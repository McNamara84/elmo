<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

final class IssueRegressionDatasetExportTest extends DatabaseTestCase
{
    private \DatasetController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new \DatasetController();
    }

    public function testDataCiteTransformPreservesAwardUriWithoutGrantNumberForIssue1147(): void
    {
        $sourceXml = $this->resourceXmlWithCoverage(fundingReferences: <<<'XML'
<FundingReferences>
    <FundingReference>
        <funder>Example Foundation</funder>
        <awarduri>https://example.org/award?x=1&amp;y=2</awarduri>
    </FundingReference>
</FundingReferences>
XML);

        $dataciteXml = $this->controller->transformResourceXmlString($sourceXml, 'datacite');
        $xpath = $this->dataCiteXPath($dataciteXml);
        $awardNumbers = $xpath->query(
            '//dc:fundingReference[dc:funderName = \'Example Foundation\']/dc:awardNumber'
        );

        $this->assertSame(1, $awardNumbers->length);
        $this->assertSame('', trim($awardNumbers->item(0)->textContent));
        $this->assertSame(
            'https://example.org/award?x=1&y=2',
            $awardNumbers->item(0)->getAttribute('awardURI')
        );
        $this->assertDataCiteSchemaValid($dataciteXml);
    }

    public function testDataCiteTransformDoesNotDuplicateAwardNumberForIssue1147(): void
    {
        $sourceXml = $this->resourceXmlWithCoverage(fundingReferences: <<<'XML'
<FundingReferences>
    <FundingReference>
        <funder>Numbered Foundation</funder>
        <grantnumber>GRANT-1147</grantnumber>
        <awarduri>https://example.org/award/1147</awarduri>
    </FundingReference>
</FundingReferences>
XML);

        $dataciteXml = $this->controller->transformResourceXmlString($sourceXml, 'datacite');
        $xpath = $this->dataCiteXPath($dataciteXml);
        $awardNumbers = $xpath->query(
            '//dc:fundingReference[dc:funderName = \'Numbered Foundation\']/dc:awardNumber'
        );

        $this->assertSame(1, $awardNumbers->length);
        $this->assertSame('GRANT-1147', trim($awardNumbers->item(0)->textContent));
        $this->assertSame(
            'https://example.org/award/1147',
            $awardNumbers->item(0)->getAttribute('awardURI')
        );
    }

    public function testDataCiteTransformKeepsAwardUrisAssignedToTheirFundingReferencesForIssue1147(): void
    {
        $sourceXml = $this->resourceXmlWithCoverage(fundingReferences: <<<'XML'
<FundingReferences>
    <FundingReference>
        <funder>URI Only Foundation</funder>
        <awarduri>https://example.org/uri-only</awarduri>
    </FundingReference>
    <FundingReference>
        <funder>Numbered Foundation</funder>
        <grantnumber>GRANT-2</grantnumber>
        <grantname>Second Award</grantname>
        <awarduri>https://example.org/numbered</awarduri>
    </FundingReference>
    <FundingReference>
        <funder>Title Only Foundation</funder>
        <grantname>Third Award</grantname>
    </FundingReference>
</FundingReferences>
XML);

        $dataciteXml = $this->controller->transformResourceXmlString($sourceXml, 'datacite');
        $xpath = $this->dataCiteXPath($dataciteXml);

        $this->assertFundingAward($xpath, 'URI Only Foundation', '', 'https://example.org/uri-only');
        $this->assertFundingAward($xpath, 'Numbered Foundation', 'GRANT-2', 'https://example.org/numbered');
        $this->assertSame(
            0,
            $xpath->query(
                '//dc:fundingReference[dc:funderName = \'Title Only Foundation\']/dc:awardNumber'
            )->length
        );
    }

    public function testDataCiteTransformOmitsEmptyCreatedDateForIssue929(): void
    {
        $dataciteXml = $this->controller->transformResourceXmlString(
            $this->resourceXmlWithCoverage(dateCreated: null),
            'datacite'
        );
        $xpath = $this->dataCiteXPath($dataciteXml);

        $createdDates = $xpath->query('//dc:dates/dc:date[@dateType="Created"]');

        $this->assertSame(0, $createdDates->length, 'Missing Date Created must not produce an empty DataCite Created date.');
    }

    public function testDataCiteTransformDoesNotAddSubmittedForNormalExportForIssue929(): void
    {
        $dataciteXml = $this->controller->transformResourceXmlString(
            $this->resourceXmlWithCoverage(),
            'datacite'
        );
        $xpath = $this->dataCiteXPath($dataciteXml);

        $submittedDates = $xpath->query('//dc:dates/dc:date[@dateType="Submitted"]');

        $this->assertSame(0, $submittedDates->length, 'Normal exports must not claim that the dataset was submitted.');
    }

    public function testDataCiteEnvelopeCanBeMarkedSubmittedForSubmitFlowForIssue929(): void
    {
        $this->assertTrue(
            method_exists($this->controller, 'markDataCiteEnvelopeAsSubmitted'),
            'DatasetController should expose a submit-flow helper that adds dateType="Submitted" after normal export generation.'
        );

        if (!method_exists($this->controller, 'markDataCiteEnvelopeAsSubmitted')) {
            return;
        }

        $submittedXml = $this->controller->markDataCiteEnvelopeAsSubmitted(
            $this->dataCiteEnvelopeXml(),
            '2026-06-25'
        );
        $xpath = $this->dataCiteXPath($submittedXml);
        $submittedDates = $xpath->query('//dc:dates/dc:date[@dateType="Submitted"]');

        $this->assertSame(1, $submittedDates->length);
        $this->assertSame('2026-06-25', trim($submittedDates->item(0)->textContent));
    }

    public function testDataCiteTransformEmitsDateOnlyCoverageIntervalForIssue880(): void
    {
        $dataciteXml = $this->controller->transformResourceXmlString(
            $this->resourceXmlWithCoverage(dateStart: '2026-01-01', dateEnd: '2026-12-31'),
            'datacite'
        );

        $this->assertSame(
            ['2026-01-01/2026-12-31'],
            $this->coverageDateValues($dataciteXml)
        );
    }

    public function testDataCiteTransformEmitsOpenCoverageIntervalForStartOnlyIssue880(): void
    {
        $dataciteXml = $this->controller->transformResourceXmlString(
            $this->resourceXmlWithCoverage(dateStart: '2026-06-12', dateEnd: null),
            'datacite'
        );

        $this->assertSame(
            ['2026-06-12/'],
            $this->coverageDateValues($dataciteXml)
        );
    }

    public function testDataCiteTransformNormalizesErnieResourceTypeLabelsForIssue1182(): void
    {
        $resourceTypes = [
            'Computational Notebook' => 'ComputationalNotebook',
            'Data Paper' => 'DataPaper',
            'Interactive Resource' => 'InteractiveResource',
        ];
        $schemaResourceTypes = $this->dataCite47ResourceTypes();

        foreach ($resourceTypes as $label => $resourceTypeGeneral) {
            $this->assertContains(
                $resourceTypeGeneral,
                $schemaResourceTypes,
                "{$resourceTypeGeneral} must be defined by the bundled DataCite 4.7 schema."
            );

            $dataciteXml = $this->controller->transformResourceXmlString(
                $this->resourceXmlWithCoverage(resourceType: $label),
                'datacite'
            );
            $resourceType = $this->dataCiteXPath($dataciteXml)
                ->query('//dc:resourceType')
                ->item(0);

            $this->assertNotNull($resourceType);
            $this->assertSame($resourceTypeGeneral, $resourceType->getAttribute('resourceTypeGeneral'));
            $this->assertSame($label, trim($resourceType->textContent));
            $this->assertDataCiteSchemaValid($dataciteXml);
        }
    }

    public function testDataCiteTransformPreservesEverySchema47ResourceType(): void
    {
        foreach ($this->dataCite47ResourceTypes() as $resourceTypeGeneral) {
            $dataciteXml = $this->controller->transformResourceXmlString(
                $this->resourceXmlWithCoverage(resourceType: $resourceTypeGeneral),
                'datacite'
            );
            $resourceType = $this->dataCiteXPath($dataciteXml)
                ->query('//dc:resourceType')
                ->item(0);

            $this->assertNotNull($resourceType);
            $this->assertSame(
                $resourceTypeGeneral,
                $resourceType->getAttribute('resourceTypeGeneral'),
                "DataCite 4.7 resource type {$resourceTypeGeneral} must remain unchanged."
            );
            $this->assertSame($resourceTypeGeneral, trim($resourceType->textContent));
            $this->assertDataCiteSchemaValid($dataciteXml);
        }
    }

    /**
     * @return array<int, string>
     */
    private function coverageDateValues(string $dataciteXml): array
    {
        $xpath = $this->dataCiteXPath($dataciteXml);
        $values = [];

        foreach ($xpath->query('//dc:dates/dc:date[@dateType="Coverage"]') as $date) {
            $values[] = trim($date->textContent);
        }

        return $values;
    }

    private function dataCiteXPath(string $xml): \DOMXPath
    {
        $dom = new \DOMDocument();
        $dom->loadXML($xml);
        $xpath = new \DOMXPath($dom);
        $xpath->registerNamespace('dc', 'http://datacite.org/schema/kernel-4');

        return $xpath;
    }

    private function assertFundingAward(
        \DOMXPath $xpath,
        string $funderName,
        string $awardNumber,
        string $awardUri
    ): void {
        $fundingReferences = $xpath->query('//dc:fundingReference');
        $matchingAward = null;

        foreach ($fundingReferences as $fundingReference) {
            $name = $xpath->query('dc:funderName', $fundingReference)->item(0);
            if ($name === null || trim($name->textContent) !== $funderName) {
                continue;
            }

            $matchingAward = $xpath->query('dc:awardNumber', $fundingReference)->item(0);
            break;
        }

        $this->assertNotNull($matchingAward, "Missing awardNumber for {$funderName}.");
        $this->assertSame($awardNumber, trim($matchingAward->textContent));
        $this->assertSame($awardUri, $matchingAward->getAttribute('awardURI'));
    }

    private function assertDataCiteSchemaValid(string $xml): void
    {
        $dom = new \DOMDocument();
        $this->assertTrue($dom->loadXML($xml));

        $previousSetting = libxml_use_internal_errors(true);
        libxml_clear_errors();

        try {
            $isValid = $dom->schemaValidate(__DIR__ . '/../schemas/DataCite/DataCiteSchema47.xsd');
            $errors = array_map(
                static fn (\LibXMLError $error): string => trim($error->message),
                libxml_get_errors()
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousSetting);
        }

        $this->assertTrue($isValid, implode(PHP_EOL, $errors));
    }

    /**
     * @return list<string>
     */
    private function dataCite47ResourceTypes(): array
    {
        $schema = new \DOMDocument();
        $this->assertTrue(
            $schema->load(__DIR__ . '/../schemas/DataCite/include/datacite-resourceType-v4.xsd')
        );
        $xpath = new \DOMXPath($schema);
        $xpath->registerNamespace('xs', 'http://www.w3.org/2001/XMLSchema');
        $resourceTypes = [];

        foreach ($xpath->query('//xs:simpleType[@name="resourceType"]//xs:enumeration/@value') as $value) {
            $resourceTypes[] = $value->nodeValue;
        }

        $this->assertCount(34, $resourceTypes, 'The bundled DataCite 4.7 resource type list changed.');

        return $resourceTypes;
    }

    private function resourceXmlWithCoverage(
        ?string $dateCreated = '2026-01-01',
        string $dateStart = '2026-01-01',
        ?string $dateEnd = '2026-12-31',
        string $fundingReferences = '',
        string $resourceType = 'Dataset'
    ): string {
        $dateCreatedElement = $dateCreated === null ? '' : "<dateCreated>{$dateCreated}</dateCreated>";
        $dateEndElement = $dateEnd === null ? '' : "<dateEnd>{$dateEnd}</dateEnd>";
        $resourceTypeElement = htmlspecialchars($resourceType, ENT_XML1 | ENT_QUOTES, 'UTF-8');

        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <doi>10.5880/GFZ.TEST.ISSUES.880.929</doi>
    <year>2026</year>
    <currentDate>2026-06-25</currentDate>
    {$dateCreatedElement}
    <ResourceType><resource_type_general>{$resourceTypeElement}</resource_type_general></ResourceType>
    <Language><code>en</code></Language>
    <Titles><Title><text>Issue Regression Dataset</text><type>Main Title</type></Title></Titles>
    <Descriptions><Description><description>Regression test dataset</description><type>Abstract</type></Description></Descriptions>
    <Authors>
        <Author><familyname>Tester</familyname><givenname>Case</givenname></Author>
    </Authors>
    <ContactPersons/>
    <SpatialTemporalCoverages>
        <SpatialTemporalCoverage>
            <latitudeMin>-90</latitudeMin>
            <latitudeMax>90</latitudeMax>
            <longitudeMin>-180</longitudeMin>
            <longitudeMax>180</longitudeMax>
            <description>Global coverage</description>
            <dateStart>{$dateStart}</dateStart>
            {$dateEndElement}
        </SpatialTemporalCoverage>
    </SpatialTemporalCoverages>
    {$fundingReferences}
</Resource>
XML;
    }

    private function dataCiteEnvelopeXml(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<envelope>
    <resource xmlns="http://datacite.org/schema/kernel-4">
        <identifier identifierType="DOI">10.5880/GFZ.TEST.SUBMITTED</identifier>
        <creators>
            <creator>
                <creatorName nameType="Personal">Tester, Case</creatorName>
            </creator>
        </creators>
        <titles><title>Issue 929 Submit Test</title></titles>
        <publisher>GFZ Data Services</publisher>
        <publicationYear>2026</publicationYear>
        <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
        <dates>
            <date dateType="Created">2026-01-01</date>
        </dates>
    </resource>
</envelope>
XML;
    }
}
