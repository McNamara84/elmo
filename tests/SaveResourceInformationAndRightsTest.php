<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';

/**
 * Testklasse für die Funktionalität zum Speichern von Ressourceninformationen und Rechten.
 * 
 * Diese Klasse enthält verschiedene Testfälle, die die korrekte Funktionsweise
 * der saveResourceInformationAndRights-Funktion unter verschiedenen Bedingungen überprüfen.
 */
class SaveResourceInformationAndRightsTest extends TestCase
{
    private $connection;

    /**
     * Setzt die Testumgebung auf.
     * 
     * Stellt eine Verbindung zur Testdatenbank her und überspringt den Test,
     * falls die Datenbank nicht verfügbar ist.
     */
    protected function setUp(): void
    {
        global $connection;
        if (!$connection) {
            $connection = connectDb();
        }
        $this->connection = $connection;
        // Überprüfen, ob die Testdatenbank verfügbar ist
        $dbname = 'mde2-msl-test';
        if ($this->connection->select_db($dbname) === false) {
            // Testdatenbank erstellen
            $connection->query("CREATE DATABASE " . $dbname);
            $connection->select_db($dbname);
            // install.php ausführen
            require 'install.php';
        }
    }

    /**
     * Bereinigt die Testdaten nach jedem Test.
     */
    protected function tearDown(): void
    {
        $this->cleanupTestData();
    }

    /**
     * Löscht alle Testdaten aus der Datenbank.
     */
    private function cleanupTestData()
    {
        $this->connection->query("SET FOREIGN_KEY_CHECKS=0");
        $this->connection->query("DELETE FROM Resource_has_Spatial_Temporal_Coverage");
        $this->connection->query("DELETE FROM Resource_has_Thesaurus_Keywords");
        $this->connection->query("DELETE FROM Resource_has_Related_Work");
        $this->connection->query("DELETE FROM Resource_has_Originating_Laboratory");
        $this->connection->query("DELETE FROM Resource_has_Funding_Reference");
        $this->connection->query("DELETE FROM Resource_has_Contact_Person");
        $this->connection->query("DELETE FROM Resource_has_Contributor_Person");
        $this->connection->query("DELETE FROM Resource_has_Contributor_Institution");
        $this->connection->query("DELETE FROM Resource_has_Author");
        $this->connection->query("DELETE FROM Resource_has_Free_Keywords");
        $this->connection->query("DELETE FROM Author_has_Affiliation");
        $this->connection->query("DELETE FROM Contact_Person_has_Affiliation");
        $this->connection->query("DELETE FROM Contributor_Person_has_Affiliation");
        $this->connection->query("DELETE FROM Contributor_Institution_has_Affiliation");
        $this->connection->query("DELETE FROM Originating_Laboratory_has_Affiliation");
        $this->connection->query("DELETE FROM Free_Keywords");
        $this->connection->query("DELETE FROM Affiliation");
        $this->connection->query("DELETE FROM Title");
        $this->connection->query("DELETE FROM Description");
        $this->connection->query("DELETE FROM Spatial_Temporal_Coverage");
        $this->connection->query("DELETE FROM Thesaurus_Keywords");
        $this->connection->query("DELETE FROM Related_Work");
        $this->connection->query("DELETE FROM Originating_Laboratory");
        $this->connection->query("DELETE FROM Funding_Reference");
        $this->connection->query("DELETE FROM Contact_Person");
        $this->connection->query("DELETE FROM Contributor_Person");
        $this->connection->query("DELETE FROM Contributor_Institution");
        $this->connection->query("DELETE FROM Author");
        $this->connection->query("DELETE FROM Resource");
        $this->connection->query("SET FOREIGN_KEY_CHECKS=1");
    }

