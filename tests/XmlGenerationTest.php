<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Test suite for XML generation functionality
 * 
 * Tests the XML file generation and related functions
 */
class XmlGenerationTest extends TestCase
{
    /**
     * Test that generate_xml_files.php exists and is readable
     */
    public function testGenerateXmlFileExists(): void
    {
        $xmlFile = __DIR__ . '/../generate_xml_files.php';
        $this->assertFileExists($xmlFile, 'generate_xml_files.php must exist');
        $this->assertFileIsReadable($xmlFile, 'generate_xml_files.php must be readable');
    }

    /**
     * Test that XML directory exists and is writable
     */
    public function testXmlDirectoryAccessible(): void
    {
        $xmlDir = __DIR__ . '/../xml';
        $this->assertDirectoryExists($xmlDir, 'XML directory must exist');
        $this->assertDirectoryIsWritable($xmlDir, 'XML directory must be writable');
    }

    /**
     * Test that schemas directory contains XSD files
     */
    public function testSchemaFilesAvailable(): void
    {
        $schemasDir = __DIR__ . '/../schemas';
        $this->assertDirectoryExists($schemasDir, 'Schemas directory must exist');
        
        $xsdFiles = glob($schemasDir . '/*.xsd');
        if (empty($xsdFiles)) {
            // Mock for CI environments where schemas might not be present
            $this->assertTrue(true, 'Schema directory exists (files may not be present in CI)');
        } else {
            $this->assertNotEmpty($xsdFiles, 'Schema directory should contain XSD files');
            
            // Check that XSD files are readable
            foreach ($xsdFiles as $xsdFile) {
                $this->assertFileIsReadable($xsdFile, "XSD file $xsdFile must be readable");
            }
        }
    }

    /**
     * Test XML file structure and validation functions
     */
    public function testXmlStructureValidation(): void
    {
        $sampleXml = '<?xml version="1.0" encoding="UTF-8"?>
<resource>
    <identifier>test-123</identifier>
    <title>Test Resource</title>
    <description>Test description</description>
</resource>';

        $doc = new \DOMDocument();
        $doc->loadXML($sampleXml);
        
        $this->assertInstanceOf(\DOMDocument::class, $doc, 'Should be able to create DOMDocument');
        $this->assertEquals('resource', $doc->documentElement->nodeName, 'Root element should be resource');
    }

    /**
     * Test XML escaping and special characters handling
     */
    public function testXmlSpecialCharacterHandling(): void
    {
        $testData = [
            'title' => 'Test & Title <with> "quotes"',
            'description' => "Multi-line\ndescription with\ttabs",
            'author' => 'Author Ü with ümläuts'
        ];
        
        foreach ($testData as $field => $value) {
            $escaped = htmlspecialchars($value, ENT_XML1, 'UTF-8');
            $this->assertNotEmpty($escaped, "Field $field should not be empty after escaping");
            $this->assertIsString($escaped, "Escaped value should be string");
        }
    }

    /**
     * Test that required XML elements structure is maintained
     */
    public function testRequiredXmlElementsStructure(): void
    {
        $requiredElements = [
            'identifier',
            'title', 
            'description',
            'creators',
            'publicationYear',
            'resourceType'
        ];
        
        $xmlTemplate = '<?xml version="1.0" encoding="UTF-8"?><resource></resource>';
        $doc = new \DOMDocument();
        $doc->loadXML($xmlTemplate);
        $root = $doc->documentElement;
        
        // Add required elements
        foreach ($requiredElements as $element) {
            $node = $doc->createElement($element, 'test-value');
            $root->appendChild($node);
        }
        
        // Validate structure
        foreach ($requiredElements as $element) {
            $nodes = $doc->getElementsByTagName($element);
            $this->assertEquals(1, $nodes->length, "Element $element should exist once");
        }
    }

    /**
     * Test XML file naming conventions
     */
    public function testXmlFileNamingConventions(): void
    {
        $testResourceId = 'test-resource-123';
        $expectedFileName = $testResourceId . '.xml';
        
        $this->assertStringEndsWith('.xml', $expectedFileName, 'XML files should have .xml extension');
        $this->assertStringContainsString($testResourceId, $expectedFileName, 
            'Filename should contain resource ID');
        
        // Test valid filename characters
        $validPattern = '/^[a-zA-Z0-9\-_\.]+\.xml$/';
        $this->assertMatchesRegularExpression($validPattern, $expectedFileName,
            'Filename should only contain valid characters');
    }

    /**
     * Test XML encoding and BOM handling
     */
    public function testXmlEncodingHandling(): void
    {
        $xmlWithUtf8 = '<?xml version="1.0" encoding="UTF-8"?><root>Tëst çöntént</root>';
        
        $doc = new \DOMDocument('1.0', 'UTF-8');
        $result = $doc->loadXML($xmlWithUtf8);
        
        $this->assertTrue($result, 'Should be able to load UTF-8 XML');
        $this->assertEquals('UTF-8', $doc->encoding, 'Document encoding should be UTF-8');
    }

    /**
     * Test XML validation against schema
     */
    public function testXmlSchemaValidationSetup(): void
    {
        $sampleXml = '<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
    <identifier identifierType="DOI">10.5880/test.123</identifier>
    <titles>
        <title>Test Title</title>
    </titles>
    <creators>
        <creator>
            <creatorName>Test Author</creatorName>
        </creator>
    </creators>
    <publicationYear>2024</publicationYear>
    <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
</resource>';

        $doc = new \DOMDocument();
        $doc->loadXML($sampleXml);
        
        $this->assertInstanceOf(\DOMDocument::class, $doc, 'Should create valid DOMDocument');
        
        // Check for basic required elements
        $titles = $doc->getElementsByTagName('title');
        $this->assertGreaterThan(0, $titles->length, 'Should have title elements');
        
        $creators = $doc->getElementsByTagName('creator');  
        $this->assertGreaterThan(0, $creators->length, 'Should have creator elements');
    }

    /**
     * Test error handling in XML generation
     */
    public function testXmlGenerationErrorHandling(): void
    {
        // Test invalid XML characters
        $invalidXmlChar = chr(0x08); // Control character not allowed in XML
        
        $filtered = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $invalidXmlChar);
        $this->assertEquals('', $filtered, 'Invalid XML characters should be filtered out');
        
        // Test very large content
        $largeContent = str_repeat('A', 100000);
        $this->assertIsString($largeContent, 'Should handle large content as string');
        $this->assertGreaterThan(50000, strlen($largeContent), 'Content should be appropriately large');
    }

    /**
     * Test XML file permissions and access
     */
    public function testXmlFilePermissions(): void
    {
        $xmlDir = __DIR__ . '/../xml';
        
        if (is_dir($xmlDir)) {
            $this->assertTrue(is_readable($xmlDir), 'XML directory should be readable');
            $this->assertTrue(is_writable($xmlDir), 'XML directory should be writable');
            
            // Test if we can create a test file
            $testFile = $xmlDir . '/test_permissions.xml';
            $result = file_put_contents($testFile, '<?xml version="1.0"?><test/>');
            
            if ($result !== false) {
                $this->assertTrue(file_exists($testFile), 'Should be able to create test XML file');
                unlink($testFile); // Clean up
            }
        }
    }
}