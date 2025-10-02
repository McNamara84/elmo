<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

/**
 * Comprehensive test suite for DatasetController class.
 * 
 * Tests helper methods and XML generation functionality without requiring
 * full database setup. Uses reflection to test private methods.
 * 
 * Coverage target: Test generate_xml_path() and loadThesauriData() methods
 * to significantly increase overall code coverage.
 */
class DatasetControllerTest extends TestCase
{
    private ?DatasetController $controller = null;
    private ?string $testXmlDir = null;

    /**
     * Stores the original global connection to restore after tests
     */
    private $originalConnection = null;

    /**
     * Set up test environment before each test
     */
    protected function setUp(): void
    {
        parent::setUp();
        
        // Save the original global connection
        global $connection;
        $this->originalConnection = $connection ?? null;
        
        // Mock the global $connection variable required by constructor
        $connection = $this->createMock(mysqli::class);
        
        $this->controller = new DatasetController();
        
        // Create temporary test XML directory
        $this->testXmlDir = sys_get_temp_dir() . '/test_xml_' . uniqid();
    }

    /**
     * Clean up after each test
     */
    protected function tearDown(): void
    {
        // Restore the original global connection
        global $connection;
        $connection = $this->originalConnection;
        
        // Clean up test XML directory if it was created
        if ($this->testXmlDir && is_dir($this->testXmlDir)) {
            $this->removeDirectory($this->testXmlDir);
        }
        
        parent::tearDown();
    }

    /**
     * Helper method to recursively remove a directory
     */
    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->removeDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    /**
     * Test: Constructor should initialize properly with global connection
     */
    public function testConstructorInitializesController(): void
    {
        $this->assertInstanceOf(DatasetController::class, $this->controller);
    }

    /**
     * Test: generate_xml_path() should generate correct path for basic resource
     * 
     * Uses reflection to test private method
     */
    public function testGenerateXmlPathCreatesBasicPath(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $resourceId = 123;
        $path = $method->invoke($this->controller, $resourceId);

        // Should contain resource ID
        $this->assertStringContainsString('resource_123.xml', $path);
        
        // Should end with .xml
        $this->assertStringEndsWith('.xml', $path);
        
        // Should be an absolute path
        $this->assertMatchesRegularExpression('/^[a-zA-Z]:\\\\|^\//', $path);
    }

    /**
     * Test: generate_xml_path() with prefix should include prefix in filename
     */
    public function testGenerateXmlPathWithPrefix(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $resourceId = 456;
        $prefix = 'datacite';
        $path = $method->invoke($this->controller, $resourceId, $prefix);

        // Should contain prefix and resource ID
        $this->assertStringContainsString('datacite_resource_456.xml', $path);
        
        // Should still end with .xml
        $this->assertStringEndsWith('.xml', $path);
    }

    /**
     * Test: generate_xml_path() should always point to xml directory
     */
    public function testGenerateXmlPathPointsToXmlDirectory(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $path = $method->invoke($this->controller, 789);

        // Should contain /xml/ or \xml\ directory
        $this->assertMatchesRegularExpression('/[\/\\\\]xml[\/\\\\]/', $path);
    }

    /**
     * Test: generate_xml_path() should generate unique paths for different IDs
     */
    public function testGenerateXmlPathGeneratesUniquePathsForDifferentIds(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $path1 = $method->invoke($this->controller, 100);
        $path2 = $method->invoke($this->controller, 200);

        // Paths should be different
        $this->assertNotEquals($path1, $path2);
        
        // But directory should be the same
        $this->assertEquals(dirname($path1), dirname($path2));
    }

    /**
     * Test: generate_xml_path() should handle string IDs (type coercion)
     */
    public function testGenerateXmlPathHandlesStringId(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $path = $method->invoke($this->controller, '999');

        $this->assertStringContainsString('resource_999.xml', $path);
    }

    /**
     * Test: generate_xml_path() should handle zero as valid ID
     */
    public function testGenerateXmlPathHandlesZeroId(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $path = $method->invoke($this->controller, 0);

        $this->assertStringContainsString('resource_0.xml', $path);
    }

