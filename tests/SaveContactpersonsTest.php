<?php

namespace Tests;

use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';
require_once __DIR__ . '/../save/formgroups/save_contactperson.php';

class SaveContactpersonsTest extends TestCase
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
        if ($this->connection->select_db($dbname) === false) {
            // Testdatenbank erstellen
            $connection->query("CREATE DATABASE " . $dbname);
            $connection->select_db($dbname);

            // Installation direkt ausführen
            require_once __DIR__ . '/../install.php';
            dropTables($connection);
            createDatabaseStructure($connection);
            insertLookupData($connection);
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
     * Testet die Speicherung einer einzelnen Contact Person mit allen ausgefüllten Feldern.
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
            "cpLastname" => ["Doe"],
            "cpFirstname" => ["John"],
            "cpPosition" => ["Researcher"],
            "cpEmail" => ["john.doe@example.com"],
            "cpOnlineResource" => ["http://example.com"],
            "cpAffiliation" => ['[{"value":"Test University"}]'],
            "hiddenCPRorId" => ['https://ror.org/03yrm5c26']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        // Überprüfen, ob die Contact Person korrekt gespeichert wurde
        $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
        $stmt->bind_param("s", $postData["cpEmail"][0]);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($result, "Die Contact Person wurde nicht gespeichert.");
        $this->assertEquals($postData["cpLastname"][0], $result["familyname"], "Der Nachname wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["cpFirstname"][0], $result["givenname"], "Der Vorname wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["cpPosition"][0], $result["position"], "Die Position wurde nicht korrekt gespeichert.");
        $this->assertEquals("example.com", $result["website"], "Die Website wurde nicht korrekt gespeichert.");

        // Überprüfen der Verknüpfung zur Resource
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Contact_Person WHERE Resource_resource_id = ? AND Contact_Person_contact_person_id = ?");
        $stmt->bind_param("ii", $resource_id, $result["contact_person_id"]);
        $stmt->execute();
        $this->assertEquals(1, $stmt->get_result()->num_rows, "Die Verknüpfung zur Resource wurde nicht korrekt erstellt.");

        // Überprüfen der Affiliation
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
     * Testet die Speicherung von 3 vollständig ausgefüllten Contact Persons.
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
            "cpLastname" => ["Doe", "Smith", "Johnson"],
            "cpFirstname" => ["John", "Jane", "Bob"],
            "cpPosition" => ["Researcher", "Professor", "Assistant"],
            "cpEmail" => ["john.doe@example.com", "jane.smith@example.com", "bob.johnson@example.com"],
            "cpOnlineResource" => ["http://example1.com", "http://example2.com", "http://example3.com"],
            "cpAffiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[{"value":"University C"}]'],
            "hiddenCPRorId" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', 'https://ror.org/0168r3w48']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        // Überprüfen, ob alle drei Contact Persons korrekt gespeichert wurden
        for ($i = 0; $i < 3; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
            $stmt->bind_param("s", $postData["cpEmail"][$i]);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();

            $this->assertNotNull($result, "Die Contact Person " . ($i + 1) . " wurde nicht gespeichert.");
            $this->assertEquals($postData["cpLastname"][$i], $result["familyname"], "Der Nachname der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals($postData["cpFirstname"][$i], $result["givenname"], "Der Vorname der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals($postData["cpPosition"][$i], $result["position"], "Die Position der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals(str_replace(["http://", "https://"], "", $postData["cpOnlineResource"][$i]), $result["website"], "Die Website der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");

            // Überprüfen der Verknüpfung zur Resource
            $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Contact_Person WHERE Resource_resource_id = ? AND Contact_Person_contact_person_id = ?");
            $stmt->bind_param("ii", $resource_id, $result["contact_person_id"]);
            $stmt->execute();
            $this->assertEquals(1, $stmt->get_result()->num_rows, "Die Verknüpfung zur Resource für Contact Person " . ($i + 1) . " wurde nicht korrekt erstellt.");

            // Überprüfen der Affiliation
            $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                                JOIN Contact_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
                                                WHERE cpha.contact_Person_contact_person_id = ?");
            $stmt->bind_param("i", $result["contact_person_id"]);
            $stmt->execute();
            $affiliationResult = $stmt->get_result()->fetch_assoc();

            $this->assertEquals(json_decode($postData["cpAffiliation"][$i], true)[0]["value"], $affiliationResult["name"], "Der Name der Affiliation für Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals(
                str_replace("https://ror.org/", "", $postData["hiddenCPRorId"][$i]),
                $affiliationResult["rorId"],
                "Die ROR-ID der Affiliation für Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert."
            );
        }
    }
    /**
     * Testet die Speicherung von 3 Contact Persons mit unvollständigen, aber dennoch validen Datensätzen.
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
            "cpLastname" => ["Doe", "Smith", "Johnson"],
            "cpFirstname" => ["", "Jane", "Bob"],
            "cpPosition" => ["Researcher", "", "Assistant"],
            "cpEmail" => ["john.doe@example.com", "jane.smith@example.com", "bob.johnson@example.com"],
            "cpOnlineResource" => ["http://example1.com", "http://example2.com", "http://example3.com"],
            "cpAffiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[]'],
            "hiddenCPRorId" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', '']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        // Überprüfen, ob alle drei Contact Persons korrekt gespeichert wurden
        for ($i = 0; $i < 3; $i++) {
            $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
            $stmt->bind_param("s", $postData["cpEmail"][$i]);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();

            $this->assertNotNull($result, "Die Contact Person " . ($i + 1) . " wurde nicht gespeichert.");
            $this->assertEquals($postData["cpLastname"][$i], $result["familyname"], "Der Nachname der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals($postData["cpFirstname"][$i], $result["givenname"], "Der Vorname der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals($postData["cpPosition"][$i], $result["position"], "Die Position der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
            $this->assertEquals(str_replace(["http://", "https://"], "", $postData["cpOnlineResource"][$i]), $result["website"], "Die Website der Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");

            // Überprüfen der Verknüpfung zur Resource
            $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Contact_Person WHERE Resource_resource_id = ? AND Contact_Person_contact_person_id = ?");
            $stmt->bind_param("ii", $resource_id, $result["contact_person_id"]);
            $stmt->execute();
            $this->assertEquals(1, $stmt->get_result()->num_rows, "Die Verknüpfung zur Resource für Contact Person " . ($i + 1) . " wurde nicht korrekt erstellt.");

            // Überprüfen der Affiliation (falls vorhanden)
            $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Contact_Person_has_Affiliation WHERE contact_Person_contact_person_id = ?");
            $stmt->bind_param("i", $result["contact_person_id"]);
            $stmt->execute();
            $affiliationCount = $stmt->get_result()->fetch_assoc()['count'];

            if (!empty($postData["cpAffiliation"][$i]) && $postData["cpAffiliation"][$i] !== '[]') {
                $this->assertEquals(1, $affiliationCount, "Es sollte eine Affiliation für Contact Person " . ($i + 1) . " gespeichert worden sein.");

                $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                                JOIN Contact_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
                                                WHERE cpha.contact_Person_contact_person_id = ?");
                $stmt->bind_param("i", $result["contact_person_id"]);
                $stmt->execute();
                $affiliationResult = $stmt->get_result()->fetch_assoc();

                $this->assertNotNull($affiliationResult, "Die Affiliation für Contact Person " . ($i + 1) . " wurde nicht gespeichert.");
                $this->assertEquals(json_decode($postData["cpAffiliation"][$i], true)[0]["value"], $affiliationResult["name"], "Der Name der Affiliation für Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert.");
                $this->assertEquals(
                    str_replace("https://ror.org/", "", $postData["hiddenCPRorId"][$i]),
                    $affiliationResult["rorId"],
                    "Die ROR-ID der Affiliation für Contact Person " . ($i + 1) . " wurde nicht korrekt gespeichert."
                );
            } else {
                $this->assertEquals(0, $affiliationCount, "Es sollte keine Affiliation für Contact Person " . ($i + 1) . " gespeichert worden sein.");
            }
        }
    }

    /**
     * Versuch, 3 Contact Persons mit fehlenden Pflichtdaten zu speichern, der fehlschlagen sollte.
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
            "cpLastname" => ["", "Smith", "Johnson"],
            "cpFirstname" => ["John", "Jane", "Bob"],
            "cpPosition" => ["Researcher", "Professor", "Assistant"],
            "cpEmail" => ["john.doe@example.com", "", "bob.johnson@example.com"],
            "cpOnlineResource" => ["http://example1.com", "http://example2.com", ""],
            "cpAffiliation" => ['[{"value":"University A"}]', '[{"value":"University B"}]', '[{"value":"University C"}]'],
            "hiddenCPRorId" => ['https://ror.org/03yrm5c26', 'https://ror.org/02nr0ka47', 'https://ror.org/0168r3w48']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        // Überprüfen, ob keine Contact Persons gespeichert wurden
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Contact_Person");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            3, 
            $count, 
            "Es sollten keine Contact Persons gespeichert worden sein.");

        // Überprüfen, ob keine Verknüpfungen zur Resource erstellt wurden
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Contact_Person WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(
            3, 
            $count, 
            "Es sollten keine Verknüpfungen zur Resource erstellt worden sein.");
    }

    /**
     * Testet die Speicherung von 2 Contact Persons. Eine nur mit Affiliation, die andere nur mit ROR-ID.
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
            "cpLastname" => ["Doe", "Smith"],
            "cpFirstname" => ["John", "Jane"],
            "cpPosition" => ["Researcher", "Professor"],
            "cpEmail" => ["john.doe@example.com", "jane.smith@example.com"],
            "cpOnlineResource" => ["http://example1.com", "http://example2.com"],
            "cpAffiliation" => ['[{"value":"University A"}]', '[]'],
            "hiddenCPRorId" => ['', 'https://ror.org/02nr0ka47']
        ];

        saveContactPerson($this->connection, $postData, $resource_id);

        // Überprüfen, ob nur die erste Contact Person gespeichert wurde
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Contact_Person");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(2, $count, "Es sollte nur eine Contact Person gespeichert worden sein.");

        // Überprüfen der gespeicherten Contact Person
        $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
        $stmt->bind_param("s", $postData["cpEmail"][0]);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($result, "Die erste Contact Person wurde nicht gespeichert.");
        $this->assertEquals($postData["cpLastname"][0], $result["familyname"], "Der Nachname der ersten Contact Person wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["cpFirstname"][0], $result["givenname"], "Der Vorname der ersten Contact Person wurde nicht korrekt gespeichert.");
        $this->assertEquals($postData["cpPosition"][0], $result["position"], "Die Position der ersten Contact Person wurde nicht korrekt gespeichert.");
        $this->assertEquals(str_replace(["http://", "https://"], "", $postData["cpOnlineResource"][0]), $result["website"], "Die Website der ersten Contact Person wurde nicht korrekt gespeichert.");

        // Überprüfen der Affiliation der ersten Contact Person
        $stmt = $this->connection->prepare("SELECT a.name, a.rorId FROM Affiliation a 
                                            JOIN Contact_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
                                            WHERE cpha.contact_Person_contact_person_id = ?");
        $stmt->bind_param("i", $result["contact_person_id"]);
        $stmt->execute();
        $affiliationResult = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($affiliationResult, "Die Affiliation für die erste Contact Person wurde nicht gespeichert.");
        $this->assertEquals(json_decode($postData["cpAffiliation"][0], true)[0]["value"], $affiliationResult["name"], "Der Name der Affiliation für die erste Contact Person wurde nicht korrekt gespeichert.");
        $this->assertNull(
            $affiliationResult["rorId"], 
        "Die ROR-ID der Affiliation für die erste Contact Person sollte null sein.");

        // Überprüfen, dass die zweite Contact Person nicht gespeichert wurde
        $stmt = $this->connection->prepare("SELECT * FROM Contact_Person WHERE email = ?");
        $stmt->bind_param("s", $postData["cpEmail"][1]);
        $stmt->execute();
        $result = $stmt->get_result();
        $this->assertEquals(1, $result->num_rows, "Die zweite Contact Person sollte gespeichert worden sein.");
    }
}
