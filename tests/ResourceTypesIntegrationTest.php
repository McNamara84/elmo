<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/DatabaseTestCase.php';

/**
 * Integration tests for Resource Types functionality with ERNIE integration
 */
final class ResourceTypesIntegrationTest extends DatabaseTestCase
{
    /**
     * Test that getResourceTypes endpoint returns valid JSON
     */
    public function testGetResourceTypesReturnsValidJson(): void
    {
        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

        // Ensure we have some test data in the database
        $this->seedResourceTypes();

        // Create controller and capture output
        $controller = new \VocabController();

        ob_start();
        $controller->getResourceTypes();
        $output = ob_get_clean();

        // Verify it's valid JSON
        $data = json_decode($output, true);
        $this->assertNotNull($data, 'Response should be valid JSON');
        $this->assertIsArray($data, 'Response should be an array');
    }

    /**
     * Test that resource types have required fields
     */
    public function testResourceTypesHaveRequiredFields(): void
    {
        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';

        $this->seedResourceTypes();

        $controller = new \VocabController();

        ob_start();
        $controller->getResourceTypes();
        $output = ob_get_clean();

        $data = json_decode($output, true);

        $this->assertNotEmpty($data, 'Should have at least one resource type');

        // Check first item has required fields
        $firstItem = $data[0];
        $this->assertArrayHasKey('id', $firstItem, 'Resource type should have id');
        $this->assertArrayHasKey('resource_type_general', $firstItem, 'Resource type should have resource_type_general');
    }

