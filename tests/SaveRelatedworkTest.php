<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';
require_once __DIR__ . '/../save/formgroups/save_relatedwork.php';
require_once __DIR__ . '/TestDatabaseSetup.php';

class SaveRelatedworkTest extends TestCase
{
    private $connection;

    protected function setUp(): void
    {
        global $connection;
        if (!$connection) {
            $connection = connectDb();
        }
        $this->connection = $connection;

        // Überprüfen, ob die Testdatenbank verfügbar ist
        $dbname = 'mde2-msl-test';
        try {
            if ($this->connection->select_db($dbname) === false) {
                // Testdatenbank erstellen
                $connection->query("CREATE DATABASE " . $dbname);
                $connection->select_db($dbname);
            }

            // Datenbank für Tests aufsetzen
            setupTestDatabase($connection);

        } catch (\Exception $e) {
            $this->fail("Fehler beim Setup der Testdatenbank: " . $e->getMessage());
        }
    }

    protected function tearDown(): void
    {
        $this->cleanupTestData();
    }

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
     * Nur ARK wurde als Identifier Type ausgewählt und alle anderen Felder bleiben leer
     */
    public function testSaveOnlyARK()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ONLY.ARK",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Only ARK"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "rIdentifier" => [""],
            "relation" => [""],
            "rIdentifierType" => ["ARK"]
        ];

        saveRelatedWork($this->connection, $postData, $resource_id);

        // Check that no Related Work was saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Related_Work");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine Related Work Einträge gespeichert worden sein.");
    }

    /**
     * Ein vollständiger Datensatz mit Relation, Identifier und Identifier Type wurde ausgefüllt
     */
    public function testSaveCompleteRelatedWork()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.COMPLETE.RELATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Complete Related Work"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "rIdentifier" => ["10.1234/test"],
            "relation" => ["1"], // Assuming 1 is a valid relation_id
            "rIdentifierType" => ["DOI"]
        ];

        saveRelatedWork($this->connection, $postData, $resource_id);

        // Check if the Related Work was saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Related_Work WHERE Identifier = ?");
        $stmt->bind_param("s", $postData["rIdentifier"][0]);
        $stmt->execute();
        $relatedWork = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($relatedWork, "Der Related Work Eintrag sollte gespeichert worden sein.");
        $this->assertEquals($postData["relation"][0], $relatedWork["relation_fk"]);

        // Check if the identifier type was correctly saved
        $stmt = $this->connection->prepare("SELECT name FROM Identifier_Type WHERE identifier_type_id = ?");
        $stmt->bind_param("i", $relatedWork["identifier_type_fk"]);
        $stmt->execute();
        $identifierType = $stmt->get_result()->fetch_assoc()['name'];
        $this->assertEquals($postData["rIdentifierType"][0], $identifierType);

        // Check if the relation to the resource was created
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Related_Work WHERE Resource_resource_id = ? AND Related_Work_related_work_id = ?");
        $stmt->bind_param("ii", $resource_id, $relatedWork["related_work_id"]);
        $stmt->execute();
        $relation = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($relation, "Die Verknüpfung zwischen Resource und Related Work sollte existieren.");
    }

    /**
     * Drei vollständige Datensätze Related Work wurden eingegeben
     */
    public function testSaveThreeCompleteRelatedWorks()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.THREE.RELATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Three Related Works"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "rIdentifier" => ["10.1234/test1", "10.1234/test2", "10.1234/test3"],
            "relation" => ["1", "2", "3"], // Assuming 1, 2, 3 are valid relation_ids
            "rIdentifierType" => ["DOI", "URL", "ISBN"]
        ];

        saveRelatedWork($this->connection, $postData, $resource_id);

        // Check if all three Related Works were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Related_Work");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(3, $count, "Es sollten genau drei Related Work Einträge gespeichert worden sein.");

        // Check if all three relations to the resource were created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Related_Work WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(3, $count, "Es sollten genau drei Verknüpfungen zwischen Resource und Related Work existieren.");
    }

    /**
     * Es wird versucht zuerst einen vollständigen, dann einen unvollständigen und dann wieder einen vollständigen Related-Work-Datensatz zu speichern
     */
    public function testSaveMixedRelatedWorks()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MIXED.RELATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Mixed Related Works"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "rIdentifier" => ["10.1234/test1", "10.1234/test2", "10.1234/test3"],
            "relation" => ["1", "", "3"], // Assuming 1 and 3 are valid relation_ids
            "rIdentifierType" => ["DOI", "URL", "ISBN"]
        ];

        saveRelatedWork($this->connection, $postData, $resource_id);

        // Check if only two Related Works were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Related_Work");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(2, $count, "Es sollten genau zwei Related Work Einträge gespeichert worden sein.");

        // Check if only two relations to the resource were created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Related_Work WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(2, $count, "Es sollten genau zwei Verknüpfungen zwischen Resource und Related Work existieren.");

        // Check if the correct Related Works were saved
        $stmt = $this->connection->prepare("SELECT Identifier FROM Related_Work");
        $stmt->execute();
        $result = $stmt->get_result();
        $savedIdentifiers = [];
        while ($row = $result->fetch_assoc()) {
            $savedIdentifiers[] = $row['Identifier'];
        }

        $this->assertContains("10.1234/test1", $savedIdentifiers, "Der erste vollständige Datensatz sollte gespeichert worden sein.");
        $this->assertContains("10.1234/test3", $savedIdentifiers, "Der dritte vollständige Datensatz sollte gespeichert worden sein.");
        $this->assertNotContains("10.1234/test2", $savedIdentifiers, "Der unvollständige Datensatz sollte nicht gespeichert worden sein.");
    }
}