<?php

declare(strict_types=1);

/**
 * Test to verify that the XSLT transformation adds valid gml:id attribute to gml:TimePeriod.
 * 
 * Issue #273: Add `gmd:id` attribute to `gml:TimePeriod` in Map2ISO transformation
 * 
 * This test ensures that:
 * - The XSLT correctly generates a gml:id attribute for gml:TimePeriod elements
 * - The gml:id value is valid (starts with letter/underscore, not a number)
 * - The gml:id follows the expected pattern (timePeriod-{id})
 */

use PHPUnit\Framework\TestCase;

final class IsoTimePeriodXsltTest extends TestCase
{
    /**
     * Test that XSLT generates valid gml:id attribute for gml:TimePeriod
     * 
     * @return void
     */
    public function testXsltGeneratesValidGmlIdForTimePeriod(): void
    {
        if (!class_exists('XSLTProcessor')) {
            $this->markTestSkipped('XSL extension is not available');
        }
        
        $baseDir = realpath(__DIR__ . '/..');
        $xsltPath = $baseDir . "/schemas/XSLT/MappingMapToIso.xslt";
        
        $this->assertFileExists($xsltPath, 'XSLT file should exist');
        
        // Create a minimal Freestyle XML input with spatial temporal coverage
        $freestyleXml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <resource_id>1</resource_id>
    <title>Test Resource</title>
    <resourceType>Dataset</resourceType>
    <publicationYear>2024</publicationYear>
    <doi>10.1234/test</doi>
    <SpatialTemporalCoverages>
        <SpatialTemporalCoverage>
            <spatial_temporal_coverage_id>42</spatial_temporal_coverage_id>
            <dateStart>2024-01-01</dateStart>
            <dateEnd>2024-12-31</dateEnd>
            <longitudeMin>-10.0</longitudeMin>
            <longitudeMax>10.0</longitudeMax>
            <latitudeMin>-20.0</latitudeMin>
            <latitudeMax>20.0</latitudeMax>
        </SpatialTemporalCoverage>
    </SpatialTemporalCoverages>
</Resource>
XML;

        // Load XML document and XSLT stylesheet
        $xml = new DOMDocument();
        $xml->loadXML($freestyleXml);
        
        $xsl = new DOMDocument();
        $xsl->load($xsltPath);

        // Create XSLT processor and perform transformation
        $proc = new XSLTProcessor();
        $proc->importStyleSheet($xsl);
        $result = $proc->transformToXML($xml);

        $this->assertNotFalse($result, 'XSLT transformation should succeed');
        
        // Load the result and verify gml:TimePeriod has gml:id
        $resultDom = new DOMDocument();
        $resultDom->loadXML($result);
        
        $xpath = new DOMXPath($resultDom);
        $xpath->registerNamespace('gmd', 'http://www.isotc211.org/2005/gmd');
        $xpath->registerNamespace('gml', 'http://www.opengis.net/gml');

        // Find all gml:TimePeriod elements
        $timePeriods = $xpath->query('//gml:TimePeriod');
        
        $this->assertGreaterThan(0, $timePeriods->length, 'At least one gml:TimePeriod should exist in the output');

        foreach ($timePeriods as $timePeriod) {
            // Check that gml:id attribute exists
            $this->assertTrue(
                $timePeriod->hasAttribute('gml:id'),
                'gml:TimePeriod must have a gml:id attribute'
            );
            
            $gmlId = $timePeriod->getAttribute('gml:id');
            $this->assertNotEmpty($gmlId, 'gml:id attribute should not be empty');

            // Validate that gml:id starts with a letter or underscore (valid NCName)
            $this->assertMatchesRegularExpression(
                '/^[a-zA-Z_]/',
                $gmlId,
                "gml:id must start with a letter or underscore (not a number), got: {$gmlId}"
            );

            // Validate that gml:id contains only valid NCName characters
            $this->assertMatchesRegularExpression(
                '/^[a-zA-Z_][a-zA-Z0-9_.-]*$/',
                $gmlId,
                "gml:id must be a valid NCName, got: {$gmlId}"
            );

            // Check that the ID follows our expected pattern (timePeriod-{number})
            $this->assertMatchesRegularExpression(
                '/^timePeriod-\d+$/',
                $gmlId,
                "gml:id should follow the pattern 'timePeriod-{{number}}', got: {$gmlId}"
            );
            
            // Verify it uses position-based numbering (starts at 1)
            $this->assertSame('timePeriod-1', $gmlId, 'gml:id should be timePeriod-1 for the first (and only) STC element');
        }
    }

