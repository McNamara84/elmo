<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/services/LicenseService.php';

#[CoversClass(\LicenseService::class)]
final class LicenseServiceTest extends TestCase
{
    #[DataProvider('responseFixtures')]
    public function testValidResponsesPreserveMetadataAndOrder(string $fixture, array $ids): void
    {
        $json = file_get_contents(__DIR__ . '/fixtures/ernie-licenses/' . $fixture);
        $licenses = \LicenseService::decodeLicenses($json);

        self::assertSame($ids, array_column($licenses, 'id'));
        self::assertSame(json_decode($json, true, 512, JSON_THROW_ON_ERROR), $licenses);
    }

    public static function responseFixtures(): array
    {
        return [
            'ELMO catalog including custom rights' => ['catalog-elmo.json', [101, 202, 9001, 301]],
            'MSL catalog differs from ELMO' => ['catalog-elmo-msl.json', [202, 301]],
            'dataset' => ['dataset-elmo.json', [101, 9001]],
            'MSL dataset' => ['dataset-elmo-msl.json', [202]],
            'software' => ['software-elmo.json', [301]],
            'revoked CC BY' => ['dataset-elmo-after-revocation.json', [9001]],
            'successful empty grant' => ['empty.json', []],
        ];
    }

    public function testErrorDocumentIsNotAnEmptySuccessfulGrant(): void
    {
        $this->expectException(\UnexpectedValueException::class);
        \LicenseService::decodeLicenses(file_get_contents(__DIR__ . '/fixtures/ernie-licenses/unauthorized.json'));
    }

    #[DataProvider('invalidDocuments')]
    public function testMalformedAndNonListDocumentsAreRejected(string $json): void
    {
        $this->expectException(\UnexpectedValueException::class);
        \LicenseService::decodeLicenses($json);
    }

    public static function invalidDocuments(): array
    {
        return [
            'empty object' => ['{}'],
            'wrapped list' => ['{"data":[]}'],
            'numeric object keys' => ['{"0":{}}'],
            'null' => ['null'],
            'boolean' => ['true'],
            'integer' => ['101'],
            'string' => ['"MIT"'],
            'empty body' => [''],
            'truncated JSON' => ['[{"id":101}'],
            'HTML' => ['<html>Bad Gateway</html>'],
            'invalid UTF-8' => ["[\"\xFF\"]"],
            'array row' => ['[[]]'],
            'null row' => ['[null]'],
            'string row' => ['["MIT"]'],
        ];
    }

    #[DataProvider('invalidFields')]
    public function testAnyInvalidRowRejectsTheWholeResponse(string $field, mixed $value, bool $missing = false): void
    {
        $valid = self::license();
        $invalid = self::license();
        $invalid['id'] = 999;
        if ($missing) {
            unset($invalid[$field]);
        } else {
            $invalid[$field] = $value;
        }

        $this->expectException(\UnexpectedValueException::class);
        \LicenseService::decodeLicenses(json_encode([$valid, $invalid], JSON_THROW_ON_ERROR));
    }

    public static function invalidFields(): iterable
    {
        foreach (['id', 'identifier', 'name', 'uri', 'scheme_uri'] as $field) {
            yield 'missing ' . $field => [$field, null, true];
        }
        foreach ([0, -1, '1', 1.5, true, null, [], new \stdClass()] as $index => $value) {
            yield 'invalid id ' . $index => ['id', $value];
        }
        foreach (['identifier', 'name'] as $field) {
            foreach (['', " \t\n", null, 7, false, [], new \stdClass()] as $index => $value) {
                yield 'invalid ' . $field . ' ' . $index => [$field, $value];
            }
        }
        foreach (['uri', 'scheme_uri'] as $field) {
            foreach ([
                '', true, 123, [], new \stdClass(), 'relative/path', '//example.org/license',
                'https:', 'https://', 'https:///license', 'https://exa mple.org',
                'https://example.org:99999/license', 'https://example.org/%xy',
                "https://example.org/\nlicense", 'https://example.org/<license>',
                'https://example.org/\license', 'https://example.org/{license}',
                'ftp://', '1scheme:license',
            ] as $index => $value) {
                yield 'invalid ' . $field . ' ' . $index => [$field, $value];
            }
        }
    }