    /**
     * Testet das Speichern von Ressourceninformationen und Rechten mit allen Feldern.
     */
    public function testSaveResourceInformationAndRights()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "dateEmbargo" => "2024-12-31",
            "resourcetype" => 1,
            "version" => 1.0,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Testing Dataset for Unit Test"],
            "titleType" => [1]
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);

        $this->assertIsInt($resource_id, "Die Funktion sollte eine gültige Resource ID zurückgeben.");
        $this->assertGreaterThan(0, $resource_id, "Die zurückgegebene Resource ID sollte größer als 0 sein.");

        // Überprüfen, ob die Daten korrekt in die Datenbank eingetragen wurden
        $stmt = $this->connection->prepare("SELECT * FROM Resource WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $this->assertEquals($postData["doi"], $row["doi"], "Die DOI wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["year"], $row["year"], "Das Jahr wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["dateCreated"], $row["dateCreated"], "Das Erstellungsdatum wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["dateEmbargo"], $row["dateEmbargoUntil"], "Das Embargodatum wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["resourcetype"], $row["Resource_Type_resource_name_id"], "Der Ressourcentyp wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["version"], $row["version"], "Die Version wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["language"], $row["Language_language_id"], "Die Sprache wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["Rights"], $row["Rights_rights_id"], "Die Rechte wurden nicht korrekt gespeichert.");

        // Überprüfen, ob der Titel korrekt eingetragen wurde
        $stmt = $this->connection->prepare("SELECT * FROM Title WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $this->assertEquals($postData["title"][0], $row["text"], "Der Titel wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["titleType"][0], $row["Title_Type_fk"], "Der Titeltyp wurde nicht korrekt gespeichert.");
    }

    /**
     * Testet das Speichern von Ressourceninformationen mit drei Titeln.
     */
    public function testSaveResourceInformationAndRightsWithThreeTitles()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ.45.57",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "dateEmbargo" => "2024-12-31",
            "resourcetype" => 1,
            "version" => 1.1,
            "language" => 2,
            "Rights" => 2,
            "title" => [
                "Main Title for Multiple Title Test",
                "Subtitle for Multiple Title Test",
                "Alternative Title for Multiple Title Test"
            ],
            "titleType" => [1, 2, 3]  // Angenommen, 1 = Main, 2 = Subtitle, 3 = Alternative
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);

        $this->assertIsInt($resource_id, "Die Funktion sollte eine gültige Resource ID zurückgeben.");
        $this->assertGreaterThan(0, $resource_id, "Die zurückgegebene Resource ID sollte größer als 0 sein.");

        // Überprüfen, ob die Ressource-Daten korrekt in die Datenbank eingetragen wurden
        $stmt = $this->connection->prepare("SELECT * FROM Resource WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $this->assertEquals($postData["doi"], $row["doi"], "Die DOI wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["year"], $row["year"], "Das Jahr wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["dateCreated"], $row["dateCreated"], "Das Erstellungsdatum wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["dateEmbargo"], $row["dateEmbargoUntil"], "Das Embargodatum wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["resourcetype"], $row["Resource_Type_resource_name_id"], "Der Ressourcentyp wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["version"], $row["version"], "Die Version wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["language"], $row["Language_language_id"], "Die Sprache wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["Rights"], $row["Rights_rights_id"], "Die Rechte wurden nicht korrekt gespeichert.");

        // Überprüfen, ob alle drei Titel korrekt eingetragen wurden
        $stmt = $this->connection->prepare("SELECT * FROM Title WHERE Resource_resource_id = ? ORDER BY Title_Type_fk");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(3, $result->num_rows, "Es sollten genau drei Titel gespeichert worden sein");

        $index = 0;
        while ($row = $result->fetch_assoc()) {
            $this->assertEquals($postData["title"][$index], $row["text"], "Der Titel an Position $index stimmt nicht überein");
            $this->assertEquals($postData["titleType"][$index], $row["Title_Type_fk"], "Der Titeltyp an Position $index stimmt nicht überein");
            $index++;
        }
    }

    /**
     * Testet das Speichern von Ressourceninformationen mit Null-Werten.
     */
    public function testSaveResourceInformationAndRightsWithNullValues()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => null,
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "dateEmbargo" => null,
            "resourcetype" => 4,
            "version" => null,
            "language" => 2,
            "Rights" => 3,
            "title" => ["Testing Title"],
            "titleType" => [1]
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);

        $this->assertIsInt($resource_id, "Die Funktion sollte eine gültige Resource ID zurückgeben.");
        $this->assertGreaterThan(0, $resource_id, "Die zurückgegebene Resource ID sollte größer als 0 sein.");

        // Überprüfen, ob die Daten korrekt in die Datenbank eingetragen und abgerufen wurden
        $stmt = $this->connection->prepare("SELECT * FROM Resource WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $this->assertNull($row["doi"], "Die DOI sollte null sein.");
        $this->assertEquals($postData["year"], $row["year"], "Das Jahr wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["dateCreated"], $row["dateCreated"], "Das Erstellungsdatum wurde nicht korrekt gespeichert.");
        $this->assertNull($row["dateEmbargoUntil"], "Das Embargodatum sollte null sein.");
        $this->assertEquals($postData["resourcetype"], $row["Resource_Type_resource_name_id"], "Der Ressourcentyp wurde nicht korrekt gespeichert.");
        $this->assertNull($row["version"], "Die Version sollte null sein.");
        $this->assertEquals($postData["language"], $row["Language_language_id"], "Die Sprache wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["Rights"], $row["Rights_rights_id"], "Die Rechte wurden nicht korrekt gespeichert.");

        // Überprüfen, ob der Titel korrekt eingetragen wurde
        $stmt = $this->connection->prepare("SELECT * FROM Title WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $this->assertEquals($postData["title"][0], $row["text"], "Der Titel wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["titleType"][0], $row["Title_Type_fk"], "Der Titeltyp wurde nicht korrekt gespeichert.");
    }

    /**
     * Testet das Verhalten bei leeren Pflichtfeldern.
     */
    public function testSaveResourceInformationAndRightsWithEmptyRequiredFields()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => null,
            "year" => null,
            "dateCreated" => null,
            "dateEmbargo" => null,
            "resourcetype" => null,
            "version" => null,
            "language" => null,
            "Rights" => null,
            "title" => [],
            "titleType" => []
        ];

        // Zählen der bestehenden Datensätze vor dem Test
        $countBefore = $this->connection->query("SELECT COUNT(*) as count FROM Resource")->fetch_assoc()['count'];

        try {
            $result = saveResourceInformationAndRights($this->connection, $postData);

            $this->assertFalse($result, "Die Methode sollte false zurückgeben, wenn Pflichtfelder leer sind");

            // Zählen der Datensätze nach dem Test
            $countAfter = $this->connection->query("SELECT COUNT(*) as count FROM Resource")->fetch_assoc()['count'];

            $this->assertEquals($countBefore, $countAfter, "Es sollte kein neuer Datensatz angelegt worden sein");

            // Überprüfen, ob kein neuer Titel angelegt wurde
            $titleCount = $this->connection->query("SELECT COUNT(*) as count FROM Title")->fetch_assoc()['count'];
            $this->assertEquals(0, $titleCount, "Es sollte kein neuer Titel angelegt worden sein");
        } catch (mysqli_sql_exception $e) {
            if (strpos($e->getMessage(), "Column") !== false && strpos($e->getMessage(), "cannot be null") !== false) {
                $this->fail("Die Funktion saveResourceInformationAndRights() versucht einen unvollständigen Datensatz in der Datenbank zu speichern!");
            } else {
                throw $e; // Andere SQL-Ausnahmen werfen
            }
        }
    }

    /**
     * Tests the update functionality when saving a resource with an existing DOI.
     * 
     * @return void
     */
    public function testUpdateExistingResource()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        // Initial data
        $initialData = [
            "doi" => "10.5880/GFZ.UPDATE.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "version" => 1.0,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Original Title"],
            "titleType" => [1]
        ];

        // Save initial resource
        $first_resource_id = saveResourceInformationAndRights($this->connection, $initialData);
        $this->assertIsInt($first_resource_id, "Initial save should return a valid resource ID");

        // Updated data with same DOI but different values
        $updatedData = [
            "doi" => "10.5880/GFZ.UPDATE.TEST",
            "year" => 2024,
            "dateCreated" => "2024-01-01",
            "resourcetype" => 2,
            "version" => 2.0,
            "language" => 2,
            "Rights" => 2,
            "title" => ["Updated Title"],
            "titleType" => [1]
        ];

        // Save updated resource
        $updated_resource_id = saveResourceInformationAndRights($this->connection, $updatedData);

        // Should return the same resource ID
        $this->assertEquals($first_resource_id, $updated_resource_id, "Update should return the same resource ID");

        // Verify updated values
        $stmt = $this->connection->prepare("SELECT * FROM Resource WHERE resource_id = ?");
        $stmt->bind_param("i", $updated_resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $this->assertEquals($updatedData["year"], $row["year"]);
        $this->assertEquals($updatedData["dateCreated"], $row["dateCreated"]);
        $this->assertEquals($updatedData["resourcetype"], $row["Resource_Type_resource_name_id"]);
        $this->assertEquals($updatedData["version"], $row["version"]);
        $this->assertEquals($updatedData["language"], $row["Language_language_id"]);
        $this->assertEquals($updatedData["Rights"], $row["Rights_rights_id"]);

        // Verify updated title
        $stmt = $this->connection->prepare("SELECT * FROM Title WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $updated_resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $this->assertEquals($updatedData["title"][0], $row["text"]);
    }

    /**
     * Tests saving multiple resources without DOIs.
     * 
     * @return void
     */
    public function testSaveMultipleResourcesWithoutDoi()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        // Create base data structure
        $baseData = [
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "titleType" => [1]
        ];

        // Save multiple resources without DOI
        $resourceIds = [];
        for ($i = 1; $i <= 3; $i++) {
            $data = $baseData;
            $data["title"] = ["Resource Without DOI #" . $i];
            $data["doi"] = null;

            $resource_id = saveResourceInformationAndRights($this->connection, $data);
            $this->assertIsInt($resource_id, "Should return valid resource ID for resource #$i");
            $this->assertGreaterThan(0, $resource_id);
            $resourceIds[] = $resource_id;
        }

        // Verify all resources were saved with unique IDs
        $this->assertCount(3, array_unique($resourceIds), "Should create three distinct resources");

        // Verify each resource in database
        foreach ($resourceIds as $index => $id) {
            $stmt = $this->connection->prepare("SELECT * FROM Resource WHERE resource_id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();

            $this->assertNull($row["doi"], "DOI should be NULL for resource #" . ($index + 1));

            // Verify title
            $stmt = $this->connection->prepare("SELECT text FROM Title WHERE Resource_resource_id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $titleRow = $stmt->get_result()->fetch_assoc();
            $this->assertEquals("Resource Without DOI #" . ($index + 1), $titleRow["text"]);
        }
    }

    /**
     * Testet die Handhabung von doppelten Titeln.
     */
    public function testHandleDuplicateTitles()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ.DUPLICATE.TITLE.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "dateEmbargo" => "2024-12-31",
            "resourcetype" => 1,
            "version" => 1.0,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Duplicate Title", "Duplicate Title", "Unique Title"],
            "titleType" => [1, 1, 2]
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);
        $this->assertIsInt($resource_id, "Die Funktion sollte eine gültige Resource ID zurückgeben.");
        $this->assertGreaterThan(0, $resource_id, "Die zurückgegebene Resource ID sollte größer als 0 sein.");

        // Überprüfen, ob nur zwei Titel gespeichert wurden (ein Duplikat entfernt)
        $stmt = $this->connection->prepare("SELECT * FROM Title WHERE Resource_resource_id = ? ORDER BY Title_Type_fk");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(2, $result->num_rows, "Es sollten genau zwei Titel gespeichert worden sein");

        $titles = [];
        while ($row = $result->fetch_assoc()) {
            $titles[] = $row;
        }

        $this->assertEquals("Duplicate Title", $titles[0]['text'], "Der erste Titel sollte 'Duplicate Title' sein");
        $this->assertEquals(1, $titles[0]['Title_Type_fk'], "Der erste Titel sollte den Typ 1 haben");
        $this->assertEquals("Unique Title", $titles[1]['text'], "Der zweite Titel sollte 'Unique Title' sein");
        $this->assertEquals(2, $titles[1]['Title_Type_fk'], "Der zweite Titel sollte den Typ 2 haben");
    }

    /**
     * Tests handling of DOIs: updating existing DOIs and allowing multiple empty/null DOIs
     * 
     * @return void
     */
    public function testDoiHandling()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        // Test 1: Updating existing DOI
        $postDataWithDOI = [
            "doi" => "10.5880/GFZ.DOI.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["DOI Test Dataset"],
            "titleType" => [1]
        ];

        // Save first dataset with DOI
        $first_id = saveResourceInformationAndRights($this->connection, $postDataWithDOI);
        $this->assertIsInt($first_id, "First save should return a valid resource ID");

        // Update the same DOI with different data
        $postDataWithDOI["year"] = 2024;
        $postDataWithDOI["title"] = ["Updated DOI Test Dataset"];
        $updated_id = saveResourceInformationAndRights($this->connection, $postDataWithDOI);
        $this->assertEquals($first_id, $updated_id, "Update should return the same resource ID");

        // Test 2: Multiple datasets with null DOI
        $postDataWithNullDOI = [
            "doi" => null,
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Dataset with null DOI"],
            "titleType" => [1]
        ];

        // Save first dataset with null DOI
        $first_null_id = saveResourceInformationAndRights($this->connection, $postDataWithNullDOI);
        $this->assertIsInt($first_null_id, "First save with null DOI should return valid ID");

        // Save second dataset with null DOI
        $second_null_id = saveResourceInformationAndRights($this->connection, $postDataWithNullDOI);
        $this->assertIsInt($second_null_id, "Second save with null DOI should return valid ID");
        $this->assertNotEquals($first_null_id, $second_null_id, "Null DOI datasets should have different IDs");

        // Test 3: Multiple datasets with empty string DOI
        $postDataWithEmptyDOI = [
            "doi" => "",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Dataset with empty DOI"],
            "titleType" => [1]
        ];

        // Save first dataset with empty DOI
        $first_empty_id = saveResourceInformationAndRights($this->connection, $postDataWithEmptyDOI);
        $this->assertIsInt($first_empty_id, "First save with empty DOI should return valid ID");

        // Save second dataset with empty DOI
        $second_empty_id = saveResourceInformationAndRights($this->connection, $postDataWithEmptyDOI);
        $this->assertIsInt($second_empty_id, "Second save with empty DOI should return valid ID");
        $this->assertNotEquals($first_empty_id, $second_empty_id, "Empty DOI datasets should have different IDs");

        // Verify database state
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource WHERE doi = ?");
        $doi = "10.5880/GFZ.DOI.TEST";
        $stmt->bind_param("s", $doi);
        $stmt->execute();
        $count_with_doi = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(1, $count_with_doi, "Should have exactly one dataset with specific DOI");

        // Check title was updated
        $stmt = $this->connection->prepare("SELECT text FROM Title WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $first_id);
        $stmt->execute();
        $title = $stmt->get_result()->fetch_assoc()['text'];
        $this->assertEquals("Updated DOI Test Dataset", $title, "Title should be updated for existing DOI");

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource WHERE doi IS NULL");
        $stmt->execute();
        $count_null_doi = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(2, $count_null_doi, "Should have exactly two datasets with null DOI");

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource WHERE doi = ''");
        $stmt->execute();
        $count_empty_doi = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(2, $count_empty_doi, "Should have exactly two datasets with empty DOI");

        // Verify total count
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource");
        $stmt->execute();
        $total_count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(5, $total_count, "Should have five datasets in total");
    }
}