<?php
namespace Tests;

require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

class DatasetControllerTest extends DatabaseTestCase
{
    private \DatasetController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new \DatasetController();
    }

    public function testGetResourceAsXmlReturnsValidXml(): void
    {
        $id = $this->createResource('TEST.DATASET', 'Test Resource');
        $xml = $this->controller->getResourceAsXml($this->connection, $id, false);

        $this->assertStringContainsString('<Resource>', $xml);
        $this->assertStringContainsString('<year>', $xml);
    }
}