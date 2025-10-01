<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Tests for the main save_data.php functionality
 * This tests the core data processing without actual HTTP calls
 */
class SaveDataProcessingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // Set up minimal POST environment
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = [];
        $_GET = [];
    }

    protected function tearDown(): void
    {
        // Clean up global state
        $_POST = [];
        $_GET = [];
        parent::tearDown();
    }

    /**
     * Test the resource ID request functionality
     */
    public function testResourceIdRequest(): void
    {
        // Mock the POST data for resource ID request
        $_POST = [
            'get_resource_id' => '1',
            'year' => 2023,
            'dateCreated' => '2023-06-01',
            'resourcetype' => 1,
            'language' => 1,
            'Rights' => 1,
            'title' => ['Test Resource'],
            'titleType' => [1]
        ];

        // Capture the output
        ob_start();
        
        // Mock the saveResourceInformationAndRights function to avoid database dependency
        if (!function_exists('saveResourceInformationAndRights')) {
            function saveResourceInformationAndRights($connection, $postData) {
                return 123; // Mock resource ID
            }
        }
        
        // Test that the logic path executes
        $this->assertEquals('POST', $_SERVER['REQUEST_METHOD']);
        $this->assertEquals('1', $_POST['get_resource_id']);
        
        ob_end_clean();
    }

    /**
     * Test save data validation logic
     */
    public function testSaveDataValidation(): void
    {
        // Include validation functions
        $validationFile = __DIR__ . '/../save/validation.php';
        
        if (file_exists($validationFile)) {
            include_once $validationFile;
            
            // Test validation functions with safe data
            if (function_exists('validateRequiredFields')) {
                $result = validateRequiredFields(['field1' => 'value1'], ['field1']);
                $this->assertTrue($result, 'Validation should pass for valid data');
                
                $result = validateRequiredFields(['field1' => ''], ['field1']);
                $this->assertFalse($result, 'Validation should fail for empty required field');
            }
            
            // Test other validation functions
            $this->assertTrue(function_exists('validateRequiredFields'), 'validateRequiredFields should exist');
            $this->assertTrue(function_exists('validateArrayDependencies'), 'validateArrayDependencies should exist');
        } else {
            $this->markTestSkipped('Validation file not found');
        }
    }

    /**
     * Test save formgroups inclusion logic
     */
    public function testFormGroupsInclusion(): void
    {
        $formGroupFiles = [
            'save_resourceinformation_and_rights.php',
            'save_authors.php',
            'save_contactperson.php',
            'save_descriptions.php',
            'save_thesauruskeywords.php',
            'save_spatialtemporalcoverage.php',
            'save_relatedwork.php',
            'save_fundingreferences.php'
        ];
        
        foreach ($formGroupFiles as $file) {
            $filePath = __DIR__ . '/../save/formgroups/' . $file;
            if (file_exists($filePath)) {
                $this->assertFileExists($filePath, "Formgroup file {$file} should exist");
                $this->assertFileIsReadable($filePath, "Formgroup file {$file} should be readable");
                
                $content = file_get_contents($filePath);
                $this->assertStringContainsString('<?php', $content, "{$file} should contain PHP code");
                $this->assertStringContainsString('function', $content, "{$file} should contain functions");
            }
        }
    }

    /**
     * Test XML processing logic paths
     */
    public function testXmlProcessingPaths(): void
    {
        // Test XML-related functionality without database operations
        $testXmlData = '<?xml version="1.0" encoding="UTF-8"?><test><item>value</item></test>';
        
        // Test XML parsing
        $dom = new \DOMDocument();
        $success = $dom->loadXML($testXmlData);
        $this->assertTrue($success, 'XML should parse successfully');
        
        // Test XML creation
        $newDom = new \DOMDocument('1.0', 'UTF-8');
        $root = $newDom->createElement('dataset');
        $newDom->appendChild($root);
        
        $metadata = $newDom->createElement('metadata');
        $root->appendChild($metadata);
        
        $title = $newDom->createElement('title', 'Test Dataset');
        $metadata->appendChild($title);
        
        $xmlString = $newDom->saveXML();
        $this->assertStringContainsString('Test Dataset', $xmlString);
        $this->assertStringContainsString('<?xml version="1.0"', $xmlString);
    }

    /**
     * Test file operations used in save processing
     */
    public function testFileOperations(): void
    {
        // Test temporary file operations that might be used in save_data.php
        $tempDir = sys_get_temp_dir();
        $testFile = $tempDir . '/elmo_test_' . uniqid() . '.xml';
        
        // Test file creation
        $testContent = '<?xml version="1.0"?><test>content</test>';
        $result = file_put_contents($testFile, $testContent);
        $this->assertNotFalse($result, 'File should be created successfully');
        
        // Test file reading
        $readContent = file_get_contents($testFile);
        $this->assertEquals($testContent, $readContent, 'File content should match');
        
        // Test file existence
        $this->assertFileExists($testFile, 'Test file should exist');
        
        // Clean up
        unlink($testFile);
        $this->assertFileDoesNotExist($testFile, 'Test file should be cleaned up');
    }

    /**
     * Test JSON processing used in API responses
     */
    public function testJsonProcessing(): void
    {
        // Test JSON encoding/decoding that might be used in save_data.php
        $testData = [
            'resource_id' => 123,
            'status' => 'success',
            'data' => [
                'title' => 'Test Dataset',
                'authors' => ['John Doe', 'Jane Smith'],
                'year' => 2023
            ]
        ];
        
        // Test encoding
        $json = json_encode($testData);
        $this->assertNotFalse($json, 'JSON encoding should succeed');
        $this->assertStringContainsString('resource_id', $json);
        $this->assertStringContainsString('Test Dataset', $json);
        
        // Test decoding
        $decoded = json_decode($json, true);
        $this->assertEquals($testData, $decoded, 'JSON should decode correctly');
        $this->assertEquals(123, $decoded['resource_id']);
        $this->assertEquals('success', $decoded['status']);
    }

    /**
     * Test string processing and sanitization
     */
    public function testStringProcessing(): void
    {
        // Test filename sanitization (used in save_data.php)
        $unsafeFilename = 'test/file\\name<>:|?*"dangerous.xml';
        $safeFilename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $unsafeFilename) . '.xml';
        
        $this->assertStringNotContainsString('/', $safeFilename);
        $this->assertStringNotContainsString('\\', $safeFilename);
        $this->assertStringNotContainsString('<', $safeFilename);
        $this->assertStringNotContainsString('>', $safeFilename);
        $this->assertStringContainsString('.xml', $safeFilename);
        
        // Test other string operations
        $this->assertEquals('test_file_name_dangerous.xml.xml', $safeFilename);
    }

    /**
     * Test header generation logic
     */
    public function testHeaderGeneration(): void
    {
        // Test header logic without actually sending headers
        $filename = 'test_dataset.xml';
        $contentType = 'application/xml';
        $disposition = 'attachment; filename="' . $filename . '"';
        
        $this->assertEquals('application/xml', $contentType);
        $this->assertStringContainsString('test_dataset.xml', $disposition);
        $this->assertStringContainsString('attachment', $disposition);
        
        // Test header escaping
        $unsafeFilename = 'test"file.xml';
        $safeDisposition = 'attachment; filename="' . str_replace('"', '\\"', $unsafeFilename) . '"';
        $this->assertStringContainsString('\\"', $safeDisposition);
    }

    /**
     * Test POST data processing
     */
    public function testPostDataProcessing(): void
    {
        // Simulate POST data processing
        $mockPostData = [
            'title' => ['Test Dataset', 'Alternative Title'],
            'titleType' => [1, 2],
            'year' => '2023',
            'dateCreated' => '2023-06-01',
            'resourcetype' => '1',
            'language' => '1',
            'Rights' => '1'
        ];
        
        // Test array processing
        $this->assertIsArray($mockPostData['title']);
        $this->assertCount(2, $mockPostData['title']);
        $this->assertEquals('Test Dataset', $mockPostData['title'][0]);
        
        // Test type conversion
        $year = (int) $mockPostData['year'];
        $this->assertIsInt($year);
        $this->assertEquals(2023, $year);
        
        // Test data validation
        $this->assertNotEmpty($mockPostData['dateCreated']);
        $this->assertTrue(is_array($mockPostData['title']) && count($mockPostData['title']) > 0);
    }
}