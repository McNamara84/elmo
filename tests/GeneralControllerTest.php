<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/controllers/GeneralController.php';

class GeneralControllerTest extends TestCase
{
    public function testGetAliveReturnsAliveMessage(): void
    {
        $controller = new \GeneralController();
        ob_start();
        $controller->getAlive();
        $output = ob_get_clean();

        $this->assertEquals(200, http_response_code());
        $this->assertJson($output);
        $data = json_decode($output, true);
        $this->assertSame("I'm still alive...", $data['message']);
    }

    public function testGetAliveRepeatedCalls(): void
    {
        $controller = new \GeneralController();
        ob_start();
        $controller->getAlive();
        ob_end_clean();
        $this->assertEquals(200, http_response_code());

        ob_start();
        $controller->getAlive();
        $output = ob_get_clean();

        $this->assertEquals(200, http_response_code());
        $this->assertJson($output);
        $data = json_decode($output, true);
        $this->assertSame("I'm still alive...", $data['message']);
    }
}