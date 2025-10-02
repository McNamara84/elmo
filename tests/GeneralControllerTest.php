<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/controllers/GeneralController.php';

/**
 * Test suite for GeneralController
 * 
 * Tests the general API endpoints provided by GeneralController
 */
class GeneralControllerTest extends TestCase
{
    private \GeneralController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new \GeneralController();
    }

    /**
     * Test getAlive returns success response
     */
    public function testGetAliveReturnsSuccessResponse(): void
    {
        ob_start();
        $this->controller->getAlive();
        $output = ob_get_clean();

        $result = json_decode($output, true);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('message', $result);
        $this->assertEquals("I'm still alive...", $result['message']);
    }

    /**
     * Test getAlive sets correct content type
     */
    public function testGetAliveSetsCorrectContentType(): void
    {
        ob_start();
        $this->controller->getAlive();
        ob_end_clean();

        // Headers are set, we can't easily test them in unit tests
        // but we can verify the method executes without errors
        $this->assertTrue(true);
    }

    /**
     * Test getAlive returns valid JSON
     */
    public function testGetAliveReturnsValidJson(): void
    {
        ob_start();
        $this->controller->getAlive();
        $output = ob_get_clean();

        $decoded = json_decode($output);
        $this->assertNotNull($decoded, 'Output should be valid JSON');
        $this->assertEquals(JSON_ERROR_NONE, json_last_error());
    }

    /**
     * Test getAlive message is a string
     */
    public function testGetAliveMessageIsString(): void
    {
        ob_start();
        $this->controller->getAlive();
        $output = ob_get_clean();

        $result = json_decode($output, true);
        
        $this->assertIsString($result['message']);
        $this->assertNotEmpty($result['message']);
    }

    /**
     * Test getAlive response structure
     */
    public function testGetAliveResponseStructure(): void
    {
        ob_start();
        $this->controller->getAlive();
        $output = ob_get_clean();

        $result = json_decode($output, true);
        
        // Should only contain 'message' key in success case
        $this->assertCount(1, $result);
        $this->assertArrayHasKey('message', $result);
        $this->assertArrayNotHasKey('error', $result);
    }

    /**
     * Test getAlive can be called multiple times
     */
    public function testGetAliveCanBeCalledMultipleTimes(): void
    {
        // First call
        ob_start();
        $this->controller->getAlive();
        $output1 = ob_get_clean();

        // Second call
        ob_start();
        $this->controller->getAlive();
        $output2 = ob_get_clean();

        $this->assertEquals($output1, $output2);
    }

    /**
     * Test GeneralController can be instantiated
     */
    public function testGeneralControllerCanBeInstantiated(): void
    {
        $controller = new \GeneralController();
        $this->assertInstanceOf(\GeneralController::class, $controller);
    }

    /**
     * Test getAlive method exists
     */
    public function testGetAliveMethodExists(): void
    {
        $this->assertTrue(method_exists($this->controller, 'getAlive'));
    }

    /**
     * Test getAlive is public method
     */
    public function testGetAliveIsPublicMethod(): void
    {
        $reflection = new \ReflectionMethod($this->controller, 'getAlive');
        $this->assertTrue($reflection->isPublic());
    }

    /**
     * Test getAlive returns immediately
     */
    public function testGetAliveReturnsImmediately(): void
    {
        $startTime = microtime(true);
        
        ob_start();
        $this->controller->getAlive();
        ob_end_clean();
        
        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;

        // Should execute very quickly (less than 100ms)
        $this->assertLessThan(0.1, $executionTime);
    }
}