    /**
     * Test database sync creates new resource types
     */
    public function testSyncCreatesNewResourceTypes(): void
    {
        // Clear existing resource types
        $this->connection->query('DELETE FROM Resource_Type');

        // Simulate ERNIE data
        $ernieData = [
            ['id' => 100, 'name' => 'Test Dataset', 'description' => 'Test description'],
            ['id' => 101, 'name' => 'Test Software', 'description' => null],
        ];

        // Use reflection to call private method
        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name'], 'description' => $t['description'] ?? null], $ernieData);
        $method->invoke($controller, 'Resource_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'resource_type_general', 'description_col' => 'description']);

        // Verify data was inserted
        $result = $this->connection->query(
            'SELECT ernie_id, resource_type_general, description FROM Resource_Type ORDER BY ernie_id'
        );

        $this->assertEquals(2, $result->num_rows, 'Should have inserted 2 resource types');

        $row1 = $result->fetch_assoc();
        $this->assertEquals(100, $row1['ernie_id']);
        $this->assertEquals('Test Dataset', $row1['resource_type_general']);
        $this->assertEquals('Test description', $row1['description']);

        $row2 = $result->fetch_assoc();
        $this->assertEquals(101, $row2['ernie_id']);
        $this->assertEquals('Test Software', $row2['resource_type_general']);
    }

    /**
     * Test that sync updates existing resource types by ernie_id
     */
    public function testSyncUpdatesExistingResourceTypesByErnieId(): void
    {
        // Insert initial data
        $this->connection->query('DELETE FROM Resource_Type');
        $this->connection->query(
            "INSERT INTO Resource_Type (ernie_id, resource_type_general, description) 
             VALUES (100, 'Old Name', 'Old description')"
        );

        // Simulate updated ERNIE data
        $ernieData = [
            ['id' => 100, 'name' => 'Updated Name', 'description' => 'Updated description'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name'], 'description' => $t['description'] ?? null], $ernieData);
        $method->invoke($controller, 'Resource_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'resource_type_general', 'description_col' => 'description']);

        // Verify data was updated
        $result = $this->connection->query(
            'SELECT resource_type_general, description FROM Resource_Type WHERE ernie_id = 100'
        );

        $row = $result->fetch_assoc();
        $this->assertEquals('Updated Name', $row['resource_type_general']);
        $this->assertEquals('Updated description', $row['description']);
    }

    /**
     * Test that sync links existing resource types by name
     */
    public function testSyncLinksExistingResourceTypesByName(): void
    {
        // Insert data without ernie_id (legacy data)
        $this->connection->query('DELETE FROM Resource_Type');
        $this->connection->query(
            "INSERT INTO Resource_Type (resource_type_general, description) 
             VALUES ('Dataset', 'Existing dataset')"
        );

        // Get the auto-generated ID
        $localId = $this->connection->insert_id;

        // Simulate ERNIE data with matching name
        $ernieData = [
            ['id' => 10, 'name' => 'Dataset', 'description' => 'ERNIE description'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name'], 'description' => $t['description'] ?? null], $ernieData);
        $method->invoke($controller, 'Resource_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'resource_type_general', 'description_col' => 'description']);

        // Verify ernie_id was linked to existing record
        $result = $this->connection->query(
            "SELECT resource_name_id, ernie_id, description FROM Resource_Type WHERE resource_type_general = 'Dataset'"
        );

        $row = $result->fetch_assoc();
        $this->assertEquals($localId, $row['resource_name_id'], 'Should keep original local ID');
        $this->assertEquals(10, $row['ernie_id'], 'Should have linked ernie_id');
        $this->assertEquals('ERNIE description', $row['description'], 'Should have updated description');
    }

    /**
     * Test mapErnieToLocalIds returns correct structure (without ernie_id in output)
     */
    public function testMapErnieToLocalIdsReturnsCorrectStructure(): void
    {
        // Set up test data
        $this->connection->query('DELETE FROM Resource_Type');
        $this->connection->query(
            "INSERT INTO Resource_Type (ernie_id, resource_type_general, description) 
             VALUES (10, 'Dataset', 'Test')"
        );
        $localId = $this->connection->insert_id;

        $ernieData = [
            ['id' => 10, 'name' => 'Dataset', 'description' => 'Test'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('mapErnieToLocalIds');
        $result = $method->invoke($controller, 'Resource_Type', $ernieData, 'resource_name_id', 'ernie_id', ['name' => 'resource_type_general', 'description' => 'description']);

        $this->assertCount(1, $result);
        $this->assertEquals($localId, $result[0]['id']);
        // ernie_id should NOT be in the output (removed per review)
        $this->assertArrayNotHasKey('ernie_id', $result[0]);
        $this->assertEquals('Dataset', $result[0]['resource_type_general']);
        $this->assertEquals('Test', $result[0]['description']);
    }

    /**
     * Test that syncErnieToDb for resource types returns boolean and uses transaction
     */
    public function testSyncErnieToDbReturnsBoolean(): void
    {
        $ernieData = [
            ['id' => 999, 'name' => 'TestType', 'description' => 'Test'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('syncErnieToDb');
        $syncItems = array_map(fn($t) => ['ernie_id' => $t['id'], 'name' => $t['name'], 'description' => $t['description'] ?? null], $ernieData);
        $result = $method->invoke($controller, 'Resource_Type', $syncItems, ['ernie_id_col' => 'ernie_id', 'name_col' => 'resource_type_general', 'description_col' => 'description']);

        $this->assertIsBool($result);
        $this->assertTrue($result);

        // Verify data was inserted
        $dbResult = $this->connection->query(
            "SELECT * FROM Resource_Type WHERE ernie_id = 999"
        );
        $this->assertEquals(1, $dbResult->num_rows);
    }

    /**
     * Compound DataCite types are stored as the human-readable ERNIE labels.
     */
    public function testInstallSeedsUseErnieDisplayLabelsForCompoundResourceTypes(): void
    {
        $expectedLabels = [
            'Computational Notebook',
            'Data Paper',
            'Interactive Resource',
            'Output Management Plan',
            'Study Registration',
        ];

        $result = $this->connection->query(
            "SELECT resource_type_general
             FROM Resource_Type
             WHERE resource_type_general LIKE '% %'
             ORDER BY resource_type_general"
        );

        $actualLabels = [];
        while ($row = $result->fetch_assoc()) {
            $actualLabels[] = $row['resource_type_general'];
        }

        $this->assertSame($expectedLabels, $actualLabels);
    }

    /**
     * ERNIE-backed options must expose local IDs that can be saved as foreign keys.
     */
    public function testSyncedComputationalNotebookUsesSavableLocalId(): void
    {
        $seedResult = $this->connection->query(
            "SELECT resource_name_id
             FROM Resource_Type
             WHERE resource_type_general = 'Computational Notebook'"
        );
        $seedRow = $seedResult->fetch_assoc();
        $this->assertNotFalse($seedRow);
        $seededLocalId = (int) $seedRow['resource_name_id'];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();
        $reflection = new \ReflectionClass($controller);

        $syncMethod = $reflection->getMethod('syncErnieToDb');
        $syncResult = $syncMethod->invoke(
            $controller,
            'Resource_Type',
            [[
                'ernie_id' => 6,
                'name' => 'Computational Notebook',
                'description' => null,
            ]],
            [
                'ernie_id_col' => 'ernie_id',
                'name_col' => 'resource_type_general',
                'description_col' => 'description',
            ]
        );
        $this->assertTrue($syncResult);

        $mapMethod = $reflection->getMethod('mapErnieToLocalIds');
        $mappedTypes = $mapMethod->invoke(
            $controller,
            'Resource_Type',
            [[
                'id' => 6,
                'name' => 'Computational Notebook',
                'description' => null,
            ]],
            'resource_name_id',
            'ernie_id',
            [
                'name' => 'resource_type_general',
                'description' => 'description',
            ]
        );

        $this->assertSame($seededLocalId, $mappedTypes[0]['id']);

        require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        $resourceId = saveResourceInformationAndRights(
            $this->connection,
            [
                'doi' => '10.5880/GFZ.TEST.RESOURCE.TYPE.' . uniqid(),
                'year' => 2026,
                'dateCreated' => '2026-07-29',
                'resourcetype' => $mappedTypes[0]['id'],
                'language' => 1,
                'Rights' => 1,
                'title' => ['Computational notebook resource'],
                'titleType' => [1],
            ]
        );

        $this->assertGreaterThan(0, $resourceId);
        $savedResource = $this->connection->query(
            "SELECT Resource_Type_resource_name_id
             FROM Resource
             WHERE resource_id = " . (int) $resourceId
        )->fetch_assoc();
        $this->assertSame(
            $seededLocalId,
            (int) $savedResource['Resource_Type_resource_name_id']
        );
    }

    /**
     * Seeds the database with test resource types
     */
    private function seedResourceTypes(): void
    {
        // Check if table is empty
        $result = $this->connection->query('SELECT COUNT(*) as cnt FROM Resource_Type');
        $row = $result->fetch_assoc();

        if ($row['cnt'] == 0) {
            $this->connection->query(
                "INSERT INTO Resource_Type (resource_type_general, description) VALUES 
                 ('Dataset', 'Data encoded in a defined structure'),
                 ('Software', 'A computer program')"
            );
        }
    }
}
