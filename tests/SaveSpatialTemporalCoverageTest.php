<?php
namespace Tests;
use PHPUnit\Framework\TestCase;
use mysqli_sql_exception;
use Tests\DatabaseTestCase;

require_once __DIR__ . '/../save/formgroups/save_spatialtemporalcoverage.php';

/**
 * Test class for Spatial Temporal Coverage saving functionality.
 * 
 * This class contains test cases for validating the correct storage of spatial
 * and temporal coverage data in the database, including coordinate information,
 * dates, times, and timezone data.
 */
class SaveSpatialTemporalCoverageTest extends DatabaseTestCase
{
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

        $this->assertTrue($result, 'Function should return true when all fields are properly saved.');

        // Verify saved data
        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        // Assert all fields were saved correctly
        $this->assertNotNull($retrievedStc, 'STC entry should be saved in the database');
        $this->assertEquals($postData["tscLatitudeMin"][0], $retrievedStc["latitudeMin"]);
        $this->assertEquals($postData["tscLatitudeMax"][0], $retrievedStc["latitudeMax"]);
        $this->assertEquals($postData["tscLongitudeMin"][0], $retrievedStc["longitudeMin"]);
        $this->assertEquals($postData["tscLongitudeMax"][0], $retrievedStc["longitudeMax"]);
        $this->assertEquals($postData["tscDateStart"][0], $retrievedStc["dateStart"]);
        $this->assertEquals($postData["tscTimeStart"][0], $retrievedStc["timeStart"]);
        $this->assertEquals($postData["tscDateEnd"][0], $retrievedStc["dateEnd"]);
        $this->assertEquals($postData["tscTimeEnd"][0], $retrievedStc["timeEnd"]);
        $this->assertEquals($postData["tscTimezone"][0], $retrievedStc["timezone"]);

        // Verify resource linkage
        $stmt = $this->connection->prepare(
            "SELECT * FROM Resource_has_Spatial_Temporal_Coverage 
             WHERE Resource_resource_id = ? 
             AND Spatial_Temporal_Coverage_spatial_temporal_coverage_id = ?"
        );
        $stmt->bind_param("ii", $resource_id, $retrievedStc["spatial_temporal_coverage_id"]);
        $stmt->execute();
        $relation = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($relation, 'Resource-STC relationship should exist');
    }

    /**
     * Saves three fully populated records and validates their persistence.
     *
     * @return void
     */
    public function testSaveThreeCompleteSets(): void
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

        $this->assertTrue($result, 'The function should return true.');

        // Check if all three STCs were saved correctly
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Spatial_Temporal_Coverage");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(3, $count, 'Exactly three STC entries should be saved.');

        // Check if all three relations to the resource were created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Spatial_Temporal_Coverage WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(3, $count, 'Exactly three relations between the resource and STC should exist.');
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

        $this->assertTrue($result, 'Function should return true when saving with null max coordinates');

        // Verify saved data
        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($retrievedStc, 'STC entry should be saved');
        $this->assertEquals($postData["tscLatitudeMin"][0], $retrievedStc["latitudeMin"]);
        $this->assertNull($retrievedStc["latitudeMax"]);
        $this->assertEquals($postData["tscLongitudeMin"][0], $retrievedStc["longitudeMin"]);
        $this->assertNull($retrievedStc["longitudeMax"]);
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

        $this->assertFalse($result, 'Function should return false with invalid coordinates');

        // Verify no records were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Spatial_Temporal_Coverage");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(0, $count, 'No STC entries should be saved with invalid coordinates');
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

        $this->assertFalse($result, 'The function should return false when the start date is missing.');

        // Check that no STC was saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Spatial_Temporal_Coverage");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, 'No STC entries should be saved.');
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

        $this->assertTrue($result, 'The function should return true when only the times are missing.');

        // Check if the STC was saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($retrievedStc, 'The STC entry should be saved.');
        $this->assertEquals($postData["tscDateStart"][0], $retrievedStc["dateStart"]);
        $this->assertEquals($postData["tscDateEnd"][0], $retrievedStc["dateEnd"]);
        $this->assertNull($retrievedStc["timeStart"]);
        $this->assertNull($retrievedStc["timeEnd"]);
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

        $this->assertTrue($result, 'The function should return true when only one time is missing.');

        // Check if the STC was saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($retrievedStc, 'The STC entry should be saved.');
        $this->assertEquals($postData["tscDateStart"][0], $retrievedStc["dateStart"]);
        $this->assertEquals($postData["tscDateEnd"][0], $retrievedStc["dateEnd"]);
        $this->assertNull($retrievedStc["timeStart"]);
        $this->assertEquals($postData["tscTimeEnd"][0], $retrievedStc["timeEnd"]);
    }
}