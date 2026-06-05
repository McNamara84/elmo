<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_contactperson.php';

/**
 * Test class for contact person saving functionality
 *
 * This class contains test cases to verify the correct saving and validation
 * of contact person information in different scenarios.
 */
final class SaveContactpersonsTest extends DatabaseTestCase
{
    /**
     * Test saving a single contact person with all fields populated
     *
     * @return void
     */
    public function testSaveSingleContactPersonWithAllFields()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.SINGLE.CONTACT",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Single Contact"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "familynames" => ["Doe"],
            "givennames" => ["John"],
            "orcids" => ["1234-1234-1234-1234"],
            "cpEmail" => ["john.doe@example.com"],
            "cpOnlineResource" => ["http://example.com"],
            "personAffiliation" => ['[{"value":"Test University"}]'],
            "authorPersonRorIds" => ['https://ror.org/03yrm5c26']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
        $stmt->bind_param("s", $postData["cpEmail"][0]);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($result, "Die Contact Person wurde nicht gespeichert.");
        $this->assertEquals($postData["familynames"][0], $result["familyname"], "Der Nachname wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["givennames"][0], $result["givenname"], "Der Vorname wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["orcids"][0], $result["orcid"], "Die ORCID wurde nicht korrekt gespeichert.");
        $this->assertEquals("example.com", $result["website"], "Die Website wurde nicht korrekt gespeichert.");

        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Contact_Person WHERE Resource_resource_id = ? AND Contact_Person_contact_person_id = ?");
        $stmt->bind_param("ii", $resource_id, $result["contact_person_id"]);
        $stmt->execute();
        $this->assertEquals(1, $stmt->get_result()->num_rows, "Die Verknüpfung zur Resource wurde nicht korrekt erstellt.");

        $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                            JOIN Contact_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
                                            WHERE cpha.contact_Person_contact_person_id = ?");
        $stmt->bind_param("i", $result["contact_person_id"]);
        $stmt->execute();
        $affiliationResult = $stmt->get_result()->fetch_assoc();

