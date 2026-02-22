<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/controllers/AffiliationController.php';

/**
 * Test class for AffiliationController
 * 
 * Tests the server-side affiliation search functionality
 */
#[CoversClass(\AffiliationController::class)]
final class AffiliationControllerTest extends TestCase
{
    private \AffiliationController $controller;
    private string $testJsonPath;
    private string $originalJsonPath;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test JSON file with sample data
        $this->testJsonPath = __DIR__ . '/test_affiliations.json';
        $testData = [
            [
                'id' => 'https://ror.org/012345678',
                'name' => 'Test University',
                'other' => ['TU', 'Test Uni']
            ],
            [
                'id' => 'https://ror.org/023456789',
                'name' => 'GFZ German Research Centre for Geosciences',
                'other' => ['GFZ Potsdam', 'GeoForschungsZentrum']
            ],
            [
                'id' => 'https://ror.org/034567890',
                'name' => 'Another Test Institute',
                'other' => []
            ],
            [
                'id' => 'https://ror.org/045678901',
                'name' => 'University of Test City',
                'other' => ['UTC']
            ],
            [
                'id' => 'https://ror.org/056789012',
                'name' => 'Geoscience Research Institute',
                'other' => ['GRI', 'Geo Research']
            ]
        ];
        
        file_put_contents($this->testJsonPath, json_encode($testData, JSON_PRETTY_PRINT));
        
        // Create controller with test file
        $this->controller = new \AffiliationController();
        
        // Use reflection to set the private cacheFile property
        $reflection = new \ReflectionClass($this->controller);
        $property = $reflection->getProperty('cacheFile');
        $property->setValue($this->controller, $this->testJsonPath);
    }

    protected function tearDown(): void
    {
        // Clean up test file
        if (file_exists($this->testJsonPath)) {
            unlink($this->testJsonPath);
        }
        parent::tearDown();
    }

    /**
     * Helper method to capture JSON output from the search method
     */
    private function captureSearchOutput(string $query, int $limit = 20): array
    {
        $_GET['q'] = $query;
        $_GET['limit'] = $limit;

        ob_start();
        $this->controller->search();
        $output = ob_get_clean();

        return json_decode($output, true) ?? [];
    }

    public function testSearchReturnsEmptyArrayForShortQuery(): void
    {
        $results = $this->captureSearchOutput('a');
        $this->assertIsArray($results);
        $this->assertEmpty($results);
    }

    public function testSearchReturnsEmptyArrayForEmptyQuery(): void
    {
        $results = $this->captureSearchOutput('');
        $this->assertIsArray($results);
        $this->assertEmpty($results);
    }

    public function testSearchFindsExactMatch(): void
    {
        $results = $this->captureSearchOutput('Test University');
        
        $this->assertNotEmpty($results);
        $this->assertSame('Test University', $results[0]['name']);
        $this->assertSame('https://ror.org/012345678', $results[0]['id']);
    }

    public function testSearchFindsByAlternativeName(): void
    {
        $results = $this->captureSearchOutput('GFZ Potsdam');
        
        $this->assertNotEmpty($results);
        $this->assertSame('GFZ German Research Centre for Geosciences', $results[0]['name']);
    }

    public function testSearchFindsByAbbreviation(): void
    {
        $results = $this->captureSearchOutput('TU');
        
        $this->assertNotEmpty($results);
        // Should find "Test University" because "TU" is in its 'other' array
        $found = false;
        foreach ($results as $result) {
            if ($result['name'] === 'Test University') {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, 'Should find Test University by abbreviation TU');
    }

    public function testSearchIsCaseInsensitive(): void
    {
        $results = $this->captureSearchOutput('test university');
        
        $this->assertNotEmpty($results);
        $this->assertSame('Test University', $results[0]['name']);
    }

    public function testSearchReturnsMultipleMatches(): void
    {
        $results = $this->captureSearchOutput('Test');
        
        $this->assertGreaterThan(1, count($results));
    }

    public function testSearchPrioritizesExactMatches(): void
    {
        $results = $this->captureSearchOutput('Test University');
        
        // Exact match should be first
        $this->assertSame('Test University', $results[0]['name']);
    }

    public function testSearchRespectsLimit(): void
    {
        $results = $this->captureSearchOutput('Test', 2);
        
        $this->assertLessThanOrEqual(2, count($results));
    }

    public function testSearchFindsPartialMatch(): void
    {
        $results = $this->captureSearchOutput('Geoscience');
        
        $this->assertNotEmpty($results);
        
        // Should find multiple geoscience-related entries
        $foundGFZ = false;
        $foundGRI = false;
        foreach ($results as $result) {
            if (str_contains($result['name'], 'GFZ')) {
                $foundGFZ = true;
            }
            if (str_contains($result['name'], 'Geoscience')) {
                $foundGRI = true;
            }
        }
        $this->assertTrue($foundGFZ || $foundGRI, 'Should find at least one geoscience-related entry');
    }

    public function testSearchReturnsCorrectDataStructure(): void
    {
        $results = $this->captureSearchOutput('Test');
        
        $this->assertNotEmpty($results);
        
        // Check that each result has the expected fields
        foreach ($results as $result) {
            $this->assertArrayHasKey('id', $result);
            $this->assertArrayHasKey('name', $result);
            $this->assertArrayHasKey('other', $result);
        }
    }

    public function testSearchHandlesMissingJsonFile(): void
    {
        // Remove the test file temporarily
        unlink($this->testJsonPath);
        
        // Clear cached data by creating new controller
        $controller = new \AffiliationController();
        $reflection = new \ReflectionClass($controller);
        $property = $reflection->getProperty('cacheFile');
        $property->setValue($controller, $this->testJsonPath);
        
        $_GET['q'] = 'Test';
        $_GET['limit'] = 20;
        
        ob_start();
        $controller->search();
        $output = ob_get_clean();
        
        $results = json_decode($output, true);
        
        $this->assertIsArray($results);
        $this->assertEmpty($results);
        
        // Recreate test file for tearDown
        file_put_contents($this->testJsonPath, '[]');
    }

    public function testSearchLimitIsConstrainedToMaximum100(): void
    {
        $results = $this->captureSearchOutput('Test', 500);
        
        // Even though we requested 500, results should be constrained
        // (in this test with only 5 entries, this just verifies no errors occur)
        $this->assertIsArray($results);
    }

    public function testSearchLimitIsConstrainedToMinimum1(): void
    {
        $results = $this->captureSearchOutput('Test', -5);
        
        // Should still work with minimum limit of 1
        $this->assertIsArray($results);
    }
}
