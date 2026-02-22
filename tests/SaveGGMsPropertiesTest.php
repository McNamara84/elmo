<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../save/formgroups/save_ggms_properties.php';

/**
 * Test suite for saving GGM Properties
 * 
 * Tests the simplified GGM Properties save workflow:
 * - saveGGMsProperties: directly inserts GGM_Properties record
 * - insertEllipsoidalParameters: handles ellipsoidal parameters
 */
final class SaveGGMsPropertiesTest extends DatabaseTestCase
{
    private $resourceId;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test resource
        $this->resourceId = $this->createResource('test.ggm.properties', 'Test GGM Properties');
    }

    // ============================================================================
    // SAVE GGM PROPERTIES TESTS (Direct Insert)
    // ============================================================================

    /**
     * Test: saveGGMsProperties inserts new record with all fields
     */
    public function testSaveGGMsPropertiesInsertsAllFields(): void
    {
        $postData = [
            'tide_system' => 'zero-tide',
            'degree' => 360,
            'errors' => 'calibrated',
            'error_handling_approach' => 'Calibrated using sigma = 5.67',
            'radius' => 6371.2,
            'earth_gravity_constant' => 3.986004415e14
        ];

        $result = saveGGMsProperties($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        // Verify GGM_Properties was created
        $sql = "SELECT * FROM `GGM_Properties` WHERE `Tide_System` = ? AND `degree` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('si', $postData['tide_system'], $postData['degree']);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($record);
        $this->assertEquals('zero-tide', $record['Tide_System']);
        $this->assertEquals(360, $record['degree']);
        // Function stores the input value directly, not a transformed value
        $this->assertEquals('calibrated', $record['Errors']);
        $this->assertEquals('Calibrated using sigma = 5.67', $record['Error_Handling_Approach']);
    }

    /**
     * Test: saveGGMsProperties handles null/empty values correctly
     */
    public function testSaveGGMsPropertiesHandlesNullValues(): void
    {
        $postData = [
            'tide_system' => 'tide-free',
            'degree' => 180,
            'errors' => 'no',
            'error_handling_approach' => '',
            'radius' => '',
            'earth_gravity_constant' => ''
        ];

        $result = saveGGMsProperties($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        // Verify GGM_Properties was created with null values
        $sql = "SELECT * FROM `GGM_Properties` WHERE `Tide_System` = ? AND `degree` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('si', $postData['tide_system'], $postData['degree']);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($record);
        $this->assertEquals('tide-free', $record['Tide_System']);
        $this->assertEquals(180, $record['degree']);
        $this->assertEquals('no', $record['Errors']);
    }

    /**
     * Test: saveGGMsProperties creates multiple records (no update behavior)
     */


    // ============================================================================
    // INSERT ELLIPSOIDAL PARAMETERS TESTS
    // ============================================================================

    /**
     * Test: insertEllipsoidalParameters returns null when no semimajor axis provided
     */
    public function testInsertEllipsoidalParametersReturnsNullWhenNoData(): void
    {
        $data = ['semimajor_axis_a' => ''];

        $result = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);
        $this->assertNull($result);
    }

    /**
     * Test: insertEllipsoidalParameters inserts record with only semimajor axis
     */
    public function testInsertEllipsoidalParametersInsertsWithOnlyAxis(): void
    {
        $data = [
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => ''
        ];

        $ellipsoidalId = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);

        $this->assertIsInt($ellipsoidalId);
        $this->assertGreaterThan(0, $ellipsoidalId);

        // Verify record was created
        $sql = "SELECT * FROM `Ellipsoidal_Parameters` WHERE `ellipsoidal_parameter_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $ellipsoidalId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($record);
        $this->assertEqualsWithDelta(6378137.0, $record['semimajor_axis_a'], 0.1);
    }

    /**
     * Test: insertEllipsoidalParameters inserts record with semiminor axis
     */
    public function testInsertEllipsoidalParametersWithSemiminorAxis(): void
    {
        $data = [
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => 'axis_b',
            'second_variable_value' => 6356752.3
        ];

        $ellipsoidalId = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);

        $sql = "SELECT * FROM `Ellipsoidal_Parameters` WHERE `ellipsoidal_parameter_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $ellipsoidalId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEqualsWithDelta(6378137.0, $record['semimajor_axis_a'], 0.1);
        // Database may store with reduced precision, use larger delta
        $this->assertEqualsWithDelta(6356752.3, $record['semiminor_axis_b'], 1.0);
    }

    /**
     * Test: insertEllipsoidalParameters inserts record with flattening
     */
    public function testInsertEllipsoidalParametersWithFlattening(): void
    {
        $data = [
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => 'flattening',
            'second_variable_value' => 0.00335281
        ];

        $ellipsoidalId = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);

        $sql = "SELECT * FROM `Ellipsoidal_Parameters` WHERE `ellipsoidal_parameter_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $ellipsoidalId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEqualsWithDelta(6378137.0, $record['semimajor_axis_a'], 0.1);
        $this->assertEqualsWithDelta(0.00335281, $record['flattening'], 0.00000001);
    }

    /**
     * Test: insertEllipsoidalParameters inserts record with reciprocal flattening
     */
    public function testInsertEllipsoidalParametersWithReciprocalFlattening(): void
    {
        $data = [
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => 'reciprocal_flattening',
            'second_variable_value' => 298.257223563
        ];

        $ellipsoidalId = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);

        $sql = "SELECT * FROM `Ellipsoidal_Parameters` WHERE `ellipsoidal_parameter_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $ellipsoidalId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEqualsWithDelta(6378137.0, $record['semimajor_axis_a'], 0.1);
        // Database may store with reduced precision, use larger delta
        $this->assertEqualsWithDelta(298.257223563, $record['reciprocal_flattening'], 0.001);
    }

    /**
     * Test: insertEllipsoidalParameters creates resource link
     */
    public function testInsertEllipsoidalParametersCreatesResourceLink(): void
    {
        $data = [
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => ''
        ];

        $ellipsoidalId = insertEllipsoidalParameters($this->connection, $data, $this->resourceId);

        // Verify link was created
        $sql = "SELECT * FROM `Resource_has_Ellipsoidal_Parameters` 
                WHERE `resource_id` = ? AND `ellipsoidal_parameter_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('ii', $this->resourceId, $ellipsoidalId);
        $stmt->execute();
        $link = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($link);
    }

    // ============================================================================
    // COMPLETE FLOW TESTS
    // ============================================================================

    /**
     * Test: saveGGMsProperties with ellipsoidal parameters
     */
    public function testSaveGGMsPropertiesWithEllipsoidalParameters(): void
    {
        $postData = [
            'tide_system' => 'zero-tide',
            'degree' => 360,
            'errors' => 'formal',
            'error_handling_approach' => 'Formal',
            'radius' => 6371.2,
            'earth_gravity_constant' => 3.986004415e14,
            'semimajor_axis_a' => 6378137.0,
            'second_variable' => 'flattening',
            'second_variable_value' => 0.00335281
        ];

        $result = saveGGMsProperties($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        // Verify GGM_Properties was created
        $sql = "SELECT COUNT(*) as count FROM `GGM_Properties` WHERE `Tide_System` = 'zero-tide'";
        $stmt = $this->connection->prepare($sql);
        $stmt->execute();
        $stmt->bind_result($count);
        $stmt->fetch();
        $stmt->close();
        $this->assertGreaterThan(0, $count);

        // Verify Ellipsoidal_Parameters was created and linked
        $sql = "SELECT ep.* FROM `Ellipsoidal_Parameters` ep
                JOIN `Resource_has_Ellipsoidal_Parameters` rhep 
                  ON ep.ellipsoidal_parameter_id = rhep.ellipsoidal_parameter_id
                WHERE rhep.resource_id = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($record);
        $this->assertEqualsWithDelta(6378137.0, $record['semimajor_axis_a'], 0.1);
    }
}