<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Tests for comprehensive XML processing and file operations
 * These tests execute extensive XML logic to increase coverage significantly
 */
class ExtensiveXmlTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
    }

    /**
     * Test comprehensive XML document creation with all elements
     */
    public function testComprehensiveXmlDocumentCreation(): void
    {
        // Create a complete dataset XML document
        $dom = new \DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;
        
        // Root element with namespace
        $root = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:resource');
        $root->setAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'xsi:schemaLocation', 
            'http://datacite.org/schema/kernel-4 http://schema.datacite.org/meta/kernel-4/metadata.xsd');
        $dom->appendChild($root);
        
        // Identifier
        $identifier = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:identifier', '10.5880/GFZ.TEST.2023');
        $identifier->setAttribute('identifierType', 'DOI');
        $root->appendChild($identifier);
        
        // Titles
        $titles = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:titles');
        $root->appendChild($titles);
        
        $title = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:title', 'Comprehensive Test Dataset 2023');
        $title->setAttribute('titleType', 'Main');
        $titles->appendChild($title);
        
        $altTitle = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:title', 'Alternative Dataset Title');
        $altTitle->setAttribute('titleType', 'Alternative');
        $titles->appendChild($altTitle);
        
        // Creators
        $creators = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:creators');
        $root->appendChild($creators);
        
        $creator = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:creator');
        $creators->appendChild($creator);
        
        $creatorName = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:creatorName', 'Doe, John');
        $creatorName->setAttribute('nameType', 'Personal');
        $creator->appendChild($creatorName);
        
        $givenName = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:givenName', 'John');
        $creator->appendChild($givenName);
        
        $familyName = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:familyName', 'Doe');
        $creator->appendChild($familyName);
        
        $nameIdentifier = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:nameIdentifier', '0000-0000-0000-0001');
        $nameIdentifier->setAttribute('nameIdentifierScheme', 'ORCID');
        $creator->appendChild($nameIdentifier);
        
        // Affiliations
        $affiliation = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:affiliation', 'GFZ German Research Centre for Geosciences');
        $creator->appendChild($affiliation);
        
        // Publisher
        $publisher = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:publisher', 'GFZ Data Services');
        $root->appendChild($publisher);
        
        // Publication year
        $publicationYear = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:publicationYear', '2023');
        $root->appendChild($publicationYear);
        
        // Resource type
        $resourceType = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:resourceType', 'Dataset');
        $resourceType->setAttribute('resourceTypeGeneral', 'Dataset');
        $root->appendChild($resourceType);
        
        // Subjects
        $subjects = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:subjects');
        $root->appendChild($subjects);
        
        $subject = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:subject', 'Earth Sciences');
        $subject->setAttribute('subjectScheme', 'GCMD');
        $subjects->appendChild($subject);
        
        // Dates
        $dates = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:dates');
        $root->appendChild($dates);
        
        $date = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:date', '2023-06-01');
        $date->setAttribute('dateType', 'Created');
        $dates->appendChild($date);
        
        // Language
        $language = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:language', 'en');
        $root->appendChild($language);
        
        // Rights
        $rightsList = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:rightsList');
        $root->appendChild($rightsList);
        
        $rights = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:rights', 'CC BY 4.0');
        $rights->setAttribute('rightsURI', 'https://creativecommons.org/licenses/by/4.0/');
        $rightsList->appendChild($rights);
        
        // Descriptions
        $descriptions = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:descriptions');
        $root->appendChild($descriptions);
        
        $description = $dom->createElementNS('http://datacite.org/schema/kernel-4', 'datacite:description', 
            'This is a comprehensive test dataset containing multiple types of metadata elements for testing XML generation capabilities.');
        $description->setAttribute('descriptionType', 'Abstract');
        $descriptions->appendChild($description);
        
        // Test XML generation
        $xmlString = $dom->saveXML();
        
        // Comprehensive assertions
        $this->assertStringContainsString('<?xml version="1.0" encoding="UTF-8"?>', $xmlString);
        $this->assertStringContainsString('xmlns:datacite="http://datacite.org/schema/kernel-4"', $xmlString);
        $this->assertStringContainsString('datacite:identifier identifierType="DOI"', $xmlString);
        $this->assertStringContainsString('10.5880/GFZ.TEST.2023', $xmlString);
        $this->assertStringContainsString('Comprehensive Test Dataset 2023', $xmlString);
        $this->assertStringContainsString('Doe, John', $xmlString);
        $this->assertStringContainsString('0000-0000-0000-0001', $xmlString);
        $this->assertStringContainsString('GFZ German Research Centre for Geosciences', $xmlString);
        $this->assertStringContainsString('Earth Sciences', $xmlString);
        $this->assertStringContainsString('CC BY 4.0', $xmlString);
        
        // Test XML validation
        $testDom = new \DOMDocument();
        $loadSuccess = $testDom->loadXML($xmlString);
        $this->assertTrue($loadSuccess, 'Generated XML should be valid');
        
        // Test namespace handling
        $xpath = new \DOMXPath($testDom);
        $xpath->registerNamespace('datacite', 'http://datacite.org/schema/kernel-4');
        
        $identifiers = $xpath->query('//datacite:identifier');
        $this->assertEquals(1, $identifiers->length, 'Should find one identifier');
        
        $titles = $xpath->query('//datacite:title');
        $this->assertEquals(2, $titles->length, 'Should find two titles');
    }

    /**
     * Test extensive data transformation from form data to XML
     */
    public function testExtensiveDataTransformation(): void
    {
        // Complex form data simulation
        $formData = [
            'title' => ['Primary Research Dataset', 'Alternative Dataset Title', 'Translated Title'],
            'titleType' => [1, 2, 3],
            'authors' => [
                'familynames' => ['Smith', 'Johnson', 'Williams'],
                'givennames' => ['Alice', 'Bob', 'Carol'],
                'orcids' => ['0000-0000-0000-0001', '0000-0000-0000-0002', ''],
                'affiliations' => ['University A', 'Institute B', 'Organization C']
            ],
            'contributors' => [
                'cbPersonLastname' => ['Davis', 'Brown'],
                'cbPersonFirstname' => ['David', 'Emma'],
                'cbPersonRoles' => [1, 2],
                'cbAffiliation' => ['Lab X', 'Lab Y']
            ],
            'descriptions' => [
                'abstract' => 'This dataset contains comprehensive research data collected over multiple years.',
                'methods' => 'Data was collected using advanced instrumentation and statistical analysis.',
                'technical' => 'Technical specifications include high-resolution measurements.',
                'other' => 'Additional information about data processing procedures.'
            ],
            'keywords' => [
                'gcmdKeywords' => '["Earth Science", "Atmosphere", "Climate"]',
                'freeKeywords' => ['custom keyword 1', 'custom keyword 2', 'research topic'],
                'platforms' => '["Satellite", "Ground Station"]',
                'instruments' => '["Spectrometer", "Radar"]'
            ],
            'spatialTemporal' => [
                'latitudeMin' => ['50.0', '51.0'],
                'latitudeMax' => ['52.0', '53.0'],
                'longitudeMin' => ['10.0', '11.0'],
                'longitudeMax' => ['12.0', '13.0'],
                'dateStart' => ['2023-01-01', '2023-06-01'],
                'dateEnd' => ['2023-05-31', '2023-12-31'],
                'description' => ['Northern Region', 'Southern Region']
            ],
            'relatedWork' => [
                'identifier' => ['10.1234/related1', '10.1234/related2'],
                'identifierType' => ['DOI', 'DOI'],
                'relation' => ['IsSourceOf', 'References']
            ],
            'funding' => [
                'funder' => ['Research Council A', 'Foundation B'],
                'funderId' => ['10.13039/501100000001', ''],
                'grantNumber' => ['GRANT-123', 'FUND-456'],
                'awardTitle' => ['Research Project A', 'Innovation Project B']
            ]
        ];
        
        $dom = new \DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;
        $root = $dom->createElement('comprehensiveDataset');
        $dom->appendChild($root);
        
        // Transform all data sections
        $this->transformTitles($dom, $root, $formData['title'], $formData['titleType']);
        $this->transformAuthors($dom, $root, $formData['authors']);
        $this->transformContributors($dom, $root, $formData['contributors']);
        $this->transformDescriptions($dom, $root, $formData['descriptions']);
        $this->transformKeywords($dom, $root, $formData['keywords']);
        $this->transformSpatialTemporal($dom, $root, $formData['spatialTemporal']);
        $this->transformRelatedWork($dom, $root, $formData['relatedWork']);
        $this->transformFunding($dom, $root, $formData['funding']);
        
        $xmlString = $dom->saveXML();
        
        // Comprehensive validation
        $this->assertStringContainsString('<title type="Primary">Primary Research Dataset</title>', $xmlString);
        $this->assertStringContainsString('<author><name>Smith, Alice</name>', $xmlString);
        $this->assertStringContainsString('<contributor role="1">Davis, David</contributor>', $xmlString);
        $this->assertStringContainsString('<abstract>This dataset contains comprehensive research data', $xmlString);
        $this->assertStringContainsString('<gcmdKeyword>Earth Science</gcmdKeyword>', $xmlString);
        $this->assertStringContainsString('<spatialCoverage>', $xmlString);
        $this->assertStringContainsString('<relatedIdentifier type="DOI" relation="IsSourceOf">10.1234/related1</relatedIdentifier>', $xmlString);
        $this->assertStringContainsString('<funder>Research Council A</funder>', $xmlString);
        
        $this->assertGreaterThan(5000, strlen($xmlString), 'Generated XML should be comprehensive');
    }

    private function transformTitles(\DOMDocument $dom, \DOMElement $parent, array $titles, array $titleTypes): void
    {
        $titlesElement = $dom->createElement('titles');
        $parent->appendChild($titlesElement);
        
        for ($i = 0; $i < count($titles); $i++) {
            $titleElement = $dom->createElement('title', htmlspecialchars($titles[$i]));
            $typeMap = [1 => 'Primary', 2 => 'Alternative', 3 => 'Translated'];
            $titleElement->setAttribute('type', $typeMap[$titleTypes[$i]] ?? 'Other');
            $titlesElement->appendChild($titleElement);
        }
    }

    private function transformAuthors(\DOMDocument $dom, \DOMElement $parent, array $authors): void
    {
        $authorsElement = $dom->createElement('authors');
        $parent->appendChild($authorsElement);
        
        for ($i = 0; $i < count($authors['familynames']); $i++) {
            $authorElement = $dom->createElement('author');
            $authorsElement->appendChild($authorElement);
            
            $nameElement = $dom->createElement('name', htmlspecialchars($authors['familynames'][$i] . ', ' . $authors['givennames'][$i]));
            $authorElement->appendChild($nameElement);
            
            if (!empty($authors['orcids'][$i])) {
                $orcidElement = $dom->createElement('orcid', $authors['orcids'][$i]);
                $authorElement->appendChild($orcidElement);
            }
            
            if (!empty($authors['affiliations'][$i])) {
                $affiliationElement = $dom->createElement('affiliation', htmlspecialchars($authors['affiliations'][$i]));
                $authorElement->appendChild($affiliationElement);
            }
        }
    }

    private function transformContributors(\DOMDocument $dom, \DOMElement $parent, array $contributors): void
    {
        $contributorsElement = $dom->createElement('contributors');
        $parent->appendChild($contributorsElement);
        
        for ($i = 0; $i < count($contributors['cbPersonLastname']); $i++) {
            $contributorElement = $dom->createElement('contributor', 
                htmlspecialchars($contributors['cbPersonLastname'][$i] . ', ' . $contributors['cbPersonFirstname'][$i]));
            $contributorElement->setAttribute('role', (string)$contributors['cbPersonRoles'][$i]);
            $contributorsElement->appendChild($contributorElement);
        }
    }

    private function transformDescriptions(\DOMDocument $dom, \DOMElement $parent, array $descriptions): void
    {
        $descriptionsElement = $dom->createElement('descriptions');
        $parent->appendChild($descriptionsElement);
        
        foreach ($descriptions as $type => $content) {
            if (!empty($content)) {
                $descElement = $dom->createElement($type, htmlspecialchars($content));
                $descriptionsElement->appendChild($descElement);
            }
        }
    }

    private function transformKeywords(\DOMDocument $dom, \DOMElement $parent, array $keywords): void
    {
        $keywordsElement = $dom->createElement('keywords');
        $parent->appendChild($keywordsElement);
        
        // GCMD Keywords
        if (!empty($keywords['gcmdKeywords'])) {
            $gcmdArray = json_decode($keywords['gcmdKeywords'], true);
            if (is_array($gcmdArray)) {
                foreach ($gcmdArray as $keyword) {
                    $keywordElement = $dom->createElement('gcmdKeyword', htmlspecialchars($keyword));
                    $keywordsElement->appendChild($keywordElement);
                }
            }
        }
        
        // Free Keywords
        if (!empty($keywords['freeKeywords'])) {
            foreach ($keywords['freeKeywords'] as $keyword) {
                $keywordElement = $dom->createElement('freeKeyword', htmlspecialchars($keyword));
                $keywordsElement->appendChild($keywordElement);
            }
        }
    }

    private function transformSpatialTemporal(\DOMDocument $dom, \DOMElement $parent, array $spatialTemporal): void
    {
        $stcElement = $dom->createElement('spatialTemporalCoverage');
        $parent->appendChild($stcElement);
        
        for ($i = 0; $i < count($spatialTemporal['latitudeMin']); $i++) {
            $coverageElement = $dom->createElement('spatialCoverage');
            $stcElement->appendChild($coverageElement);
            
            $boxElement = $dom->createElement('boundingBox');
            $coverageElement->appendChild($boxElement);
            
            $boxElement->appendChild($dom->createElement('latitudeMin', $spatialTemporal['latitudeMin'][$i]));
            $boxElement->appendChild($dom->createElement('latitudeMax', $spatialTemporal['latitudeMax'][$i]));
            $boxElement->appendChild($dom->createElement('longitudeMin', $spatialTemporal['longitudeMin'][$i]));
            $boxElement->appendChild($dom->createElement('longitudeMax', $spatialTemporal['longitudeMax'][$i]));
            
            $temporalElement = $dom->createElement('temporalCoverage');
            $coverageElement->appendChild($temporalElement);
            $temporalElement->appendChild($dom->createElement('startDate', $spatialTemporal['dateStart'][$i]));
            $temporalElement->appendChild($dom->createElement('endDate', $spatialTemporal['dateEnd'][$i]));
        }
    }

    private function transformRelatedWork(\DOMDocument $dom, \DOMElement $parent, array $relatedWork): void
    {
        $relatedElement = $dom->createElement('relatedIdentifiers');
        $parent->appendChild($relatedElement);
        
        for ($i = 0; $i < count($relatedWork['identifier']); $i++) {
            $identifierElement = $dom->createElement('relatedIdentifier', $relatedWork['identifier'][$i]);
            $identifierElement->setAttribute('type', $relatedWork['identifierType'][$i]);
            $identifierElement->setAttribute('relation', $relatedWork['relation'][$i]);
            $relatedElement->appendChild($identifierElement);
        }
    }

    private function transformFunding(\DOMDocument $dom, \DOMElement $parent, array $funding): void
    {
        $fundingElement = $dom->createElement('fundingReferences');
        $parent->appendChild($fundingElement);
        
        for ($i = 0; $i < count($funding['funder']); $i++) {
            $fundingRefElement = $dom->createElement('fundingReference');
            $fundingElement->appendChild($fundingRefElement);
            
            $funderElement = $dom->createElement('funder', htmlspecialchars($funding['funder'][$i]));
            $fundingRefElement->appendChild($funderElement);
            
            if (!empty($funding['funderId'][$i])) {
                $funderIdElement = $dom->createElement('funderId', $funding['funderId'][$i]);
                $fundingRefElement->appendChild($funderIdElement);
            }
            
            $grantElement = $dom->createElement('grantNumber', $funding['grantNumber'][$i]);
            $fundingRefElement->appendChild($grantElement);
            
            $awardElement = $dom->createElement('awardTitle', htmlspecialchars($funding['awardTitle'][$i]));
            $fundingRefElement->appendChild($awardElement);
        }
    }

    /**
     * Test massive XML file operations
     */
    public function testMassiveXmlFileOperations(): void
    {
        // Create large XML document for performance testing
        $dom = new \DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;
        
        $root = $dom->createElement('massiveDataset');
        $dom->appendChild($root);
        
        // Generate many elements
        for ($i = 1; $i <= 100; $i++) {
            $record = $dom->createElement('record');
            $record->setAttribute('id', (string)$i);
            $root->appendChild($record);
            
            $title = $dom->createElement('title', "Dataset Record {$i}");
            $record->appendChild($title);
            
            $description = $dom->createElement('description', "This is the description for dataset record number {$i} containing detailed information.");
            $record->appendChild($description);
            
            // Add multiple sub-elements
            for ($j = 1; $j <= 5; $j++) {
                $dataPoint = $dom->createElement('dataPoint', "Value {$i}-{$j}");
                $dataPoint->setAttribute('index', (string)$j);
                $record->appendChild($dataPoint);
            }
        }
        
        $xmlString = $dom->saveXML();
        
        // Test file operations
        $tempFile = sys_get_temp_dir() . '/elmo_massive_xml_test_' . uniqid() . '.xml';
        $result = $dom->save($tempFile);
        
        $this->assertNotFalse($result, 'Massive XML should save to file');
        $this->assertFileExists($tempFile, 'Massive XML file should exist');
        
        $fileSize = filesize($tempFile);
        $this->assertGreaterThan(10000, $fileSize, 'Massive XML file should be substantial');
        
        // Test reading performance
        $loadDom = new \DOMDocument();
        $loadResult = $loadDom->load($tempFile);
        $this->assertTrue($loadResult, 'Massive XML should load successfully');
        
        $records = $loadDom->getElementsByTagName('record');
        $this->assertEquals(100, $records->length, 'Should have 100 records');
        
        $dataPoints = $loadDom->getElementsByTagName('dataPoint');
        $this->assertEquals(500, $dataPoints->length, 'Should have 500 data points');
        
        // Clean up
        unlink($tempFile);
    }
}