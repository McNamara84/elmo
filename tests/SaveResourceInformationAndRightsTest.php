<?php

declare(strict_types=1);

namespace Tests;


/**
 * Testklasse für die Funktionalität zum Speichern von Ressourceninformationen und Rechten.
 * 
 * Diese Klasse enthält verschiedene Testfälle, die die korrekte Funktionsweise
 * der saveResourceInformationAndRights-Funktion unter verschiedenen Bedingungen überprüfen.
 */
final class SaveResourceInformationAndRightsTest extends DatabaseTestCase
{
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
                "Alternative for Multiple Title Test",
                "Translated Title for Multiple Title Test"
            ],
            "titleType" => [1, 2, 3]  // Angenommen, 1 = Main, 2 = Alternative, 3 = Translated
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
            "action" => "submit",
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
     * Tests that a title with text only (without type) is skipped, not saved.
     * 
     * @return void
     */
    public function testTitleWithTextOnlyNullType()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ.TITLE.NULL.TYPE.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "action" => "submit",
            "title" => ["Title Without Type"],
            "titleType" => [""]  // Empty title type
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);
        // Should return false because title without type is skipped, no valid titles remain
        $this->assertFalse($resource_id, "Should return false when title has no type (text-only titles not allowed)");
    }

    /**
     * Tests saving a title with both text and a valid type.
     * 
     * @return void
     */
    public function testTitleWithTextAndValidType()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ.TITLE.VALID.TYPE.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Title With Valid Type"],
            "titleType" => ["1"]  // Valid type ID
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);
        $this->assertIsInt($resource_id, "Should return a valid resource ID");
        $this->assertGreaterThan(0, $resource_id);

        // Verify title was saved with correct type
        $stmt = $this->connection->prepare("SELECT * FROM Title WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $this->assertEquals("Title With Valid Type", $row["text"], "Title text should be saved");
        $this->assertEquals(1, $row["Title_Type_fk"], "Title type should be saved as integer 1");
    }

    /**
     * Tests that a title with type but no text is skipped (not saved).
     * 
     * @return void
     */
    public function testTitleWithTypeButNoText()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ.TITLE.TYPE.NO.TEXT.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "action" => "submit",
            "title" => [""],  // Empty title text
            "titleType" => ["1"]  // Type without text
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);
        // Should return false because type without text is invalid, no valid titles remain
        $this->assertFalse($resource_id, "Should return false when title has type but no text");
    }

    /**
     * Tests that completely empty title entries are skipped.
     * 
     * @return void
     */
    public function testCompletelyEmptyTitleEntry()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ.TITLE.EMPTY.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "action" => "submit",
            "title" => [""],  // Empty title text
            "titleType" => [""]  // Empty title type
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);
        // Should return false because there are no valid titles for a resource
        $this->assertFalse($resource_id, "Should return false when all titles are empty");
    }

    /**
     * Tests that invalid title type IDs are skipped with logging.
     * 
     * @return void
     */
    public function testInvalidTitleTypeId()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ.TITLE.INVALID.TYPE.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Title With Invalid Type"],
            "titleType" => ["9999"]  // Non-existent type ID
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);
        // Should return false because invalid type is skipped and no valid titles remain
        $this->assertFalse($resource_id, "Should return false when title type ID doesn't exist in database");
    }

    /**
     * Tests mixed title scenarios: some valid, some invalid.
     * Valid titles should be saved, invalid ones skipped.
     * 
     * @return void
     */
    public function testMixedTitlesWithSomeValid()
    {
        if (!function_exists('saveResourceInformationAndRights')) {
            require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        }

        $postData = [
            "doi" => "10.5880/GFZ.TITLE.MIXED.TEST",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => [
                "Valid Title 1",      // Valid
                "",                   // Invalid (no text)
                "Valid Title 2",      // Valid
                "Invalid No Type"     // Invalid (no type)
            ],
            "titleType" => [
                "1",  // Valid type
                "1",  // Invalid (no text to go with)
                "2",  // Valid type
                ""    // Invalid (no type)
            ]
        ];

        $resource_id = saveResourceInformationAndRights($this->connection, $postData);
        $this->assertIsInt($resource_id, "Should return a valid resource ID");
        $this->assertGreaterThan(0, $resource_id);

        // Verify only valid titles were saved
        $stmt = $this->connection->prepare("SELECT * FROM Title WHERE Resource_resource_id = ? ORDER BY title_id");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $this->assertEquals(2, $result->num_rows, "Should have exactly 2 valid titles saved");

        $titles = [];
        while ($row = $result->fetch_assoc()) {
            $titles[] = $row;
        }

        $this->assertEquals("Valid Title 1", $titles[0]["text"], "First valid title should be saved");
        $this->assertEquals(1, $titles[0]["Title_Type_fk"], "First valid title should have type 1");
        $this->assertEquals("Valid Title 2", $titles[1]["text"], "Second valid title should be saved");
        $this->assertEquals(2, $titles[1]["Title_Type_fk"], "Second valid title should have type 2");
    }
}