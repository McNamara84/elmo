<?php

declare(strict_types=1);

namespace Tests;

use DOMDocument;
use DOMXPath;
use PHPUnit\Framework\TestCase;
use SimpleXMLElement;
use XSLTProcessor;

if (!defined('UNIT_TESTING')) {
    define('UNIT_TESTING', true);
}

require_once __DIR__ . '/../includes/save_to_db_helper.php';
require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
require_once __DIR__ . '/../api/v2/controllers/ICGEMController.php';

final class RelatedWorkRoundTripTest extends TestCase
{
    public function testDataCiteImportPayloadExportAndReimportPreserveRelatedWorksAndInstruments(): void
    {
        $uploadedDataCite = $this->dataCiteXml([
            ['10.1234/first', 'IsReferencedBy', 'DOI'],
            ['https://example.org/documentation?a=1&b=2', 'IsDocumentedBy', 'URL'],
            ['21.11157/instrument-a', 'IsCollectedBy', 'Handle'],
            ['10.5555/instrument-b', 'IsCollectedBy', 'DOI'],
        ]);

        $normalRelatedWorks = $this->reverseTransform($uploadedDataCite, true);
        self::assertSame([
            ['10.1234/first', 'IsReferencedBy', 'DOI'],
            ['https://example.org/documentation?a=1&b=2', 'IsDocumentedBy', 'URL'],
        ], $normalRelatedWorks);

        $postData = [
            'relatedWorksPayload' => json_encode(array_map(
                static fn (array $entry): array => [
                    'identifier' => $entry[0],
                    'relation' => $entry[1],
                    'identifierType' => $entry[2],
                ],
                $normalRelatedWorks
            ), JSON_THROW_ON_ERROR),
        ];
        $resourceXml = applyRelatedWorksPayloadToResourceXmlString(
            $this->resourceXmlWithInstruments(),
            $postData,
            true
        );

        $controller = (new \ReflectionClass(\DatasetController::class))->newInstanceWithoutConstructor();
        $exportedDataCite = $controller->transformResourceXmlString($resourceXml, 'datacite');

        self::assertSame([
            ['10.1234/first', 'IsReferencedBy', 'DOI'],
            ['https://example.org/documentation?a=1&b=2', 'IsDocumentedBy', 'URL'],
            ['21.11157/instrument-a', 'IsCollectedBy', 'Handle'],
            ['10.5555/instrument-b', 'IsCollectedBy', 'DOI'],
        ], $this->dataCiteRelatedIdentifiers($exportedDataCite));
        self::assertSame($normalRelatedWorks, $this->reverseTransform($exportedDataCite, true));
        self::assertSame(
            $this->dataCiteRelatedIdentifiers($exportedDataCite),
            $this->reverseTransform($exportedDataCite, false)
        );
        $this->assertDataCiteSchemaValid($exportedDataCite);
    }

    public function testIcgemEnvelopeKeepsEachRelatedWorkAndInstrumentExactlyOnce(): void
    {
        $dataCiteXml = $this->dataCiteXml([
            ['10.1234/normal', 'References', 'DOI'],
            ['21.11157/instrument', 'IsCollectedBy', 'Handle'],
        ]);
        $controller = new class($dataCiteXml) extends \ICGEMController {
            public function __construct(private readonly string $dataCiteXml)
            {
                $this->connection = new \mysqli();
                $this->logger = null;
            }

            protected function getGGMData(\mysqli $connection, int $resource_id): ?array
            {
                return [];
            }

            public function transformAndSaveOrDownloadXml(
                $id,
                $format,
                $download = false,
                ?string $sourceXmlString = null
            ): string {
                return $this->dataCiteXml;
            }

            public function getDataSources(\mysqli $connection, int $resource_id): array
            {
                return [];
            }

            public function getTopographicModelProperties(\mysqli $connection, int $resource_id): array
            {
                return [];
            }

            public function getTemporalModelProperties(\mysqli $connection, int $resource_id): array
            {
                return [];
            }

            public function getStaticModelProperties(\mysqli $connection, int $resource_id): array
            {
                return [];
            }

            public function getEllipsoidalParameters(\mysqli $connection, int $resource_id): array
            {
                return [];
            }

            protected function insertContact(SimpleXMLElement $icgempart, int $id): void
            {
            }

            protected function insertDescriptions(SimpleXMLElement $xml, int $id): void
            {
            }
        };

        $envelope = $controller->createICGEMxml(42);

        self::assertSame([
            ['10.1234/normal', 'References', 'DOI'],
            ['21.11157/instrument', 'IsCollectedBy', 'Handle'],
        ], $this->dataCiteRelatedIdentifiers($envelope));
    }

