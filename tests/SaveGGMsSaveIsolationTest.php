<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_ggms_definition.php';
require_once __DIR__ . '/../save/formgroups/save_ggms_properties.php';
require_once __DIR__ . '/../save/formgroups/save_ggms_modeltypes.php';
require_once __DIR__ . '/../save/formgroups/save_ggms_datasources.php';

/**
 * Save-isolation tests for GGMs formgroups.
 *
 * Validates two invariants across all four GGM save scripts:
 *
 *  1. save_and_download (save) — partial or completely empty form data must be
 *     accepted without throwing; a record row is always inserted so the
 *     resource gets exactly one stable ID.
 *
 *  2. submit — back-end validation IS activated and must reject incomplete data.
 *
 * Back-end validation summary per script
 * ────────────────────────────────────────────────────────────
 * save_ggms_definition.php
 *   submit  : validateGGMData() enforces model_name (non-empty, no spaces),
 *             model_type and mathematical_representation (non-empty strings);
 *             FK resolution for model_type / mathematical_representation /
 *             file_format must all succeed.
 *   save    : Only checks resourceId > 0; null FKs are stored as NULL.
 *
 * save_ggms_properties.php
 *   NO action gate at all — always upserts whatever is supplied (nulls OK).
 *
 * save_ggms_modeltypes.php
 *   NO field-level validation on either action.
 *   Only guard: if no GGM_Definition is linked, function returns true silently.
 *
 * save_ggms_datasources.php
 *   submit  : validateDataSourceRow() enforces type-specific required fields
 *             and forbids cross-type field contamination.
 *   save    : Validation is skipped; rows are inserted as-is.
 * ────────────────────────────────────────────────────────────
 */
final class SaveGGMsSaveIsolationTest extends DatabaseTestCase
{
    private int $resourceId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resourceId = $this->createResource('test.ggms.isolation.' . uniqid(), 'Test GGMs Isolation');
        $this->ensureLookupData();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function ensureLookupData(): void
    {
        foreach (['Static', 'Temporal', 'Topographic', 'Simulated'] as $type) {
            $stmt = $this->connection->prepare(
                "INSERT IGNORE INTO `Model_Type` (`name`, `description`) VALUES (?, ?)"
            );
            $desc = $type . ' model';
            $stmt->bind_param('ss', $type, $desc);
            $stmt->execute();
            $stmt->close();
        }

        foreach (['Spherical harmonics', 'Ellipsoidal harmonics'] as $rep) {
            $stmt = $this->connection->prepare(
                "INSERT IGNORE INTO `Mathematical_Representation` (`name`, `description`) VALUES (?, ?)"
            );
            $desc = $rep;
            $stmt->bind_param('ss', $rep, $desc);
            $stmt->execute();
            $stmt->close();
        }

        foreach (['icgem1.0', 'icgem2.0'] as $fmt) {
            $stmt = $this->connection->prepare(
                "INSERT IGNORE INTO `File_Format` (`name`, `description`) VALUES (?, ?)"
            );
            $desc = $fmt;
            $stmt->bind_param('ss', $fmt, $desc);
            $stmt->execute();
            $stmt->close();
        }
    }

