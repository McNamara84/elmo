<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/services/DataCiteRelationType.php';
require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

final class DataCiteRelationTypeTest extends TestCase
{
    public function testCanonicalValuesMatchBundledDataCiteSchema(): void
    {
        $schema = new \DOMDocument();
        self::assertTrue(
            $schema->load(__DIR__ . '/../schemas/DataCite/include/datacite-relationType-v4.xsd')
        );
        $xpath = new \DOMXPath($schema);
        $xpath->registerNamespace('xs', 'http://www.w3.org/2001/XMLSchema');
        $schemaValues = [];

        foreach ($xpath->query('//xs:enumeration/@value') as $value) {
            $schemaValues[] = $value->nodeValue;
        }

        self::assertSame($schemaValues, \DataCiteRelationType::values());
    }

    public function testCanonicalTokensAndExplicitLabelsRoundTrip(): void
    {
        foreach (\DataCiteRelationType::values() as $canonical) {
            self::assertSame($canonical, \DataCiteRelationType::canonicalize($canonical));
            self::assertSame(
                $canonical,
                \DataCiteRelationType::canonicalize(\DataCiteRelationType::label($canonical))
            );
        }
    }

    public function testUnknownRelationLabelsAreNotGuessed(): void
    {
        self::assertNull(\DataCiteRelationType::canonicalize('Made Available By'));
        self::assertNull(\DataCiteRelationType::canonicalize('Is referenced by'));
        self::assertSame('Made Available By', \DataCiteRelationType::label('Made Available By'));
    }

    public function testFreshInstallSeedsContainOnlyCanonicalRelationTypes(): void
    {
        $installSource = file_get_contents(__DIR__ . '/../scripts/install.php');
        self::assertIsString($installSource);
        self::assertSame(
            1,
            preg_match('/"Relation"\s*=>\s*\[(.*?)\],\s*"Identifier_Type"\s*=>/s', $installSource, $section)
        );
        self::assertGreaterThan(
            0,
            preg_match_all('/\["name"\s*=>\s*"([^"]+)"/', $section[1], $matches)
        );

        $seedNames = $matches[1];
        self::assertContains('IsReferencedBy', $seedNames);
        self::assertContains('IsDocumentedBy', $seedNames);
        self::assertNotContains('Is Referenced By', $seedNames);
        self::assertNotContains('Is Documented By', $seedNames);

        foreach ($seedNames as $seedName) {
            self::assertContains($seedName, \DataCiteRelationType::values());
        }
    }

    public function testErnieNormalizationSeparatesCanonicalNameAndDisplayLabel(): void
    {
        $controller = (new \ReflectionClass(\VocabController::class))->newInstanceWithoutConstructor();
        $method = (new \ReflectionClass($controller))->getMethod('normalizeRelationTypesFromErnie');

        $normalized = $method->invoke($controller, [
            ['id' => 17, 'name' => 'Is Referenced By', 'description' => 'References this resource'],
            ['id' => 18, 'name' => 'IsDocumentedBy', 'description' => 'Documents this resource'],
            ['id' => 999, 'name' => 'Made Available By', 'description' => 'Not a DataCite relation'],
        ]);

        self::assertSame([
            [
                'id' => 17,
                'name' => 'IsReferencedBy',
                'description' => 'References this resource',
                'label' => 'Is Referenced By',
            ],
            [
                'id' => 18,
                'name' => 'IsDocumentedBy',
                'description' => 'Documents this resource',
                'label' => 'Is Documented By',
            ],
        ], $normalized);
    }

    public function testForwardXsltMapsKnownLegacyLabelsToSchemaValidTokens(): void
    {
        $dataCiteXml = $this->transformRelatedWorks([
            ['10.1234/referenced', 'Is Referenced By'],
            ['10.1234/documented', 'Is Documented By'],
        ]);
        $xpath = $this->dataCiteXPath($dataCiteXml);
        $relations = $xpath->query('//dc:relatedIdentifier/@relationType');

        self::assertSame('IsReferencedBy', $relations->item(0)->nodeValue);
        self::assertSame('IsDocumentedBy', $relations->item(1)->nodeValue);
        $this->assertSchemaValidity($dataCiteXml, true);
    }

    public function testForwardXsltLeavesUnknownLegacyLabelUnchanged(): void
    {
        $dataCiteXml = $this->transformRelatedWorks([
            ['10.1234/unknown', 'Made Available By'],
        ]);
        $xpath = $this->dataCiteXPath($dataCiteXml);

        self::assertSame(
            'Made Available By',
            $xpath->evaluate('string(//dc:relatedIdentifier/@relationType)')
        );
        $this->assertSchemaValidity($dataCiteXml, false);
    }

    /**
     * @param list<array{0: string, 1: string}> $relatedWorks
     */
    private function transformRelatedWorks(array $relatedWorks): string
    {
        $relatedWorkXml = '';
        foreach ($relatedWorks as [$identifier, $relation]) {
            $identifier = htmlspecialchars($identifier, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $relation = htmlspecialchars($relation, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $relatedWorkXml .= <<<XML
<RelatedWork>
    <Identifier>{$identifier}</Identifier>
    <Relation><name>{$relation}</name></Relation>
    <IdentifierType><name>DOI</name></IdentifierType>
</RelatedWork>
XML;
        }

        $sourceXml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <doi>10.5880/GFZ.TEST.RELATION.TYPES</doi>
    <year>2026</year>
    <dateCreated>2026-09-18</dateCreated>
    <ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType>
    <Language><code>en</code></Language>
    <Titles><Title><text>Relation Type Regression</text><type>Main Title</type></Title></Titles>
    <Descriptions><Description><description>Relation type test</description><type>Abstract</type></Description></Descriptions>
    <Authors><Author><familyname>Tester</familyname><givenname>Case</givenname></Author></Authors>
    <ContactPersons/>
    <RelatedWorks>{$relatedWorkXml}</RelatedWorks>
</Resource>
XML;

        $reflection = new \ReflectionClass(\DatasetController::class);
        /** @var \DatasetController $controller */
        $controller = $reflection->newInstanceWithoutConstructor();

        return $controller->transformResourceXmlString($sourceXml, 'datacite');
    }

    private function dataCiteXPath(string $xml): \DOMXPath
    {
        $dom = new \DOMDocument();
        self::assertTrue($dom->loadXML($xml));
        $xpath = new \DOMXPath($dom);
        $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');

        return $xpath;
    }

    private function assertSchemaValidity(string $xml, bool $expected): void
    {
        $dom = new \DOMDocument();
        self::assertTrue($dom->loadXML($xml));
        $previousSetting = libxml_use_internal_errors(true);
        libxml_clear_errors();

        try {
            $valid = $dom->schemaValidate(__DIR__ . '/../schemas/DataCite/DataCiteSchema47.xsd');
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousSetting);
        }

        self::assertSame($expected, $valid);
    }
}