    /**
     * @param list<array{0: string, 1: string, 2: string}> $relatedWorks
     */
    private function dataCiteXml(array $relatedWorks): string
    {
        $relatedIdentifierXml = '';
        foreach ($relatedWorks as [$identifier, $relation, $identifierType]) {
            $identifier = htmlspecialchars($identifier, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $relation = htmlspecialchars($relation, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $identifierType = htmlspecialchars($identifierType, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $relatedIdentifierXml .= sprintf(
                '<relatedIdentifier relatedIdentifierType="%s" relationType="%s">%s</relatedIdentifier>',
                $identifierType,
                $relation,
                $identifier
            );
        }

        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.5880/GFZ.RELATED.WORK.ROUNDTRIP</identifier>
  <creators><creator><creatorName nameType="Personal">Tester, Case</creatorName><givenName>Case</givenName><familyName>Tester</familyName></creator></creators>
  <titles><title>Related Work Roundtrip</title></titles>
  <publisher>GFZ Data Services</publisher>
  <publicationYear>2026</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <relatedIdentifiers>{$relatedIdentifierXml}</relatedIdentifiers>
</resource>
XML;
    }

    private function resourceXmlWithInstruments(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
  <doi>10.5880/GFZ.RELATED.WORK.ROUNDTRIP</doi>
  <year>2026</year>
  <dateCreated>2026-09-18</dateCreated>
  <ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType>
  <Language><code>en</code></Language>
  <Titles><Title><text>Related Work Roundtrip</text><type>Main Title</type></Title></Titles>
  <Descriptions><Description><description>Roundtrip test</description><type>Abstract</type></Description></Descriptions>
  <Authors><Author><familyname>Tester</familyname><givenname>Case</givenname></Author></Authors>
  <ContactPersons/>
  <RelatedWorks>
    <RelatedWork><Identifier>21.11157/instrument-a</Identifier><Relation><name>IsCollectedBy</name></Relation><IdentifierType><name>Handle</name></IdentifierType></RelatedWork>
    <RelatedWork><Identifier>10.5555/instrument-b</Identifier><Relation><name>IsCollectedBy</name></Relation><IdentifierType><name>DOI</name></IdentifierType></RelatedWork>
  </RelatedWorks>
</Resource>
XML;
    }

    /**
     * @return list<array{0: string, 1: string, 2: string}>
     */
    private function reverseTransform(string $xml, bool $excludeIsCollectedBy): array
    {
        $source = new DOMDocument();
        self::assertTrue($source->loadXML($xml, LIBXML_NONET));
        $stylesheet = new DOMDocument();
        self::assertTrue($stylesheet->load(
            __DIR__ . '/../schemas/XSLT/MappingDataCiteRelatedWorksToMap.xslt',
            LIBXML_NONET
        ));
        $processor = new XSLTProcessor();
        self::assertTrue($processor->importStylesheet($stylesheet));
        self::assertTrue($processor->setParameter(
            '',
            'excludeIsCollectedBy',
            $excludeIsCollectedBy ? 'true' : 'false'
        ));
        $result = $processor->transformToDoc($source);
        self::assertInstanceOf(DOMDocument::class, $result);

        $entries = [];
        $xpath = new DOMXPath($result);
        foreach ($xpath->query('/RelatedWorks/RelatedWork') as $work) {
            $entries[] = [
                trim($xpath->evaluate('string(Identifier)', $work)),
                trim($xpath->evaluate('string(Relation/name)', $work)),
                trim($xpath->evaluate('string(IdentifierType/name)', $work)),
            ];
        }

        return $entries;
    }

    /**
     * @return list<array{0: string, 1: string, 2: string}>
     */
    private function dataCiteRelatedIdentifiers(string $xml): array
    {
        $document = new DOMDocument();
        self::assertTrue($document->loadXML($xml, LIBXML_NONET));
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');
        $entries = [];

        foreach ($xpath->query('//dc:relatedIdentifiers/dc:relatedIdentifier') as $identifier) {
            $entries[] = [
                trim($identifier->textContent),
                $identifier->getAttribute('relationType'),
                $identifier->getAttribute('relatedIdentifierType'),
            ];
        }

        return $entries;
    }

    private function assertDataCiteSchemaValid(string $xml): void
    {
        $document = new DOMDocument();
        self::assertTrue($document->loadXML($xml, LIBXML_NONET));
        $previousSetting = libxml_use_internal_errors(true);
        libxml_clear_errors();

        try {
            $valid = $document->schemaValidate(__DIR__ . '/../schemas/DataCite/DataCiteSchema47.xsd');
            $errors = array_map(
                static fn (\LibXMLError $error): string => trim($error->message),
                libxml_get_errors()
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousSetting);
        }

        self::assertTrue($valid, implode(PHP_EOL, $errors));
    }
}
