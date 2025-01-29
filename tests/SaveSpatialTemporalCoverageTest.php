<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;

require_once __DIR__ . '/../settings.php';
require_once __DIR__ . '/../save/formgroups/save_spatialtemporalcoverage.php';

/**
 * Test class for Spatial Temporal Coverage saving functionality.
 * 
 * This class contains test cases for validating the correct storage of spatial
 * and temporal coverage data in the database, including coordinate information,
 * dates, times, and timezone data.
 */
class SaveSpatialTemporalCoverageTest extends TestCase
{
    /**
     * @var mysqli Database connection
     */
    private $connection;

    /**
     * Set up the test environment.
     * 
     * Establishes database connection and ensures test database exists.
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

        // Überprüfen, ob die Testdatenbank verfügbar ist
        $dbname = 'mde2-msl-test';
        if ($this->connection->select_db($dbname) === false) {
            // Testdatenbank erstellen
            $connection->query("CREATE DATABASE " . $dbname);
            $connection->select_db($dbname);

            // Installation direkt ausführen
            require_once 'install.php';
            dropTables($connection);
            createDatabaseStructure($connection);
            insertLookupData($connection);
        }
    }

    /**
     * Clean up after each test.
     *
     * @return void
     */
    protected function tearDown(): void
    {
        $this->cleanupTestData();
    }

