<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/controllers/ICGEMController.php';

/**
 * Tests for ICGEMController::insertDescriptions() method
 * 
 * Tests that descriptions are:
 * - Retrieved from the database correctly
 * - Validated against ICGEM schema enumeration
 * - Converted to sentence case
 * - Properly escaped for XML
 * - Only valid types are included in output
 */
class ICGEMControllerDescriptionsTest extends TestCase
{
    private ICGEMController $controller;
    private \mysqli $mockConnection;

    protected function setUp(): void
    {
        $this->controller = new ICGEMController();
        
        // Create a mock mysqli connection
        $this->mockConnection = $this->createMock(\mysqli::class);
    }

    /**
     * Test that valid ICGEM description types are inserted correctly
     */
    public function testInsertDescriptionsWithValidTypes(): void
    {
        // Simulate database response with valid ICGEM types
        $mockStatement = $this->createMock(\mysqli_stmt::class);
        $mockStatement->expects($this->once())
            ->method('bind_param')
            ->with('i', 1);
        
        $mockStatement->expects($this->once())
            ->method('execute');
        
        // Mock the database result
        $mockResult = $this->createMock(\mysqli_result::class);
        $mockResult->expects($this->at(0))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'Abstract', 'description' => 'Test abstract']);
        
        $mockResult->expects($this->at(1))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'Input Data', 'description' => 'Test input']);

        $mockResult->expects($this->at(2))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'Technical information', 'description' => 'Should be filtered out']);
        
        $mockResult->expects($this->at(3))
            ->method('fetch_assoc')
            ->willReturn(null); // End of results
        
        $mockStatement->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);
        
        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStatement);
        
        // Use reflection to test the protected method
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        
        // Set the private connection property
        $connectionProperty = $reflection->getProperty('connection');
        $connectionProperty->setAccessible(true);
        $connectionProperty->setValue($this->controller, $this->mockConnection);
        
        // Create test XML
        $xml = new \SimpleXMLElement('<icgem_metadata/>');
        
        // Execute the method
        $method->invoke($this->controller, $xml, 1);
        
        // Verify the XML structure
        $this->assertTrue(isset($xml->descriptions), 'descriptions element should exist');
        $this->assertCount(2, $xml->descriptions->description, 'Should have 2 descriptions (1 invalid filtered out)');
        
        // Check first description
        $this->assertEquals('Abstract', (string)$xml->descriptions->description[0]['type']);
        $this->assertEquals('Test abstract', (string)$xml->descriptions->description[0]);
        
        // Check second description (should be converted to sentence case)
        $this->assertEquals('Input data', (string)$xml->descriptions->description[1]['type']);
        $this->assertEquals('Test input', (string)$xml->descriptions->description[1]);
        
        // Verify that the invalid type is NOT in the output
        $xmlString = $xml->asXML();
        $this->assertStringNotContainsString('Technical information', $xmlString, 'Invalid type should not appear in XML');
        $this->assertStringNotContainsString('Should be filtered out', $xmlString, 'Description content for invalid type should not appear in XML');
    }

    /**
     * Test that invalid description types are filtered out
     */
    public function testInsertDescriptionsFiltersInvalidTypes(): void
    {
        $mockStatement = $this->createMock(\mysqli_stmt::class);
        $mockStatement->expects($this->once())
            ->method('bind_param')
            ->with('i', 2);
        
        $mockStatement->expects($this->once())
            ->method('execute');
        
        // Mock database response with invalid types
        $mockResult = $this->createMock(\mysqli_result::class);
        $mockResult->expects($this->at(0))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'Methods', 'description' => 'Should be filtered']);
        
        $mockResult->expects($this->at(1))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'Abstract', 'description' => 'Valid description']);
        
        $mockResult->expects($this->at(2))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'TechnicalInfo', 'description' => 'Should be filtered']);
        
        $mockResult->expects($this->at(3))
            ->method('fetch_assoc')
            ->willReturn(null);
        
        $mockStatement->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);
        
        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStatement);
        
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        
        $connectionProperty = $reflection->getProperty('connection');
        $connectionProperty->setAccessible(true);
        $connectionProperty->setValue($this->controller, $this->mockConnection);
        
        $xml = new \SimpleXMLElement('<icgem_metadata/>');
        
        $method->invoke($this->controller, $xml, 2);
        
        // Only valid types should be in the XML
        $this->assertCount(1, $xml->descriptions->description, 'Only 1 valid description should be included');
        $this->assertEquals('Abstract', (string)$xml->descriptions->description[0]['type']);
        $this->assertEquals('Valid description', (string)$xml->descriptions->description[0]);
    }

    /**
     * Test sentence case conversion
     */
    public function testInsertDescriptionsSentenceCaseConversion(): void
    {
        $mockStatement = $this->createMock(\mysqli_stmt::class);
        $mockStatement->expects($this->once())
            ->method('bind_param')
            ->with('i', 3);
        
        $mockStatement->expects($this->once())
            ->method('execute');
        
        // Test various capitalization input
        $mockResult = $this->createMock(\mysqli_result::class);
        $mockResult->expects($this->at(0))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'ABSTRACT', 'description' => 'All caps']);
        
        $mockResult->expects($this->at(1))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'general model description', 'description' => 'All lowercase']);
        
        $mockResult->expects($this->at(2))
            ->method('fetch_assoc')
            ->willReturn(['type' => 'PROCESSING PROCEDURES', 'description' => 'Mixed caps']);
        
        $mockResult->expects($this->at(3))
            ->method('fetch_assoc')
            ->willReturn(null);
        
        $mockStatement->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);
        
        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStatement);
        
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        
        $connectionProperty = $reflection->getProperty('connection');
        $connectionProperty->setAccessible(true);
        $connectionProperty->setValue($this->controller, $this->mockConnection);
        
        $xml = new \SimpleXMLElement('<icgem_metadata/>');
        
        $method->invoke($this->controller, $xml, 3);
        
        // All should be converted to proper sentence case
        $this->assertEquals('Abstract', (string)$xml->descriptions->description[0]['type']);
        $this->assertEquals('General model description', (string)$xml->descriptions->description[1]['type']);
        $this->assertEquals('Processing procedures', (string)$xml->descriptions->description[2]['type']);
    }

    /**
     * Test that special characters are properly escaped in XML
     */
    public function testInsertDescriptionsEscapesSpecialCharacters(): void
    {
        $mockStatement = $this->createMock(\mysqli_stmt::class);
        $mockStatement->expects($this->once())
            ->method('bind_param')
            ->with('i', 4);
        
        $mockStatement->expects($this->once())
            ->method('execute');
        
        // Test special characters that need escaping
        $mockResult = $this->createMock(\mysqli_result::class);
        $mockResult->expects($this->at(0))
            ->method('fetch_assoc')
            ->willReturn([
                'type' => 'Abstract', 
                'description' => 'Description with <tags> & special "chars"'
            ]);
        
        $mockResult->expects($this->at(1))
            ->method('fetch_assoc')
            ->willReturn(null);
        
        $mockStatement->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);
        
        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStatement);
        
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        
        $connectionProperty = $reflection->getProperty('connection');
        $connectionProperty->setAccessible(true);
        $connectionProperty->setValue($this->controller, $this->mockConnection);
        
        $xml = new \SimpleXMLElement('<icgem_metadata/>');
        
        $method->invoke($this->controller, $xml, 4);
        
        // Get the XML as string to verify escaping
        $xmlString = $xml->asXML();
        
        // Should contain escaped versions, not raw special chars
        $this->assertStringContainsString('&lt;', $xmlString, 'Should contain escaped <');
        $this->assertStringContainsString('&amp;', $xmlString, 'Should contain escaped &');
        $this->assertStringContainsString('&quot;', $xmlString, 'Should contain escaped "');
    }

    /**
     * Test handling of empty description list
     */
    public function testInsertDescriptionsWithNoDescriptions(): void
    {
        $mockStatement = $this->createMock(\mysqli_stmt::class);
        $mockStatement->expects($this->once())
            ->method('bind_param')
            ->with('i', 5);
        
        $mockStatement->expects($this->once())
            ->method('execute');
        
        // Empty result
        $mockResult = $this->createMock(\mysqli_result::class);
        $mockResult->expects($this->once())
            ->method('fetch_assoc')
            ->willReturn(null);
        
        $mockStatement->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);
        
        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStatement);
        
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        
        $connectionProperty = $reflection->getProperty('connection');
        $connectionProperty->setAccessible(true);
        $connectionProperty->setValue($this->controller, $this->mockConnection);
        
        $xml = new \SimpleXMLElement('<icgem_metadata/>');
        
        $method->invoke($this->controller, $xml, 5);
        
        // No descriptions element should be created
        $this->assertFalse(isset($xml->descriptions), 'descriptions element should not exist when empty');
    }

    /**
     * Test that database prepare failure is handled gracefully
     */
    public function testInsertDescriptionsHandlesDatabaseError(): void
    {
        // Mock prepare to return false (failure)
        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn(false);
        
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        
        $connectionProperty = $reflection->getProperty('connection');
        $connectionProperty->setAccessible(true);
        $connectionProperty->setValue($this->controller, $this->mockConnection);
        
        $xml = new \SimpleXMLElement('<icgem_metadata/>');
        
        // Should not throw exception, just return gracefully
        $method->invoke($this->controller, $xml, 6);
        
        // XML should remain unchanged
        $this->assertFalse(isset($xml->descriptions));
    }

    /**
     * Test all valid ICGEM types are accepted
     */
    public function testInsertDescriptionsAcceptsAllValidTypes(): void
    {
        $validTypes = [
            'Abstract',
            'General model description',
            'Input data',
            'Processing procedures',
            'Specific features of resulting gravity field',
            'Other'
        ];
        
        $mockStatement = $this->createMock(\mysqli_stmt::class);
        $mockStatement->expects($this->once())
            ->method('bind_param')
            ->with('i', 7);
        
        $mockStatement->expects($this->once())
            ->method('execute');
        
        // Create mock result with all valid types
        $mockResult = $this->createMock(\mysqli_result::class);
        
        $callCount = 0;
        foreach ($validTypes as $type) {
            $mockResult->expects($this->at($callCount++))
                ->method('fetch_assoc')
                ->willReturn(['type' => $type, 'description' => "Description for $type"]);
        }
        
        // Final call returns null
        $mockResult->expects($this->at($callCount))
            ->method('fetch_assoc')
            ->willReturn(null);
        
        $mockStatement->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);
        
        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStatement);
        
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        
        $connectionProperty = $reflection->getProperty('connection');
        $connectionProperty->setAccessible(true);
        $connectionProperty->setValue($this->controller, $this->mockConnection);
        
        $xml = new \SimpleXMLElement('<icgem_metadata/>');
        
        $method->invoke($this->controller, $xml, 7);
        
        // All 6 valid types should be included
        $this->assertCount(6, $xml->descriptions->description, 'All 6 valid ICGEM types should be included');
        
        // Verify each type
        foreach ($validTypes as $index => $type) {
            $this->assertEquals($type, (string)$xml->descriptions->description[$index]['type']);
        }
    }
}
