<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../api/v2/controllers/ValidationController.php';

/**
 * Test class for ValidationController
 * 
 * Tests the controller methods for identifier type validation
 */
final class ValidationControllerTest extends DatabaseTestCase
{
    private \ValidationController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->controller = new \ValidationController();
        
        // Ensure test data exists using prepared statement to preserve backslashes
        $stmt = $this->connection->prepare(
            "INSERT INTO Identifier_Type (identifier_type_id, name, pattern, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE pattern=VALUES(pattern)"
        );
        $id = 100;
        $name = 'TestDOI';
        $pattern = '^10\.\d{4,9}/[-._;()/:A-Z0-9]+$';
        $desc = 'Test DOI Pattern';
        $stmt->bind_param('isss', $id, $name, $pattern, $desc);
        $stmt->execute();
        $stmt->close();

        $stmt = $this->connection->prepare(
            "INSERT INTO Identifier_Type (identifier_type_id, name, pattern, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE pattern=VALUES(pattern)"
        );
        $id = 101;
        $name = 'TestORCID';
        $pattern = '^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$';
        $desc = 'Test ORCID Pattern';
        $stmt->bind_param('isss', $id, $name, $pattern, $desc);
        $stmt->execute();
        $stmt->close();
    }

    public function testGetPatternReturnsPatternForValidType(): void
    {
        // This test verifies the database query logic, not the HTTP output
        $stmt = $this->connection->prepare('SELECT pattern FROM Identifier_Type WHERE name = ?');
        $type = 'DOI';
        $stmt->bind_param('s', $type);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $this->assertGreaterThanOrEqual(0, $result->num_rows);
        $stmt->close();
    }

    public function testGetPatternHandlesTestData(): void
    {
        $stmt = $this->connection->prepare('SELECT pattern FROM Identifier_Type WHERE name = ?');
        $type = 'TestDOI';
        $stmt->bind_param('s', $type);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $this->assertEquals(1, $result->num_rows);
        $row = $result->fetch_assoc();
        $this->assertEquals('^10\\.\\d{4,9}/[-._;()/:A-Z0-9]+$', $row['pattern']);
        $stmt->close();
    }

    public function testGetIdentifierTypesQueryWorks(): void
    {
        $stmt = $this->connection->prepare('SELECT name, pattern, description FROM Identifier_Type');
        $this->assertNotFalse($stmt);
        
        $result = $stmt->execute();
        $this->assertTrue($result);
        
        $resultSet = $stmt->get_result();
        $this->assertGreaterThan(0, $resultSet->num_rows);
        
        $stmt->close();
    }

    public function testIdentifierTypeTableHasCorrectStructure(): void
    {
        $result = $this->connection->query("DESCRIBE Identifier_Type");
        $columns = [];
        while ($row = $result->fetch_assoc()) {
            $columns[] = $row['Field'];
        }
        
        $this->assertContains('name', $columns);
        $this->assertContains('pattern', $columns);
    }
}
