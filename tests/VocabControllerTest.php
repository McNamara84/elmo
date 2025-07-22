<?php
namespace Tests;

use PHPUnit\Framework\TestCase;
use EasyRdf\Graph;
use EasyRdf\RdfNamespace;

require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

class VocabControllerTest extends TestCase
{
    private function getController(): \VocabController
    {
        global $mslLabsUrl, $mslVocabsUrl;
        $mslLabsUrl = 'http://example.com/labs.json';
        $mslVocabsUrl = 'http://example.com/vocab/';
        return new \VocabController();
    }

    private function invoke($object, string $method, array $args = [])
    {
        $ref = new \ReflectionClass($object);
        $m = $ref->getMethod($method);
        $m->setAccessible(true);
        return $m->invokeArgs($object, $args);
    }

    public function testAddTimestampToData(): void
    {
        $controller = $this->getController();
        $result = $this->invoke($controller, 'addTimestampToData', [[1, 2, 3]]);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('lastUpdated', $result);
        $this->assertArrayHasKey('data', $result);
        $this->assertEquals([1, 2, 3], $result['data']);
        $this->assertMatchesRegularExpression('/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/', $result['lastUpdated']);
    }
}