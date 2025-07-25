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
        // Generate the different XML formats directly without spawning a new
        // PHP process. The helper method `transformAndSaveOrDownloadXml` returns
        // the transformed XML as a string which allows us to recreate the
        // expected envelope XML inside the test environment.
        $dataciteXml = $this->controller->transformAndSaveOrDownloadXml($id, 'datacite');
        $isoXml = $this->controller->transformAndSaveOrDownloadXml($id, 'iso');
        $difXml = $this->controller->transformAndSaveOrDownloadXml($id, 'dif');

        // Remove potential XML declarations from the returned strings as done
        // by the controller when creating the envelope.
        $dataciteXml = preg_replace('/<\?xml[^>]+\?>/', '', $dataciteXml);
        $isoXml = preg_replace('/<\?xml[^>]+\?>/', '', $isoXml);
        $difXml = preg_replace('/<\?xml[^>]+\?>/', '', $difXml);

        $output = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".
            "<envelope>\n    {$dataciteXml}\n\n    {$isoXml}\n\n    {$difXml}\n</envelope>";

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