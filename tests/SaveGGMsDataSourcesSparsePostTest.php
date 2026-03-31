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
}