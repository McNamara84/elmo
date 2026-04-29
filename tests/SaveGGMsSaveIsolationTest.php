<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_ggms_properties.php';
require_once __DIR__ . '/../save/formgroups/save_ggms_datasources.php';

/**
 * Isolation tests that verify save_and_download vs submit behaviour for the GGM
 * form groups that participate in the "separate save / submit" workflow.
 *
 * Philosophy:
 * - save_and_download: incomplete / "Choose" defaults must be accepted silently.
 * - submit: same incomplete data must trigger a validation Exception.
 */
final class SaveGGMsSaveIsolationTest extends DatabaseTestCase
{
    private int $resourceId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resourceId = $this->createResource('test.ggm.isolation', 'GGM Save Isolation');
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function getGGMPropertiesForResource(int $resourceId): ?array
    {
        $sql = "SELECT gp.*
                FROM `GGM_Properties` gp
                JOIN `Resource_has_GGM_Properties` rhgp
                    ON gp.GGM_Properties_id = rhgp.GGM_Properties_GGM_Properties_id
                WHERE rhgp.Resource_resource_id = ?
                LIMIT 1";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row;
    }

    private function getDataSourcesForResource(int $resourceId): array
    {
        $sql = "SELECT ds.*
                FROM `Data_Sources` ds
                JOIN `Resource_has_Data_Sources` rhds ON ds.data_source_id = rhds.data_source_id
                WHERE rhds.resource_id = ?
                ORDER BY ds.data_source_id ASC";
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        return $rows;
    }

    // =========================================================================
    // GGM Properties – save_and_download isolation
    // =========================================================================

    /**
     * Saving with only `degree` filled (all dropdowns on "Choose" → empty string)
     * must succeed and store NULL (not empty string) for the un-filled string fields.
     */
    public function testPropertiesSaveSucceedsWithOnlyDegree(): void
    {
        $postData = [
            'action'                  => 'save_and_download',
            'tide_system'             => '',   // "Choose" default
            'degree'                  => '360',
            'errors'                  => '',   // "Choose" default
            'error_handling_approach' => '',
            'radius'                  => '',
            'earth_gravity_constant'  => '',
        ];

        $result = saveGGMsProperties($this->connection, $postData, $this->resourceId);
        $this->assertTrue($result);

        $record = $this->getGGMPropertiesForResource($this->resourceId);
        $this->assertNotNull($record, 'GGM_Properties record should be created');
        $this->assertEquals(360, $record['degree']);
        $this->assertNull($record['Tide_System'], 'Empty-string tide_system must be stored as NULL');
        $this->assertNull($record['Errors'], 'Empty-string errors must be stored as NULL');
        $this->assertNull($record['Error_Handling_Approach'], 'Empty error_handling_approach must be NULL');
        $this->assertNull($record['radius']);
        $this->assertNull($record['earth_gravity_constant']);
    }

    // =========================================================================
    // Data Sources – incomplete satellite row
    // =========================================================================

    /**
     * A satellite data source row that has no platform selected must still be
     * persisted during save_and_download (partial save is acceptable).
     */
    public function testDataSourcesSaveSucceedsWithIncompleteSatelliteRow(): void
    {
        $postData = [
            'action'                 => 'save_and_download',
            'datasource_type'        => ['S'],
            'datasource_description' => ['Satellite data – platform not yet chosen'],
            // satellite_platform intentionally absent (user left "Choose")
        ];

        saveGGMsDataSources($this->connection, $postData, $this->resourceId);

        $records = $this->getDataSourcesForResource($this->resourceId);
        $this->assertNotNull($records[0] ?? null, 'Data_Sources record should be created on save despite missing platform');
        $this->assertEquals('S', $records[0]['type']);
        $this->assertNull($records[0]['S_value_name'], 'S_value_name must be NULL when no platform was chosen');
    }

    /**
     * The same incomplete satellite row must throw an Exception when action = submit.
     */
    public function testDataSourcesSubmitFailsWithMissingSatellitePlatform(): void
    {
        $postData = [
            'action'                 => 'submit',
            'datasource_type'        => ['S'],
            'datasource_description' => ['Satellite data – platform not yet chosen'],
            // satellite_platform intentionally absent
        ];

        $this->expectException(\Exception::class);

        saveGGMsDataSources($this->connection, $postData, $this->resourceId);
    }
}
