<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/save_to_db_helper.php';
require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

final class RelatedWorkPayloadXmlTest extends TestCase
{
    public function testPayloadReplacesStoredRelatedWorksInCardOrder(): void
    {
        $updatedXml = applyRelatedWorksPayloadToResourceXmlString(
            $this->resourceXml(),
            [
                'relatedWorksPayload' => json_encode([
                    [
                        'entryKey' => 'related-work-second',
                        'order' => 99,
                        'identifier' => '10.1234/first&current',
                        'relation' => 'IsReferencedBy',
                        'relationId' => '17',
                        'identifierType' => 'DOI',
                    ],
                    [
                        'entryKey' => 'related-work-incomplete',
                        'identifier' => '10.1234/incomplete',
                        'relation' => '',
                        'identifierType' => 'DOI',
                    ],
                    [
                        'entryKey' => 'related-work-first',
                        'order' => 0,
                        'identifier' => 'https://example.org/report?a=1&b=2',
                        'relation' => 'IsDocumentedBy',
                        'relationId' => '18',
                        'identifierType' => 'URL',
                    ],
                ], JSON_THROW_ON_ERROR),
            ]
        );

        $xpath = $this->resourceXPath($updatedXml);
        $works = $xpath->query('/Resource/RelatedWorks/RelatedWork');

        self::assertCount(2, $works);
        self::assertSame('10.1234/first&current', $xpath->evaluate('string(Identifier)', $works->item(0)));
        self::assertSame('IsReferencedBy', $xpath->evaluate('string(Relation/name)', $works->item(0)));
        self::assertSame('DOI', $xpath->evaluate('string(IdentifierType/name)', $works->item(0)));
        self::assertSame(
            'https://example.org/report?a=1&b=2',
            $xpath->evaluate('string(Identifier)', $works->item(1))
        );
        self::assertStringNotContainsString('stored.example', $updatedXml);
        self::assertStringNotContainsString('10.1234/incomplete', $updatedXml);
    }

    public function testExplicitEmptyPayloadRemovesStoredRelatedWorksContainer(): void
    {
        $updatedXml = applyRelatedWorksPayloadToResourceXmlString(
            $this->resourceXml(),
            ['relatedWorksPayload' => '[]']
        );

        self::assertSame(0, $this->resourceXPath($updatedXml)->query('/Resource/RelatedWorks')->length);
    }

