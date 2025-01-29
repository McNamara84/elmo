<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';
require_once __DIR__ . '/../save/formgroups/save_descriptions.php';
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/TestDatabaseSetup.php';

class SaveDescriptionsTest extends TestCase
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
     * Alle vier Descriptions wurden ausgefüllt
     */
    public function testSaveAllDescriptions()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ALL.DESCRIPTIONS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test All Descriptions"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "descriptionAbstract" => "This is an abstract.",
            "descriptionMethods" => "These are the methods.",
            "descriptionTechnical" => "This is technical information.",
            "descriptionOther" => "This is other information."
        ];

        $result = saveDescriptions($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "saveDescriptions sollte true zurückgeben, wenn alle Beschreibungen erfolgreich gespeichert wurden.");

        // Überprüfen, ob alle vier Descriptions gespeichert wurden
        $stmt = $this->connection->prepare("SELECT * FROM Description WHERE resource_id = ? ORDER BY type");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(4, $result->num_rows, "Es sollten genau vier Descriptions gespeichert worden sein.");

        $expectedDescriptions = [
            ['type' => 'Abstract', 'description' => $postData['descriptionAbstract']],
            ['type' => 'Methods', 'description' => $postData['descriptionMethods']],
            ['type' => 'Other', 'description' => $postData['descriptionOther']],
            ['type' => 'Technical Information', 'description' => $postData['descriptionTechnical']]
        ];

        $index = 0;
        while ($description = $result->fetch_assoc()) {
            $this->assertEquals($expectedDescriptions[$index]['type'], $description['type'], "Der Beschreibungstyp stimmt nicht überein.");
            $this->assertEquals($expectedDescriptions[$index]['description'], $description['description'], "Der Inhalt der {$description['type']} Beschreibung stimmt nicht überein.");
            $index++;
        }
    }

    /**
     * Nur Abstract wurde ausgefüllt
     */
    public function testSaveOnlyAbstract()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ONLY.ABSTRACT",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Only Abstract"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "descriptionAbstract" => "This is an abstract.",
            "descriptionMethods" => "",
            "descriptionTechnical" => "",
            "descriptionOther" => ""
        ];

        saveDescriptions($this->connection, $postData, $resource_id);

        // Überprüfen, ob nur Abstract gespeichert wurde
        $stmt = $this->connection->prepare("SELECT * FROM Description WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(1, $result->num_rows, "Es sollte genau eine Description gespeichert worden sein.");

        $description = $result->fetch_assoc();
        $this->assertEquals('Abstract', $description['type'], "Der gespeicherte Beschreibungstyp sollte 'Abstract' sein.");
        $this->assertEquals($postData['descriptionAbstract'], $description['description'], "Der Inhalt der Abstract Beschreibung stimmt nicht überein.");
    }

    /**
     * Nur Methods wurde ausgefüllt (sollte fehlschlagen)
     */
    public function testSaveOnlyMethods()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ONLY.METHODS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Only Methods"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "descriptionAbstract" => "",
            "descriptionMethods" => "These are the methods.",
            "descriptionTechnical" => "",
            "descriptionOther" => ""
        ];

        $result = saveDescriptions($this->connection, $postData, $resource_id);

        $this->assertFalse($result, "Die Funktion sollte false zurückgeben, wenn nur Methods ausgefüllt ist.");

        // Überprüfen, ob keine Descriptions gespeichert wurden
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Description WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine Descriptions gespeichert worden sein.");
    }
}