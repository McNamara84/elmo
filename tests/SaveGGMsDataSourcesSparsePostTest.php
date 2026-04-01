<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_ggms_datasources.php';

final class SaveGGMsDataSourcesSparsePostTest extends DatabaseTestCase
{
    private function getDataSourcesForResource(int $resourceId): array
    {
        $sql = "SELECT ds.* FROM `Data_Sources` ds
                JOIN `Resource_has_Data_Sources` rhds ON ds.data_source_id = rhds.data_source_id
                WHERE rhds.resource_id = ?
                ORDER BY ds.data_source_id ASC";

        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        return $rows;
    }

    private function satellitePlatformPayload(string $platformName = 'GRACE'): string
    {
        return json_encode([
            [
                'value' => "Space-based Platforms > {$platformName}",
                'id' => 'gcmd_' . strtolower(str_replace('-', '_', $platformName)),
                'scheme' => 'GCMD Platforms',
                'schemeURI' => 'https://gcmd.earthdata.nasa.gov/',
                'language' => 'en'
            ]
        ]);
    }

    public function testExtractDataSourceRowsAlignsSparseBrowserPayload(): void
    {
        $postData = [
            'datasource_type' => ['S', 'G', 'A', 'M'],
            'datasource_description' => [
                'Satellite description',
                'Ground description',
                'Altimetry description',
                'Model description'
            ],
            'satellite_platform' => [$this->satellitePlatformPayload('GRACE')],
            'datasource_details' => [
                'Terrestrial',
                'Direct observations from altimetry satellites',
                'Global Gravitational Model'
            ],
            'dIdentifier' => ['10.5880/icgem.2024.001'],
            'dIdentifierType' => ['DOI'],
            'dName' => ['ICGEM_Global_Model_2024']
        ];

        $rows = \extractDataSourceRows($postData);

        $this->assertCount(4, $rows);
        $this->assertSame('S', $rows[0]['type']);
        $this->assertSame('Ground description', $rows[1]['description']);
        $this->assertSame('Terrestrial', $rows[1]['datasource_details']);
        $this->assertSame('Direct observations from altimetry satellites', $rows[2]['datasource_details']);
        $this->assertSame('Global Gravitational Model', $rows[3]['datasource_details']);
        $this->assertSame('10.5880/icgem.2024.001', $rows[3]['dIdentifier']);
        $this->assertSame('DOI', $rows[3]['dIdentifierType']);
        $this->assertSame('ICGEM_Global_Model_2024', $rows[3]['dName']);
    }

    public function testSaveGGMsDataSourcesPreservesDetailsForSparsePayload(): void
    {
        $resourceId = $this->createResource('test.sparse.datasources', 'Sparse Data Sources');

        $postData = [
            'datasource_type' => ['S', 'G', 'A', 'T', 'T', 'M'],
            'datasource_description' => [
                'Satellite description',
                'Ground description',
                'Altimetry description',
                'Terrain DEM description',
                'Terrain isostasy description',
                'Model description'
            ],
            'satellite_platform' => [$this->satellitePlatformPayload('GRACE')],
            'datasource_details' => [
                'Terrestrial',
                'Direct observations from altimetry satellites',
                'Digital Elevation Model (DEM/DTM)',
                'Isostasy',
                'Global Gravitational Model'
            ],
            'compensation_depth' => ['650'],
            'dIdentifier' => ['10.5880/icgem.2024.001'],
            'dIdentifierType' => ['DOI'],
            'dName' => ['ICGEM_Global_Model_2024']
        ];

        \saveGGMsDataSources($this->connection, $postData, $resourceId);

        $dataSources = $this->getDataSourcesForResource($resourceId);
        $this->assertCount(6, $dataSources);

        $ground = array_values(array_filter($dataSources, static fn(array $row): bool => $row['description'] === 'Ground description'))[0];
        $altimetry = array_values(array_filter($dataSources, static fn(array $row): bool => $row['description'] === 'Altimetry description'))[0];
        $terrainDem = array_values(array_filter($dataSources, static fn(array $row): bool => $row['description'] === 'Terrain DEM description'))[0];
        $terrainIsostasy = array_values(array_filter($dataSources, static fn(array $row): bool => $row['description'] === 'Terrain isostasy description'))[0];
        $model = array_values(array_filter($dataSources, static fn(array $row): bool => $row['description'] === 'Model description'))[0];

        $this->assertSame('G', $ground['type']);
        $this->assertSame('Terrestrial', $ground['details']);

        $this->assertSame('A', $altimetry['type']);
        $this->assertSame('Direct observations from altimetry satellites', $altimetry['details']);

        $this->assertSame('T', $terrainDem['type']);
        $this->assertSame('Digital Elevation Model (DEM/DTM)', $terrainDem['details']);
        $this->assertNull($terrainDem['T_Isostasy_compensation_depth']);

        $this->assertSame('T', $terrainIsostasy['type']);
        $this->assertSame('Isostasy', $terrainIsostasy['details']);
        $this->assertSame(650, $terrainIsostasy['T_Isostasy_compensation_depth']);

        $this->assertSame('M', $model['type']);
        $this->assertSame('Global Gravitational Model', $model['details']);
        $this->assertSame('10.5880/icgem.2024.001', $model['M_identifier']);
        $this->assertSame('DOI', $model['M_identifier_type']);
        $this->assertSame('ICGEM_Global_Model_2024', $model['M_name']);
    }