    /**
     * Remove all test data from the database.
     *
     * @return void
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
     * Alle Felder wurden einmal befüllt
     */
    /**
     * Tests saving a complete STC record with all fields filled.
     * 
     * Verifies that a fully populated spatial temporal coverage record
     * is correctly saved to the database with all its attributes.
     *
     * @return void
     */
    public function testSaveAllFieldsFilled()
    {
        // Create test resource
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ALL.FIELDS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test All Fields STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        // Prepare test data
        $postData = [
            "tscLatitudeMin" => ["40.7128"],
            "tscLatitudeMax" => ["40.7828"],
            "tscLongitudeMin" => ["-74.0060"],
            "tscLongitudeMax" => ["-73.9360"],
            "tscDescription" => ["New York City"],
            "tscDateStart" => ["2023-01-01"],
            "tscTimeStart" => ["00:00:00"],
            "tscDateEnd" => ["2023-12-31"],
            "tscTimeEnd" => ["23:59:59"],
            "tscTimezone" => ["-05:00"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Function should return true when all fields are properly saved.");

        // Verify saved data
        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $stc = $stmt->get_result()->fetch_assoc();

        // Assert all fields were saved correctly
        $this->assertNotNull($stc, "STC entry should be saved in the database");
        $this->assertEquals($postData["tscLatitudeMin"][0], $stc["latitudeMin"]);
        $this->assertEquals($postData["tscLatitudeMax"][0], $stc["latitudeMax"]);
        $this->assertEquals($postData["tscLongitudeMin"][0], $stc["longitudeMin"]);
        $this->assertEquals($postData["tscLongitudeMax"][0], $stc["longitudeMax"]);
        $this->assertEquals($postData["tscDateStart"][0], $stc["dateStart"]);
        $this->assertEquals($postData["tscTimeStart"][0], $stc["timeStart"]);
        $this->assertEquals($postData["tscDateEnd"][0], $stc["dateEnd"]);
        $this->assertEquals($postData["tscTimeEnd"][0], $stc["timeEnd"]);
        $this->assertEquals($postData["tscTimezone"][0], $stc["timezone"]);

        // Verify resource linkage
        $stmt = $this->connection->prepare(
            "SELECT * FROM Resource_has_Spatial_Temporal_Coverage 
             WHERE Resource_resource_id = ? 
             AND Spatial_Temporal_Coverage_spatial_temporal_coverage_id = ?"
        );
        $stmt->bind_param("ii", $resource_id, $stc["spatial_temporal_coverage_id"]);
        $stmt->execute();
        $relation = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($relation, "Resource-STC relationship should exist");
    }

    /**
     * Eingabe von 3 vollständig ausgefüllten Datensätzen
     */
    public function testSaveThreeCompleteSets()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.THREE.SETS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Three Sets STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "tscLatitudeMin" => ["40.7128", "51.5074", "48.8566"],
            "tscLatitudeMax" => ["40.7828", "51.5774", "48.9266"],
            "tscLongitudeMin" => ["-74.0060", "-0.1278", "2.3522"],
            "tscLongitudeMax" => ["-73.9360", "-0.0578", "2.4222"],
            "tscDescription" => ["New York", "London", "Paris"],
            "tscDateStart" => ["2023-01-01", "2023-02-01", "2023-03-01"],
            "tscTimeStart" => ["00:00:00", "00:00:00", "00:00:00"],
            "tscDateEnd" => ["2023-12-31", "2023-12-31", "2023-12-31"],
            "tscTimeEnd" => ["23:59:59", "23:59:59", "23:59:59"],
            "tscTimezone" => ["-05:00", "+00:00", "+01:00"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Die Funktion sollte true zurückgeben.");

        // Check if all three STCs were saved correctly
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Spatial_Temporal_Coverage");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(3, $count, "Es sollten genau drei STC-Einträge gespeichert worden sein.");

        // Check if all three relations to the resource were created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Spatial_Temporal_Coverage WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(3, $count, "Es sollten genau drei Verknüpfungen zwischen Resource und STC existieren.");
    }

    /**
     * Tests saving STC record without maximum coordinates.
     * 
     * Verifies that a record can be saved with only minimum coordinates,
     * leaving maximum coordinates as null.
     *
     * @return void
     */
    public function testSaveWithoutMaxCoordinates()
    {
        // Create test resource
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.NO.MAX.COORDS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test No Max Coordinates STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "tscLatitudeMin" => ["40.7128"],
            "tscLatitudeMax" => [""],
            "tscLongitudeMin" => ["-74.0060"],
            "tscLongitudeMax" => [""],
            "tscDescription" => ["New York City"],
            "tscDateStart" => ["2023-01-01"],
            "tscTimeStart" => ["00:00:00"],
            "tscDateEnd" => ["2023-12-31"],
            "tscTimeEnd" => ["23:59:59"],
            "tscTimezone" => ["-05:00"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Function should return true when saving with null max coordinates");

        // Verify saved data
        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $stc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($stc, "STC entry should be saved");
        $this->assertEquals($postData["tscLatitudeMin"][0], $stc["latitudeMin"]);
        $this->assertNull($stc["latitudeMax"]);
        $this->assertEquals($postData["tscLongitudeMin"][0], $stc["longitudeMin"]);
        $this->assertNull($stc["longitudeMax"]);
    }

    /**
     * Tests validation of invalid coordinate combinations.
     * 
     * Verifies that saving fails when required coordinate fields are missing.
     *
     * @return void
     */
    public function testSaveWithInvalidCoordinates()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.INVALID.COORDS",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Invalid Coordinates STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "tscLatitudeMin" => [""],
            "tscLatitudeMax" => ["40.7828"],
            "tscLongitudeMin" => ["-74.0060"],
            "tscLongitudeMax" => [""],
            "tscDescription" => ["New York City"],
            "tscDateStart" => ["2023-01-01"],
            "tscTimeStart" => ["00:00:00"],
            "tscDateEnd" => ["2023-12-31"],
            "tscTimeEnd" => ["23:59:59"],
            "tscTimezone" => ["-05:00"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertFalse($result, "Function should return false with invalid coordinates");

        // Verify no records were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Spatial_Temporal_Coverage");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(0, $count, "No STC entries should be saved with invalid coordinates");
    }

    /**
     * Tests that saving fails when start date is missing.
     * 
     * Verifies that the system requires a start date for temporal coverage.
     *
     * @return void
     */
    public function testSaveWithoutStartDateTime()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.NO.START.DATETIME",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test No Start DateTime STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "tscLatitudeMin" => ["40.7128"],
            "tscLatitudeMax" => ["40.7828"],
            "tscLongitudeMin" => ["-74.0060"],
            "tscLongitudeMax" => ["-73.9360"],
            "tscDescription" => ["New York City"],
            "tscDateStart" => [""],
            "tscTimeStart" => [""],
            "tscDateEnd" => ["2023-12-31"],
            "tscTimeEnd" => ["23:59:59"],
            "tscTimezone" => ["-05:00"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertFalse($result, "Die Funktion sollte false zurückgeben wenn das Startdatum fehlt.");

        // Check that no STC was saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Spatial_Temporal_Coverage");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine STC-Einträge gespeichert worden sein.");
    }

    /**
     * Tests saving without time values.
     * 
     * Verifies that records can be saved with date-only temporal coverage,
     * with time fields as null.
     *
     * @return void
     */
    public function testSaveWithoutTimes()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.NO.TIMES",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test No Times STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "tscLatitudeMin" => ["40.7128"],
            "tscLatitudeMax" => ["40.7828"],
            "tscLongitudeMin" => ["-74.0060"],
            "tscLongitudeMax" => ["-73.9360"],
            "tscDescription" => ["New York City"],
            "tscDateStart" => ["2023-01-01"],
            "tscTimeStart" => [""],
            "tscDateEnd" => ["2023-12-31"],
            "tscTimeEnd" => [""],
            "tscTimezone" => ["-05:00"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Die Funktion sollte true zurückgeben wenn nur die Uhrzeiten fehlen.");

        // Check if the STC was saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $stc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($stc, "Der STC-Eintrag sollte gespeichert worden sein.");
        $this->assertEquals($postData["tscDateStart"][0], $stc["dateStart"]);
        $this->assertEquals($postData["tscDateEnd"][0], $stc["dateEnd"]);
        $this->assertNull($stc["timeStart"]);
        $this->assertNull($stc["timeEnd"]);
    }

    /**
     * Tests saving with mixed time values.
     * 
     * Verifies that records can be saved with some time fields populated
     * and others null.
     *
     * @return void
     */
    public function testSaveWithMixedTimes()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MIXED.TIMES",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Mixed Times STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "tscLatitudeMin" => ["40.7128"],
            "tscLatitudeMax" => ["40.7828"],
            "tscLongitudeMin" => ["-74.0060"],
            "tscLongitudeMax" => ["-73.9360"],
            "tscDescription" => ["New York City"],
            "tscDateStart" => ["2023-01-01"],
            "tscTimeStart" => [""],
            "tscDateEnd" => ["2023-12-31"],
            "tscTimeEnd" => ["23:59:59"],
            "tscTimezone" => ["-05:00"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, "Die Funktion sollte true zurückgeben wenn nur eine Uhrzeit fehlt.");

        // Check if the STC was saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $stc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($stc, "Der STC-Eintrag sollte gespeichert worden sein.");
        $this->assertEquals($postData["tscDateStart"][0], $stc["dateStart"]);
        $this->assertEquals($postData["tscDateEnd"][0], $stc["dateEnd"]);
        $this->assertNull($stc["timeStart"]);
        $this->assertEquals($postData["tscTimeEnd"][0], $stc["timeEnd"]);
    }
}