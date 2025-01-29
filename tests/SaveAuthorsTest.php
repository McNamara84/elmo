<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_authors.php';
require_once __DIR__ . '/TestDatabaseSetup.php';

/**
 * Testklasse für die Funktionalität zum Speichern von Autoren.
 * 
 * Diese Klasse enthält verschiedene Testfälle, die die korrekte Funktionsweise
 * der saveAuthors-Funktion unter verschiedenen Bedingungen überprüfen.
 */
class SaveAuthorsTest extends TestCase
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
     * Testet das Speichern eines einzelnen Autors mit allen Feldern.
     */
    public function testSaveSingleAuthorWithAllFields()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.SINGLE.AUTHOR",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Single Author"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "familynames" => ["Doe"],
            "givennames" => ["John"],
            "orcids" => ["0000-0001-2345-6789"],
            "affiliation" => ['[{"value":"Test University"}]'],
            "authorRorIds" => ['https://ror.org/047w75g40']
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Überprüfen, ob der Autor korrekt gespeichert wurde
        $stmt = $this->connection->prepare("SELECT * FROM Author WHERE familyname = ?");
        $stmt->bind_param("s", $authorData["familynames"][0]);
        $stmt->execute();
        $authorResult = $stmt->get_result()->fetch_assoc();

        $this->assertEquals(
            $authorData["givennames"][0],
            $authorResult["givenname"],
            "Der Vorname des Autors wurde nicht korrekt gespeichert."
        );
        $this->assertEquals(
            $authorData["orcids"][0],
            $authorResult["orcid"],
            "Die ORCID des Autors wurde nicht korrekt gespeichert."
        );

        // Überprüfen der Relation zur Resource
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
        $stmt->bind_param("ii", $resource_id, $authorResult["author_id"]);
        $stmt->execute();
        $this->assertEquals(
            1,
            $stmt->get_result()->num_rows,
            "Die Verknüpfung zwischen Autor und Resource wurde nicht korrekt gespeichert."
        );

        // Überprüfen der Affiliation
        $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                            JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id
                                            WHERE aha.Author_author_id = ?");
        $stmt->bind_param("i", $authorResult["author_id"]);
        $stmt->execute();
        $affiliationResult = $stmt->get_result()->fetch_assoc();

        $this->assertEquals(
            "Test University Potsdam",
            $affiliationResult["name"],
            "Der Name der Affiliation wurde nicht korrekt gespeichert."
        );
        $this->assertEquals(
            "047w75g40",
            $affiliationResult["rorId"],
            "Die ROR-ID der Affiliation wurde nicht korrekt gespeichert."
        );
    }

    /**
     * Testet das Speichern von drei Autoren mit allen Feldern.
     */
    public function testSaveThreeAuthorsWithAllFields()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.THREE.AUTHORS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Three Authors"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "familynames" => ["Doe", "Smith", "Johnson"],
            "givennames" => ["John", "Jane", "Bob"],
            "orcids" => ["0000-0001-2345-6789", "0000-0002-3456-7890", "0000-0003-4567-8901"],
            "affiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[{"value":"University C"}]'],
            "authorRorIds" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', 'https://ror.org/0168r3w48']
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Überprüfen, ob alle drei Autoren korrekt gespeichert wurden
        for ($i = 0; $i < 3; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Author WHERE familyname = ? AND givenname = ?");
            $stmt->bind_param("ss", $authorData["familynames"][$i], $authorData["givennames"][$i]);
            $stmt->execute();
            $authorResult = $stmt->get_result()->fetch_assoc();

            $this->assertEquals(
                $authorData["orcids"][$i],
                $authorResult["orcid"],
                "Die ORCID des Autors " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );

            // Überprüfen der Relation zur Resource
            $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
            $stmt->bind_param("ii", $resource_id, $authorResult["author_id"]);
            $stmt->execute();
            $this->assertEquals(
                1,
                $stmt->get_result()->num_rows,
                "Die Verknüpfung zwischen Autor " . ($i + 1) . " und Resource wurde nicht korrekt gespeichert."
            );

            // Überprüfen der Affiliation
            $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                                JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id
                                                WHERE aha.Author_author_id = ?");
            $stmt->bind_param("i", $authorResult["author_id"]);
            $stmt->execute();
            $affiliationResult = $stmt->get_result()->fetch_assoc();

            $this->assertEquals(
                json_decode($authorData["affiliation"][$i], true)[0]["value"],
                $affiliationResult["name"],
                "Der Name der Affiliation für Autor " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );
            $this->assertEquals(
                str_replace("https://ror.org/", "", $authorData["authorRorIds"][$i]),
                $affiliationResult["rorId"],
                "Die ROR-ID der Affiliation für Autor " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );
        }
    }

    /**
     * Testet das Speichern eines einzelnen Autors mit nur den erforderlichen Feldern.
     */
    public function testSaveSingleAuthorWithOnlyRequiredFields()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.SINGLE.REQUIRED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Single Required"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "familynames" => ["OnlyLastName"],
            "givennames" => [""],
            "orcids" => [""],
            "affiliation" => [],
            "authorRorIds" => []
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Überprüfen, ob der Autor korrekt gespeichert wurde
        $stmt = $this->connection->prepare("SELECT * FROM Author WHERE familyname = ?");
        $stmt->bind_param("s", $authorData["familynames"][0]);
        $stmt->execute();
        $authorResult = $stmt->get_result()->fetch_assoc();

        $this->assertEmpty(
            $authorResult["givenname"],
            "Der Vorname des Autors sollte leer sein."
        );
        $this->assertEmpty(
            $authorResult["orcid"],
            "Die ORCID des Autors sollte leer sein."
        );

        // Überprüfen der Relation zur Resource
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
        $stmt->bind_param("ii", $resource_id, $authorResult["author_id"]);
        $stmt->execute();
        $this->assertEquals(
            1,
            $stmt->get_result()->num_rows,
            "Die Verknüpfung zwischen Autor und Resource wurde nicht korrekt gespeichert."
        );

        // Überprüfen, dass keine Affiliation gespeichert wurde
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author_has_Affiliation WHERE Author_author_id = ?");
        $stmt->bind_param("i", $authorResult["author_id"]);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            0,
            $count,
            "Es sollten keine Affiliationen für diesen Autor gespeichert worden sein."
        );
    }

    /**
     * Testet das Verhalten beim Versuch, einen Autor mit leeren Feldern zu speichern.
     */
    public function testSaveAuthorWithEmptyFields()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.EMPTY.AUTHOR",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Empty Author"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "familynames" => [],
            "givennames" => [],
            "orcids" => [],
            "affiliation" => [],
            "authorRorIds" => []
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Überprüfen, ob kein Autor gespeichert wurde
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            0,
            $count,
            "Es sollte kein Autor gespeichert worden sein, da alle Felder leer waren."
        );
    }

    /**
     * Testet das Speichern von drei Autoren, wobei einer einen fehlenden Nachnamen hat.
     */
    public function testSaveThreeAuthorsWithOneMissingLastName()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.THREE.AUTHORS.ONE.MISSING",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Three Authors One Missing"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "familynames" => ["Doe", "", "Johnson"],
            "givennames" => ["John", "Jane", "Bob"],
            "orcids" => ["0000-0001-2345-6789", "0000-0002-3456-7890", "0000-0003-4567-8901"],
            "affiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[{"value":"University C"}]'],
            "authorRorIds" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', 'https://ror.org/0168r3w48']
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Überprüfen, ob nur zwei Autoren gespeichert wurden
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            2,
            $count,
            "Es sollten nur zwei Autoren gespeichert worden sein, da einer einen fehlenden Nachnamen hatte."
        );

        // Überprüfen, ob die richtigen zwei Autoren gespeichert wurden
        $stmt = $this->connection->prepare("SELECT familyname FROM Author ORDER BY familyname");
        $stmt->execute();
        $result = $stmt->get_result();
        $savedFamilynames = [];
        while ($row = $result->fetch_assoc()) {
            $savedFamilynames[] = $row['familyname'];
        }
        $this->assertEquals(
            ["Doe", "Johnson"],
            $savedFamilynames,
            "Nur die Autoren 'Doe' und 'Johnson' sollten gespeichert worden sein."
        );
    }

    /**
     * Testet das Speichern von Autoren mit mehreren Affiliationen.
     */
    public function testSaveAuthorsWithMultipleAffiliations()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MULTIPLE.AFFILIATIONS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Multiple Affiliations"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "familynames" => ["Doe", "Smith", "Johnson"],
            "givennames" => ["John", "Jane", "Bob"],
            "orcids" => ["0000-0001-2345-6789", "0000-0002-3456-7890", "0000-0003-4567-8901"],
            "affiliation" => [
                '[{"value":"University A"}]',
                '[{"value":"University B"},{"value":"Institute C"},{"value":"Lab D"}]',
                '[{"value":"University E"},{"value":"Institute F"}]'
            ],
            "authorRorIds" => [
                'https://ror.org/03yrm5c26]',
                'https://ror.org/02nr0ka47,https://ror.org/0168r3w48,https://ror.org/04m7fg108',
                'https://ror.org/05dxps055,https://ror.org/00hx57361'
            ]
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Überprüfen, ob alle drei Autoren korrekt gespeichert wurden
        for ($i = 0; $i < 3; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Author WHERE familyname = ? AND givenname = ?");
            $stmt->bind_param("ss", $authorData["familynames"][$i], $authorData["givennames"][$i]);
            $stmt->execute();
            $authorResult = $stmt->get_result()->fetch_assoc();

            $this->assertEquals(
                $authorData["orcids"][$i],
                $authorResult["orcid"],
                "Die ORCID des Autors " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );

            // Überprüfen der Affiliationen
            $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                            JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id
                                            WHERE aha.Author_author_id = ?");
            $stmt->bind_param("i", $authorResult["author_id"]);
            $stmt->execute();
            $affiliationResults = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

            $expectedAffiliations = json_decode($authorData["affiliation"][$i], true);
            $expectedRorIds = explode(',', $authorData["authorRorIds"][$i]);

            $this->assertCount(
                count($expectedAffiliations),
                $affiliationResults,
                "Die Anzahl der gespeicherten Affiliationen für Autor " . ($i + 1) . " stimmt nicht mit der erwarteten Anzahl überein."
            );

            foreach ($affiliationResults as $index => $affiliation) {
                $this->assertEquals(
                    $expectedAffiliations[$index]["value"],
                    $affiliation["name"],
                    "Der Name der Affiliation " . ($index + 1) . " für Autor " . ($i + 1) . " wurde nicht korrekt gespeichert."
                );
                $this->assertEquals(
                    str_replace("https://ror.org/", "", $expectedRorIds[$index]),
                    $affiliation["rorId"],
                    "Die ROR-ID der Affiliation " . ($index + 1) . " für Autor " . ($i + 1) . " wurde nicht korrekt gespeichert."
                );
            }
        }
    }

    /**
     * Testet das Speichern von Autoren mit gemischten Affiliationen und ROR-IDs.
     */
    public function testSaveAuthorsWithMixedAffiliationsAndRorIds()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MIXED.AFFILIATIONS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Mixed Affiliations and RorIds"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "familynames" => ["Doe", "Smith", "Johnson"],
            "givennames" => ["John", "Jane", "Bob"],
            "orcids" => ["0000-0001-2345-6789", "0000-0002-3456-7890", "0000-0003-4567-8901"],
            "affiliation" => [
                '[]',
                '[{"value":"University B"}]',
                '[]'
            ],
            "authorRorIds" => [
                '',
                '',
                'https://ror.org/03yrm5c26'
            ]
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Überprüfen, ob nur die ersten beiden Autoren gespeichert wurden
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            2,
            $count,
            "Es sollten nur zwei Autoren gespeichert worden sein, da der dritte Autor eine ROR-ID ohne Affiliation hatte."
        );

        // Überprüfen der gespeicherten Autoren und ihrer Affiliationen
        for ($i = 0; $i < 2; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Author WHERE familyname = ? AND givenname = ?");
            $stmt->bind_param("ss", $authorData["familynames"][$i], $authorData["givennames"][$i]);
            $stmt->execute();
            $authorResult = $stmt->get_result()->fetch_assoc();

            $this->assertNotNull(
                $authorResult,
                "Autor {$authorData["familynames"][$i]} sollte gespeichert worden sein."
            );

            // Überprüfen der Affiliationen
            $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author_has_Affiliation WHERE Author_author_id = ?");
            $stmt->bind_param("i", $authorResult["author_id"]);
            $stmt->execute();
            $affiliationCount = $stmt->get_result()->fetch_assoc()['count'];

            if ($i == 0) {
                $this->assertEquals(
                    0,
                    $affiliationCount,
                    "Autor ohne Affiliation sollte keine Affiliationen haben."
                );
            } else {
                $this->assertEquals(
                    1,
                    $affiliationCount,
                    "Autor mit Affiliation sollte eine Affiliation haben."
                );
            }
        }

        // Überprüfen, dass der dritte Autor nicht gespeichert wurde
        $stmt = $this->connection->prepare("SELECT * FROM Author WHERE familyname = ? AND givenname = ?");
        $stmt->bind_param("ss", $authorData["familynames"][2], $authorData["givennames"][2]);
        $stmt->execute();
        $result = $stmt->get_result();
        $this->assertEquals(
            0,
            $result->num_rows,
            "Der dritte Autor sollte nicht gespeichert worden sein, da er eine ROR-ID ohne Affiliation hatte."
        );
    }

    /**
     * Testet Spezialfälle und Randbedingungen beim Speichern von Autoren.
     */
    public function testSpecialCasesAndEdgeConditions()
    {
        // Erstellen einer initialen Ressource und eines Autors
        $initialResourceData = [
            "doi" => "10.5880/GFZ.TEST.INITIAL",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Initial Test Resource"],
            "titleType" => [1]
        ];
        $initial_resource_id = saveResourceInformationAndRights($this->connection, $initialResourceData);

        $initialAuthorData = [
            "familynames" => ["Existing"],
            "givennames" => ["Author"],
            "orcids" => ["0000-0001-2345-6789"],
            "affiliation" => ['[{"value":"Existing University"}]'],
            "authorRorIds" => ['https://ror.org/03yrm5c26']
        ];
        saveAuthors($this->connection, $initialAuthorData, $initial_resource_id);

        // Neue Ressource für den Haupttest
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.SPECIAL.CASES",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Special Cases"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "familynames" => [
                "Doe",                     // Normal case
                "Smith-Jones",             // Hyphenated name
                "Müller",                  // Non-ASCII character
                str_repeat("A", 256),      // Very long name
                "Existing"                 // Existing author with new affiliation
            ],
            "givennames" => [
                "John",
                "Jane",
                "Jürgen",
                "Bob",
                "Author"
            ],
            "orcids" => [
                "0000-0002-3456-7890",     // New ORCID
                "0000-0003-4567-8901",     // New ORCID
                "invalid-orcid",           // Invalid ORCID
                "",                        // Empty ORCID
                "0000-0001-2345-6789"      // Existing ORCID
            ],
            "affiliation" => [
                '[{"value":"University A"}]',
                '[{"value":"University B"},{"value":"Institute C"}]',
                '[{"value":"Universität D"}]',  // Non-ASCII character
                '[{"value":"' . str_repeat("X", 256) . '"}]',  // Very long affiliation
                '[{"value":"Existing University"},{"value":"New University"}]'  // Existing and new affiliation
            ],
            "authorRorIds" => [
                'https://ror.org/04m7fg108',
                'https://ror.org/02nr0ka47,https://ror.org/0168r3w48',
                '',
                '',
                'https://ror.org/03yrm5c26,https://ror.org/05dxps055'
            ]
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Überprüfen der gespeicherten Autoren
        $stmt = $this->connection->prepare("SELECT COUNT(DISTINCT a.author_id) as count FROM Author a JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id WHERE rha.Resource_resource_id IN (?, ?)");
        $stmt->bind_param("ii", $initial_resource_id, $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        // Wir erwarten, dass 5 Autoren insgesamt gespeichert wurden
        $this->assertEquals(
            5,
            $count,
            "Es sollten insgesamt 5 Autoren gespeichert worden sein, einschließlich des bestehenden Autors."
        );

        // Überprüfen des existierenden Autors
        $stmt = $this->connection->prepare("SELECT a.*, GROUP_CONCAT(DISTINCT rha.Resource_resource_id) as resource_ids, COUNT(DISTINCT aha.Affiliation_affiliation_id) as affiliation_count FROM Author a JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id LEFT JOIN Author_has_Affiliation aha ON a.author_id = aha.Author_author_id WHERE a.orcid = ? GROUP BY a.author_id");
        $existingOrcid = "0000-0001-2345-6789";
        $stmt->bind_param("s", $existingOrcid);
        $stmt->execute();
        $existingAuthor = $stmt->get_result()->fetch_assoc();

        // Der existierende Autor sollte mit beiden Ressourcen verknüpft sein
        $this->assertStringContainsString(
            (string) $initial_resource_id,
            $existingAuthor['resource_ids'],
            "Der existierende Autor sollte mit der initialen Ressource verknüpft sein."
        );
        $this->assertStringContainsString(
            (string) $resource_id,
            $existingAuthor['resource_ids'],
            "Der existierende Autor sollte mit der neuen Ressource verknüpft sein."
        );

        // Der existierende Autor sollte jetzt zwei Affiliationen haben
        $this->assertEquals(
            2,
            $existingAuthor['affiliation_count'],
            "Der bestehende Autor sollte jetzt zwei Affiliationen haben: die ursprüngliche und die neue."
        );

        // Überprüfen der Affiliationen
        $stmt = $this->connection->prepare("SELECT COUNT(DISTINCT affiliation_id) as count FROM Affiliation");
        $stmt->execute();
        $affiliationCount = $stmt->get_result()->fetch_assoc()['count'];

        // Wir erwarten 7 einzigartige Affiliationen (5 neue + 2 bestehende)
        $this->assertEquals(
            7,
            $affiliationCount,
            "Es sollten 7 einzigartige Affiliationen gespeichert worden sein (5 neue + 2 bestehende)."
        );
    }
}