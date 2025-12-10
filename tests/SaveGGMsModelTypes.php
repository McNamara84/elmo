<?php

namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/formgroups/save_ggms_modeltypes.php';
require_once __DIR__ . '/../save/formgroups/save_ggms_definition.php';

/**
 * Test suite for saving GGMs Model Types
 * 
 * Tests the complete model-type-specific properties workflow:
 * - Static models: time-variable coefficients info (saved to Static_Model_Properties)
 * - Temporal models: dates, resolution, institution
 * - Topographic models: layer approach, domain, density (single and separate crust/mantle)
 */
class SaveGGMsModelTypesTest extends DatabaseTestCase
{
    private $resourceId;
    private $modelTypeIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test resource
        $this->resourceId = $this->createResource('test.ggm.modeltypes', 'Test GGM Model Types');

        // Ensure Model_Type records exist
        $this->ensureModelTypes();
    }

    /**
     * Ensure all required model types exist in database
     */
    private function ensureModelTypes(): void
    {
        $modelTypes = ['Static', 'Temporal', 'Topographic'];
        
        foreach ($modelTypes as $type) {
            $sql = "SELECT Model_type_id FROM `Model_Type` WHERE name = ? LIMIT 1";
            $stmt = $this->connection->prepare($sql);
            $stmt->bind_param('s', $type);
            $stmt->execute();
            $stmt->bind_result($id);
            
            if ($stmt->fetch()) {
                $this->modelTypeIds[$type] = $id;
            } else {
                $stmt->close();
                // Insert if not exists
                $sql = "INSERT INTO `Model_Type` (`name`, `description`) VALUES (?, ?)";
                $stmt = $this->connection->prepare($sql);
                $desc = "{$type} gravity model type";
                $stmt->bind_param('ss', $type, $desc);
                $stmt->execute();
                $this->modelTypeIds[$type] = $stmt->insert_id;
            }
            $stmt->close();
        }
    }

    // ============================================================================
    // STATIC MODEL TESTS (Using Static_Model_Properties table)
    // ============================================================================

    /**
     * Test: saveStaticModelData inserts into Static_Model_Properties with time-variable coefficients
     */
    public function testSaveStaticModelDataWithTimeVariableCoefficients(): void
    {
        $postData = [
            'time_variable_coefficients' => true,
            'time_variable_description' => 'Annual and semi-annual variations included'
        ];

        saveStaticModelData($this->connection, $postData, $this->resourceId);

        // Verify in Static_Model_Properties table
        $sql = "SELECT `info_time_variable_coefficients` FROM `Static_Model_Properties` 
                WHERE `resource_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($description);
        $stmt->fetch();
        $stmt->close();

        $this->assertEquals('Annual and semi-annual variations included', $description);
    }

    /**
     * Test: saveStaticModelData with no time-variable coefficients
     */
    public function testSaveStaticModelDataWithoutTimeVariableCoefficients(): void
    {
        $postData = [
            'time_variable_coefficients' => false,
            'time_variable_description' => 'Should be ignored'
        ];

        saveStaticModelData($this->connection, $postData, $this->resourceId);

        $sql = "SELECT `info_time_variable_coefficients` FROM `Static_Model_Properties` 
                WHERE `resource_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($description);
        $stmt->fetch();
        $stmt->close();

        $this->assertNull($description);
    }

    /**
     * Test: saveStaticModelData with empty time-variable checkbox
     */
    public function testSaveStaticModelDataWithEmptyCheckbox(): void
    {
        $postData = [
            'time_variable_coefficients' => '',
        ];

        saveStaticModelData($this->connection, $postData, $this->resourceId);

        $sql = "SELECT `info_time_variable_coefficients` FROM `Static_Model_Properties` 
                WHERE `resource_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($description);
        $stmt->fetch();
        $stmt->close();

        $this->assertNull($description);
    }

    // ============================================================================
    // TEMPORAL MODEL TESTS
    // ============================================================================

    /**
     * Test: insertTemporalModelProperties with all fields populated
     */
    public function testInsertTemporalModelPropertiesComplete(): void
    {
        $postData = [
            'temporal_start' => '2016-01-01',
            'temporal_end' => '2024-12-31',
            'temporal_frequency_predef' => 'monthly',
            'temporal_institution' => 'GFZ Potsdam'
        ];

        $temporalId = insertTemporalModelProperties($this->connection, $postData, $this->resourceId);
        
        $this->assertIsInt($temporalId);
        
        // Verify temporal properties
        $sql = "SELECT * FROM `Temporal_Model_Properties` WHERE `temporal_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $temporalId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEquals('2016-01-01', $record['start_date']);
        $this->assertEquals('2024-12-31', $record['end_date']);
        $this->assertEquals(30, $record['temporal_resolution_days']);
        $this->assertEquals(1, $record['generating_institution']);

        // Verify linking
        $sql = "SELECT * FROM `Resource_has_Temporal_Model_Properties` 
                WHERE `resource_id` = ? AND `temporal_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('ii', $this->resourceId, $temporalId);
        $stmt->execute();
        $link = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($link);
    }

    /**
     * Test: insertTemporalModelProperties with custom frequency
     */
    public function testInsertTemporalModelPropertiesWithCustomFrequency(): void
    {
        $postData = [
            'temporal_start' => '2018-06-15',
            'temporal_end' => '2023-06-15',
            'temporal_frequency' => '15',  // custom: 15 days
            'temporal_institution' => 'CSR University of Texas'
        ];

        $temporalId = insertTemporalModelProperties($this->connection, $postData, $this->resourceId);
        
        $sql = "SELECT `temporal_resolution_days` FROM `Temporal_Model_Properties` 
                WHERE `temporal_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $temporalId);
        $stmt->execute();
        $stmt->bind_result($days);
        $stmt->fetch();
        $stmt->close();

        $this->assertEquals(15, $days);
    }

    /**
     * Test: insertTemporalModelProperties with predefined frequencies
     *
     * @dataProvider temporalFrequencyProvider
     */
    public function testInsertTemporalModelPropertiesFrequencies(string $frequency, int $expectedDays): void
    {
        $postData = [
            'temporal_start' => '2020-01-01',
            'temporal_end' => '2025-01-01',
            'temporal_frequency_predef' => $frequency,
            'temporal_institution' => null
        ];

        $temporalId = insertTemporalModelProperties($this->connection, $postData, $this->resourceId);
        
        $sql = "SELECT `temporal_resolution_days` FROM `Temporal_Model_Properties` 
                WHERE `temporal_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $temporalId);
        $stmt->execute();
        $stmt->bind_result($days);
        $stmt->fetch();
        $stmt->close();

        $this->assertEquals($expectedDays, $days);
    }

    public static function temporalFrequencyProvider(): array
    {
        return [
            ['daily', 1],
            ['weekly', 7],
            ['monthly', 30],
            ['quarterly', 90],
            ['yearly', 365],
        ];
    }

    /**
     * Test: insertTemporalModelProperties with minimal data
     */
    public function testInsertTemporalModelPropertiesMinimal(): void
    {
        $postData = [];

        $temporalId = insertTemporalModelProperties($this->connection, $postData, $this->resourceId);
        
        $sql = "SELECT * FROM `Temporal_Model_Properties` WHERE `temporal_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $temporalId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNull($record['start_date']);
        $this->assertNull($record['end_date']);
        $this->assertNull($record['temporal_resolution_days']);
        $this->assertEquals(0, $record['generating_institution']);
    }

    // ============================================================================
    // TOPOGRAPHIC MODEL TESTS
    // ============================================================================

    /**
     * Test: insertTopographicModelProperties with single density information
     */
    public function testInsertTopographicModelPropertiesWithSingleDensity(): void
    {
        $postData = [
            'topo_layer_approach' => 'multi-layer',
            'topo_domain' => 'spatial',
            'topo_approximation' => 'spherical',
            'topo_density' => 'layer-specific',
            'topo_density_details' => 'Crustal densities from CRUST1.0, mantle from PREM'
        ];

        $topoId = insertTopographicModelProperties($this->connection, $postData, $this->resourceId);
        
        $this->assertIsInt($topoId);
        
        // Verify topographic properties
        $sql = "SELECT * FROM `Topographic_Models_Properties` WHERE `topographic_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $topoId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEquals('multi-layer', $record['layer_approach']);
        $this->assertEquals('spatial', $record['forward_modelling_domain']);
        $this->assertEquals('spherical', $record['approximation']);
        $this->assertEquals('layer-specific', $record['density_information']);
        $this->assertEquals('Crustal densities from CRUST1.0, mantle from PREM', $record['density_information_details']);
        $this->assertNull($record['crust_density_value']);
        $this->assertNull($record['mantle_density_value']);

        // Verify linking
        $sql = "SELECT * FROM `Resource_has_Topographic_Model_Properties` 
                WHERE `resource_id` = ? AND `topographic_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('ii', $this->resourceId, $topoId);
        $stmt->execute();
        $link = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($link);
    }

    // ============================================================================
    // TOPOGRAPHIC MODEL TESTS
    // ============================================================================

    /**
     * Test: insertTopographicModelProperties with separate crust and mantle densities
     */
    public function testInsertTopographicModelPropertiesWithSeparateDensities(): void
    {
        $postData = [
            'topo_layer_approach' => 'multi-layer',
            'topo_domain' => 'spectral',
            'topo_approximation' => 'ellipsoidal',
            'topo_density' => 'constant',
            'topo_density_details' => null,
            'separate_density' => true,
            'topo_density_crust_value' => '2670.0',
            'topo_density_crust_description' => 'Average crustal density',
            'topo_density_mantle_value' => '3300.0',
            'topo_density_mantle_description' => 'Reference mantle density'
        ];

        $topoId = insertTopographicModelProperties($this->connection, $postData, $this->resourceId);
        
        // Verify topographic properties
        $sql = "SELECT * FROM `Topographic_Models_Properties` WHERE `topographic_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $topoId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEquals('multi-layer', $record['layer_approach']);
        $this->assertEquals('spectral', $record['forward_modelling_domain']);
        $this->assertEquals('ellipsoidal', $record['approximation']);
        $this->assertEqualsWithDelta(2670.0, $record['crust_density_value'], 0.1);
        $this->assertEquals('Average crustal density', $record['crust_density_description']);
        $this->assertEqualsWithDelta(3300.0, $record['mantle_density_value'], 0.1);
        $this->assertEquals('Reference mantle density', $record['mantle_density_description']);
    }

    /**
     * Test: insertTopographicModelProperties with only crust density
     */
    public function testInsertTopographicModelPropertiesWithOnlyCrustDensity(): void
    {
        $postData = [
            'topo_layer_approach' => 'single-layer',
            'topo_domain' => 'spatial',
            'topo_approximation' => 'spherical',
            'topo_density' => 'constant',
            'separate_density' => true,
            'topo_density_crust_value' => '2750.5',
            'topo_density_crust_description' => 'Crustal density'
            // mantle values empty
        ];

        $topoId = insertTopographicModelProperties($this->connection, $postData, $this->resourceId);
        
        $sql = "SELECT * FROM `Topographic_Models_Properties` WHERE `topographic_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $topoId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEqualsWithDelta(2750.5, $record['crust_density_value'], 0.1);
        $this->assertEquals('Crustal density', $record['crust_density_description']);
        $this->assertNull($record['mantle_density_value']);
        $this->assertNull($record['mantle_density_description']);
    }

    /**
     * Test: insertTopographicModelProperties with minimal data
     */
    public function testInsertTopographicModelPropertiesMinimal(): void
    {
        $postData = [];

        $topoId = insertTopographicModelProperties($this->connection, $postData, $this->resourceId);
        
        $sql = "SELECT * FROM `Topographic_Models_Properties` WHERE `topographic_model_property_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $topoId);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNull($record['layer_approach']);
        $this->assertNull($record['forward_modelling_domain']);
        $this->assertNull($record['approximation']);
        $this->assertNull($record['crust_density_value']);
        $this->assertNull($record['mantle_density_value']);
    }

    // ============================================================================
    // ORCHESTRATION TESTS
    // ============================================================================

    /**
     * Test: saveGGMsModelTypes dispatches to static model handler
     */
    public function testSaveGGMsModelTypesDispatchesToStaticHandler(): void
    {
        $this->setResourceModelType('Static');
        
        $postData = [
            'time_variable_coefficients' => true,
            'time_variable_description' => 'Monthly variations'
        ];

        $result = saveGGMsModelTypes($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        // Verify GGM_Properties was updated
        $sql = "SELECT `info_time_variable_coefficients` FROM `GGM_Properties` 
                WHERE `GGM_Properties_id` = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->ggmPropertiesId);
        $stmt->execute();
        $stmt->bind_result($description);
        $stmt->fetch();
        $stmt->close();

        $this->assertEquals('Monthly variations', $description);
    }

    /**
     * Test: saveGGMsModelTypes dispatches to temporal model handler
     */
    public function testSaveGGMsModelTypesDispatchesToTemporalHandler(): void
    {
        $this->setResourceModelType('Temporal');
        
        $postData = [
            'temporal_start' => '2010-01-01',
            'temporal_end' => '2024-12-31',
            'temporal_frequency_predef' => 'monthly',
            'temporal_institution' => 'JPL'
        ];

        $result = saveGGMsModelTypes($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        // Verify temporal properties were inserted
        $sql = "SELECT COUNT(*) as count FROM `Temporal_Model_Properties` tmp
                JOIN `Resource_has_Temporal_Model_Properties` rhmp 
                  ON tmp.temporal_model_property_id = rhmp.temporal_model_property_id
                WHERE rhmp.resource_id = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($count);
        $stmt->fetch();
        $stmt->close();

        $this->assertGreaterThan(0, $count);
    }

    /**
     * Test: saveGGMsModelTypes dispatches to topographic model handler
     */
    public function testSaveGGMsModelTypesDispatchesToTopographicHandler(): void
    {
        $this->setResourceModelType('Topographic');
        
        $postData = [
            'topo_layer_approach' => 'multi-layer',
            'topo_domain' => 'spatial',
            'topo_approximation' => 'spherical',
            'topo_density' => 'layer-specific',
            'topo_density_details' => 'CRUST1.0 model',
            'separate_density' => false
        ];

        $result = saveGGMsModelTypes($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        // Verify topographic properties were inserted
        $sql = "SELECT COUNT(*) as count FROM `Topographic_Models_Properties` tmp
                JOIN `Resource_has_Topographic_Model_Properties` rhtmp 
                  ON tmp.topographic_model_property_id = rhtmp.topographic_model_property_id
                WHERE rhtmp.resource_id = ?";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($count);
        $stmt->fetch();
        $stmt->close();

        $this->assertGreaterThan(0, $count);
    }

    /**
     * Test: saveGGMsModelTypes throws exception when no GGM_Properties found
     */
    public function testSaveGGMsModelTypesThrowsExceptionWhenNoGGMFound(): void
    {
        $nonExistentResourceId = 99999;

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('No GGM_Properties record found');
        
        saveGGMsModelTypes($this->connection, [], $nonExistentResourceId);
    }
}