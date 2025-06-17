<?php
namespace Tests;

use PHPUnit\Framework\TestCase;
use EasyRdf\Http;
use EasyRdf\Http\Response;

require_once __DIR__ . '/../api_functions.php';

class FetchAndProcessCGIKeywordsTest extends TestCase
{
    private $originalClient;

    protected function setUp(): void
    {
        // Backup the original HTTP client
        $this->originalClient = Http::getDefaultHttpClient();

        // Prepare mocked response with local RDF data
        $rdfData = file_get_contents(__DIR__ . '/datasets/simplelithology.rdf');
        $response = new Response(200, ['Content-Type' => 'application/rdf+xml'], $rdfData);

        // Create mock client that returns the predefined response
        $mock = $this->getMockBuilder('EasyRdf\\Http\\Client')
            ->onlyMethods(['request'])
            ->getMock();
        $mock->method('request')->willReturn($response);

        Http::setDefaultHttpClient($mock);
    }

    protected function tearDown(): void
    {
        // Restore original HTTP client
        Http::setDefaultHttpClient($this->originalClient);
    }

    public function testFetchAndProcessCGIKeywordsReturnsHierarchy(): void
    {
        $keywords = fetchAndProcessCGIKeywords();

        $this->assertIsArray($keywords);
        $this->assertCount(1, $keywords);

        $root = $keywords[0];
        $this->assertEquals('http://resource.geosciml.org/classifier/cgi/lithology/compound_material', $root['id']);
        $this->assertEquals('Compound Material', $root['text']);
        $this->assertArrayHasKey('children', $root);
        $this->assertCount(1, $root['children']);

        $child = $root['children'][0];
        $this->assertEquals('http://resource.geosciml.org/classifier/cgi/lithology/granite', $child['id']);
        $this->assertEquals('Granite', $child['text']);
    }
}