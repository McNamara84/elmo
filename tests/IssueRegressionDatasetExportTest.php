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

    private function resourceXmlWithCoverage(
        ?string $dateCreated = '2026-01-01',
        string $dateStart = '2026-01-01',
        ?string $dateEnd = '2026-12-31'
    ): string {
        $dateCreatedElement = $dateCreated === null ? '' : "<dateCreated>{$dateCreated}</dateCreated>";
        $dateEndElement = $dateEnd === null ? '' : "<dateEnd>{$dateEnd}</dateEnd>";

        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <doi>10.5880/GFZ.TEST.ISSUES.880.929</doi>
    <year>2026</year>
    <currentDate>2026-06-25</currentDate>
    {$dateCreatedElement}
    <ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType>
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
