<?php
namespace Tests;

require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';

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

    public function testEnvelopeXmlAsStringWrapsBaseXml(): void
    {
        $id = $this->createResource('TEST.ENVELOPE', 'Envelope Test');
        $cmd = PHP_BINARY.' '.escapeshellarg(__DIR__.'/scripts/envelope.php').' '.intval($id);
        $output = shell_exec($cmd);

        $this->assertStringContainsString('<envelope>', $output);
        $this->assertStringContainsString('<resource', $output);
    }

    public function testHandleExportBaseXmlInvalidIdReturnsError(): void
    {
        $cmd = PHP_BINARY.' '.escapeshellarg(__DIR__.'/scripts/handle_base_xml.php').' 999999';
        $output = shell_exec($cmd);

        $this->assertStringContainsString('error', $output);
    }
}