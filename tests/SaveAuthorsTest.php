<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_authors.php';

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
     * Tests saving a single person author with all fields populated.
     *
     * @return void
     * @throws \Exception
     */
    public function testSaveSinglePersonAuthorWithAllFields()
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
            "personAffiliation" => ['[{"value":"Test University"}]'],
            "authorPersonRorIds" => ['https://ror.org/047w75g40']
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        // Check: Person is in Author_person
        $stmt = $this->connection->prepare("SELECT * FROM Author_person WHERE familyname = ? AND givenname = ?");
        $stmt->bind_param("ss", $authorData["familynames"][0], $authorData["givennames"][0]);
        $stmt->execute();
        $personResult = $stmt->get_result()->fetch_assoc();
        $this->assertNotEmpty($personResult, "Der Autor wurde nicht in Author_person gespeichert.");

        $this->assertEquals(
            $authorData["orcids"][0],
            $personResult["orcid"],
            "Die ORCID des Autors wurde nicht korrekt in Author_person gespeichert."
        );

        $author_person_id = $personResult["author_person_id"];

        // Check: Link entry in Author
        $stmt = $this->connection->prepare("SELECT * FROM Author WHERE Author_Person_author_person_id = ?");
        $stmt->bind_param("i", $author_person_id);
        $stmt->execute();
        $authorLinkResult = $stmt->get_result()->fetch_assoc();
        $this->assertNotEmpty($authorLinkResult, "Der Autor wurde nicht korrekt mit der Author-Tabelle verknüpft.");
        $author_id = $authorLinkResult["author_id"];

        // Check: Link to resource
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
        $stmt->bind_param("ii", $resource_id, $author_id);
        $stmt->execute();
        $this->assertEquals(
            1,
            $stmt->get_result()->num_rows,
            "Die Verknüpfung zwischen Autor und Resource wurde nicht korrekt gespeichert."
        );

        // Check: Affiliation saved and linked
        $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                        JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id
                                        WHERE aha.Author_author_id = ?");
        $stmt->bind_param("i", $author_id);
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
    public function testSaveSingleInstitutionAuthorWithAllFields()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.SINGLE.INSTITUTION",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Single Institution"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "authorinstitutionName" => ["Test Institution"],
            "institutionAffiliation" => ['[{"value":"Test Institution University"}]'],
            "authorInstitutionRorIds" => ['https://ror.org/012345678']
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        $stmt = $this->connection->prepare("SELECT * FROM Author_institution WHERE institutionname = ?");
        $stmt->bind_param("s", $authorData["authorinstitutionName"][0]);
        $stmt->execute();
        $institutionResult = $stmt->get_result()->fetch_assoc();
        $this->assertNotEmpty($institutionResult, "Die Institution wurde nicht in Author_institution gespeichert.");

        $author_institution_id = $institutionResult["author_institution_id"];

        $stmt = $this->connection->prepare("SELECT * FROM Author WHERE Author_Institution_author_institution_id = ?");
        $stmt->bind_param("i", $author_institution_id);
        $stmt->execute();
        $authorLinkResult = $stmt->get_result()->fetch_assoc();
        $this->assertNotEmpty($authorLinkResult, "Die Institution wurde nicht korrekt mit der Author-Tabelle verknüpft.");
        $author_id = $authorLinkResult["author_id"];

        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
        $stmt->bind_param("ii", $resource_id, $author_id);
        $stmt->execute();
        $this->assertEquals(
            1,
            $stmt->get_result()->num_rows,
            "Die Verknüpfung zwischen Institution und Resource wurde nicht korrekt gespeichert."
        );

        // Affiliations prüfen
        $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
            JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id
            WHERE aha.Author_author_id = ?");
        $stmt->bind_param("i", $author_id);
        $stmt->execute();
        $affiliationResult = $stmt->get_result()->fetch_assoc();

        $this->assertEquals(
            "Test Institution University",
            $affiliationResult["name"],
            "Der Name der Affiliation wurde nicht korrekt gespeichert."
        );
        $this->assertEquals(
            "012345678",
            $affiliationResult["rorId"],
            "Die ROR-ID der Affiliation wurde nicht korrekt gespeichert."
        );
    }

    /**
     * Tests saving three personal authors with all fields populated.
     *
     * @return void
     * @throws \Exception
     */
    public function testSaveThreePersonAuthorsWithAllFields()
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
            "personAffiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[{"value":"University C"}]'],
            "authorPersonRorIds" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', 'https://ror.org/0168r3w48']
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        for ($i = 0; $i < 3; $i++) {
            // Retrieve Author_person entry
            $stmt = $this->connection->prepare("SELECT * FROM Author_person WHERE familyname = ? AND givenname = ?");
            $stmt->bind_param("ss", $authorData["familynames"][$i], $authorData["givennames"][$i]);
            $stmt->execute();
            $personResult = $stmt->get_result()->fetch_assoc();
            $this->assertNotEmpty($personResult, "Author_person nicht gefunden für Autor " . ($i + 1));
            $this->assertEquals(
                $authorData["orcids"][$i],
                $personResult["orcid"],
                "Die ORCID des Autors " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );
            $stmt->close();

            // Get link to author
            $author_person_id = $personResult["author_person_id"];
            $stmt = $this->connection->prepare("SELECT * FROM Author WHERE Author_Person_author_person_id = ?");
            $stmt->bind_param("i", $author_person_id);
            $stmt->execute();
            $authorLinkResult = $stmt->get_result()->fetch_assoc();
            $this->assertNotEmpty($authorLinkResult, "Der Autor wurde nicht korrekt mit der Author-Tabelle verknüpft.");
            $author_id = $authorLinkResult["author_id"];
            $stmt->close();

            // Check Resource_has_Author link
            $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Author WHERE Resource_resource_id = ? AND Author_author_id = ?");
            $stmt->bind_param("ii", $resource_id, $author_id);
            $stmt->execute();
            $this->assertEquals(
                1,
                $stmt->get_result()->num_rows,
                "Die Verknüpfung zwischen Autor " . ($i + 1) . " und Resource wurde nicht korrekt gespeichert."
            );
            $stmt->close();

            // Check Affiliation
            $stmt = $this->connection->prepare("SELECT a.name, a.rorId 
                                            FROM Affiliation a 
                                            JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id
                                            WHERE aha.Author_author_id = ?");
            $stmt->bind_param("i", $author_id);
            $stmt->execute();
            $affiliationResult = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            $expectedName = json_decode($authorData["personAffiliation"][$i], true)[0]["value"];
            $expectedRor = str_replace("https://ror.org/", "", $authorData["authorPersonRorIds"][$i]);

            $this->assertEquals(
                $expectedName,
                $affiliationResult["name"],
                "Der Name der Affiliation für Autor " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );
            $this->assertEquals(
                $expectedRor,
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
    /**
     * Tests saving a single author with only required fields.
     *
     * @return void
     * @throws \Exception
     */
    public function testSaveSinglePersonAuthorWithMissingGivenname()
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

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author_person");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            0,
            $count,
            "Es sollte kein Autor gespeichert werden, wenn kein Vorname angegeben wurde."
        );
    }
    public function testSaveSingleInstitutionAuthorWithMissingName()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.SINGLE.REQUIRED.INSTITUTION",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Single Institution Required"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $authorData = [
            "authorinstitutionName" => [""],
            "institutionAffiliation" => [''],
            "authorInstitutionRorIds" => ['']
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author_institution");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            0,
            $count,
            "Es sollte kein Autor gespeichert werden, wenn kein Institutionname angegeben wurde."
        );
    }

    /**
     * Tests behavior when attempting to save an personal author with empty fields.
     *
     * @return void
     * @throws \Exception
     */
    public function testSavePersonAuthorWithEmptyFields()
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
            "personAffiliation" => [],
            "authorPersonRorIds" => []
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author_person");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            0,
            $count,
            "Es sollte kein Autor gespeichert worden sein, da alle Felder leer waren."
        );
    }

    /**
     * Tests saving three personal authors where one has a missing last name.
     *
     * @return void
     * @throws \Exception
     */
    public function testSaveThreePersonAuthorsWithOneMissingLastName()
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
            "personAffiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[{"value":"University C"}]'],
            "authorPersonRorIds" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', 'https://ror.org/0168r3w48']
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author_person");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            2,
            $count,
            "Es sollten nur zwei Autoren gespeichert worden sein, da einer einen fehlenden Nachnamen hatte."
        );

        $stmt = $this->connection->prepare("SELECT familyname FROM Author_person ORDER BY familyname");
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
    public function testSavePersonAuthorsWithMultipleAffiliations()
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
            "personAffiliation" => [
                '[{"value":"University A"}]',
                '[{"value":"University B"},{"value":"Institute C"},{"value":"Lab D"}]',
                '[{"value":"University E"},{"value":"Institute F"}]'
            ],
            "authorPersonRorIds" => [
                'https://ror.org/03yrm5c26',
                'https://ror.org/02nr0ka47,https://ror.org/0168r3w48,https://ror.org/04m7fg108',
                'https://ror.org/05dxps055,https://ror.org/00hx57361'
            ]
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        for ($i = 0; $i < 3; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Author_person WHERE familyname = ? AND givenname = ?");
            $stmt->bind_param("ss", $authorData["familynames"][$i], $authorData["givennames"][$i]);
            $stmt->execute();
            $person = $stmt->get_result()->fetch_assoc();

            $this->assertEquals(
                $authorData["orcids"][$i],
                $person["orcid"],
                "Die ORCID des Autors " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );

            // Zu Author mappen
            $stmt = $this->connection->prepare("SELECT author_id FROM Author WHERE Author_Person_author_person_id = ?");
            $stmt->bind_param("i", $person["author_person_id"]);
            $stmt->execute();
            $author = $stmt->get_result()->fetch_assoc();
            $author_id = $author["author_id"];

            // Affiliations prüfen
            $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
            JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id 
            WHERE aha.Author_author_id = ?");
            $stmt->bind_param("i", $author_id);
            $stmt->execute();
            $affiliations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

            $expectedNames = json_decode($authorData["personAffiliation"][$i], true);
            $expectedRorIds = explode(',', $authorData["authorPersonRorIds"][$i]);

            $this->assertCount(
                count($expectedNames),
                $affiliations,
                " stimmt nicht mit der erwarteten Anzahl überein " . ($i + 1)
            );

            foreach ($affiliations as $index => $affiliation) {
                $this->assertEquals(
                    $expectedNames[$index]["value"],
                    $affiliation["name"],
                    "wurde nicht korrekt gespeichert. " . ($index + 1) . " für Autor " . ($i + 1)
                );
                $this->assertEquals(
                    str_replace("https://ror.org/", "", $expectedRorIds[$index]),
                    $affiliation["rorId"],
                    "wurde nicht korrekt gespeichert. " . ($index + 1) . " bei Autor " . ($i + 1)
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
    public function testSavePersonAuthorsWithMixedAffiliationsAndRorIds()
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
            "personAffiliation" => [
                '[]',
                '[{"value":"University B"}]',
                '[]'
            ],
            "authorPersonRorIds" => [
                '',
                '',
                'https://ror.org/03yrm5c26'
            ]
        ];

        saveAuthors($this->connection, $authorData, $resource_id);

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author_person");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            2,
            $count,
            "Es sollten nur zwei Autoren gespeichert worden sein, da der dritte Autor eine ROR-ID ohne Affiliation hatte."
        );

        for ($i = 0; $i < 2; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Author_person WHERE familyname = ? AND givenname = ?");
            $stmt->bind_param("ss", $authorData["familynames"][$i], $authorData["givennames"][$i]);
            $stmt->execute();
            $personResult = $stmt->get_result()->fetch_assoc();
            $this->assertNotNull($personResult, "Autor {$authorData["familynames"][$i]} sollte gespeichert worden sein.");

            $stmt = $this->connection->prepare("SELECT * FROM Author WHERE Author_Person_author_person_id = ?");
            $stmt->bind_param("i", $personResult["author_person_id"]);
            $stmt->execute();
            $authorLink = $stmt->get_result()->fetch_assoc();
            $author_id = $authorLink["author_id"];

            $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Author_has_Affiliation WHERE Author_author_id = ?");
            $stmt->bind_param("i", $author_id);
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

        $stmt = $this->connection->prepare("SELECT * FROM Author_person WHERE familyname = ? AND givenname = ?");
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
            "personAffiliation" => ['[{"value":"Existing University"}]'],
            "authorPersonRorIds" => ['https://ror.org/03yrm5c26']
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
            "personAffiliation" => [
                '[{"value":"University A"}]',
                '[{"value":"University B"},{"value":"Institute C"}]',
                '[{"value":"Universität D"}]',  // Non-ASCII character
                '[{"value":"' . str_repeat("X", 256) . '"}]',  // Very long affiliation
                '[{"value":"Existing University"},{"value":"New University"}]'  // Existing and new affiliation
            ],
            "authorPersonRorIds" => [
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

        $existingOrcid = "0000-0001-2345-6789";
        $stmt = $this->connection->prepare("
        SELECT a.author_id, GROUP_CONCAT(DISTINCT rha.Resource_resource_id) as resource_ids,
               COUNT(DISTINCT aha.Affiliation_affiliation_id) as affiliation_count
        FROM Author a
        JOIN Author_person ap ON a.Author_Person_author_person_id = ap.author_person_id
        JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id
        LEFT JOIN Author_has_Affiliation aha ON a.author_id = aha.Author_author_id
        WHERE ap.orcid = ?
        GROUP BY a.author_id
    ");
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