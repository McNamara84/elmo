<?php
declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

if (!defined('UNIT_TESTING')) {
    define('UNIT_TESTING', true);
}
require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

#[CoversClass(\VocabController::class)]
final class VocabControllerTest extends TestCase
{
    private function getController(): \VocabController
    {
        global $mslVocabsUrl;
        $mslVocabsUrl = 'http://example.com/vocab/';
        return new \VocabController();
    }

    private function invoke(object $object, string $method, array $args = []): mixed
    {
        $ref = new \ReflectionClass($object);
        $m = $ref->getMethod($method);
        return $m->invokeArgs($object, $args);
    }

    public function testAddTimestampToData(): void
    {
        $controller = $this->getController();
        $result = $this->invoke($controller, 'addTimestampToData', [[1, 2, 3]]);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('lastUpdated', $result);
        $this->assertArrayHasKey('data', $result);
        $this->assertSame([1, 2, 3], $result['data']);
        $this->assertMatchesRegularExpression('/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/', $result['lastUpdated']);
    }

    public function testProcessItemTransformsStructure(): void
    {
        $controller = $this->getController();
        $item = [
            'text' => 'Parent',
            'extra' => ['uri' => 'uri:parent', 'vocab_uri' => 'scheme'],
            'synonyms' => ['Syn1', 'Syn2'],
            'children' => [
                [
                    'text' => 'Child',
                    'extra' => ['uri' => 'uri:child', 'vocab_uri' => 'scheme'],
                ]
            ]
        ];

        $processed = $this->invoke($controller, 'processItem', [$item]);

        $expected = [
            'id' => 'uri:parent',
            'text' => 'Parent',
            'language' => 'en',
            'scheme' => 'scheme',
            'schemeURI' => 'scheme',
            'description' => 'Syn1, Syn2',
            'children' => [[
                'id' => 'uri:child',
                'text' => 'Child',
                'language' => 'en',
                'scheme' => 'scheme',
                'schemeURI' => 'scheme',
                'description' => '',
                'children' => []
            ]]
        ];

        $this->assertSame($expected, $processed);
    }
}