    public function testOverflowingIdIsRejected(): void
    {
        $this->expectException(\UnexpectedValueException::class);
        \LicenseService::decodeLicenses('[{"id":9999999999999999999999999999,"identifier":"MIT","name":"MIT","uri":null,"scheme_uri":null}]');
    }

    #[DataProvider('validUris')]
    public function testNullableAndAbsoluteUrisArePreserved(?string $uri): void
    {
        $license = self::license();
        $license['uri'] = $uri;
        $license['scheme_uri'] = $uri;
        self::assertSame([$license], self::decode([$license]));
    }

    public static function validUris(): array
    {
        return [
            [null],
            ['https://example.org/licenses/custom%20license?version=1#terms'],
            ['http://example.org/license'],
            ['ftp://example.org/license.txt'],
            ['ftps://example.org/license.txt'],
            ['urn:example:license:2026'],
            ['mailto:licensing@example.org'],
        ];
    }

    public function testAdditionalFieldsAreIgnoredWithoutInventingLicenseMetadata(): void
    {
        $license = self::license();
        $result = self::decode([$license + ['is_active' => false, 'forSoftware' => 1, 'future' => ['key' => 'value']]]);
        self::assertSame([$license], $result);
    }

    public function testIdenticalDuplicatesAreCollapsedInOriginalOrder(): void
    {
        $first = self::license();
        $second = array_replace($first, ['id' => 2, 'identifier' => 'CC0-1.0']);
        self::assertSame([$first, $second], self::decode([$first, $second, $first]));
    }

    public function testConflictingMetadataForOneIdRejectsTheResponse(): void
    {
        $license = self::license();
        $this->expectException(\UnexpectedValueException::class);
        $this->expectExceptionMessage('Conflicting ERNIE license ID');
        self::decode([$license, array_replace($license, ['uri' => 'https://example.org/changed'])]);
    }

    #[DataProvider('conflictingIdentifiers')]
    public function testAmbiguousIdentifierRejectsTheResponse(?string $scheme, string $identifier): void
    {
        $first = self::license();
        $second = array_replace($first, ['id' => 999, 'identifier' => $identifier, 'scheme_uri' => $scheme]);
        $this->expectException(\UnexpectedValueException::class);
        $this->expectExceptionMessage('Conflicting ERNIE license identifier');
        self::decode([$first, $second]);
    }

    public static function conflictingIdentifiers(): array
    {
        return [
            ['https://spdx.org/licenses/', 'CC-BY-4.0'],
            ['https://spdx.org/licenses/', 'cc-by-4.0'],
            ['https://spdx.org/licenses', 'cc-by-4.0'],
        ];
    }

    public function testCustomIdentifiersKeepCaseAndSchemaIdentity(): void
    {
        $first = array_replace(self::license(), ['identifier' => 'Custom-Right', 'scheme_uri' => null]);
        $second = array_replace($first, ['id' => 2, 'identifier' => 'custom-right']);
        $third = array_replace($first, ['id' => 3, 'scheme_uri' => 'urn:example:rights']);
        self::assertSame([$first, $second, $third], self::decode([$first, $second, $third]));
    }

    public function testDuplicateCustomIdentifierIsAmbiguousEvenWithDifferentNames(): void
    {
        $first = array_replace(self::license(), ['identifier' => 'custom-right', 'scheme_uri' => null]);
        $second = array_replace($first, ['id' => 2, 'name' => 'Another name']);
        $this->expectException(\UnexpectedValueException::class);
        self::decode([$first, $second]);
    }

    #[DataProvider('resourceTypes')]
    public function testCanonicalTokensAndDisplayNamesResolveToTheSameSlug(string $canonical, string $name, string $slug): void
    {
        self::assertSame($slug, \LicenseService::resourceTypeSlug($canonical));
        self::assertSame($slug, \LicenseService::resourceTypeSlug($name));
        self::assertSame($slug, \LicenseService::resourceTypeSlug(" \t" . $name . "\n"));
    }