        $this->assertEquals("Test University", $affiliationResult["name"], "Der Name der Affiliation wurde nicht korrekt gespeichert.");
        $this->assertEquals("03yrm5c26", $affiliationResult["rorId"], "Die ROR-ID der Affiliation wurde nicht korrekt gespeichert.");
    }

    /**
     * Test saving three fully populated contact persons
     *
     * @return void
     */
    public function testSaveThreeCompleteContactPersons()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.THREE.CONTACTS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Three Contacts"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "familynames" => ["Doe", "Smith", "Johnson"],
            "givennames" => ["John", "Jane", "Bob"],
            "orcids" => ["1234-1234-1234-1234", "0000-1111-2222-3333", "9876-9876-9765-9876"],
            "cpEmail" => ["john.doe@example.com", "jane.smith@example.com", "bob.johnson@example.com"],
            "cpOnlineResource" => ["http://example1.com", "http://example2.com", "http://example3.com"],
            "personAffiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[{"value":"University C"}]'],
            "authorPersonRorIds" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', 'https://ror.org/0168r3w48']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        for ($i = 0; $i < 3; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
            $stmt->bind_param("s", $postData["cpEmail"][$i]);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();

            $this->assertNotNull($result, "Die Contact Person " . ($i + 1) . " wurde nicht gespeichert.");
            $this->assertEquals($postData["familynames"][$i], $result["familyname"], "Der Nachname der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals($postData["givennames"][$i], $result["givenname"], "Der Vorname der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals($postData["orcids"][$i], $result["orcid"], "Die ORCID der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals(str_replace(["http://", "https://"], "", $postData["cpOnlineResource"][$i]), $result["website"], "Die Website der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");

            $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Contact_Person WHERE Resource_resource_id = ? AND Contact_Person_contact_person_id = ?");
            $stmt->bind_param("ii", $resource_id, $result["contact_person_id"]);
            $stmt->execute();
            $this->assertEquals(1, $stmt->get_result()->num_rows, "Die Verknüpfung zur Resource für Contact Person " . ($i + 1) . " wurde nicht korrekt erstellt.");

            $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                                JOIN Contact_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
                                                WHERE cpha.contact_Person_contact_person_id = ?");
            $stmt->bind_param("i", $result["contact_person_id"]);
            $stmt->execute();
            $affiliationResult = $stmt->get_result()->fetch_assoc();

            $this->assertEquals(json_decode($postData["personAffiliation"][$i], true)[0]["value"], $affiliationResult["name"], "Der Name der Affiliation für Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals(
                str_replace("https://ror.org/", "", $postData["authorPersonRorIds"][$i]),
                $affiliationResult["rorId"],
                "Die ROR-ID der Affiliation für Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );
        }
    }
    /**
     * Test saving contact persons with missing non-required fields
     * Verifies that contact persons are saved correctly when optional fields are empty
     *
     * @return void
     */
    public function testSaveContactPersonsWithMissingNonRequiredFields()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MISSING.NONREQUIRED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Missing Non-Required Fields"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "familynames" => ["Doe", "Smith", "Johnson"],
            "givennames" => ["Jane", "Jane", "Bob"],
            "orcids" => ["1234-1234-1234-1234", "", "9876-9876-9876-9876"],
            "cpEmail" => ["john.doe@example.com", "jane.smith@example.com", "bob.johnson@example.com"],
            "cpOnlineResource" => ["", "http://example2.com", "http://example3.com"],
            "personAffiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[]'],
            "authorPersonRorIds" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', '']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        for ($i = 0; $i < 3; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
            $stmt->bind_param("s", $postData["cpEmail"][$i]);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();

            $this->assertNotNull($result, "Die Contact Person " . ($i + 1) . " wurde nicht gespeichert.");
            $this->assertEquals($postData["familynames"][$i], $result["familyname"], "Der Nachname der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals($postData["givennames"][$i], $result["givenname"], "Der Vorname der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals($postData["orcids"][$i], $result["orcid"], "Die ORCID der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals(str_replace(["http://", "https://"], "", $postData["cpOnlineResource"][$i]), $result["website"], "Die Website der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");

            $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Contact_Person WHERE Resource_resource_id = ? AND Contact_Person_contact_person_id = ?");
            $stmt->bind_param("ii", $resource_id, $result["contact_person_id"]);
            $stmt->execute();
            $this->assertEquals(1, $stmt->get_result()->num_rows, "Die Verknüpfung zur Resource für Contact Person " . ($i + 1) . " wurde nicht korrekt erstellt.");

            $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Contact_Person_has_Affiliation WHERE contact_Person_contact_person_id = ?");
            $stmt->bind_param("i", $result["contact_person_id"]);
            $stmt->execute();
            $affiliationCount = $stmt->get_result()->fetch_assoc()['count'];

            if (!empty($postData["personAffiliation"][$i]) && $postData["personAffiliation"][$i] !== '[]') {
                $this->assertEquals(1, $affiliationCount, "Es sollte eine Affiliation für Contact Person " . ($i + 1) . " gespeichert worden sein.");

                $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                                JOIN Contact_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
                                                WHERE cpha.contact_Person_contact_person_id = ?");
                $stmt->bind_param("i", $result["contact_person_id"]);
                $stmt->execute();
                $affiliationResult = $stmt->get_result()->fetch_assoc();

                $this->assertNotNull($affiliationResult, "Die Affiliation für Contact Person " . ($i + 1) . " wurde nicht gespeichert.");
                $this->assertEquals(json_decode($postData["personAffiliation"][$i], true)[0]["value"], $affiliationResult["name"], "Der Name der Affiliation für Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
                $this->assertEquals(
                    str_replace("https://ror.org/", "", $postData["authorPersonRorIds"][$i]),
                    $affiliationResult["rorId"],
                    "Die ROR-ID der Affiliation für Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert."
                );
            } else {
                $this->assertEquals(0, $affiliationCount, "Es sollte keine Affiliation für Contact Person " . ($i + 1) . " gespeichert worden sein.");
            }
        }
    }

    /**
     * Test saving contact persons with missing required fields
     * Verifies that contact persons are not saved when mandatory fields are missing
     *
     * @return void
     */
    public function testSaveContactPersonsWithMissingRequiredFields()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MISSING.REQUIRED",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Missing Required Fields"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "familynames" => ["", "Smith", "Johnson"],
            "givennames" => ["John", "Jane", "Bob"],
            "orcids" => ["1234-1234-1234-1234", "1111-2222-3333-4444", "9876-9876-9876-9876"],
            "cpEmail" => ["john.doe@example.com", "", "bob.johnson@example.com"],
            "cpOnlineResource" => ["http://example1.com", "http://example2.com", ""],
            "personAffiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[{"value":"University C"}]'],
            "authorPersonRorIds" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', 'https://ror.org/0168r3w48']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Contact_Person");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            1,
            $count,
            "Es sollten keine Contact Persons gespeichert worden sein."
        );

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Contact_Person WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            1,
            $count,
            "Es sollten keine Verknüpfungen zur Resource erstellt worden sein."
        );
    }

    /**
     * Test saving contact persons with mixed affiliation and ROR ID data
     * Tests scenario where one person has only affiliation and another has only ROR ID
     *
     * @return void
     */
    public function testSaveContactPersonsWithMixedAffiliationRorId()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MIXED.AFFILIATION",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Mixed Affiliation/ROR-ID"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "familynames" => ["Doe", "Smith"],
            "givennames" => ["John", "Jane"],
            "orcids" => ["1234-1234-1234-1234", "9999-8888-7777-6666"],
            "cpEmail" => ["john.doe@example.com", "jane.smith@example.com"],
            "cpOnlineResource" => ["http://example1.com", "http://example2.com"],
            "personAffiliation" => ['[{"value":"University A"}]', '[]'],
            "authorPersonRorIds" => ['', 'https://ror.org/02nr0ka47']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Contact_Person");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(2, $count, "Es sollte nur eine Contact Person gespeichert worden sein.");

        $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
        $stmt->bind_param("s", $postData["cpEmail"][0]);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($result, "Die erste Contact Person wurde nicht gespeichert.");
        $this->assertEquals($postData["familynames"][0], $result["familyname"], "Der Nachname der ersten Contact Person wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["givennames"][0], $result["givenname"], "Der Vorname der ersten Contact Person wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["orcids"][0], $result["orcid"], "Die ORCID der ersten Contact Person wurde nicht korrekt gespeichert.");
        $this->assertEquals(str_replace(["http://", "https://"], "", $postData["cpOnlineResource"][0]), $result["website"], "Die Website der ersten Contact Person wurde nicht korrekt gespeichert.");

        $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                            JOIN Contact_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
                                            WHERE cpha.contact_Person_contact_person_id = ?");
        $stmt->bind_param("i", $result["contact_person_id"]);
        $stmt->execute();
        $affiliationResult = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($affiliationResult, "Die Affiliation für die erste Contact Person wurde nicht gespeichert.");
        $this->assertEquals(json_decode($postData["personAffiliation"][0], true)[0]["value"], $affiliationResult["name"], "Der Name der Affiliation für die erste Contact Person wurde nicht korrekt gespeichert.");
        $this->assertNull(
            $affiliationResult["rorId"],
            "Die ROR-ID der Affiliation für die erste Contact Person sollte null sein."
        );

        $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
        $stmt->bind_param("s", $postData["cpEmail"][1]);
        $stmt->execute();
        $result = $stmt->get_result();
        $this->assertEquals(1, $result->num_rows, "Die zweite Contact Person sollte gespeichert worden sein.");
    }

    /**
     * Bug #767: Duplicate Contact_Person rows when ORCID and website are NULL.
     * Two identical contact persons without ORCID/website should produce only 1 row.
     * Empty optional fields must be stored as SQL NULL.
     */
    public function testSaveDuplicateContactPersonWithNullOrcidAndWebsite()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.DUP.NULL.CONTACT",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Duplicate NULL Contact Person"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            'familynames' => ['DupContact', 'DupContact'],
            'givennames' => ['Person', 'Person'],
            'orcids' => ['', ''],
            'cpEmail' => ['dup@example.com', 'dup@example.com'],
            'cpOnlineResource' => ['', ''],
            'personAffiliation' => ['', ''],
            'authorPersonRorIds' => ['', '']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare(
            'SELECT * FROM Contact_Person WHERE familyname = ? AND givenname = ? AND email = ?'
        );
        $fn = 'DupContact';
        $gn = 'Person';
        $email = 'dup@example.com';
        $stmt->bind_param('sss', $fn, $gn, $email);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(1, $rows, 'Bug #767: Duplicate Contact_Person created when ORCID and website are NULL.');
        $this->assertNull($rows[0]['orcid'], 'Empty ORCID should be stored as SQL NULL.');
        $this->assertNull($rows[0]['website'], 'Empty website should be stored as SQL NULL.');
    }

    /**
     * Bug #767: Contact persons with different websites (one NULL, one filled) are not duplicates.
     */
    public function testContactPersonsWithDifferentWebsiteAreNotDuplicates()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.DIFF.WEB.CONTACT",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Different Website Contact Person"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            'familynames' => ['WebContact', 'WebContact'],
            'givennames' => ['Person', 'Person'],
            'orcids' => ['', ''],
            'cpEmail' => ['web@example.com', 'web@example.com'],
            'cpOnlineResource' => ['', 'http://example.com'],
            'personAffiliation' => ['', ''],
            'authorPersonRorIds' => ['', '']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare(
            'SELECT website FROM Contact_Person WHERE familyname = ? AND email = ? ORDER BY website'
        );
        $fn = 'WebContact';
        $email = 'web@example.com';
        $stmt->bind_param('ss', $fn, $email);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(2, $rows, 'Contact persons with different websites (NULL vs filled) should be stored separately.');
        $this->assertNull($rows[0]['website'], 'First contact should have NULL website.');
        $this->assertNotNull($rows[1]['website'], 'Second contact should have a filled website.');
    }

    /**
     * Bug #767: Duplicate detection when only ORCID is NULL but website is filled.
     */
    public function testSaveDuplicateContactPersonWithNullOrcidButFilledWebsite()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.PARTIAL.NULL.CONTACT",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Partial NULL Contact Person"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            'familynames' => ['PartialContact', 'PartialContact'],
            'givennames' => ['Person', 'Person'],
            'orcids' => ['', ''],
            'cpEmail' => ['partial@example.com', 'partial@example.com'],
            'cpOnlineResource' => ['http://partial.example.com', 'http://partial.example.com'],
            'personAffiliation' => ['', ''],
            'authorPersonRorIds' => ['', '']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare(
            'SELECT * FROM Contact_Person WHERE familyname = ? AND email = ?'
        );
        $fn = 'PartialContact';
        $email = 'partial@example.com';
        $stmt->bind_param('ss', $fn, $email);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(1, $rows, 'Bug #767: Duplicate Contact_Person created when ORCID is NULL but website is filled.');
        $this->assertNull($rows[0]['orcid'], 'Empty ORCID should be stored as SQL NULL.');
        $this->assertNotNull($rows[0]['website'], 'Filled website should not be NULL.');
    }

    /**
     * Bug #767: Legacy Contact_Person row with SQL NULL must be found when saving with empty fields.
     */
    public function testContactPersonLegacyNullMatchedByFormSave()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.LEGACY.NULL.CONTACT",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Legacy NULL Contact Person"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        // Pre-insert a contact person with SQL NULLs (legacy row)
        $stmt = $this->connection->prepare(
            'INSERT INTO Contact_Person (familyname, givenname, orcid, email, website) VALUES (?, ?, NULL, ?, NULL)'
        );
        $fn = 'LegacyContact';
        $gn = 'NullFields';
        $email = 'legacy@example.com';
        $stmt->bind_param('sss', $fn, $gn, $email);
        $stmt->execute();
        $legacyId = $stmt->insert_id;
        $stmt->close();

        // Save via form handler with empty strings (should normalize to NULL and match)
        $postData = [
            'familynames' => ['LegacyContact'],
            'givennames' => ['NullFields'],
            'orcids' => [''],
            'cpEmail' => ['legacy@example.com'],
            'cpOnlineResource' => [''],
            'personAffiliation' => [''],
            'authorPersonRorIds' => ['']
        ];
        saveContactPerson($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare(
            'SELECT contact_person_id FROM Contact_Person WHERE familyname = ? AND email = ?'
        );
        $stmt->bind_param('ss', $fn, $email);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $this->assertCount(1, $rows, 'Legacy row with SQL NULLs should be matched by form save.');
        $this->assertEquals($legacyId, $rows[0]['contact_person_id'], 'The pre-existing legacy contact person ID should be reused.');
    }
}
