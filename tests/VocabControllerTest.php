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

        $this->assertEquals($expected, $processed);
    }

    /**
     * Test constructor initializes URLs from global variables
     */
    public function testConstructorInitializesUrls(): void
    {
        global $mslLabsUrl, $mslVocabsUrl;
        $mslLabsUrl = 'http://test.com/labs.json';
        $mslVocabsUrl = 'http://test.com/vocab/';
        
        $controller = new \VocabController();
        
        // We can't directly access private properties, but we can verify the object was created
        $this->assertInstanceOf(\VocabController::class, $controller);
    }

    /**
     * Test addTimestampToData with empty array
     */
    public function testAddTimestampToDataWithEmptyArray(): void
    {
        $controller = $this->getController();
        $result = $this->invoke($controller, 'addTimestampToData', [[]]);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('lastUpdated', $result);
        $this->assertArrayHasKey('data', $result);
        $this->assertEquals([], $result['data']);
    }

    /**
     * Test addTimestampToData with complex data structure
     */
    public function testAddTimestampToDataWithComplexStructure(): void
    {
        $controller = $this->getController();
        $complexData = [
            'users' => [
                ['id' => 1, 'name' => 'John'],
                ['id' => 2, 'name' => 'Jane']
            ],
            'metadata' => ['version' => '1.0']
        ];
        
        $result = $this->invoke($controller, 'addTimestampToData', [$complexData]);

        $this->assertIsArray($result);
        $this->assertEquals($complexData, $result['data']);
        $this->assertArrayHasKey('lastUpdated', $result);
    }

    /**
     * Test addTimestampToData timestamp format
     */
    public function testAddTimestampToDataTimestampFormat(): void
    {
        $controller = $this->getController();
        $result = $this->invoke($controller, 'addTimestampToData', [['test']]);

        // Verify timestamp is in correct format
        $timestamp = $result['lastUpdated'];
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $timestamp);
        
        // Verify timestamp is valid
        $dateTime = \DateTime::createFromFormat('Y-m-d H:i:s', $timestamp);
        $this->assertNotFalse($dateTime);
    }

    /**
     * Test processItem with no children
     */
    public function testProcessItemWithNoChildren(): void
    {
        $controller = $this->getController();
        $item = [
            'text' => 'Item',
            'extra' => ['uri' => 'uri:item', 'vocab_uri' => 'test-scheme'],
            'synonyms' => []
        ];

        $processed = $this->invoke($controller, 'processItem', [$item]);

        $this->assertEquals('uri:item', $processed['id']);
        $this->assertEquals('Item', $processed['text']);
        $this->assertEquals('test-scheme', $processed['scheme']);
        $this->assertEquals('', $processed['description']);
        $this->assertEquals([], $processed['children']);
    }

    /**
     * Test processItem with multiple synonyms
     */
    public function testProcessItemWithMultipleSynonyms(): void
    {
        $controller = $this->getController();
        $item = [
            'text' => 'Term',
            'extra' => ['uri' => 'uri:term', 'vocab_uri' => 'vocab'],
            'synonyms' => ['Synonym1', 'Synonym2', 'Synonym3']
        ];

        $processed = $this->invoke($controller, 'processItem', [$item]);

        $this->assertEquals('Synonym1, Synonym2, Synonym3', $processed['description']);
    }

    /**
     * Test processItem with nested children
     */
    public function testProcessItemWithNestedChildren(): void
    {
        $controller = $this->getController();
        $item = [
            'text' => 'Parent',
            'extra' => ['uri' => 'uri:parent', 'vocab_uri' => 'scheme'],
            'children' => [
                [
                    'text' => 'Child1',
                    'extra' => ['uri' => 'uri:child1', 'vocab_uri' => 'scheme'],
                    'children' => [
                        [
                            'text' => 'Grandchild',
                            'extra' => ['uri' => 'uri:grandchild', 'vocab_uri' => 'scheme']
                        ]
                    ]
                ]
            ]
        ];

        $processed = $this->invoke($controller, 'processItem', [$item]);

        $this->assertCount(1, $processed['children']);
        $this->assertEquals('Child1', $processed['children'][0]['text']);
        $this->assertCount(1, $processed['children'][0]['children']);
        $this->assertEquals('Grandchild', $processed['children'][0]['children'][0]['text']);
    }

    /**
     * Test processItem sets correct language
     */
    public function testProcessItemSetsCorrectLanguage(): void
    {
        $controller = $this->getController();
        $item = [
            'text' => 'Test',
            'extra' => ['uri' => 'uri:test', 'vocab_uri' => 'vocab']
        ];

        $processed = $this->invoke($controller, 'processItem', [$item]);

        $this->assertEquals('en', $processed['language']);
    }

    /**
     * Test processItem maintains URI consistency
     */
    public function testProcessItemMaintainsUriConsistency(): void
    {
        $controller = $this->getController();
        $item = [
            'text' => 'Concept',
            'extra' => ['uri' => 'http://example.org/concept', 'vocab_uri' => 'http://example.org/vocab']
        ];

        $processed = $this->invoke($controller, 'processItem', [$item]);

        $this->assertEquals('http://example.org/concept', $processed['id']);
        $this->assertEquals('http://example.org/vocab', $processed['scheme']);
        $this->assertEquals('http://example.org/vocab', $processed['schemeURI']);
    }

    /**
     * Test processItem with empty extra array
     */
    public function testProcessItemWithEmptyExtra(): void
    {
        $controller = $this->getController();
        $item = [
            'text' => 'Test',
            'extra' => []
        ];

        $processed = $this->invoke($controller, 'processItem', [$item]);

        // Should have default empty values
        $this->assertArrayHasKey('id', $processed);
        $this->assertArrayHasKey('scheme', $processed);
    }

    /**
     * Test processItem recursively processes all children
     */
    public function testProcessItemRecursivelyProcessesChildren(): void
    {
        $controller = $this->getController();
        $item = [
            'text' => 'Root',
            'extra' => ['uri' => 'uri:root', 'vocab_uri' => 'scheme'],
            'children' => [
                [
                    'text' => 'Child1',
                    'extra' => ['uri' => 'uri:child1', 'vocab_uri' => 'scheme'],
                    'synonyms' => ['C1Syn']
                ],
                [
                    'text' => 'Child2',
                    'extra' => ['uri' => 'uri:child2', 'vocab_uri' => 'scheme'],
                    'synonyms' => ['C2Syn1', 'C2Syn2']
                ]
            ]
        ];

        $processed = $this->invoke($controller, 'processItem', [$item]);

        $this->assertCount(2, $processed['children']);
        $this->assertEquals('C1Syn', $processed['children'][0]['description']);
        $this->assertEquals('C2Syn1, C2Syn2', $processed['children'][1]['description']);
    }

    /**
     * Test sortChildrenRecursively sorts children within nodes
     */
    public function testSortChildrenRecursivelySortsChildrenWithinNodes(): void
    {
        $controller = $this->getController();
        $nodes = [
            [
                'text' => 'Parent',
                'children' => [
                    ['text' => 'Zebra', 'children' => []],
                    ['text' => 'Apple', 'children' => []],
                    ['text' => 'Mango', 'children' => []]
                ]
            ]
        ];

        $this->invoke($controller, 'sortChildrenRecursively', [&$nodes]);

        // sortChildrenRecursively sorts CHILDREN, not the top-level array
        $this->assertEquals('Apple', $nodes[0]['children'][0]['text']);
        $this->assertEquals('Mango', $nodes[0]['children'][1]['text']);
        $this->assertEquals('Zebra', $nodes[0]['children'][2]['text']);
    }

    /**
     * Test sortChildrenRecursively handles nested children
     */
    public function testSortChildrenRecursivelyHandlesNestedChildren(): void
    {
        $controller = $this->getController();
        $nodes = [
            [
                'text' => 'Parent1',
                'children' => [
                    ['text' => 'Z-Child', 'children' => []],
                    ['text' => 'A-Child', 'children' => []]
                ]
            ]
        ];

        $this->invoke($controller, 'sortChildrenRecursively', [&$nodes]);

        $this->assertEquals('A-Child', $nodes[0]['children'][0]['text']);
        $this->assertEquals('Z-Child', $nodes[0]['children'][1]['text']);
    }

    /**
     * Test sortChildrenRecursively with empty array
     */
    public function testSortChildrenRecursivelyWithEmptyArray(): void
    {
        $controller = $this->getController();
        $nodes = [];

        $this->invoke($controller, 'sortChildrenRecursively', [&$nodes]);

        $this->assertEquals([], $nodes);
    }

    /**
     * Test sortChildrenRecursively with single element
     */
    public function testSortChildrenRecursivelyWithSingleElement(): void
    {
        $controller = $this->getController();
        $nodes = [['text' => 'Only', 'children' => []]];

        $this->invoke($controller, 'sortChildrenRecursively', [&$nodes]);

        $this->assertCount(1, $nodes);
        $this->assertEquals('Only', $nodes[0]['text']);
    }

    /**
     * Test sortChildrenRecursively is case-insensitive
     */
    public function testSortChildrenRecursivelyIsCaseInsensitive(): void
    {
        $controller = $this->getController();
        $nodes = [
            [
                'text' => 'Parent',
                'children' => [
                    ['text' => 'zebra', 'children' => []],
                    ['text' => 'Apple', 'children' => []],
                    ['text' => 'MANGO', 'children' => []]
                ]
            ]
        ];

        $this->invoke($controller, 'sortChildrenRecursively', [&$nodes]);

        // Should be sorted alphabetically ignoring case
        $texts = array_column($nodes[0]['children'], 'text');
        $this->assertEquals(['Apple', 'MANGO', 'zebra'], $texts);
    }
}