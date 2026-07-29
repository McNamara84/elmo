<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../save/formgroups/save_spatialtemporalcoverage.php';
require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';

/**
 * Test class for Spatial Temporal Coverage saving functionality.
 * 
 * This class contains test cases for validating the correct storage of spatial
 * and temporal coverage data in the database, including coordinate information,
 * dates, times, and timezone data.
 */
final class SaveSpatialTemporalCoverageTest extends DatabaseTestCase
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
    public function testSubmitRejectsInvalidCoordinateCombination()
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
            "action" => "submit",
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
     * Tests that spatial-only submit data is allowed outside ELMO-GEM.
     *
     * @return void
     */
    public function testSubmitAllowsSpatialOnlyCoverageOutsideElmoGem()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.EMPTY.DATE",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Empty Date STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "action" => "submit",
            "tscLatitudeMin" => ["40.7128"],
            "tscLatitudeMax" => ["40.7828"],
            "tscLongitudeMin" => ["-74.0060"],
            "tscLongitudeMax" => ["-73.9360"],
            "tscDescription" => ["New York City"],
            "tscDateStart" => [""],  // Empty date
            "tscTimeStart" => [""],
            "tscDateEnd" => [""],
            "tscTimeEnd" => [""],
            "tscTimezone" => [""]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Spatial-only STC should be valid outside ELMO-GEM.');

        // Spatial coverage is independent from temporal coverage in DataCite 4.7.
        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count 
            FROM Resource_has_Spatial_Temporal_Coverage 
            WHERE Resource_resource_id = ?
        ");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, 'Spatial-only STC should be linked to the resource.');
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
     * Tests that submit validation rejects same-day entries with reversed time order.
     *
     * @return void
     */
    public function testSubmitRejectsSameDateWithEndTimeBeforeStartTime(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.INVALID.TIME.ORDER",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Invalid Time Order STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "action" => "submit",
            "tscLatitudeMin" => ["40.7128"],
            "tscLatitudeMax" => ["40.7828"],
            "tscLongitudeMin" => ["-74.0060"],
            "tscLongitudeMax" => ["-73.9360"],
            "tscDescription" => ["New York City"],
            "tscDateStart" => ["2023-01-01"],
            "tscTimeStart" => ["12:00"],
            "tscDateEnd" => ["2023-01-01"],
            "tscTimeEnd" => ["11:00"],
            "tscTimezone" => ["-05:00"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertFalse($result, 'Function should return false for invalid same-day time order.');

        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Spatial_Temporal_Coverage");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];
        $this->assertEquals(0, $count, 'No STC entries should be saved for invalid same-day time order.');
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

    /**
     * Tests saving STC record with date only, no time and no timezone.
     *
     * Verifies that a spatial temporal coverage entry can be saved when
     * only dates (no time or timezone) are provided. This is the expected
     * behaviour for users entering temporal coverage without times.
     *
     * @return void
     */
    public function testSaveDateOnlyWithoutTimezone(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.DATE.ONLY",
            "year" => 2025,
            "dateCreated" => "2025-01-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Date Only STC"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "tscLatitudeMin"  => ["52.5200"],
            "tscLatitudeMax"  => [""],
            "tscLongitudeMin" => ["13.4050"],
            "tscLongitudeMax" => [""],
            "tscDescription"  => ["Berlin"],
            "tscDateStart"    => ["2025-01-01"],
            "tscTimeStart"    => [""],
            "tscDateEnd"      => ["2025-12-31"],
            "tscTimeEnd"      => [""],
            "tscTimezone"     => [""]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Function should return true for date-only STC (no time, no timezone).');

        $stmt = $this->connection->prepare("SELECT * FROM Spatial_Temporal_Coverage WHERE Description = ?");
        $stmt->bind_param("s", $postData["tscDescription"][0]);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($retrievedStc, 'The STC entry should be saved.');
        $this->assertEquals($postData["tscDateStart"][0], $retrievedStc["dateStart"]);
        $this->assertEquals($postData["tscDateEnd"][0], $retrievedStc["dateEnd"]);
        $this->assertNull($retrievedStc["timeStart"]);
        $this->assertNull($retrievedStc["timeEnd"]);
        $this->assertNull($retrievedStc["timezone"]);
    }

    /**
     * Tests saving STC with empty dateEnd and description (Bug #2 regression test).
     * 
     * This test covers the fix for HTTP 500 error that occurred when:
     * 1. dateEnd was an empty string (should be converted to NULL)
     * 2. description was an empty string (should be converted to NULL)
     * 
     * Previously, empty strings caused MySQL errors because the date columns
     * don't accept empty strings, only NULL or valid dates.
     *
     * @return void
     */
    public function testSaveWithEmptyDateEndAndDescription(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.EMPTY.DATEEND." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-01-24",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Empty DateEnd Coverage"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        // This is the exact scenario that caused HTTP 500 on Stage:
        // - dateEnd is empty string (not null)
        // - description is empty string (not null)
        $postData = [
            "tscLatitudeMin"  => ["52.5"],
            "tscLatitudeMax"  => ["52.6"],
            "tscLongitudeMin" => ["13.3"],
            "tscLongitudeMax" => ["13.4"],
            "tscDescription"  => [""],  // Empty string - should be converted to NULL
            "tscDateStart"    => ["2026-01-01"],
            "tscTimeStart"    => [""],
            "tscDateEnd"      => [""],  // Empty string - should be converted to NULL
            "tscTimeEnd"      => [""],
            "tscTimezone"     => [""]
        ];

        // This should NOT throw an error - the fix converts empty strings to NULL
        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Function should return true when dateEnd and description are empty strings');

        // Verify the record was saved - query via link table to ensure we get the correct STC
        $stmt = $this->connection->prepare(
            "SELECT stc.* FROM Spatial_Temporal_Coverage stc
             INNER JOIN Resource_has_Spatial_Temporal_Coverage rhstc 
                ON stc.spatial_temporal_coverage_id = rhstc.Spatial_Temporal_Coverage_spatial_temporal_coverage_id
             WHERE rhstc.Resource_resource_id = ?"
        );
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($retrievedStc, 'STC entry should be saved even with empty dateEnd/description');
        $this->assertEquals($postData["tscLatitudeMin"][0], $retrievedStc["latitudeMin"]);
        $this->assertEquals($postData["tscLatitudeMax"][0], $retrievedStc["latitudeMax"]);
        $this->assertEquals($postData["tscDateStart"][0], $retrievedStc["dateStart"]);
        $this->assertNull($retrievedStc["dateEnd"], 'Empty string dateEnd should be saved as NULL');
        $this->assertNull($retrievedStc["description"], 'Empty string description should be saved as NULL');
    }

    /**
     * Tests that a completely empty STC row on submit is treated as optional.
     *
     * @return void
     */
    public function testSubmitWithEmptyStcRowIsOptional(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.EMPTY.STC.SUBMIT." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-06-25",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Empty STC Submit"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "action" => "submit",
            "tscLatitudeMin" => [""],
            "tscLatitudeMax" => [""],
            "tscLongitudeMin" => [""],
            "tscLongitudeMax" => [""],
            "tscDescription" => [""],
            "tscDateStart" => [""],
            "tscTimeStart" => [""],
            "tscDateEnd" => [""],
            "tscTimeEnd" => [""],
            "tscTimezone" => [""],
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Submit should succeed when STC row is completely empty.');

        $stmt = $this->connection->prepare("
            SELECT COUNT(*) as count
            FROM Resource_has_Spatial_Temporal_Coverage
            WHERE Resource_resource_id = ?
        ");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, 'No STC should be saved for an empty row.');
    }

    public function testSubmitValidatesAllRowsBeforeWritingAnyStcData(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ATOMIC.STC.SUBMIT." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-07-29",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Atomic STC Submit"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "action" => "submit",
            "tscLatitudeMin" => ["10", "20"],
            "tscLatitudeMax" => ["", ""],
            "tscLongitudeMin" => ["30", ""],
            "tscLongitudeMax" => ["", ""],
            "tscDescription" => ["Valid first row", "Invalid second row"],
            "tscDateStart" => ["", ""],
            "tscDateEnd" => ["", ""],
            "tscTimeStart" => ["", ""],
            "tscTimeEnd" => ["", ""],
            "tscTimezone" => ["", ""],
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertFalse($result, 'An invalid later row must reject the complete STC submit.');

        $stmt = $this->connection->prepare(
            "SELECT COUNT(*) AS count
             FROM Resource_has_Spatial_Temporal_Coverage
             WHERE Resource_resource_id = ?"
        );
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();

        $this->assertSame(0, (int) $stmt->get_result()->fetch_assoc()['count']);
        $this->assertSame(
            0,
            (int) $this->connection->query('SELECT COUNT(*) AS count FROM Spatial_Temporal_Coverage')
                ->fetch_assoc()['count'],
            'Pre-validation must prevent orphaned STC records.'
        );
    }

    /**
     * Tests saving STC with only coordinates and start date (minimal valid input).
     * 
     * This covers the scenario where a user only fills in the required coordinate
     * fields and a start date, leaving all other optional fields empty.
     *
     * @return void
     */
    public function testSaveMinimalValidInput(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MINIMAL.STC." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-01-24",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Minimal STC Input"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        // Minimal input: only coordinates and start date
        $postData = [
            "tscLatitudeMin"  => ["-90"],
            "tscLatitudeMax"  => ["90"],
            "tscLongitudeMin" => ["-180"],
            "tscLongitudeMax" => ["180"],
            "tscDescription"  => [""],
            "tscDateStart"    => ["2026-01-01"],
            "tscTimeStart"    => [""],
            "tscDateEnd"      => [""],
            "tscTimeEnd"      => [""],
            "tscTimezone"     => [""]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Function should handle minimal valid input correctly');
    }

    /**
     * Tests saving STC when optional keys are completely absent from postData.
     * 
     * This covers the scenario where the frontend doesn't include optional fields
     * at all (keys are missing, not just empty). The backend should handle this
     * gracefully without errors.
     *
     * @return void
     */
    public function testSaveWithAbsentOptionalKeys(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ABSENT.KEYS." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-01-24",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Absent Optional Keys"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        // Only required fields - optional keys are completely absent
        $postData = [
            "tscLatitudeMin"  => ["45.0"],
            "tscLongitudeMin" => ["10.0"],
            "tscDateStart"    => ["2026-01-01"]
            // tscLatitudeMax, tscLongitudeMax, tscDescription, tscDateEnd, 
            // tscTimeStart, tscTimeEnd, tscTimezone are all absent
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Function should handle absent optional keys gracefully');

        // Verify the record was saved
        $stmt = $this->connection->prepare(
            "SELECT stc.* FROM Spatial_Temporal_Coverage stc
             INNER JOIN Resource_has_Spatial_Temporal_Coverage rhstc 
                ON stc.spatial_temporal_coverage_id = rhstc.Spatial_Temporal_Coverage_spatial_temporal_coverage_id
             WHERE rhstc.Resource_resource_id = ?"
        );
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($retrievedStc, 'STC entry should be saved with absent optional keys');
        $this->assertEquals("45.0", $retrievedStc["latitudeMin"]);
        $this->assertNull($retrievedStc["latitudeMax"], 'Absent latitudeMax should be NULL');
        $this->assertNull($retrievedStc["longitudeMax"], 'Absent longitudeMax should be NULL');
        $this->assertNull($retrievedStc["description"], 'Absent description should be NULL');
        $this->assertNull($retrievedStc["dateEnd"], 'Absent dateEnd should be NULL');
    }

    /**
     * Tests that coordinate value 0 (equator/prime meridian) is saved correctly.
     * 
     * This test ensures that the empty-string-to-NULL conversion doesn't
     * incorrectly treat '0' as empty (which empty() would do in PHP).
     *
     * @return void
     */
    public function testSaveWithZeroCoordinates(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.ZERO.COORDS." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-01-24",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Zero Coordinates"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        // Coordinates at equator and prime meridian (all zeros)
        $postData = [
            "tscLatitudeMin"  => ["0"],
            "tscLatitudeMax"  => ["0"],
            "tscLongitudeMin" => ["0"],
            "tscLongitudeMax" => ["0"],
            "tscDescription"  => ["Point at equator/prime meridian intersection"],
            "tscDateStart"    => ["2026-01-01"],
            "tscTimeStart"    => [""],
            "tscDateEnd"      => [""],
            "tscTimeEnd"      => [""],
            "tscTimezone"     => [""]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Function should save coordinate value 0 correctly');

        // Verify 0 values were saved as 0, not NULL
        $stmt = $this->connection->prepare(
            "SELECT stc.* FROM Spatial_Temporal_Coverage stc
             INNER JOIN Resource_has_Spatial_Temporal_Coverage rhstc 
                ON stc.spatial_temporal_coverage_id = rhstc.Spatial_Temporal_Coverage_spatial_temporal_coverage_id
             WHERE rhstc.Resource_resource_id = ?"
        );
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($retrievedStc, 'STC entry should be saved with zero coordinates');
        $this->assertEquals(0, (float)$retrievedStc["latitudeMin"], 'Zero latitudeMin should be saved as 0, not NULL');
        $this->assertEquals(0, (float)$retrievedStc["latitudeMax"], 'Zero latitudeMax should be saved as 0, not NULL');
        $this->assertEquals(0, (float)$retrievedStc["longitudeMin"], 'Zero longitudeMin should be saved as 0, not NULL');
        $this->assertEquals(0, (float)$retrievedStc["longitudeMax"], 'Zero longitudeMax should be saved as 0, not NULL');
    }
    
    /**
     * Tests that saving fails when longitudeMax is set but the bounding box is incomplete.
     * 
     * This covers the scenario where one of the maximum coordinate values is provided
     * without all four bounding box coordinates being present. The backend should
     * reject incomplete bounding box definitions.
     *
     * @return void
     */
    public function testSubmitFailsWhenLongitudeMaxIsGivenButBoundingBoxIsIncomplete(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.INCOMPLETE.BBOX." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-01-24",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Incomplete Bounding Box"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "action"          => "submit",
            "tscLatitudeMin"  => ["45.0"],
            "tscLongitudeMin" => ["10.0"],
            "tscLongitudeMax" => ["20.0"],
            "tscDateStart"    => ["2026-01-01"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertFalse($result, 'Saving should fail when longitudeMax is set but not all four coordinates are present');
    }

    /**
     * Draft saves preserve incomplete bounding boxes so users can finish them later.
     */
    public function testSaveAllowsIncompleteBoundingBoxDraft(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.INCOMPLETE.BBOX.DRAFT." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-01-24",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Incomplete Bounding Box Draft"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "action" => "save_and_download",
            "tscLatitudeMin" => ["45.0"],
            "tscLongitudeMin" => ["10.0"],
            "tscLongitudeMax" => ["20.0"],
            "tscDateStart" => ["2026-01-01"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Draft saving should preserve an incomplete bounding box.');

        $stmt = $this->connection->prepare(
            "SELECT stc.latitudeMax, stc.longitudeMax
             FROM Spatial_Temporal_Coverage stc
             INNER JOIN Resource_has_Spatial_Temporal_Coverage rel
                ON rel.Spatial_Temporal_Coverage_spatial_temporal_coverage_id = stc.spatial_temporal_coverage_id
             WHERE rel.Resource_resource_id = ?"
        );
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $stc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($stc);
        $this->assertNull($stc['latitudeMax']);
        $this->assertSame(20.0, (float) $stc['longitudeMax']);
    }

    /**
     * Tests saving STC with description only and no coordinates.
     * 
     * This covers the scenario where a user provides only a textual spatial
     * description without any coordinate values. The backend should allow saving
     * this entry and store all coordinate fields as NULL.
     *
     * @return void
     */
    public function testSaveWithDescriptionOnlyAndNoCoordinates(): void
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.DESCRIPTION.ONLY." . uniqid(),
            "year" => 2026,
            "dateCreated" => "2026-01-24",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Description Only"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "tscDescription" => ["Area described in text only"],
            "tscDateStart"   => ["2026-01-01"]
        ];

        $result = saveSpatialTemporalCoverage($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'Saving should succeed with description only and no coordinates');

        $stmt = $this->connection->prepare(
            "SELECT stc.* FROM Spatial_Temporal_Coverage stc
             INNER JOIN Resource_has_Spatial_Temporal_Coverage rhstc
                ON stc.spatial_temporal_coverage_id = rhstc.Spatial_Temporal_Coverage_spatial_temporal_coverage_id
             WHERE rhstc.Resource_resource_id = ?"
        );
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $retrievedStc = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($retrievedStc);
        $this->assertEquals("Area described in text only", $retrievedStc["description"]);
        $this->assertNull($retrievedStc["latitudeMin"]);
        $this->assertNull($retrievedStc["latitudeMax"]);
        $this->assertNull($retrievedStc["longitudeMin"]);
        $this->assertNull($retrievedStc["longitudeMax"]);
    }
}
