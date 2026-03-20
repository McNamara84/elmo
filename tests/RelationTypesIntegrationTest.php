<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/DatabaseTestCase.php';

/**
 * Integration tests for Relation Types functionality with ERNIE integration
 */
final class RelationTypesIntegrationTest extends DatabaseTestCase
{
    /**
     * Test that getRelations endpoint returns valid JSON
     */
    public function testGetRelationsReturnsValidJson(): void
    {
        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

        $this->seedRelations();

        $controller = new \VocabController();

        ob_start();
        $controller->getRelations();
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertNotNull($data, 'Response should be valid JSON');
        $this->assertIsArray($data, 'Response should be an array');
    }

    /**
     * Test database sync creates new relation types
     */
    public function testSyncCreatesNewRelationTypes(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Relation');

        $ernieData = [
            ['ernie_id' => 200, 'name' => 'IsCitedBy', 'description' => 'Is cited by'],
            ['ernie_id' => 201, 'name' => 'Cites', 'description' => null],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $method->invoke($controller, 'Relation', $ernieData, [
            'ernie_id_col' => 'ernie_id',
            'name_col' => 'name',
            'description_col' => 'description'
        ]);

        $result = $this->connection->query(
            'SELECT ernie_id, name, description FROM Relation ORDER BY ernie_id'
        );

        $this->assertEquals(2, $result->num_rows, 'Should have inserted 2 relation types');

        $row1 = $result->fetch_assoc();
        $this->assertEquals(200, $row1['ernie_id']);
        $this->assertEquals('IsCitedBy', $row1['name']);
        $this->assertEquals('Is cited by', $row1['description']);

        $row2 = $result->fetch_assoc();
        $this->assertEquals(201, $row2['ernie_id']);
        $this->assertEquals('Cites', $row2['name']);
    }

    /**
     * Test that sync updates existing relation types by ernie_id
     */
    public function testSyncUpdatesExistingRelationTypesByErnieId(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Relation');
        $this->connection->query(
            "INSERT INTO Relation (ernie_id, name, description) VALUES (200, 'Old Name', 'Old desc')"
        );

        $ernieData = [
            ['ernie_id' => 200, 'name' => 'Updated Name', 'description' => 'Updated desc'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $method->invoke($controller, 'Relation', $ernieData, [
            'ernie_id_col' => 'ernie_id',
            'name_col' => 'name',
            'description_col' => 'description'
        ]);

        $result = $this->connection->query(
            'SELECT name, description FROM Relation WHERE ernie_id = 200'
        );

        $row = $result->fetch_assoc();
        $this->assertEquals('Updated Name', $row['name']);
        $this->assertEquals('Updated desc', $row['description']);
    }

    /**
     * Test that sync links existing relation types by name (legacy migration)
     */
    public function testSyncLinksExistingRelationTypesByName(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Relation');
        $this->connection->query(
            "INSERT INTO Relation (name, description) VALUES ('IsCitedBy', 'Legacy description')"
        );

        $localId = $this->connection->insert_id;

        $ernieData = [
            ['ernie_id' => 50, 'name' => 'IsCitedBy', 'description' => 'ERNIE description'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $method->invoke($controller, 'Relation', $ernieData, [
            'ernie_id_col' => 'ernie_id',
            'name_col' => 'name',
            'description_col' => 'description'
        ]);

        $result = $this->connection->query(
            "SELECT relation_id, ernie_id, description FROM Relation WHERE name = 'IsCitedBy'"
        );

        $row = $result->fetch_assoc();
        $this->assertEquals($localId, $row['relation_id'], 'Should keep original local ID');
        $this->assertEquals(50, $row['ernie_id'], 'Should have linked ernie_id');
        $this->assertEquals('ERNIE description', $row['description'], 'Should have updated description');
    }

    /**
     * Test syncErnieToDb returns boolean for relation types
     */
    public function testSyncErnieToDbReturnsBoolean(): void
    {
        $ernieData = [
            ['ernie_id' => 999, 'name' => 'TestRelation', 'description' => 'Test'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $result = $method->invoke($controller, 'Relation', $ernieData, [
            'ernie_id_col' => 'ernie_id',
            'name_col' => 'name',
            'description_col' => 'description'
        ]);

        $this->assertIsBool($result);
        $this->assertTrue($result);

        $dbResult = $this->connection->query(
            "SELECT * FROM Relation WHERE ernie_id = 999"
        );
        $this->assertEquals(1, $dbResult->num_rows);
    }

    /**
     * Test mapErnieToLocalIds returns correct structure for relation types
     */
    public function testMapErnieToLocalIdsReturnsCorrectStructure(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Relation');
        $this->connection->query(
            "INSERT INTO Relation (ernie_id, name, description) VALUES (10, 'IsCitedBy', 'Test')"
        );
        $localId = $this->connection->insert_id;

        $ernieData = [
            ['id' => 10, 'name' => 'IsCitedBy', 'description' => 'Test'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('mapErnieToLocalIds');
        $result = $method->invoke($controller, 'Relation', $ernieData, 'relation_id', 'ernie_id', [
            'name' => 'name',
            'description' => 'description'
        ]);

        $this->assertCount(1, $result);
        $this->assertEquals($localId, $result[0]['id']);
        $this->assertArrayNotHasKey('ernie_id', $result[0]);
        $this->assertEquals('IsCitedBy', $result[0]['name']);
        $this->assertEquals('Test', $result[0]['description']);
    }

    /**
     * Seeds the database with test relation types
     */
    private function seedRelations(): void
    {
        $result = $this->connection->query('SELECT COUNT(*) as cnt FROM Relation');
        $row = $result->fetch_assoc();

        if ($row['cnt'] == 0) {
            $this->connection->query(
                "INSERT INTO Relation (name, description) VALUES
                 ('IsCitedBy', 'indicates that B includes A in a citation'),
                 ('Cites', 'indicates that A includes B in a citation')"
            );
        }
    }
}
