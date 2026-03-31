<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_usedinstruments.php';

final class SaveUsedInstrumentsTest extends DatabaseTestCase
{
    /**
     * Helper to create a test resource
     */
    private function createTestResource(string $doiSuffix, string $title): int
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST." . $doiSuffix,
            "year" => 2024,
            "dateCreated" => "2024-01-15",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => [$title],
            "titleType" => [1]
        ];
        return saveResourceInformationAndRights($this->connection, $resourceData);
    }

    /**
     * Keine Instrument-Daten im POST - sollte erfolgreich durchlaufen
     */
    public function testSaveWithNoInstrumentData()
    {
        $resource_id = $this->createTestResource("NO.INSTRUMENTS", "Test No Instruments");

        $postData = [];

        $result = saveUsedInstruments($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Ohne Instrument-Daten sollte true zurückgegeben werden.");

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Related_Work");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine Related Work Einträge gespeichert worden sein.");
    }

    /**
     * Leere Arrays im POST - sollte erfolgreich durchlaufen
     */
    public function testSaveWithEmptyArrays()
    {
        $resource_id = $this->createTestResource("EMPTY.INSTRUMENTS", "Test Empty Instruments");

        $postData = [
            "instrumentPid" => [],
            "instrumentPidType" => []
        ];

        $result = saveUsedInstruments($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Bei leeren Arrays sollte true zurückgegeben werden.");

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Related_Work");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine Related Work Einträge gespeichert worden sein.");
    }

    /**
     * Ein einzelnes Instrument mit Handle-PID wird korrekt gespeichert
     */
    public function testSaveSingleInstrumentWithHandle()
    {
        $resource_id = $this->createTestResource("SINGLE.INSTRUMENT", "Test Single Instrument");

        $postData = [
            "instrumentPid" => ["21.11157/1234"],
            "instrumentPidType" => ["Handle"]
        ];

        $result = saveUsedInstruments($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Das Speichern eines einzelnen Instruments sollte erfolgreich sein.");

        // Check Related_Work entry
        $stmt = $this->connection->prepare("SELECT * FROM Related_Work WHERE Identifier = ?");
        $pid = "21.11157/1234";
        $stmt->bind_param("s", $pid);
        $stmt->execute();
        $relatedWork = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($relatedWork, "Der Related Work Eintrag für das Instrument sollte existieren.");

        // Verify relation is IsCollectedBy
        $stmt = $this->connection->prepare("SELECT name FROM Relation WHERE relation_id = ?");
        $stmt->bind_param("i", $relatedWork["relation_fk"]);
        $stmt->execute();
        $relationName = $stmt->get_result()->fetch_assoc()['name'];
        $this->assertEquals("IsCollectedBy", $relationName, "Die Relation sollte 'IsCollectedBy' sein.");

        // Verify identifier type is Handle
        $stmt = $this->connection->prepare("SELECT name FROM Identifier_Type WHERE identifier_type_id = ?");
        $stmt->bind_param("i", $relatedWork["identifier_type_fk"]);
        $stmt->execute();
        $identifierTypeName = $stmt->get_result()->fetch_assoc()['name'];
        $this->assertEquals("Handle", $identifierTypeName, "Der Identifier-Typ sollte 'Handle' sein.");

        // Check Resource_has_Related_Work link
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Related_Work WHERE Resource_resource_id = ? AND Related_Work_related_work_id = ?");
        $stmt->bind_param("ii", $resource_id, $relatedWork["related_work_id"]);
        $stmt->execute();
        $linkCount = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(1, $linkCount, "Die Verknüpfung zwischen Resource und Instrument sollte existieren.");
    }

    /**
     * Mehrere Instrumente werden korrekt gespeichert
     */
    public function testSaveMultipleInstruments()
    {
        $resource_id = $this->createTestResource("MULTI.INSTRUMENTS", "Test Multiple Instruments");

        $postData = [
            "instrumentPid" => ["21.11157/1001", "21.11157/1002", "21.11157/1003"],
            "instrumentPidType" => ["Handle", "Handle", "Handle"]
        ];

        $result = saveUsedInstruments($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Das Speichern mehrerer Instrumente sollte erfolgreich sein.");

        // Check count
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Related_Work");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(3, $count, "Es sollten genau drei Instrument-Einträge gespeichert worden sein.");

        // Check resource links
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Related_Work WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $linkCount = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(3, $linkCount, "Alle drei Instrumente sollten mit der Resource verknüpft sein.");
    }

    /**
     * Leere PIDs in der Mitte werden übersprungen
     */
    public function testSaveSkipsEmptyPids()
    {
        $resource_id = $this->createTestResource("SKIP.EMPTY", "Test Skip Empty PIDs");

        $postData = [
            "instrumentPid" => ["21.11157/1001", "", "21.11157/1003"],
            "instrumentPidType" => ["Handle", "Handle", "Handle"]
        ];

        $result = saveUsedInstruments($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Das Speichern mit leeren PIDs sollte erfolgreich sein.");

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Related_Work");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(2, $count, "Nur die zwei nicht-leeren PIDs sollten gespeichert worden sein.");
    }

    /**
     * Dynamischer pidType wird korrekt unterstützt
     */
    public function testSaveWithDynamicPidType()
    {
        $resource_id = $this->createTestResource("DYNAMIC.PIDTYPE", "Test Dynamic PID Type");

        $postData = [
            "instrumentPid" => ["10.1234/test-doi-instrument"],
            "instrumentPidType" => ["DOI"]
        ];

        $result = saveUsedInstruments($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Das Speichern mit DOI-PidType sollte erfolgreich sein.");

        $stmt = $this->connection->prepare("SELECT * FROM Related_Work WHERE Identifier = ?");
        $pid = "10.1234/test-doi-instrument";
        $stmt->bind_param("s", $pid);
        $stmt->execute();
        $relatedWork = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($relatedWork, "Das Instrument mit DOI-PID sollte gespeichert worden sein.");

        // Verify identifier type is DOI
        $stmt = $this->connection->prepare("SELECT name FROM Identifier_Type WHERE identifier_type_id = ?");
        $stmt->bind_param("i", $relatedWork["identifier_type_fk"]);
        $stmt->execute();
        $identifierTypeName = $stmt->get_result()->fetch_assoc()['name'];
        $this->assertEquals("DOI", $identifierTypeName, "Der Identifier-Typ sollte 'DOI' sein.");
    }

    /**
     * Fehlender instrumentPidType fällt auf Handle zurück
     */
    public function testSaveWithMissingPidTypeFallsBackToHandle()
    {
        $resource_id = $this->createTestResource("FALLBACK.HANDLE", "Test Fallback Handle");

        $postData = [
            "instrumentPid" => ["21.11157/fallback-test"],
            "instrumentPidType" => [] // Empty array - should default to Handle
        ];

        $result = saveUsedInstruments($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Das Speichern ohne expliziten PidType sollte erfolgreich sein.");

        $stmt = $this->connection->prepare("SELECT * FROM Related_Work WHERE Identifier = ?");
        $pid = "21.11157/fallback-test";
        $stmt->bind_param("s", $pid);
        $stmt->execute();
        $relatedWork = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($relatedWork, "Das Instrument sollte mit Handle-Fallback gespeichert worden sein.");

        // Verify identifier type is Handle (default)
        $stmt = $this->connection->prepare("SELECT name FROM Identifier_Type WHERE identifier_type_id = ?");
        $stmt->bind_param("i", $relatedWork["identifier_type_fk"]);
        $stmt->execute();
        $identifierTypeName = $stmt->get_result()->fetch_assoc()['name'];
        $this->assertEquals("Handle", $identifierTypeName, "Der Default-PidType sollte 'Handle' sein.");
    }
}
