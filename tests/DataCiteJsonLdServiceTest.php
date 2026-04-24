<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

final class DataCiteJsonLdServiceTest extends TestCase
{
    private \DataCiteJsonLdService $service;

    protected function setUp(): void
    {
        require_once __DIR__ . '/../api/v2/services/DataCiteJsonLdService.php';
        $this->service = new \DataCiteJsonLdService();
    }

    public function testConvertsDataCiteXmlToCompactJsonLdArray(): void
    {
        $xml = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI">10.9999/example</identifier>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, Jane</creatorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-2345-6789</nameIdentifier>
      <affiliation affiliationIdentifier="https://ror.org/04wxnsj81" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">Example University</affiliation>
    </creator>
  </creators>
  <titles>
    <title xml:lang="en">Example Dataset</title>
    <title titleType="Subtitle" xml:lang="en">Secondary Title</title>
  </titles>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear>2026</publicationYear>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" rightsURI="https://creativecommons.org/licenses/by/4.0/" xml:lang="en">Creative Commons Attribution 4.0 International</rights>
  </rightsList>
</resource>
XML;

        $result = $this->service->convertXmlStringToArray($xml);

        $this->assertSame('https://schema.stage.datacite.org/linked-data/context/fullcontext.jsonld', $result['@context']);
        $this->assertSame('https://doi.org/10.9999/example', $result['@id']);
        $this->assertSame('DOI', $result['identifier']['attrs']['identifierType']);
        $this->assertSame('10.9999/example', $result['identifier']['value']);
        $this->assertSame('Doe, Jane', $result['creators']['creator']['creatorName']['value']);
        $this->assertSame('Personal', $result['creators']['creator']['creatorName']['attrs']['nameType']);
        $this->assertSame('Jane', $result['creators']['creator']['givenName']['value']);
        $this->assertSame('Example University', $result['creators']['creator']['affiliation']['value']);
        $this->assertSame('https://ror.org/04wxnsj81', $result['creators']['creator']['affiliation']['attrs']['affiliationIdentifier']);
        $this->assertCount(2, $result['titles']['title']);
        $this->assertSame('en', $result['titles']['title'][0]['attrs']['lang']);
        $this->assertSame('Subtitle', $result['titles']['title'][1]['attrs']['titleType']);
        $this->assertSame('GFZ Data Services', $result['publisher']['value']);
        $this->assertSame('2026', $result['publicationYear']['value']);
        $this->assertSame('Dataset', $result['resourceType']['attrs']['resourceTypeGeneral']);
        $this->assertSame('CC-BY-4.0', $result['rightsList']['rights']['attrs']['rightsIdentifier']);
    }

    public function testConvertsDataCiteXmlToPrettyPrintedJsonLdString(): void
    {
        $xml = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.9999/example</identifier>
  <publicationYear>2026</publicationYear>
</resource>
XML;

        $json = $this->service->convertXmlStringToJsonLd($xml);
        $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

        $this->assertStringContainsString("\n    \"identifier\"", $json);
        $this->assertSame('10.9999/example', $decoded['identifier']['value']);
        $this->assertSame('2026', $decoded['publicationYear']['value']);
    }
}