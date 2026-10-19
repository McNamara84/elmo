<?php

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/author_payload_xml.php';
require_once __DIR__ . '/../includes/contributor_payload_xml.php';
require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

/** Export-only replacement text must preserve identifiers without changing source labels. */
final class IncompleteAffiliationExportTest extends TestCase
{
    private const RESOURCE = '<Resource><doi>10.5880/GFZ.INCOMPLETE.AFFILIATIONS</doi><year>2026</year><dateCreated>2026-10-15</dateCreated><ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType><Language><code>en</code></Language><Titles><Title><text>Incomplete affiliations</text><type>Main Title</type></Title></Titles><Descriptions><Description><description>Export regression test</description><type>Abstract</type></Description></Descriptions></Resource>';

    /** @return list<array{string, string}> Person/institution cases with both supported ROR forms. */
    public static function peopleTypes(): array
    {
        return [
            ['person', '04z8jg394'], ['institution', '04z8jg394'],
            ['person', 'https://ror.org/04z8jg394'], ['institution', 'https://ror.org/04z8jg394'],
        ];
    }

    #[DataProvider('peopleTypes')]
    public function testIncompleteLabelsKeepTheirRorIdsInBothGroups(string $type, string $rorId): void
    {
        $entry = [
            'type' => $type, 'familyname' => 'Doe', 'institutionname' => 'Institute',
            'roles' => ['Researcher'],
            'affiliations' => [
                ['label' => '', 'rorId' => $rorId],
                ['label' => 'Department', 'rorId' => ''],
                ['label' => 'Named organization', 'rorId' => '012m9bp23'],
                ['label' => '', 'rorId' => ''],
            ],
        ];
        $post = [
            'authorsPayload' => json_encode([$entry], JSON_THROW_ON_ERROR),
            'contributorsPayload' => json_encode([$entry], JSON_THROW_ON_ERROR),
        ];
        $resource = applyAuthorsPayloadToResourceXmlString(self::RESOURCE, $post);
        $resource = applyContributorsPayloadToResourceXmlString($resource, $post);
        $dom = new DOMDocument();
        self::assertTrue($dom->loadXML($resource));
        $xpath = new DOMXPath($dom);
        foreach (['Authors/Author', 'Contributors/Contributor'] as $path) {
            $affiliations = "/Resource/$path/Affiliations/Affiliation";
            self::assertSame(3, $xpath->query($affiliations)->length);
            self::assertSame('https://ror.org/04z8jg394', $xpath->evaluate("string({$affiliations}[1]/name)"));
            self::assertSame('04z8jg394', $xpath->evaluate("string({$affiliations}[1]/rorId)"));
            self::assertSame('Department', $xpath->evaluate("string({$affiliations}[2]/name)"));
            self::assertSame('Named organization', $xpath->evaluate("string({$affiliations}[3]/name)"));
        }

        $controller = (new ReflectionClass(DatasetController::class))->newInstanceWithoutConstructor();
        self::assertTrue($dom->loadXML($controller->transformResourceXmlString($resource, 'datacite')));
        self::assertTrue($dom->schemaValidate(__DIR__ . '/../schemas/DataCite/DataCiteSchema47.xsd'));
        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');
        foreach (['creators/dc:creator', 'contributors/dc:contributor'] as $path) {
            $affiliation = "//dc:$path/dc:affiliation[1]";
            self::assertSame('https://ror.org/04z8jg394', $xpath->evaluate("string($affiliation/@affiliationIdentifier)"));
            self::assertSame('https://ror.org/04z8jg394', $xpath->evaluate("string($affiliation)"));
        }

        $payload = (new DataCiteJsonLdService())->convertXmlStringToArray($dom->saveXML());
        foreach ([$payload['creators']['creator'], $payload['contributors']['contributor']] as $person) {
            self::assertCount(3, $person['affiliation']);
            self::assertSame('https://ror.org/04z8jg394', $person['affiliation'][0]['value']);
            self::assertSame('https://ror.org/04z8jg394', $person['affiliation'][0]['attrs']['affiliationIdentifier']);
            self::assertSame('Department', $person['affiliation'][1]['value']);
            self::assertArrayNotHasKey('attrs', $person['affiliation'][1]);
        }

        // Normalizing the same source after exporting still returns the original empty label.
        $authors = normalizeAuthorsPayload($post);
        self::assertSame('', parseAffiliationEntries($authors[0]['affiliation_data'], $authors[0]['rorId_data'])[0]['label']);
        self::assertSame('', normalizeContributorsPayload($post)[0]['affiliations'][0]['label']);
        self::assertSame($rorId, normalizeContributorsPayload($post)[0]['affiliations'][0]['rorId']);
    }
}
