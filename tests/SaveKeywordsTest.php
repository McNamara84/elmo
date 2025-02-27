<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';
require_once __DIR__ . '/../save/formgroups/save_thesauruskeywords.php';
require_once __DIR__ . '/TestDatabaseSetup.php';

class SaveKeywordsTest extends TestCase
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
     * Alle Thesaurus Keyword Eingabefelder enthalten exakt eine Eingabe
     */
    public function testSaveAllThesaurusKeywordsSingle()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ALL.KEYWORDS.SINGLE",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test All Keywords Single"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "gcmdScienceKeywords" => json_encode([["value" => "Keyword1", "id" => "ert6445667758we", "scheme" => "CustomScheme", "schemeURI" => "http://example.com/scheme", "language" => "en"]]),
            "MSLKeywords" => json_encode([["value" => "Material1", "id" => "35457687243", "scheme" => "TestScheme", "schemeURI" => "http://example.de/scheme", "language" => "en"]]),
        ];

        saveKeywords($this->connection, $postData, $resource_id);

        // Check if all keywords were saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Thesaurus_Keywords");
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(2, $result->num_rows, "Es sollten genau 2 Thesaurus Keywords gespeichert worden sein.");

        $expectedKeywords = [
            "Keyword1",
            "Material1",
        ];

        while ($row = $result->fetch_assoc()) {
            $this->assertContains($row['keyword'], $expectedKeywords, "Das Keyword '{$row['keyword']}' sollte in der Liste der erwarteten Keywords sein.");
        }

    }

    /**
     * Alle Thesaurus Keyword Eingabefelder wurden mit je 3 Keywords befüllt
     */
    public function testSaveAllThesaurusKeywordsMultiple()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ALL.KEYWORDS.MULTIPLE",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test All Keywords Multiple"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "gcmdScienceKeywords" => json_encode([
                [
                    "value" => "Keyword1",
                    "id" => "http://gcmd.nasa.gov/keyword1",
                    "scheme" => "GCMD Science Keywords",
                    "schemeURI" => "http://gcmd.nasa.gov",
                    "language" => "en"
                ],
                [
                    "value" => "Keyword2",
                    "id" => "http://gcmd.nasa.gov/keyword2",
                    "scheme" => "GCMD Science Keywords",
                    "schemeURI" => "http://gcmd.nasa.gov",
                    "language" => "en"
                ],
                [
                    "value" => "Keyword3",
                    "id" => "http://gcmd.nasa.gov/keyword3",
                    "scheme" => "GCMD Science Keywords",
                    "schemeURI" => "http://gcmd.nasa.gov",
                    "language" => "en"
                ]
            ]),
            "MSLKeywords" => json_encode([
                [
                    "value" => "Material1",
                    "id" => "http://msl.org/material1",
                    "scheme" => "MSL Keywords",
                    "schemeURI" => "http://epos-msl.org",
                    "language" => "en"
                ],
                [
                    "value" => "Material2",
                    "id" => "http://msl.org/material2",
                    "scheme" => "MSL Keywords",
                    "schemeURI" => "http://epos-msl.org",
                    "language" => "en"
                ],
                [
                    "value" => "Material3",
                    "id" => "http://msl.org/material3",
                    "scheme" => "MSL Keywords",
                    "schemeURI" => "http://test-epos-msl.org",
                    "language" => "en"
                ]
            ])
        ];

        saveKeywords($this->connection, $postData, $resource_id);

        // Check if all keywords were saved correctly
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Thesaurus_Keywords");
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertEquals(6, $result['count'], "Es sollten genau 6 Thesaurus Keywords gespeichert worden sein.");

        // Check if all keywords are linked to the resource
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Thesaurus_Keywords WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertEquals(6, $result['count'], "Es sollten genau 6 Verknüpfungen zwischen Resource und Thesaurus Keywords existieren.");
    }

    /**
     * Nur einzelne Thesaurus Keyword Eingabefelder wurden befüllt. Diese sollten dann natürlich nicht gespeichert werden.
     */
    public function testSavePartialThesaurusKeywords()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.PARTIAL.KEYWORDS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Partial Keywords"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "gcmdScienceKeywords" => json_encode([["value" => "Keyword1"]]),
            "MSLKeywords" => json_encode([["value" => "Age1"]])
        ];

        saveKeywords($this->connection, $postData, $resource_id);

        // Check if only the filled keywords were saved
        $stmt = $this->connection->prepare("SELECT * FROM Thesaurus_Keywords");
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(0, $result->num_rows, "Es sollten genau 0 Thesaurus Keywords gespeichert worden sein.");
    }

    /**
     * Keine Thesaurus Keyword Eingabefelder wurden befüllt
     */
    public function testSaveNoThesaurusKeywords()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.NO.KEYWORDS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test No Keywords"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "gcmdScienceKeywords" => "",
            "MSLKeywords" => ""
        ];

        saveKeywords($this->connection, $postData, $resource_id);

        // Check if no keywords were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Thesaurus_Keywords");
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertEquals(0, $result['count'], "Es sollten keine Thesaurus Keywords gespeichert worden sein.");

        // Check if no links to the resource were created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Thesaurus_Keywords WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertEquals(0, $result['count'], "Es sollten keine Verknüpfungen zwischen Resource und Thesaurus Keywords existieren.");
    }
}