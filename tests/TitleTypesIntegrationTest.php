<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/DatabaseTestCase.php';

/**
 * Integration tests for Title Types functionality with ERNIE integration
 */
final class TitleTypesIntegrationTest extends DatabaseTestCase
{
    /**
     * Test that getTitleTypes endpoint returns valid JSON
     */
    public function testGetTitleTypesReturnsValidJson(): void
    {
        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

        // Ensure we have some test data in the database
        $this->seedTitleTypes();

        // Create controller and capture output
        $controller = new \VocabController();

        ob_start();
        $controller->getTitleTypes();
        $output = ob_get_clean();

        // Verify it's valid JSON
        $data = json_decode($output, true);
        $this->assertNotNull($data, 'Response should be valid JSON');
        $this->assertIsArray($data, 'Response should be an array');
    }

    /**
     * Test that title types have required fields
     */
    public function testTitleTypesHaveRequiredFields(): void
    {
        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

        $this->seedTitleTypes();

        $controller = new \VocabController();

        ob_start();
        $controller->getTitleTypes();
        $output = ob_get_clean();

        $data = json_decode($output, true);

        $this->assertNotEmpty($data, 'Should have at least one title type');

        // Check first item has required fields
        $firstItem = $data[0];
        $this->assertArrayHasKey('id', $firstItem, 'Title type should have id');
        $this->assertArrayHasKey('name', $firstItem, 'Title type should have name');
    }

    /**
     * Test that title types response does not expose ernie_id
     */
    public function testTitleTypesResponseDoesNotExposeErnieId(): void
    {
        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

        $this->seedTitleTypes();

        $controller = new \VocabController();

        ob_start();
        $controller->getTitleTypes();
        $output = ob_get_clean();

        $data = json_decode($output, true);

        foreach ($data as $type) {
            $this->assertArrayNotHasKey('ernie_id', $type, 'ernie_id should not be exposed to frontend');
            $this->assertArrayNotHasKey('slug', $type, 'slug should not be exposed to frontend');
        }
    }

