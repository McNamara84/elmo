<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';
require_once __DIR__ . '/../save/formgroups/save_freekeywords.php';
require_once __DIR__ . '/TestDatabaseSetup.php';

class SaveFreekeywordsTest extends DatabaseTestCase
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

    /**
     * Ein einzelnes, noch nicht kuratiertes, Freies Keyword wurde eingegeben
     */
    public function testSaveSingleUncuratedFreeKeyword()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.SINGLE.UNCURATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Single Uncurated Free Keyword"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => [json_encode([["value" => "NewKeyword"]])]
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if the keyword was saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Free_Keywords WHERE free_keyword = ?");
        $keyword = "NewKeyword";
        $stmt->bind_param("s", $keyword);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($result, "Das freie Keyword sollte gespeichert worden sein.");
        $this->assertEquals(0, $result['isCurated'], "Das Keyword sollte als nicht kuratiert markiert sein.");

        // Check if the relation to the resource was created
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ? AND Free_Keywords_free_keywords_id = ?");
        $stmt->bind_param("ii", $resource_id, $result['free_keywords_id']);
        $stmt->execute();
        $relationResult = $stmt->get_result();

        $this->assertEquals(1, $relationResult->num_rows, "Es sollte eine Verknüpfung zwischen Resource und Free Keyword existieren.");
    }

    /**
     * Ein freies Keyword wurde eingegeben, das bereits existiert, aber noch nicht kuratiert wurde
     */
    public function testSaveExistingUncuratedFreeKeyword()
    {
        // First, insert an uncurated keyword
        $this->connection->query("INSERT INTO Free_Keywords (free_keyword, isCurated) VALUES ('ExistingUncurated', 0)");
        $existing_id = $this->connection->insert_id;

        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.EXISTING.UNCURATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Existing Uncurated Free Keyword"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => [json_encode([["value" => "ExistingUncurated"]])]
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if no new keyword was created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Free_Keywords WHERE free_keyword = ?");
        $keyword = "ExistingUncurated";
        $stmt->bind_param("s", $keyword);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, "Es sollte kein neues Keyword erstellt worden sein.");

        // Check if the relation to the resource was created
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ? AND Free_Keywords_free_keywords_id = ?");
        $stmt->bind_param("ii", $resource_id, $existing_id);
        $stmt->execute();
        $relationResult = $stmt->get_result();

        $this->assertEquals(1, $relationResult->num_rows, "Es sollte eine Verknüpfung zwischen Resource und dem existierenden Free Keyword erstellt worden sein.");
    }

    /**
     * Ein Keyword wurde eingegeben, das bereits existiert und kuratiert wurde
     */
    public function testSaveExistingCuratedFreeKeyword()
    {
        // First, insert a curated keyword
        $this->connection->query("INSERT INTO Free_Keywords (free_keyword, isCurated) VALUES ('ExistingCurated', 1)");
        $existing_id = $this->connection->insert_id;

        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.EXISTING.CURATED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Existing Curated Free Keyword"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => [json_encode([["value" => "ExistingCurated"]])]
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if no new keyword was created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Free_Keywords WHERE free_keyword = ?");
        $keyword = "ExistingCurated";
        $stmt->bind_param("s", $keyword);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, "Es sollte kein neues Keyword erstellt worden sein.");

        // Check if the relation to the resource was created
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ? AND Free_Keywords_free_keywords_id = ?");
        $stmt->bind_param("ii", $resource_id, $existing_id);
        $stmt->execute();
        $relationResult = $stmt->get_result();

        $this->assertEquals(1, $relationResult->num_rows, "Es sollte eine Verknüpfung zwischen Resource und dem existierenden kuratierten Free Keyword erstellt worden sein.");
    }

    /**
     * Mehrere Keywords wurden ausgewählt, manche existieren bereits, manche sind kuratiert und manche nicht
     */
    public function testSaveMultipleMixedFreeKeywords()
    {
        // Insert some existing keywords
        $this->connection->query("INSERT INTO Free_Keywords (free_keyword, isCurated) VALUES ('ExistingCurated1', 1), ('ExistingUncurated1', 0)");

        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MULTIPLE.MIXED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Multiple Mixed Free Keywords"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => [
                json_encode([
                    ["value" => "ExistingCurated1"],
                    ["value" => "ExistingUncurated1"],
                    ["value" => "NewKeyword1"],
                    ["value" => "NewKeyword2"]
                ])
            ]
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if the correct number of keywords exists
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Free_Keywords");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(4, $count, "Es sollten insgesamt 4 Keywords in der Datenbank sein.");

        // Check if all keywords are linked to the resource
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(4, $count, "Es sollten 4 Verknüpfungen zwischen der Resource und den Free Keywords existieren.");

        // Check the curation status of the keywords
        $stmt = $this->connection->prepare("SELECT free_keyword, isCurated FROM Free_Keywords");
        $stmt->execute();
        $result = $stmt->get_result();
        $keywords = $result->fetch_all(MYSQLI_ASSOC);

        $expectedStatus = [
            'ExistingCurated1' => 1,
            'ExistingUncurated1' => 0,
            'NewKeyword1' => 0,
            'NewKeyword2' => 0
        ];

        foreach ($keywords as $keyword) {
            $this->assertEquals($expectedStatus[$keyword['free_keyword']], $keyword['isCurated'], "Der Kuratierungsstatus für '{$keyword['free_keyword']}' ist nicht korrekt.");
        }
    }

    /**
     * Das Eingabefeld für Free Keywords wurde nicht befüllt
     */
    public function testSaveNoFreeKeywords()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.NO.FREE.KEYWORDS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test No Free Keywords"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "freekeywords" => []
        ];

        saveFreeKeywords($this->connection, $postData, $resource_id);

        // Check if no keywords were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Free_Keywords");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine Free Keywords gespeichert worden sein.");

        // Check if no relations were created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Free_Keywords WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine Verknüpfungen zwischen Resource und Free Keywords existieren.");
    }
}