    /**
     * Test that XSLT generates unique gml:id attributes for multiple TimePeriod elements
     * 
     * @return void
     */
    public function testXsltGeneratesUniqueGmlIdsForMultipleTimePeriods(): void
    {
        if (!class_exists('XSLTProcessor')) {
            $this->markTestSkipped('XSL extension is not available');
        }
        
        $baseDir = realpath(__DIR__ . '/..');
        $xsltPath = $baseDir . "/schemas/XSLT/MappingMapToIso.xslt";
        
        // Create Freestyle XML with multiple spatial temporal coverages
        $freestyleXml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <resource_id>1</resource_id>
    <title>Test Resource</title>
    <resourceType>Dataset</resourceType>
    <publicationYear>2024</publicationYear>
    <doi>10.1234/test</doi>
    <SpatialTemporalCoverages>
        <SpatialTemporalCoverage>
            <spatial_temporal_coverage_id>100</spatial_temporal_coverage_id>
            <dateStart>2024-01-01</dateStart>
            <dateEnd>2024-06-30</dateEnd>
            <longitudeMin>-10.0</longitudeMin>
            <longitudeMax>10.0</longitudeMax>
            <latitudeMin>-20.0</latitudeMin>
            <latitudeMax>20.0</latitudeMax>
        </SpatialTemporalCoverage>
        <SpatialTemporalCoverage>
            <spatial_temporal_coverage_id>200</spatial_temporal_coverage_id>
            <dateStart>2024-07-01</dateStart>
            <dateEnd>2024-12-31</dateEnd>
            <longitudeMin>-10.0</longitudeMin>
            <longitudeMax>10.0</longitudeMax>
            <latitudeMin>-20.0</latitudeMin>
            <latitudeMax>20.0</latitudeMax>
        </SpatialTemporalCoverage>
    </SpatialTemporalCoverages>
</Resource>
XML;

        // Load XML document and XSLT stylesheet
        $xml = new DOMDocument();
        $xml->loadXML($freestyleXml);
        
        $xsl = new DOMDocument();
        $xsl->load($xsltPath);

        // Create XSLT processor and perform transformation
        $proc = new XSLTProcessor();
        $proc->importStyleSheet($xsl);
        $result = $proc->transformToXML($xml);

        $this->assertNotFalse($result, 'XSLT transformation should succeed');
        
        // Load the result and verify gml:TimePeriod elements have unique gml:id values
        $resultDom = new DOMDocument();
        $resultDom->loadXML($result);
        
        $xpath = new DOMXPath($resultDom);
        $xpath->registerNamespace('gml', 'http://www.opengis.net/gml');

        // Find all gml:TimePeriod elements and collect their IDs
        $timePeriods = $xpath->query('//gml:TimePeriod');
        $gmlIds = [];

        $this->assertGreaterThan(1, $timePeriods->length, 'Multiple gml:TimePeriod elements should exist');

        foreach ($timePeriods as $timePeriod) {
            $gmlId = $timePeriod->getAttribute('gml:id');
            
            $this->assertNotContains(
                $gmlId, 
                $gmlIds, 
                "gml:id values must be unique within the document, duplicate found: {$gmlId}"
            );
            
            $gmlIds[] = $gmlId;
        }
        
        // Verify we got position-based IDs (1, 2, ...)
        $this->assertContains('timePeriod-1', $gmlIds, 'Should contain timePeriod-1 for first STC');
        $this->assertContains('timePeriod-2', $gmlIds, 'Should contain timePeriod-2 for second STC');
    }

    /**
     * Test that the XSLT file contains the expected pattern for gml:id generation
     * 
     * @return void
     */
    public function testXsltContainsCorrectGmlIdPattern(): void
    {
        $baseDir = realpath(__DIR__ . '/..');
        $xsltPath = $baseDir . "/schemas/XSLT/MappingMapToIso.xslt";
        
        $this->assertFileExists($xsltPath, 'XSLT file should exist');
        
        $xsltContent = file_get_contents($xsltPath);
        
        // Check that the XSLT uses position() for position-based numbering
        $this->assertStringContainsString(
            "concat('timePeriod-', position())",
            $xsltContent,
            "XSLT should contain the pattern concat('timePeriod-', position()) for generating position-based gml:id"
        );
        
        // Ensure it doesn't use the old spatial_temporal_coverage_id for gml:id
        $this->assertStringNotContainsString(
            "concat('timePeriod-', *[local-name()='spatial_temporal_coverage_id'",
            $xsltContent,
            "XSLT should not use spatial_temporal_coverage_id for gml:id (should use position() instead)"
        );
        
        // Ensure it doesn't use the old number() function for gml:id
        $this->assertStringNotContainsString(
            '<xsl:value-of select="number(*[local-name()=\'spatial_temporal_coverage_id\'',
            $xsltContent,
            "XSLT should not use number() function for gml:id (IDs must start with letter)"
        );
    }
}
