<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/DatabaseTestCase.php';

/**
 * Integration tests for Identifier Types functionality with ERNIE integration
 */
final class IdentifierTypesIntegrationTest extends DatabaseTestCase
{
    /**
     * Test that syncIdentifierTypesToDb creates new identifier types
     */
    public function testSyncCreatesNewIdentifierTypes(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Identifier_Type');

        $ernieData = [
            ['id' => 300, 'name' => 'DOI', 'description' => 'Digital Object Identifier', 'pattern' => '^10\\.\\d{4,9}/[-._;()/:A-Z0-9]+$'],
            ['id' => 301, 'name' => 'URL', 'description' => 'Uniform Resource Locator', 'pattern' => '^https?://'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();
        $controller->syncIdentifierTypesToDb($ernieData);

        $result = $this->connection->query(
            'SELECT ernie_id, name, description, pattern, isShown FROM Identifier_Type ORDER BY ernie_id'
        );

        $this->assertEquals(2, $result->num_rows, 'Should have inserted 2 identifier types');

        $row1 = $result->fetch_assoc();
        $this->assertEquals(300, $row1['ernie_id']);
        $this->assertEquals('DOI', $row1['name']);
        $this->assertEquals('Digital Object Identifier', $row1['description']);
        $this->assertNotEmpty($row1['pattern']);
        $this->assertEquals(1, $row1['isShown']);

        $row2 = $result->fetch_assoc();
        $this->assertEquals(301, $row2['ernie_id']);
        $this->assertEquals('URL', $row2['name']);
        $this->assertEquals(1, $row2['isShown']);
    }

    /**
     * Test that sync updates existing identifier types by ernie_id
     */
    public function testSyncUpdatesExistingIdentifierTypesByErnieId(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Identifier_Type');
        $this->connection->query(
            "INSERT INTO Identifier_Type (ernie_id, name, description, pattern, isShown)
             VALUES (300, 'Old DOI', 'Old desc', '^old$', 1)"
        );

        $ernieData = [
            ['id' => 300, 'name' => 'DOI', 'description' => 'Updated desc', 'pattern' => '^10\\.\\d+'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();
        $controller->syncIdentifierTypesToDb($ernieData);

        $result = $this->connection->query(
            'SELECT name, description, pattern, isShown FROM Identifier_Type WHERE ernie_id = 300'
        );

        $row = $result->fetch_assoc();
        $this->assertEquals('DOI', $row['name']);
        $this->assertEquals('Updated desc', $row['description']);
        $this->assertEquals('^10\\.\\d+', $row['pattern']);
        $this->assertEquals(1, $row['isShown']);
    }

    /**
     * Test that sync links existing identifier types by name (legacy migration)
     */
    public function testSyncLinksExistingIdentifierTypesByName(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Identifier_Type');
        $this->connection->query(
            "INSERT INTO Identifier_Type (name, description, pattern, isShown)
             VALUES ('DOI', 'Existing DOI', '^existing$', 1)"
        );

        $localId = $this->connection->insert_id;

        $ernieData = [
            ['id' => 50, 'name' => 'DOI', 'description' => 'ERNIE DOI', 'pattern' => '^10\\.\\d+'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();
        $controller->syncIdentifierTypesToDb($ernieData);

        $result = $this->connection->query(
            "SELECT identifier_type_id, ernie_id, description, pattern FROM Identifier_Type WHERE name = 'DOI'"
        );

        $row = $result->fetch_assoc();
        $this->assertEquals($localId, $row['identifier_type_id'], 'Should keep original local ID');
        $this->assertEquals(50, $row['ernie_id'], 'Should have linked ernie_id');
        $this->assertEquals('ERNIE DOI', $row['description'], 'Should have updated description');
        $this->assertEquals('^10\\.\\d+', $row['pattern'], 'Should have updated pattern');
    }

    /**
     * Test that types removed from ERNIE get deactivated (isShown=0)
     */
    public function testSyncDeactivatesRemovedTypes(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Identifier_Type');

        // Insert 3 types initially, all ERNIE-linked and visible
        $this->connection->query(
            "INSERT INTO Identifier_Type (ernie_id, name, description, pattern, isShown) VALUES
             (100, 'DOI', 'DOI desc', '^doi$', 1),
             (101, 'URL', 'URL desc', '^url$', 1),
             (102, 'ARK', 'ARK desc', '^ark$', 1)"
        );

        // Sync with only 2 types – ARK (ernie_id=102) is no longer in ERNIE
        $ernieData = [
            ['id' => 100, 'name' => 'DOI', 'description' => 'DOI desc', 'pattern' => '^doi$'],
            ['id' => 101, 'name' => 'URL', 'description' => 'URL desc', 'pattern' => '^url$'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();
        $controller->syncIdentifierTypesToDb($ernieData);

        // DOI and URL should still be visible
        $result = $this->connection->query(
            "SELECT name, isShown FROM Identifier_Type WHERE ernie_id IN (100, 101) ORDER BY ernie_id"
        );
        $this->assertEquals(2, $result->num_rows);
        while ($row = $result->fetch_assoc()) {
            $this->assertEquals(1, $row['isShown'], "{$row['name']} should still be visible");
        }

        // ARK should be deactivated
        $result = $this->connection->query(
            "SELECT isShown FROM Identifier_Type WHERE ernie_id = 102"
        );
        $row = $result->fetch_assoc();
        $this->assertEquals(0, $row['isShown'], 'ARK should be deactivated (isShown=0)');
    }

    /**
     * Test that locally-added types (no ernie_id) are not affected by sync
     */
    public function testSyncDoesNotAffectLocalTypes(): void
    {
        $this->connection->query('DELETE FROM Related_Work');
        $this->connection->query('DELETE FROM Identifier_Type');

        // Insert a local type (no ernie_id) and an ERNIE type
        $this->connection->query(
            "INSERT INTO Identifier_Type (name, description, pattern, isShown) VALUES
             ('LocalType', 'Local only', '^local$', 1)"
        );
        $this->connection->query(
            "INSERT INTO Identifier_Type (ernie_id, name, description, pattern, isShown) VALUES
             (100, 'DOI', 'DOI desc', '^doi$', 1)"
        );

        // Sync with only DOI – LocalType should remain unchanged
        $ernieData = [
            ['id' => 100, 'name' => 'DOI', 'description' => 'DOI desc', 'pattern' => '^doi$'],
        ];

        require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
        $controller = new \VocabController();
        $controller->syncIdentifierTypesToDb($ernieData);

        // Local type should still be visible and unchanged
        $result = $this->connection->query(
            "SELECT isShown FROM Identifier_Type WHERE name = 'LocalType'"
        );
        $row = $result->fetch_assoc();
        $this->assertEquals(1, $row['isShown'], 'Local type (no ernie_id) should not be deactivated');
    }

    /**
     * Test that getActiveIdentifierTypes uses VocabController sync
     */
    public function testGetActiveIdentifierTypesReturnsValidJson(): void
    {
        require_once __DIR__ . '/../api/v2/controllers/ValidationController.php';

        $this->seedIdentifierTypes();

        $controller = new \ValidationController();

        ob_start();
        $controller->getActiveIdentifierTypes();
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertNotNull($data, 'Response should be valid JSON');
        $this->assertArrayHasKey('identifierTypes', $data, 'Response should have identifierTypes key');
    }

    /**
     * Seeds the database with test identifier types
     */
    private function seedIdentifierTypes(): void
    {
        $result = $this->connection->query('SELECT COUNT(*) as cnt FROM Identifier_Type');
        $row = $result->fetch_assoc();

        if ($row['cnt'] == 0) {
            $this->connection->query(
                "INSERT INTO Identifier_Type (name, description, pattern, isShown) VALUES
                 ('DOI', 'Digital Object Identifier', '^10\\.\\d{4,9}/[-._;()/:A-Z0-9]+$', 1),
                 ('URL', 'Uniform Resource Locator', '^https?://', 1)"
            );
        }
    }
}