    /**
     * Links a GGM_Definition (with the given model type) to the test resource.
     * Does NOT create GGM_Properties — that dependency was removed from modeltypes.
     */
    private function linkDefinitionWithModelType(string $modelTypeName): void
    {
        $stmt = $this->connection->prepare(
            "SELECT Model_type_id FROM `Model_Type` WHERE name = ? LIMIT 1"
        );
        $stmt->bind_param('s', $modelTypeName);
        $stmt->execute();
        $stmt->bind_result($modelTypeId);
        $stmt->fetch();
        $stmt->close();

        $modelName = 'TestModel_' . uniqid();
        $stmt = $this->connection->prepare(
            "INSERT INTO `GGM_Definition` (`Model_Name`, `Model_type_id`) VALUES (?, ?)"
        );
        $stmt->bind_param('si', $modelName, $modelTypeId);
        $stmt->execute();
        $ggmDefId = $stmt->insert_id;
        $stmt->close();

        $stmt = $this->connection->prepare(
            "INSERT INTO `Resource_has_GGM_Definition`
             (`Resource_resource_id`, `GGM_Definition_GGM_Definition_id`) VALUES (?, ?)"
        );
        $stmt->bind_param('ii', $this->resourceId, $ggmDefId);
        $stmt->execute();
        $stmt->close();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // save_ggms_definition.php — save action (partial data)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * save: all GGM Definition fields empty → record created, NULLs stored for FKs.
     */
    public function testDefinitionSaveSucceedsWhenAllFieldsEmpty(): void
    {
        $postData = [
            'action'                    => 'save_and_download',
            'model_name'                => '',
            'model_type'                => '',
            'mathematical_representation' => '',
            'file_format'               => '',
            'celestial_body'            => '',
            'product_type'              => '',
        ];

        $result = saveGGMsDefinition($this->connection, $postData, $this->resourceId);

        $this->assertTrue($result);

        $stmt = $this->connection->prepare(
            "SELECT gd.GGM_Definition_id FROM `GGM_Definition` gd
             JOIN `Resource_has_GGM_Definition` rhgd
               ON rhgd.GGM_Definition_GGM_Definition_id = gd.GGM_Definition_id
             WHERE rhgd.Resource_resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($defId);
        $found = $stmt->fetch();
        $stmt->close();

        $this->assertTrue($found, 'GGM_Definition record should exist after save with empty fields');
        $this->assertGreaterThan(0, $defId);
    }

    /**
     * save: only model_name supplied, FK fields empty → succeeds, FKs stored as NULL.
     */
    public function testDefinitionSaveSucceedsWithOnlyModelName(): void
    {
        $postData = [
            'action'                    => 'save_and_download',
            'model_name'                => 'PARTIAL_MODEL',
            'model_type'                => '',
            'mathematical_representation' => '',
            'file_format'               => '',
        ];

        $result = saveGGMsDefinition($this->connection, $postData, $this->resourceId);

        $this->assertTrue($result);

        $stmt = $this->connection->prepare(
            "SELECT gd.Model_Name, gd.Model_type_id, gd.Mathematical_representation_id, gd.File_format_id
             FROM `GGM_Definition` gd
             JOIN `Resource_has_GGM_Definition` rhgd
               ON rhgd.GGM_Definition_GGM_Definition_id = gd.GGM_Definition_id
             WHERE rhgd.Resource_resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($row);
        $this->assertEquals('PARTIAL_MODEL', $row['Model_Name']);
        $this->assertNull($row['Model_type_id'],                  'FK should be NULL when not resolved');
        $this->assertNull($row['Mathematical_representation_id'], 'FK should be NULL when not resolved');
        $this->assertNull($row['File_format_id'],                 'FK should be NULL when not resolved');
    }

    /**
     * save: valid FK values → FKs are resolved and stored correctly.
     */
    public function testDefinitionSaveResolvesValidForeignKeys(): void
    {
        $postData = [
            'action'                    => 'save_and_download',
            'model_name'                => 'FULL_MODEL',
            'model_type'                => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format'               => 'icgem1.0',
            'celestial_body'            => 'Earth',
        ];

        saveGGMsDefinition($this->connection, $postData, $this->resourceId);

        $stmt = $this->connection->prepare(
            "SELECT gd.Model_type_id, gd.Mathematical_representation_id, gd.File_format_id
             FROM `GGM_Definition` gd
             JOIN `Resource_has_GGM_Definition` rhgd
               ON rhgd.GGM_Definition_GGM_Definition_id = gd.GGM_Definition_id
             WHERE rhgd.Resource_resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($row['Model_type_id'],                  'Model_type_id should be resolved');
        $this->assertNotNull($row['Mathematical_representation_id'], 'Math representation should be resolved');
        $this->assertNotNull($row['File_format_id'],                 'File_format_id should be resolved');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // save_ggms_definition.php — submit action (back-end validation active)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * submit: model_name missing → validateGGMData throws.
     */
    public function testDefinitionSubmitFailsWhenModelNameMissing(): void
    {
        $postData = [
            'action'                    => 'submit',
            'model_name'                => '',
            'model_type'                => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format'               => 'icgem1.0',
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/model_name.*required/i');

        saveGGMsDefinition($this->connection, $postData, $this->resourceId);
    }

    /**
     * submit: model_name contains spaces → validateGGMData throws.
     */
    public function testDefinitionSubmitFailsWhenModelNameHasSpaces(): void
    {
        $postData = [
            'action'                    => 'submit',
            'model_name'                => 'MODEL WITH SPACES',
            'model_type'                => 'Static',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format'               => 'icgem1.0',
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Model name must not contain spaces');

        saveGGMsDefinition($this->connection, $postData, $this->resourceId);
    }

    /**
     * submit: mathematical_representation missing → validateGGMData throws.
     */
    public function testDefinitionSubmitFailsWhenMathRepresentationMissing(): void
    {
        $postData = [
            'action'                    => 'submit',
            'model_name'                => 'VALID_MODEL',
            'model_type'                => 'Static',
            'mathematical_representation' => '',
            'file_format'               => 'icgem1.0',
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/mathematical_representation.*required/i');

        saveGGMsDefinition($this->connection, $postData, $this->resourceId);
    }

    /**
     * submit: all fields valid but model_type FK cannot be resolved → throws.
     */
    public function testDefinitionSubmitFailsWhenForeignKeyUnresolvable(): void
    {
        $postData = [
            'action'                    => 'submit',
            'model_name'                => 'VALID_MODEL',
            'model_type'                => 'NonexistentType',
            'mathematical_representation' => 'Spherical harmonics',
            'file_format'               => 'icgem1.0',
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/foreign key/i');

        saveGGMsDefinition($this->connection, $postData, $this->resourceId);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // save_ggms_properties.php — no action gate (always saves)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Properties has NO submit/save distinction — all fields empty still inserts a row.
     */
    public function testPropertiesSaveSucceedsWithAllFieldsEmpty(): void
    {
        $postData = [
            'tide_system'            => '',
            'degree'                 => '',
            'errors'                 => '',
            'error_handling_approach' => '',
            'radius'                 => '',
            'earth_gravity_constant' => '',
        ];

        $result = saveGGMsProperties($this->connection, $postData, $this->resourceId);

        $this->assertTrue($result);

        $stmt = $this->connection->prepare(
            "SELECT GGM_Properties_GGM_Properties_id
             FROM `Resource_has_GGM_Properties`
             WHERE Resource_resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $stmt->bind_result($propsId);
        $found = $stmt->fetch();
        $stmt->close();

        $this->assertTrue($found, 'GGM_Properties record should be created even with empty fields');
        $this->assertGreaterThan(0, $propsId);
    }

    /**
     * Properties: partial data (only degree) → saves successfully, other fields NULL.
     */
    public function testPropertiesSaveSucceedsWithOnlyDegree(): void
    {
        $postData = [
            'tide_system'            => '',
            'degree'                 => '180',
            'errors'                 => '',
            'error_handling_approach' => '',
            'radius'                 => '',
            'earth_gravity_constant' => '',
        ];

        saveGGMsProperties($this->connection, $postData, $this->resourceId);

        $stmt = $this->connection->prepare(
            "SELECT gp.degree, gp.Tide_System
             FROM `GGM_Properties` gp
             JOIN `Resource_has_GGM_Properties` rhp
               ON rhp.GGM_Properties_GGM_Properties_id = gp.GGM_Properties_id
             WHERE rhp.Resource_resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($row);
        $this->assertEquals(180, (int) $row['degree']);
        $this->assertNull($row['Tide_System']);
    }

    /**
     * Properties: called with action=submit still saves (no submit gate exists here).
     */
    public function testPropertiesSubmitActionAlsoSucceedsWithPartialData(): void
    {
        $postData = [
            'action'                 => 'submit',
            'tide_system'            => 'zero-tide',
            'degree'                 => '',
            'errors'                 => '',
            'error_handling_approach' => '',
            'radius'                 => '',
            'earth_gravity_constant' => '',
        ];

        // Should NOT throw — properties has no submit-only validation
        $result = saveGGMsProperties($this->connection, $postData, $this->resourceId);

        $this->assertTrue($result);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // save_ggms_modeltypes.php — no field-level validation
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Model types: no GGM_Definition linked → silently returns true (nothing to do).
     */
    public function testModelTypesSaveReturnsTrueWhenNoDefinitionLinked(): void
    {
        // resourceId has no linked GGM_Definition at this point
        $postData = ['action' => 'save_and_download'];

        $result = saveGGMsModelTypes($this->connection, $postData, $this->resourceId);

        $this->assertTrue($result);
    }

    /**
     * Model types: Static type with no description → inserts Static_Model_Properties with NULL.
     */
    public function testModelTypesSaveStaticWithNoDescriptionInsertsNullRow(): void
    {
        $this->linkDefinitionWithModelType('Static');

        $postData = [
            'action' => 'save_and_download',
            // staticDescription intentionally absent
        ];

        $result = saveGGMsModelTypes($this->connection, $postData, $this->resourceId);

        $this->assertTrue($result);

        $stmt = $this->connection->prepare(
            "SELECT smp.info_time_variable_coefficients
             FROM `Static_Model_Properties` smp
             JOIN `Resource_has_Static_Model_Properties` rsmp
               ON rsmp.static_model_property_id = smp.static_model_property_id
             WHERE rsmp.resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($row, 'Static_Model_Properties row should be created');
        $this->assertNull($row['info_time_variable_coefficients']);
    }

    /**
     * Model types: Temporal type with only start date → inserts with remaining fields NULL.
     */
    public function testModelTypesSaveTemporalWithOnlyStartDate(): void
    {
        $this->linkDefinitionWithModelType('Temporal');

        $postData = [
            'action'        => 'save_and_download',
            'temporalStart' => '2020-01-01',
            // end date, resolution, institution, release all absent
        ];

        $result = saveGGMsModelTypes($this->connection, $postData, $this->resourceId);

        $this->assertTrue($result);

        $stmt = $this->connection->prepare(
            "SELECT tmp.start_date, tmp.end_date, tmp.temporal_resolution_days
             FROM `Temporal_Model_Properties` tmp
             JOIN `Resource_has_Temporal_Model_Properties` rtmp
               ON rtmp.temporal_model_property_id = tmp.temporal_model_property_id
             WHERE rtmp.resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($row);
        $this->assertEquals('2020-01-01', $row['start_date']);
        $this->assertNull($row['end_date']);
        $this->assertNull($row['temporal_resolution_days']);
    }

    /**
     * Model types: model_type provided directly in postData (no definition in DB needed).
     */
    public function testModelTypesSaveUsesModelTypeFromPostDataDirectly(): void
    {
        // No GGM_Definition linked — model_type comes from postData
        $postData = [
            'action'     => 'save_and_download',
            'model_type' => 'Static',
        ];

        $result = saveGGMsModelTypes($this->connection, $postData, $this->resourceId);

        $this->assertTrue($result);

        $stmt = $this->connection->prepare(
            "SELECT COUNT(*) as cnt
             FROM `Resource_has_Static_Model_Properties`
             WHERE resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEquals(1, (int) $row['cnt'], 'Static_Model_Properties should be created from postData model_type');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // save_ggms_datasources.php — save skips validation, submit enforces it
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * save: Satellite row with no platform → no exception, row inserted with NULL platform fields.
     */
    public function testDataSourcesSaveSucceedsWithIncompleteSatelliteRow(): void
    {
        $postData = [
            'action'                  => 'save_and_download',
            'datasource_type'         => ['S'],
            'datasource_description'  => ['Test satellite without platform'],
            // satellite_platform deliberately absent
        ];

        // Should not throw
        saveGGMsDataSources($this->connection, $postData, $this->resourceId);

        $stmt = $this->connection->prepare(
            "SELECT ds.type, ds.S_value_name
             FROM `Data_Sources` ds
             JOIN `Resource_has_Data_Sources` rhds ON rhds.data_source_id = ds.data_source_id
             WHERE rhds.resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($row, 'Data_Sources record should be created on save despite missing platform');
        $this->assertEquals('S', $row['type']);
        $this->assertNull($row['S_value_name']);
    }

    /**
     * save: Ground data row with no details → inserts with NULL details.
     */
    public function testDataSourcesSaveSucceedsWithIncompleteGroundDataRow(): void
    {
        $postData = [
            'action'                  => 'save_and_download',
            'datasource_type'         => ['G'],
            'datasource_description'  => [''],
            // datasource_details deliberately absent
        ];

        saveGGMsDataSources($this->connection, $postData, $this->resourceId);

        $stmt = $this->connection->prepare(
            "SELECT ds.type, ds.details
             FROM `Data_Sources` ds
             JOIN `Resource_has_Data_Sources` rhds ON rhds.data_source_id = ds.data_source_id
             WHERE rhds.resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertNotNull($row);
        $this->assertEquals('G', $row['type']);
        $this->assertNull($row['details']);
    }

    /**
     * save: empty datasource_type array → nothing saved, no exception.
     */
    public function testDataSourcesSaveWithNoRowsDoesNothing(): void
    {
        $postData = [
            'action'                 => 'save_and_download',
            'datasource_type'        => [],
            'datasource_description' => [],
        ];

        saveGGMsDataSources($this->connection, $postData, $this->resourceId);

        $stmt = $this->connection->prepare(
            "SELECT COUNT(*) as cnt FROM `Resource_has_Data_Sources` WHERE resource_id = ?"
        );
        $stmt->bind_param('i', $this->resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertEquals(0, (int) $row['cnt']);
    }

    /**
     * submit: Satellite row with no platform → validateDataSourceRow throws.
     */
    public function testDataSourcesSubmitFailsWithMissingSatellitePlatform(): void
    {
        $postData = [
            'action'                 => 'submit',
            'datasource_type'        => ['S'],
            'datasource_description' => [''],
            // satellite_platform absent
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/satellite_platform.*required/i');

        saveGGMsDataSources($this->connection, $postData, $this->resourceId);
    }

    /**
     * submit: Ground data row with no details → validateDataSourceRow throws.
     */
    public function testDataSourcesSubmitFailsWithMissingGroundDetails(): void
    {
        $postData = [
            'action'                 => 'submit',
            'datasource_type'        => ['G'],
            'datasource_description' => [''],
            // datasource_details absent
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/datasource_details.*required/i');

        saveGGMsDataSources($this->connection, $postData, $this->resourceId);
    }

    /**
     * submit: Model row with identifier but no identifier_type → validateDataSourceRow throws.
     */
    public function testDataSourcesSubmitFailsWithModelRowMissingDetails(): void
    {
        $postData = [
            'action'                 => 'submit',
            'datasource_type'        => ['M'],
            'datasource_description' => [''],
            // datasource_details absent (required for M type)
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/datasource_details.*required/i');

        saveGGMsDataSources($this->connection, $postData, $this->resourceId);
    }
}
