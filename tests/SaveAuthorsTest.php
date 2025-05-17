<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_authors.php';
require_once __DIR__ . '/TestDatabaseSetup.php';

/**
 * Test class for the author saving functionality.
 * 
 * This class contains various test cases to verify the correct functionality
 * of the saveAuthors function under different conditions.
 * 
 * @package Tests
 */
class SaveAuthorsTest extends DatabaseTestCase
{
    /**
     * @var \mysqli Database connection instance
     */
    private $connection;

    /**
     * Set up the test environment.
     * Creates test database if it doesn't exist and initializes database structure.
     *
     * @return void
     */
    protected function setUp(): void
    {
        global $connection;
        if (!$connection) {
            $connection = connectDb();
        }
        $this->connection = $connection;
        $dbname = 'mde2-msl-test';
        try {
            if ($this->connection->select_db($dbname) === false) {
                $connection->query("CREATE DATABASE " . $dbname);
                $connection->select_db($dbname);
            }
            setupTestDatabase($connection);

        } catch (\Exception $e) {
            $this->fail("Fehler beim Setup der Testdatenbank: " . $e->getMessage());
        }
    }

    /**
     * Clean up test data after each test.
     *
     * @return void
     */
    protected function tearDown(): void
    {
        $this->cleanupTestData();
    }

    /**
     * Tests saving a single author with all fields populated.
     *
     * @return void
     * @throws \Exception
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

        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
        $stmt->bind_param("ii", $resource_id, $authorResult["author_id"]);
        $stmt->execute();
        $this->assertEquals(
            1,
            $stmt->get_result()->num_rows,
            "Die Verknüpfung zwischen Autor und Resource wurde nicht korrekt gespeichert."
        );

        $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                            JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id
                                            WHERE aha.Author_author_id = ?");
        $stmt->bind_param("i", $authorResult["author_id"]);
        $stmt->execute();
        $affiliationResult = $stmt->get_result()->fetch_assoc();

        $this->assertEquals(
            "Test University",
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
     * Tests saving three authors with all fields populated.
     *
     * @return void
     * @throws \Exception
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

            $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
            $stmt->bind_param("ii", $resource_id, $authorResult["author_id"]);
            $stmt->execute();
            $this->assertEquals(
                1,
                $stmt->get_result()->num_rows,
                "Die Verknüpfung zwischen Autor " . ($i + 1) . " und Resource wurde nicht korrekt gespeichert."
            );

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
     * Tests saving a single author with only required fields.
     *
     * @return void
     * @throws \Exception
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

        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
        $stmt->bind_param("ii", $resource_id, $authorResult["author_id"]);
        $stmt->execute();
        $this->assertEquals(
            1,
            $stmt->get_result()->num_rows,
            "Die Verknüpfung zwischen Autor und Resource wurde nicht korrekt gespeichert."
        );

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
     * Tests behavior when attempting to save an author with empty fields.
     *
     * @return void
     * @throws \Exception
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
     * Tests saving three authors where one has a missing last name.
     *
     * @return void
     * @throws \Exception
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

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            2,
            $count,
            "Es sollten nur zwei Autoren gespeichert worden sein, da einer einen fehlenden Nachnamen hatte."
        );

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
     * Tests saving authors with multiple affiliations.
     * Verifies correct handling of multiple affiliations per author.
     *
     * @return void
     * @throws \Exception
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
     * Tests saving authors with mixed affiliations and ROR IDs.
     * Verifies correct handling of cases where some authors have affiliations
     * and ROR IDs while others don't.
     *
     * @return void
     * @throws \Exception
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

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            2,
            $count,
            "Es sollten nur zwei Autoren gespeichert worden sein, da der dritte Autor eine ROR-ID ohne Affiliation hatte."
        );

        for ($i = 0; $i < 2; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Author WHERE familyname = ? AND givenname = ?");
            $stmt->bind_param("ss", $authorData["familynames"][$i], $authorData["givennames"][$i]);
            $stmt->execute();
            $authorResult = $stmt->get_result()->fetch_assoc();

            $this->assertNotNull(
                $authorResult,
                "Autor {$authorData["familynames"][$i]} sollte gespeichert worden sein."
            );

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
     * Tests special cases and edge conditions when saving authors.
     * Includes tests for:
     * - Hyphenated names
     * - Non-ASCII characters
     * - Very long names and affiliations
     * - Existing authors with new affiliations
     * - Invalid ORCID IDs
     * - Multiple resource associations
     *
     * @return void
     * @throws \Exception
     */
    public function testSpecialCasesAndEdgeConditions()
    {
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

        $stmt = $this->connection->prepare("SELECT COUNT(DISTINCT a.author_id) as count FROM Author a JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id WHERE rha.Resource_resource_id IN (?, ?)");
        $stmt->bind_param("ii", $initial_resource_id, $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(
            5,
            $count,
            "Es sollten insgesamt 5 Autoren gespeichert worden sein, einschließlich des bestehenden Autors."
        );

        $stmt = $this->connection->prepare("SELECT a.*, GROUP_CONCAT(DISTINCT rha.Resource_resource_id) as resource_ids, COUNT(DISTINCT aha.Affiliation_affiliation_id) as affiliation_count FROM Author a JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id LEFT JOIN Author_has_Affiliation aha ON a.author_id = aha.Author_author_id WHERE a.orcid = ? GROUP BY a.author_id");
        $existingOrcid = "0000-0001-2345-6789";
        $stmt->bind_param("s", $existingOrcid);
        $stmt->execute();
        $existingAuthor = $stmt->get_result()->fetch_assoc();

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

        $this->assertEquals(
            2,
            $existingAuthor['affiliation_count'],
            "Der bestehende Autor sollte jetzt zwei Affiliationen haben: die ursprüngliche und die neue."
        );

        $stmt = $this->connection->prepare("SELECT COUNT(DISTINCT affiliation_id) as count FROM Affiliation");
        $stmt->execute();
        $affiliationCount = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(
            7,
            $affiliationCount,
            "Es sollten 7 einzigartige Affiliationen gespeichert worden sein (5 neue + 2 bestehende)."
        );
    }
}