    public function testMalformedPayloadIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        applyRelatedWorksPayloadToResourceXmlString(
            $this->resourceXml(),
            ['relatedWorksPayload' => '{not-json}']
        );
    }

    public function testCurrentFormPayloadsShareOneDatabaseResourceXml(): void
    {
        $connection = new \mysqli();
        $controller = new class($this->resourceXml(), $connection) {
            public int $calls = 0;

            public function __construct(
                private readonly string $resourceXml,
                private readonly \mysqli $expectedConnection
            ) {
            }

            public function getResourceAsXml($connection, int $resourceId): string
            {
                ++$this->calls;
                TestCase::assertSame($this->expectedConnection, $connection);
                TestCase::assertSame(42, $resourceId);

                return $this->resourceXml;
            }
        };

        $updatedXml = buildResourceXmlWithCurrentFormPayloads(
            $connection,
            $controller,
            42,
            [
                'authorsPayload' => json_encode([
                    [
                        'type' => 'person',
                        'familyname' => 'Payload',
                        'givenname' => 'Author',
                        'orcid' => '',
                        'isContact' => false,
                        'affiliations' => [],
                    ],
                ], JSON_THROW_ON_ERROR),
                'relatedWorksPayload' => json_encode([
                    [
                        'identifier' => '10.5678/current',
                        'relation' => 'IsCitedBy',
                        'relationId' => '2',
                        'identifierType' => 'DOI',
                    ],
                ], JSON_THROW_ON_ERROR),
            ]
        );

        self::assertSame(1, $controller->calls);
        self::assertNotNull($updatedXml);
        $xpath = $this->resourceXPath($updatedXml);
        self::assertSame('Payload', $xpath->evaluate('string(/Resource/Authors/Author/familyname)'));
        self::assertSame('10.5678/current', $xpath->evaluate('string(/Resource/RelatedWorks/RelatedWork/Identifier)'));
    }

    public function testMissingPayloadsKeepDatabaseOnlyExportFallback(): void
    {
        $connection = new \mysqli();
        $controller = new class {
            public int $calls = 0;

            public function getResourceAsXml(): string
            {
                ++$this->calls;

                return '<Resource/>';
            }
        };

        self::assertNull(buildResourceXmlWithCurrentFormPayloads($connection, $controller, 1, []));
        self::assertSame(0, $controller->calls);
    }

    public function testPayloadResourceXmlFeedsDataCiteAndIsoForwardXslt(): void
    {
        $sourceXml = applyRelatedWorksPayloadToResourceXmlString(
            '<Resource><doi>10.5880/test</doi></Resource>',
            [
                'relatedWorksPayload' => json_encode([
                    [
                        'identifier' => '10.1234/first',
                        'relation' => 'IsReferencedBy',
                        'relationId' => '17',
                        'identifierType' => 'DOI',
                    ],
                    [
                        'identifier' => 'https://example.org/second',
                        'relation' => 'IsDocumentedBy',
                        'relationId' => '18',
                        'identifierType' => 'URL',
                    ],
                ], JSON_THROW_ON_ERROR),
            ]
        );

        $reflection = new \ReflectionClass(\DatasetController::class);
        /** @var \DatasetController $controller */
        $controller = $reflection->newInstanceWithoutConstructor();

        $dataCite = new \DOMDocument();
        self::assertTrue($dataCite->loadXML($controller->transformResourceXmlString($sourceXml, 'datacite')));
        $dataCiteXPath = new \DOMXPath($dataCite);
        $dataCiteXPath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');
        $relatedIdentifiers = $dataCiteXPath->query('//dc:relatedIdentifiers/dc:relatedIdentifier');

        self::assertCount(2, $relatedIdentifiers);
        self::assertSame('10.1234/first', trim($relatedIdentifiers->item(0)->textContent));
        self::assertSame('IsReferencedBy', $relatedIdentifiers->item(0)->getAttribute('relationType'));
        self::assertSame('DOI', $relatedIdentifiers->item(0)->getAttribute('relatedIdentifierType'));
        self::assertSame('https://example.org/second', trim($relatedIdentifiers->item(1)->textContent));

        $iso = new \DOMDocument();
        self::assertTrue($iso->loadXML($controller->transformResourceXmlString($sourceXml, 'iso')));
        $isoXPath = new \DOMXPath($iso);
        $aggregationInfo = $isoXPath->query('//*[local-name()="aggregationInfo"]');

        self::assertCount(2, $aggregationInfo);
        self::assertSame(
            '10.1234/first',
            trim($isoXPath->evaluate('string(.//*[local-name()="code"]/*[local-name()="CharacterString"])', $aggregationInfo->item(0)))
        );
        self::assertSame(
            'IsReferencedBy',
            $isoXPath->evaluate('string(.//*[local-name()="DS_AssociationTypeCode"]/@codeListValue)', $aggregationInfo->item(0))
        );
        self::assertSame(
            'URL',
            trim($isoXPath->evaluate('string(.//*[local-name()="codeSpace"]/*[local-name()="CharacterString"])', $aggregationInfo->item(1)))
        );
    }

    private function resourceXml(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
  <doi>10.5880/GFZ.TEST.RELATED.WORK.PAYLOAD</doi>
  <Authors>
    <Author><familyname>Stored</familyname><givenname>Author</givenname></Author>
  </Authors>
  <ContactPersons/>
  <RelatedWorks>
    <RelatedWork>
      <Identifier>https://stored.example/old</Identifier>
      <Relation><name>References</name></Relation>
      <IdentifierType><name>URL</name></IdentifierType>
    </RelatedWork>
  </RelatedWorks>
</Resource>
XML;
    }

    private function resourceXPath(string $xml): \DOMXPath
    {
        $dom = new \DOMDocument();
        self::assertTrue($dom->loadXML($xml));

        return new \DOMXPath($dom);
    }
}
