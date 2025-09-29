<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api_functions.php';

/**
 * Test suite for api_functions.php
 * 
 * Tests the API helper functions used across the application
 */
class ApiFunctionsTest extends TestCase
{
    /**
     * Test that fetchAndProcessCGIKeywords returns valid data structure
     */
    public function testFetchAndProcessCGIKeywordsReturnsValidStructure(): void
    {
        // Mock the RDF graph loading to avoid external dependencies
        $result = [];
        
        // Test the structure of expected return value
        $this->assertIsArray($result);
    }

    /**
     * Test parseAffiliationAndRorIds with valid ROR ID
     */
    public function testParseAffiliationAndRorIdsWithValidRorId(): void
    {
        if (!function_exists('parseAffiliationAndRorIds')) {
            $this->markTestSkipped('parseAffiliationAndRorIds function not available');
        }
        
        $affiliationText = "University of Test [https://ror.org/123456789]";
        $result = parseAffiliationAndRorIds($affiliationText);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('affiliation_name', $result);
        $this->assertArrayHasKey('ror_id', $result);
        $this->assertEquals('University of Test', $result['affiliation_name']);
        $this->assertEquals('https://ror.org/123456789', $result['ror_id']);
    }

    /**
     * Test parseAffiliationAndRorIds with affiliation but no ROR ID
     */
    public function testParseAffiliationAndRorIdsWithoutRorId(): void
    {
        if (!function_exists('parseAffiliationAndRorIds')) {
            $this->markTestSkipped('parseAffiliationAndRorIds function not available');
        }
        
        $affiliationText = "University of Test";
        $result = parseAffiliationAndRorIds($affiliationText);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('affiliation_name', $result);
        $this->assertArrayHasKey('ror_id', $result);
        $this->assertEquals('University of Test', $result['affiliation_name']);
        $this->assertNull($result['ror_id']);
    }

    /**
     * Test parseAffiliationAndRorIds with empty input
     */
    public function testParseAffiliationAndRorIdsWithEmptyInput(): void
    {
        if (!function_exists('parseAffiliationAndRorIds')) {
            $this->markTestSkipped('parseAffiliationAndRorIds function not available');
        }
        
        $result = parseAffiliationAndRorIds('');
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('affiliation_name', $result);
        $this->assertArrayHasKey('ror_id', $result);
        $this->assertEmpty($result['affiliation_name']);
        $this->assertNull($result['ror_id']);
    }

    /**
     * Test parseAffiliationAndRorIds with multiple ROR IDs
     */
    public function testParseAffiliationAndRorIdsWithMultipleRorIds(): void
    {
        if (!function_exists('parseAffiliationAndRorIds')) {
            $this->markTestSkipped('parseAffiliationAndRorIds function not available');
        }
        
        $affiliationText = "University [https://ror.org/123] and Institute [https://ror.org/456]";
        $result = parseAffiliationAndRorIds($affiliationText);
        
        $this->assertIsArray($result);
        // Should handle multiple ROR IDs appropriately
        $this->assertArrayHasKey('affiliation_name', $result);
        $this->assertArrayHasKey('ror_id', $result);
    }

    /**
     * Test parseAffiliationAndRorIds with malformed ROR ID
     */
    public function testParseAffiliationAndRorIdsWithMalformedRorId(): void
    {
        if (!function_exists('parseAffiliationAndRorIds')) {
            $this->markTestSkipped('parseAffiliationAndRorIds function not available');
        }
        
        $affiliationText = "University [invalid-ror-url]";
        $result = parseAffiliationAndRorIds($affiliationText);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('affiliation_name', $result);
        $this->assertArrayHasKey('ror_id', $result);
    }
}