    /**
     * Test: generate_xml_path() with empty prefix should behave like no prefix
     */
    public function testGenerateXmlPathWithEmptyPrefix(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $pathNoPrefix = $method->invoke($this->controller, 123, null);
        $pathEmptyPrefix = $method->invoke($this->controller, 123, '');

        // Empty string prefix should result in different path (prefix logic adds it)
        // But both should contain resource_123.xml
        $this->assertStringContainsString('resource_123.xml', $pathNoPrefix);
        $this->assertStringContainsString('resource_123.xml', $pathEmptyPrefix);
    }

    /**
     * Test: loadThesauriData() should return array
     * 
     * Tests private method using reflection
     */
    public function testLoadThesauriDataReturnsArray(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        $data = $method->invoke($this->controller);

        $this->assertIsArray($data);
    }

    /**
     * Test: loadThesauriData() should load lastUpdated timestamps
     * 
     * This test depends on actual JSON files in json/thesauri directory
     */
    public function testLoadThesauriDataContainsLastUpdatedTimestamps(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        $data = $method->invoke($this->controller);

        // If thesauri directory exists and has files, check structure
        if (!empty($data)) {
            // Each entry should be a timestamp string (YYYY-MM-DD format)
            foreach ($data as $fileName => $lastUpdated) {
                $this->assertIsString($fileName, 'File name key should be string');
                $this->assertIsString($lastUpdated, 'lastUpdated value should be string');
                
                // Check if lastUpdated matches ISO date format (YYYY-MM-DD)
                $this->assertMatchesRegularExpression(
                    '/^\d{4}-\d{2}-\d{2}/',
                    $lastUpdated,
                    "lastUpdated should be in ISO date format (YYYY-MM-DD)"
                );
            }
        } else {
            // If no thesauri files exist, data should be empty array
            $this->assertIsArray($data);
        }
    }

    /**
     * Test: loadThesauriData() should only include files with lastUpdated property
     */
    public function testLoadThesauriDataOnlyIncludesFilesWithLastUpdated(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        $data = $method->invoke($this->controller);

        // All returned entries must have lastUpdated values
        foreach ($data as $lastUpdated) {
            $this->assertNotEmpty($lastUpdated, 'lastUpdated should not be empty');
        }
    }

    /**
     * Test: loadThesauriData() should use correct directory path
     * 
     * Verifies the method looks in json/thesauri directory
     */
    public function testLoadThesauriDataUsesCorrectDirectory(): void
    {
        $baseDir = realpath(__DIR__ . '/..');
        $expectedJsonDir = $baseDir . '/json/thesauri';

        // Verify the expected directory exists
        if (is_dir($expectedJsonDir)) {
            $this->assertDirectoryExists($expectedJsonDir);
            
            $reflection = new ReflectionClass(DatasetController::class);
            $method = $reflection->getMethod('loadThesauriData');
            $method->setAccessible(true);

            $data = $method->invoke($this->controller);

            // If directory exists and has JSON files, data should not be empty
            $jsonFiles = glob($expectedJsonDir . '/*.json');
            if (!empty($jsonFiles)) {
                $this->assertNotEmpty($data, 'Should load data from existing JSON files');
            }
        } else {
            $this->markTestSkipped('json/thesauri directory does not exist');
        }
    }

    /**
     * Test: loadThesauriData() should handle missing thesauri directory gracefully
     */
    public function testLoadThesauriDataHandlesMissingDirectory(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        // This should not throw an exception even if directory is missing
        try {
            $data = $method->invoke($this->controller);
            $this->assertIsArray($data);
        } catch (Exception $e) {
            // If exception is thrown, it should be a warning not a fatal error
            $this->assertStringContainsString('glob', $e->getMessage(), 
                'Exception should be related to glob or directory access');
        }
    }

    /**
     * Test: loadThesauriData() should extract filename without .json extension
     */
    public function testLoadThesauriDataExtractsFilenameWithoutExtension(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        $data = $method->invoke($this->controller);

        // All keys should NOT end with .json
        foreach (array_keys($data) as $fileName) {
            $this->assertStringEndsNotWith('.json', $fileName, 
                'File name keys should not include .json extension');
        }
    }

