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

    public function testBuildHierarchyCreatesStructure(): void
    {
        $controller = $this->getController();

        RdfNamespace::set('skos', 'http://www.w3.org/2004/02/skos/core#');
        RdfNamespace::set('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');

        $graph = new Graph();

        $root1 = 'http://example.com/root1';
        $root2 = 'http://example.com/root2';
        $child1 = 'http://example.com/child1';
        $na = 'http://example.com/na';
        $child2 = 'http://example.com/child2';

        $graph->addResource($root1, 'rdf:type', 'skos:Concept');
        $graph->addLiteral($root1, 'skos:prefLabel', 'Root1', 'en');
        $graph->addLiteral($root1, 'skos:definition', 'def1');

        $graph->addResource($root2, 'rdf:type', 'skos:Concept');
        $graph->addLiteral($root2, 'skos:prefLabel', 'Root2', 'en');
        $graph->addLiteral($root2, 'skos:definition', 'def2');
        $graph->addLiteral($root2, 'skos:altLabel', 'Alt1');
        $graph->addLiteral($root2, 'skos:altLabel', 'Alt2');

        $graph->addResource($child1, 'rdf:type', 'skos:Concept');
        $graph->addLiteral($child1, 'skos:prefLabel', 'Child1', 'en');
        $graph->addResource($child1, 'skos:broader', $root1);

        $graph->addResource($na, 'rdf:type', 'skos:Concept');
        $graph->addLiteral($na, 'skos:prefLabel', 'NOT APPLICABLE');

        $graph->addResource($child2, 'rdf:type', 'skos:Concept');
        $graph->addLiteral($child2, 'skos:prefLabel', 'Child2', 'en');
        $graph->addResource($child2, 'skos:broader', $na);

        $hierarchy = $this->invoke($controller, 'buildHierarchy', [$graph, 'testscheme', 'Test Scheme']);

        $this->assertCount(3, $hierarchy);
        $labels = array_column($hierarchy, 'text');
        sort($labels, SORT_STRING | SORT_FLAG_CASE);
        $this->assertEquals(['Child2', 'Root1', 'Root2'], $labels);

        foreach ($hierarchy as $node) {
            if ($node['text'] === 'Root1') {
                $this->assertCount(1, $node['children']);
                $this->assertEquals('Child1', $node['children'][0]['text']);
            }
            if ($node['text'] === 'Root2') {
                $this->assertStringContainsString('Alt1, Alt2', $node['description']);
            }
        }
    }
}