    /**
     * Test database sync creates new title types
     */
    public function testSyncCreatesNewTitleTypes(): void
    {
        // Clear existing title types (need to clear FK references first)
        $this->connection->query('DELETE FROM Title');
        $this->connection->query('DELETE FROM Title_Type');

        // Simulate ERNIE data
        $ernieData = [
            ['id' => 100, 'name' => 'Test Main Title', 'slug' => 'test-main-title'],
            ['id' => 101, 'name' => 'Test Alternative', 'slug' => 'test-alternative'],
        ];

        // Use reflection to call private method
        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name']], $ernieData);
        $method->invoke($controller, 'Title_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'name']);

        // Verify data was inserted
        $result = $this->connection->query(
            'SELECT ernie_id, name FROM Title_Type ORDER BY ernie_id'
        );

        $this->assertEquals(2, $result->num_rows, 'Should have inserted 2 title types');

        $row1 = $result->fetch_assoc();
        $this->assertEquals(100, $row1['ernie_id']);
        $this->assertEquals('Test Main Title', $row1['name']);

        $row2 = $result->fetch_assoc();
        $this->assertEquals(101, $row2['ernie_id']);
        $this->assertEquals('Test Alternative', $row2['name']);
    }

    /**
     * Test that sync updates existing title types by ernie_id
     */
    public function testSyncUpdatesExistingTitleTypesByErnieId(): void
    {
        // Insert initial data
        $this->connection->query('DELETE FROM Title');
        $this->connection->query('DELETE FROM Title_Type');
        $this->connection->query(
            "INSERT INTO Title_Type (ernie_id, name) VALUES (100, 'Old Name')"
        );

        // Simulate updated ERNIE data
        $ernieData = [
            ['id' => 100, 'name' => 'Updated Name', 'slug' => 'updated-name'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name']], $ernieData);
        $method->invoke($controller, 'Title_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'name']);

        // Verify data was updated
        $result = $this->connection->query(
            'SELECT name FROM Title_Type WHERE ernie_id = 100'
        );

        $row = $result->fetch_assoc();
        $this->assertEquals('Updated Name', $row['name']);
    }

    /**
     * Test that sync links existing title types by name (legacy migration)
     */
    public function testSyncLinksExistingTitleTypesByName(): void
    {
        // Insert data without ernie_id (legacy data)
        $this->connection->query('DELETE FROM Title');
        $this->connection->query('DELETE FROM Title_Type');
        $this->connection->query(
            "INSERT INTO Title_Type (name) VALUES ('Main Title')"
        );

        // Get the auto-generated ID
        $localId = $this->connection->insert_id;

        // Simulate ERNIE data with matching name
        $ernieData = [
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name']], $ernieData);
        $method->invoke($controller, 'Title_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'name']);

        // Verify ernie_id was linked to existing record
        $result = $this->connection->query(
            "SELECT title_type_id, ernie_id FROM Title_Type WHERE name = 'Main Title'"
        );

        $row = $result->fetch_assoc();
        $this->assertEquals($localId, $row['title_type_id'], 'Should keep original local ID');
        $this->assertEquals(1, $row['ernie_id'], 'Should have linked ernie_id');
    }

    /**
     * Test mapErnieToLocalIds returns correct structure for title types
     */
    public function testMapErnieToLocalIdsReturnsCorrectStructure(): void
    {
        // Set up test data
        $this->connection->query('DELETE FROM Title');
        $this->connection->query('DELETE FROM Title_Type');
        $this->connection->query(
            "INSERT INTO Title_Type (ernie_id, name) VALUES (1, 'Main Title')"
        );
        $localId = $this->connection->insert_id;

        $ernieData = [
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('mapErnieToLocalIds');
        $result = $method->invoke($controller, 'Title_Type', $ernieData, 'title_type_id', 'ernie_id', ['name' => 'name']);

        $this->assertCount(1, $result);
        $this->assertEquals($localId, $result[0]['id']);
        $this->assertEquals('Main Title', $result[0]['name']);
        // ernie_id and slug should NOT be in the output
        $this->assertArrayNotHasKey('ernie_id', $result[0]);
        $this->assertArrayNotHasKey('slug', $result[0]);
    }

    /**
     * Test that syncErnieToDb for title types returns boolean and uses transaction
     */
    public function testSyncErnieToDbReturnsBoolean(): void
    {
        $ernieData = [
            ['id' => 999, 'name' => 'TestType', 'slug' => 'test-type'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name']], $ernieData);
        $result = $method->invoke($controller, 'Title_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'name']);

        $this->assertIsBool($result);
        $this->assertTrue($result);

        // Verify data was inserted
        $dbResult = $this->connection->query(
            "SELECT * FROM Title_Type WHERE ernie_id = 999"
        );
        $this->assertEquals(1, $dbResult->num_rows);
    }

    /**
     * Test sync with all five current ERNIE title types
     */
    public function testSyncWithAllFiveErnieTitleTypes(): void
    {
        $this->connection->query('DELETE FROM Title');
        $this->connection->query('DELETE FROM Title_Type');

        // Full ERNIE response as of current configuration
        $ernieData = [
            ['id' => 2, 'name' => 'Alternative Title', 'slug' => 'alternative-title'],
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title'],
            ['id' => 5, 'name' => 'Other', 'slug' => 'other'],
            ['id' => 3, 'name' => 'Subtitle', 'slug' => 'subtitle'],
            ['id' => 4, 'name' => 'Translated Title', 'slug' => 'translated-title'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name']], $ernieData);
        $result = $method->invoke($controller, 'Title_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'name']);

        $this->assertTrue($result);

        // Verify all 5 types were inserted
        $dbResult = $this->connection->query('SELECT COUNT(*) as cnt FROM Title_Type');
        $row = $dbResult->fetch_assoc();
        $this->assertEquals(5, $row['cnt'], 'Should have all 5 title types');

        // Verify each has correct ernie_id
        foreach ($ernieData as $expected) {
            $stmt = $this->connection->prepare(
                'SELECT name FROM Title_Type WHERE ernie_id = ?'
            );
            $stmt->bind_param('i', $expected['id']);
            $stmt->execute();
            $result = $stmt->get_result();
            $this->assertEquals(1, $result->num_rows, "Should find title type with ernie_id {$expected['id']}");
            $row = $result->fetch_assoc();
            $this->assertEquals($expected['name'], $row['name']);
        }
    }

    /**
     * Test that legacy title types (without ernie_id) are properly migrated
     */
    public function testLegacyMigrationPreservesExistingTitles(): void
    {
        // Set up legacy data (3 original title types without ernie_id)
        $this->connection->query('DELETE FROM Title');
        $this->connection->query('DELETE FROM Title_Type');
        $this->connection->query("INSERT INTO Title_Type (name) VALUES ('Main Title')");
        $mainTitleLocalId = $this->connection->insert_id;
        $this->connection->query("INSERT INTO Title_Type (name) VALUES ('Alternative Title')");
        $altTitleLocalId = $this->connection->insert_id;
        $this->connection->query("INSERT INTO Title_Type (name) VALUES ('Translated Title')");
        $transTitleLocalId = $this->connection->insert_id;

        // Insert a title referencing a legacy title type
        $this->connection->query(
            "INSERT INTO Resource (doi) VALUES ('10.5880/test.legacy')"
        );
        $resourceId = $this->connection->insert_id;
        $this->connection->query(
            "INSERT INTO Title (text, Title_Type_fk, Resource_resource_id) 
             VALUES ('Test Legacy Title', {$mainTitleLocalId}, {$resourceId})"
        );

        // Simulate ERNIE sync with all 5 types
        $ernieData = [
            ['id' => 2, 'name' => 'Alternative Title', 'slug' => 'alternative-title'],
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title'],
            ['id' => 5, 'name' => 'Other', 'slug' => 'other'],
            ['id' => 3, 'name' => 'Subtitle', 'slug' => 'subtitle'],
            ['id' => 4, 'name' => 'Translated Title', 'slug' => 'translated-title'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name']], $ernieData);
        $method->invoke($controller, 'Title_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'name']);

        // Verify local IDs are preserved for existing types
        $result = $this->connection->query(
            "SELECT title_type_id FROM Title_Type WHERE name = 'Main Title'"
        );
        $row = $result->fetch_assoc();
        $this->assertEquals($mainTitleLocalId, $row['title_type_id'], 'Main Title local ID should be preserved');

        // Verify the FK reference still works
        $result = $this->connection->query(
            "SELECT t.text, tt.name as title_type_name 
             FROM Title t 
             JOIN Title_Type tt ON t.Title_Type_fk = tt.title_type_id 
             WHERE t.Resource_resource_id = {$resourceId}"
        );
        $row = $result->fetch_assoc();
        $this->assertEquals('Test Legacy Title', $row['text']);
        $this->assertEquals('Main Title', $row['title_type_name']);
    }

    /**
     * Seeds the database with test title types
     */
    private function seedTitleTypes(): void
    {
        // Check if table is empty
        $result = $this->connection->query('SELECT COUNT(*) as cnt FROM Title_Type');
        $row = $result->fetch_assoc();

        if ($row['cnt'] == 0) {
            $this->connection->query(
                "INSERT INTO Title_Type (name) VALUES 
                 ('Main Title'),
                 ('Alternative Title'),
                 ('Translated Title')"
            );
        }
    }
}