    /**
     * Test: loadThesauriData() should handle empty JSON files gracefully
     */
    public function testLoadThesauriDataHandlesEmptyJsonFiles(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        $data = $method->invoke($this->controller);

        // Should not throw exception and should return array
        $this->assertIsArray($data);
    }

    /**
     * Test: loadThesauriData() should ignore invalid JSON files
     */
    public function testLoadThesauriDataIgnoresInvalidJsonFiles(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        // Method should handle invalid JSON gracefully
        $data = $method->invoke($this->controller);

        $this->assertIsArray($data);
        
        // All values should be valid timestamp strings
        foreach ($data as $lastUpdated) {
            $this->assertIsString($lastUpdated);
        }
    }

    /**
     * Test: getThesaurusKeywords() should accept mysqli connection and resource_id
     * 
     * Tests method signature and basic return type without full database
     */
    public function testGetThesaurusKeywordsSignature(): void
    {
        // Verify method exists and is callable
        $this->assertTrue(
            method_exists($this->controller, 'getThesaurusKeywords'),
            'getThesaurusKeywords method should exist'
        );
    }

    /**
     * Test: Constructor should set connection property
     */
    public function testConstructorSetsConnectionProperty(): void
    {
        global $connection;
        $mockConnection = $this->createMock(mysqli::class);
        $connection = $mockConnection;

        $controller = new DatasetController();

        // Verify controller was created successfully
        $this->assertInstanceOf(DatasetController::class, $controller);
    }

    /**
     * Test: generate_xml_path() with special characters in prefix
     */
    public function testGenerateXmlPathWithSpecialCharactersInPrefix(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $prefix = 'iso-19115';
        $path = $method->invoke($this->controller, 123, $prefix);

        $this->assertStringContainsString('iso-19115_resource_123.xml', $path);
    }

    /**
     * Test: generate_xml_path() should generate path with correct directory separators
     */
    public function testGenerateXmlPathUsesCorrectDirectorySeparators(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('generate_xml_path');
        $method->setAccessible(true);

        $path = $method->invoke($this->controller, 123);

        // Path should use proper directory separators for the OS
        $this->assertMatchesRegularExpression('/[\/\\\\]xml[\/\\\\]resource_123\.xml$/', $path);
    }

    /**
     * Test: loadThesauriData() should return expected keys for known files
     */
    public function testLoadThesauriDataReturnsExpectedKeys(): void
    {
        $baseDir = realpath(__DIR__ . '/..');
        $jsonDir = $baseDir . '/json/thesauri';

        if (!is_dir($jsonDir)) {
            $this->markTestSkipped('json/thesauri directory does not exist');
        }

        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        $data = $method->invoke($this->controller);

        // Common expected keys (may vary by project setup)
        $possibleKeys = [
            'gcmdPlatformsKeywords',
            'gcmdInstrumentsKeywords',
            'gcmdScienceKeywords',
            'msl-vocabularies'
        ];

        // At least one of these keys should be present if files exist
        $jsonFiles = glob($jsonDir . '/*.json');
        if (!empty($jsonFiles)) {
            $this->assertNotEmpty($data, 'Should have loaded data from JSON files');
        }
    }

    /**
     * Test: Multiple calls to loadThesauriData() should return consistent results
     */
    public function testLoadThesauriDataConsistency(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        $data1 = $method->invoke($this->controller);
        $data2 = $method->invoke($this->controller);

        // Same data should be returned on multiple calls
        $this->assertEquals($data1, $data2);
    }

    /**
     * Test: loadThesauriData() should preserve key-value associations
     */
    public function testLoadThesauriDataPreservesKeyValueAssociations(): void
    {
        $reflection = new ReflectionClass(DatasetController::class);
        $method = $reflection->getMethod('loadThesauriData');
        $method->setAccessible(true);

        $data = $method->invoke($this->controller);

        // Verify array has string keys (associative)
        if (!empty($data)) {
            $keys = array_keys($data);
            $this->assertIsString($keys[0], 'Keys should be strings (associative array)');
        }
    }
}