    public static function resourceTypes(): array
    {
        return [
            ['Audiovisual', 'Audiovisual', 'audiovisual'],
            ['Award', 'Award', 'award'],
            ['Book', 'Book', 'book'],
            ['BookChapter', 'Book Chapter', 'book-chapter'],
            ['Collection', 'Collection', 'collection'],
            ['ComputationalNotebook', 'Computational Notebook', 'computational-notebook'],
            ['ConferencePaper', 'Conference Paper', 'conference-paper'],
            ['ConferenceProceeding', 'Conference Proceeding', 'conference-proceeding'],
            ['DataPaper', 'Data Paper', 'data-paper'],
            ['Dataset', 'Dataset', 'dataset'],
            ['Dissertation', 'Dissertation', 'dissertation'],
            ['Event', 'Event', 'event'],
            ['Image', 'Image', 'image'],
            ['Instrument', 'Instrument', 'instrument'],
            ['InteractiveResource', 'Interactive Resource', 'interactive-resource'],
            ['Journal', 'Journal', 'journal'],
            ['JournalArticle', 'Journal Article', 'journal-article'],
            ['Model', 'Model', 'model'],
            ['OutputManagementPlan', 'Output Management Plan', 'output-management-plan'],
            ['PeerReview', 'Peer Review', 'peer-review'],
            ['PhysicalObject', 'Physical Object', 'physical-object'],
            ['Poster', 'Poster', 'poster'],
            ['Preprint', 'Preprint', 'preprint'],
            ['Presentation', 'Presentation', 'presentation'],
            ['Project', 'Project', 'project'],
            ['Report', 'Report', 'report'],
            ['Service', 'Service', 'service'],
            ['Software', 'Software', 'software'],
            ['Sound', 'Sound', 'sound'],
            ['Standard', 'Standard', 'standard'],
            ['StudyRegistration', 'Study Registration', 'study-registration'],
            ['Text', 'Text', 'text'],
            ['Workflow', 'Workflow', 'workflow'],
            ['Other', 'Other', 'other'],
        ];
    }

    public function testResolverCoversEveryBundledDataCiteResourceType(): void
    {
        $schema = new \DOMDocument();
        self::assertTrue($schema->load(__DIR__ . '/../schemas/DataCite/include/datacite-resourceType-v4.xsd'));
        $xpath = new \DOMXPath($schema);
        $xpath->registerNamespace('xs', 'http://www.w3.org/2001/XMLSchema');
        $types = [];
        foreach ($xpath->query('//xs:enumeration/@value') as $value) {
            $types[] = $value->nodeValue;
            self::assertNotNull(\LicenseService::resourceTypeSlug($value->nodeValue));
        }
        self::assertSame($types, array_column(self::resourceTypes(), 0));
    }

    #[DataProvider('unknownResourceTypes')]
    public function testUnknownNamesAndPathsAreNotGuessed(string $name): void
    {
        self::assertNull(\LicenseService::resourceTypeSlug($name));
    }

    public static function unknownResourceTypes(): array
    {
        return [
            [''], [' '], ['Unknown Type'], ['dataset'], ['Bookchapter'], ['Book  Chapter'],
            ['book-chapter'], ['../dataset'], ['Software?editor=elmo-msl'], ['Dataset/../../software'],
        ];
    }

    private static function license(): array
    {
        return [
            'id' => 101,
            'identifier' => 'CC-BY-4.0',
            'name' => 'Creative Commons Attribution 4.0 International',
            'uri' => 'https://creativecommons.org/licenses/by/4.0/',
            'scheme_uri' => 'https://spdx.org/licenses/',
        ];
    }

    private static function decode(array $licenses): array
    {
        return \LicenseService::decodeLicenses(json_encode($licenses, JSON_THROW_ON_ERROR));
    }
}