    /**
     * Test: Unknown type code in datasource_type raises a RuntimeException.
     *
     * An unrecognised type must never silently consume (or fail to consume) cursor-based
     * fields, because that would misalign every subsequent row.
     */
    public function testUnknownTypeCodeThrowsRuntimeException(): void
    {
        $postData = [
            'datasource_type'       => ['G', 'X', 'M'],
            'datasource_description' => ['Ground desc', 'Unknown desc', 'Model desc'],
            'datasource_details'    => ['Terrestrial', 'Global Gravitational Model'],
            'dIdentifier'           => ['10.5880/icgem.2024.001'],
            'dIdentifierType'       => ['DOI'],
            'dName'                 => ['ICGEM_Global_Model_2024'],
        ];

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches("/Unknown data source type 'X'/");

        \extractDataSourceRows($postData);
    }

    /**
     * Test: Alignment false-positive scenario — [S, G, M] with the same number of
     * datasource_details values as row types must NOT be treated as row-aligned.
     *
     * The browser only submits details for G and M (2 values). If an extra entry were
     * present, the old heuristic would flag count==count and map details[0] onto row 0 (S).
     * With the hardcoded queue approach the mapping must always be:
     *   queue[0] → G, queue[1] → M  (S is skipped entirely).
     *
     * We simulate the coincidental equal-length case by injecting a 3rd details entry
     * that must NOT end up on the S row.
     */
    public function testAlignmentFalsePositiveDoesNotPolluteSatelliteRow(): void
    {
        $postData = [
            'datasource_type'        => ['S', 'G', 'M'],
            'datasource_description' => ['Sat desc', 'Ground desc', 'Model desc'],
            // 3 detail values == 3 types: would trigger the old false-positive alignment
            'datasource_details'     => ['Terrestrial', 'Global Gravitational Model', 'Stray entry'],
            'satellite_platform'     => [$this->satellitePlatformPayload('GRACE')],
            'dIdentifier'            => ['10.5880/icgem.2024.001'],
            'dIdentifierType'        => ['DOI'],
            'dName'                  => ['ICGEM_Global_Model_2024'],
        ];

        $rows = \extractDataSourceRows($postData);

        $this->assertCount(3, $rows);

        // S row must have no details (queue not consumed for type S)
        $this->assertNull($rows[0]['datasource_details'], 'S row must not receive a datasource_details value');

        // G row must receive the first queued details entry
        $this->assertSame('Terrestrial', $rows[1]['datasource_details']);

        // M row must receive the second queued details entry
        $this->assertSame('Global Gravitational Model', $rows[2]['datasource_details']);
    }

    /**
     * Test: Multiple satellite rows mixed with other sparse types.
     *
     * Two S rows (each with its own platform) followed by G and M must each receive
     * only their own platform payload and leave the details queue intact for G and M.
     */
    public function testMultipleSatelliteRowsCombinedWithSparseTypes(): void
    {
        $postData = [
            'datasource_type'        => ['S', 'S', 'G', 'M'],
            'datasource_description' => ['Sat1 desc', 'Sat2 desc', 'Ground desc', 'Model desc'],
            'satellite_platform'     => [
                $this->satellitePlatformPayload('GRACE'),
                $this->satellitePlatformPayload('GOCE'),
            ],
            'datasource_details'     => ['Terrestrial', 'Global Gravitational Model'],
            'dIdentifier'            => ['10.5880/icgem.2024.001'],
            'dIdentifierType'        => ['DOI'],
            'dName'                  => ['ICGEM_Global_Model_2024'],
        ];

        $rows = \extractDataSourceRows($postData);

        $this->assertCount(4, $rows);

        // Both S rows must have their own platform payloads
        $platform0 = json_decode($rows[0]['satellite_platform'], true);
        $platform1 = json_decode($rows[1]['satellite_platform'], true);
        $this->assertStringContainsString('GRACE', $platform0[0]['value']);
        $this->assertStringContainsString('GOCE', $platform1[0]['value']);

        // S rows must not have details
        $this->assertNull($rows[0]['datasource_details']);
        $this->assertNull($rows[1]['datasource_details']);

        // G and M rows must have their details from the queue
        $this->assertSame('Terrestrial', $rows[2]['datasource_details']);
        $this->assertSame('Global Gravitational Model', $rows[3]['datasource_details']);
    }

    /**
     * Test: Empty datasource_details for a type that requires it (G) triggers a
     * validation error when action=submit.
     */
    public function testEmptyDetailsForGroundTypeFailsValidationOnSubmit(): void
    {
        $resourceId = $this->createResource('test.empty.details', 'Empty Details Validation');

        $postData = [
            'action'                 => 'submit',
            'datasource_type'        => ['G'],
            'datasource_description' => ['Ground desc'],
            'datasource_details'     => [''],   // empty — required for type G
        ];

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches("/datasource_details.*required.*G/i");

        \saveGGMsDataSources($this->connection, $postData, $resourceId);
    }
}