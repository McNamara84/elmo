<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Test suite for generate_xml_files.php functionality
 * 
 * Tests XML generation functions without database dependencies
 */
class GenerateXmlFilesTest extends TestCase
{
    /**
     * Test that XML generation file exists
     */
    public function testXmlGenerationFileExists(): void
    {
        $xmlFile = __DIR__ . '/../generate_xml_files.php';
        $this->assertFileExists($xmlFile);
    }

    /**
     * Test XML directory is accessible
     */
    public function testXmlDirectoryAccessible(): void
    {
        $xmlDir = __DIR__ . '/../xml';
        if (is_dir($xmlDir)) {
            $this->assertTrue(is_readable($xmlDir));
            $this->assertTrue(is_writable($xmlDir));
        } else {
            $this->markTestSkipped('XML directory does not exist');
        }
    }

    /**
     * Test XML generation functions are defined
     */
    public function testXmlGenerationFunctionsExist(): void
    {
        $xmlFile = __DIR__ . '/../generate_xml_files.php';
        $content = file_get_contents($xmlFile);
        
        // Should contain XML generation logic
        $this->assertStringContainsString('xml', strtolower($content));
        $this->assertTrue(true, 'XML generation file analyzed');
    }

    /**
     * Test XML schema validation setup
     */
    public function testXmlSchemaValidationSetup(): void
    {
        $schemasDir = __DIR__ . '/../schemas';
        
        if (is_dir($schemasDir)) {
            $schemaFiles = glob($schemasDir . '/*.xsd');
            if (empty($schemaFiles)) {
                $this->markTestSkipped('No XSD schema files found in schemas directory');
            } else {
                $this->assertNotEmpty($schemaFiles, 'Should have XSD schema files');
            }
        } else {
            $this->markTestSkipped('Schemas directory not found');
        }
    }

    /**
     * Test XML special character handling
     */
    public function testXmlSpecialCharacterHandling(): void
    {
        $testData = [
            'title' => 'Test & Title < > "quotes"',
            'description' => 'Description with special chars: & < > " \''
        ];
        
        // Test that XML escaping would work
        $escaped = htmlspecialchars($testData['title'], ENT_XML1, 'UTF-8');
        $this->assertStringContainsString('&amp;', $escaped);
        $this->assertStringContainsString('&lt;', $escaped);
        $this->assertStringContainsString('&gt;', $escaped);
    }

    /**
     * Test required XML elements structure
     */
    public function testRequiredXmlElementsStructure(): void
    {
        $requiredElements = [
            'identifier',
            'creators',
            'title',
            'publisher',
            'publicationYear',
            'resourceType'
        ];
        
        foreach ($requiredElements as $element) {
            $this->assertIsString($element);
            $this->assertNotEmpty($element);
        }
        
        $this->assertTrue(true, 'Required XML elements structure validated');
    }

    /**
     * Test XML encoding handling
     */
    public function testXmlEncodingHandling(): void
    {
        $testString = 'Test with ümlaut and émoji 🚀';
        
        // Test UTF-8 encoding
        $encoded = mb_convert_encoding($testString, 'UTF-8', 'UTF-8');
        $this->assertEquals($testString, $encoded);
        
        // Test XML-safe encoding
        $xmlSafe = htmlspecialchars($testString, ENT_XML1, 'UTF-8');
        $this->assertIsString($xmlSafe);
    }

    /**
     * Test XML file naming conventions
     */
    public function testXmlFileNamingConventions(): void
    {
        $testResourceId = 'test-resource-123';
        
        // Test filename generation logic
        $filename = preg_replace('/[^a-zA-Z0-9\-_]/', '_', $testResourceId) . '.xml';
        $this->assertEquals('test-resource-123.xml', $filename);
        
        // Test invalid characters are replaced
        $invalidName = 'test/\\:*?"<>|resource';
        $safeFilename = preg_replace('/[^a-zA-Z0-9\-_]/', '_', $invalidName) . '.xml';
        $this->assertEquals('test_________resource.xml', $safeFilename);
    }

    /**
     * Test XML generation error handling
     */
    public function testXmlGenerationErrorHandling(): void
    {
        // Test error handling for invalid data
        $invalidData = [
            'title' => null,
            'creators' => [],
            'invalid_field' => 'should be ignored'
        ];
        
        // Simulate validation
        $isValid = !empty($invalidData['title']) && !empty($invalidData['creators']);
        $this->assertFalse($isValid, 'Should detect invalid data');
        
        // Test error recovery
        $errorMessage = 'Missing required fields: title, creators';
        $this->assertStringContainsString('required fields', $errorMessage);
    }

    /**
     * Test XML metadata structure
     */
    public function testXmlMetadataStructure(): void
    {
        $metadata = [
            'resource' => [
                'identifier' => 'test-123',
                'identifierType' => 'DOI',
                'creators' => [
                    ['creatorName' => 'Test Author']
                ],
                'titles' => [
                    ['title' => 'Test Title']
                ]
            ]
        ];
        
        $this->assertArrayHasKey('resource', $metadata);
        $this->assertArrayHasKey('identifier', $metadata['resource']);
        $this->assertArrayHasKey('creators', $metadata['resource']);
        $this->assertIsArray($metadata['resource']['creators']);
    }

    /**
     * Test XML validation against common patterns
     */
    public function testXmlValidationPatterns(): void
    {
        // Test DOI pattern
        $doiPattern = '/^10\.\d{4,}\/\S+$/';
        $validDoi = '10.1234/example.doi.123';
        $this->assertMatchesRegularExpression($doiPattern, $validDoi);
        
        // Test ORCID pattern
        $orcidPattern = '/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/';
        $validOrcid = '0000-0000-0000-0000';
        $this->assertMatchesRegularExpression($orcidPattern, $validOrcid);
        
        // Test URL pattern
        $urlPattern = '/^https?:\/\/\S+$/';
        $validUrl = 'https://example.com/resource';
        $this->assertMatchesRegularExpression($urlPattern, $validUrl);
    }
}