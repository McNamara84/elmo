<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

if (!defined('UNIT_TESTING')) {
    define('UNIT_TESTING', true);
}

require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

#[CoversClass(\DatasetController::class)]
final class DatasetControllerJsonLdExportTest extends TestCase
{
    public function testTransformResourceToJsonLdReturnsCompactDataCiteShape(): void
    {
        $xml = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.9999/example</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, John</creatorName>
      <givenName>John</givenName>
      <familyName>Doe</familyName>
    </creator>
  </creators>
  <titles>
    <title>Test Dataset Title</title>
  </titles>
  <publicationYear>2024</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <subjects>
    <subject>Earth Science</subject>
  </subjects>
  <fundingReferences>
    <fundingReference>
      <funderName>Test Funder</funderName>
    </fundingReference>
  </fundingReferences>
  <relatedIdentifiers>
    <relatedIdentifier relatedIdentifierType="DOI" relationType="IsCitedBy">10.1234/test</relatedIdentifier>
  </relatedIdentifiers>
</resource>
XML;

        $controller = $this->getMockBuilder(\DatasetController::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['transformAndSaveOrDownloadXml'])
            ->getMock();

        $controller->method('transformAndSaveOrDownloadXml')
            ->with(123, 'datacite', false)
            ->willReturn($xml);

        $json = $controller->transformResourceToJsonLd(123);
        $payload = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame('https://schema.stage.datacite.org/linked-data/context/fullcontext.jsonld', $payload['@context']);
        $this->assertSame('Test Dataset Title', $payload['titles']['title']['value']);
        $this->assertSame('Doe, John', $payload['creators']['creator']['creatorName']['value']);
        $this->assertSame('John', $payload['creators']['creator']['givenName']['value']);
        $this->assertSame('2024', $payload['publicationYear']['value']);
        $this->assertSame('Dataset', $payload['resourceType']['attrs']['resourceTypeGeneral']);
        $this->assertSame('Earth Science', $payload['subjects']['subject']['value']);
        $this->assertSame('Test Funder', $payload['fundingReferences']['fundingReference']['funderName']['value']);
        $this->assertSame('10.1234/test', $payload['relatedIdentifiers']['relatedIdentifier']['value']);
    }
}