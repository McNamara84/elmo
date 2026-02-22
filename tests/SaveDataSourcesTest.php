<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../save/formgroups/save_ggms_datasources.php';

/**
 * Test suite for saving GGM Data Sources
 * 
 * Tests the complete data source saving workflow including:
 * - Simple types (G, A, T) with field validation
 * - Satellite (S) type with thesaurus keyword ingestion
 * - Multiple satellite platforms expansion
 * - All 5 types combined in a single save operation
 */
final class SaveDataSourcesTest extends DatabaseTestCase
{
    // ============================================================================
    // MOCK DATA GENERATION METHODS
    // ============================================================================
    
    /**
     * Generate mock data for a single Satellite data source
     * 
     * @param array $platformNames Optional: custom platform names to use instead of defaults
     * @return array PostData for satellite type
     */
    public static function satelliteRow(array $platformNames = ['GRACE', 'GRACE-FO']): array
    {
        $platforms = [];
        
        // Simulate Tagify tag objects with metadata
        foreach ($platformNames as $name) {
            $platforms[] = [
                'value' => "Space-based Platforms > {$name}",
                'id' => 'gcmd_' . strtolower(str_replace('-', '_', $name)),
                'scheme' => 'GCMD Platforms',
                'schemeURI' => 'https://gcmd.earthdata.nasa.gov/',
                'language' => 'en'
            ];
        }
        
        return [
            'type' => 'S',
            'satellite_platform' => json_encode($platforms),
            'description' => 'Space-borne gravity measurement satellites',
            'details' => '',
            'compensation_depth' => '',
            'identifier' => '',
            'identifier_type' => '',
            'model_name' => ''
        ];
    }
    
    /**
     * Generate mock data for a Ground data source
     */
    public static function groundRow(): array
    {
        return [
            'type' => 'G',
            'datasource_details' => 'Terrestrial gravity stations',
            'description' => 'Land-based gravity observations',
            'satellite_platform' => '',
            'compensation_depth' => '',
            'identifier' => '',
            'identifier_type' => '',
            'model_name' => ''
        ];
    }
    
    /**
     * Generate mock data for an Altimetry data source
     */
    public static function altimetryRow(): array
    {
        return [
            'type' => 'A',
            'datasource_details' => 'Direct observations from altimetry satellites',
            'description' => 'Satellite altimetry data',
            'satellite_platform' => '',
            'compensation_depth' => '',
            'identifier' => '',
            'identifier_type' => '',
            'model_name' => ''
        ];
    }
    
    /**
     * Generate mock data for a Terrain/Topography data source
     */
    public static function terrainRow(int $compensationDepth = 500): array
    {
        return [
            'type' => 'T',
            'datasource_details' => 'Digital Elevation Model (DEM/DTM)',
            'compensation_depth' => (string)$compensationDepth,
            'description' => 'Topographic data for gravity field modeling',
            'satellite_platform' => '',
            'identifier' => '',
            'identifier_type' => '',
            'model_name' => ''
        ];
    }
    
    /**
     * Generate mock data for a Model data source
     * 
     * @param string $identifierType Type of identifier (DOI, URL, ISBN, etc)
     */
    public static function modelRow(string $identifierType = 'DOI'): array
    {
        return [
            'type' => 'M',
            'datasource_details' => 'Global Gravitational Model',
            'dIdentifier' => '10.5880/icgem.2024.001',
            'dIdentifierType' => $identifierType,
            'dName' => 'ICGEM_Global_Model_2024',
            'description' => 'Reference gravity model from ICGEM',
            'satellite_platform' => '',
            'compensation_depth' => ''
        ];
    }
    
    /**
     * Convert row objects back to POST array format
     * (This is how they come from the HTML form)
     * 
     * @param array $rows Array of individual row data
     * @return array PostData in form array format
     */
    public static function rowsToPostData(array $rows): array
    {
        $postData = [
            'datasource_type' => [],
            'datasource_details' => [],
            'compensation_depth' => [],
            'satellite_platform' => [],
            'dIdentifier' => [],
            'dIdentifierType' => [],
            'dName' => [],
            'datasource_description' => []
        ];
        
        foreach ($rows as $row) {
            $postData['datasource_type'][] = $row['type'];
            $postData['datasource_details'][] = $row['datasource_details'] ?? $row['details'] ?? '';
            $postData['compensation_depth'][] = $row['compensation_depth'] ?? '';
            $postData['satellite_platform'][] = $row['satellite_platform'] ?? '';
            $postData['dIdentifier'][] = $row['dIdentifier'] ?? $row['identifier'] ?? '';
            $postData['dIdentifierType'][] = $row['dIdentifierType'] ?? $row['identifier_type'] ?? '';
            $postData['dName'][] = $row['dName'] ?? $row['model_name'] ?? '';
            $postData['datasource_description'][] = $row['description'] ?? '';
        }
        
        return $postData;
    }
    
    // ============================================================================
    // HELPER METHODS FOR DATABASE ASSERTIONS
    // ============================================================================
    
    /**
     * Get data source record from database by type and description
     */
    private function getDataSourceFromDb(int $resourceId, string $type, string $description): ?array
    {
        $sql = "SELECT ds.* FROM `Data_Sources` ds
                JOIN `Resource_has_Data_Sources` rhds ON ds.data_source_id = rhds.data_source_id
                WHERE rhds.resource_id = ? AND ds.type = ? AND ds.description = ?";
        
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('iss', $resourceId, $type, $description);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();
        
        return $row;
    }
    
    /**
     * Get all data sources for a resource
     */
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
    
    /**
     * Get thesaurus keywords for a resource
     */
    private function getThesaurusKeywordsForResource(int $resourceId): array
    {
        $sql = "SELECT tk.* FROM `Thesaurus_Keywords` tk
                JOIN `Resource_has_Thesaurus_Keywords` rhtk ON tk.thesaurus_keywords_id = rhtk.Thesaurus_Keywords_thesaurus_keywords_id
                WHERE rhtk.Resource_resource_id = ?
                ORDER BY tk.thesaurus_keywords_id ASC";
        
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        
        return $rows;
    }
    
    /**
     * Get related works for a resource
     */
    private function getRelatedWorksForResource(int $resourceId): array
    {
        $sql = "SELECT rw.* FROM `Related_Work` rw
                JOIN `Resource_has_Related_Work` rhrw ON rw.related_work_id = rhrw.Related_Work_related_work_id
                WHERE rhrw.Resource_resource_id = ?
                ORDER BY rw.related_work_id ASC";
        
        $stmt = $this->connection->prepare($sql);
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        
        return $rows;
    }
    
    // ============================================================================
    // TEST METHODS
    // ============================================================================
    
    /**
     * Test: Save simple Ground (G) data source
     * Assert: Correct fields populated, type-specific fields not present
     */
    public function testSaveSimpleGroundDataSource(): void
    {
        $resource_id = $this->createResource('test.ground', 'Test Ground Data Source');
        
        $mockData = self::groundRow();
        $postData = self::rowsToPostData([$mockData]);
        
        // Save the data source
        saveGGMsDataSources($this->connection, $postData, $resource_id);
        
        // Retrieve from database
        $dbRecord = $this->getDataSourceFromDb(
            $resource_id,
            'G',
            'Land-based gravity observations'
        );
        
        $this->assertNotNull($dbRecord, 'Data source should be saved');
        $this->assertEquals('G', $dbRecord['type']);
        $this->assertEquals('Land-based gravity observations', $dbRecord['description']);
        $this->assertEquals('Terrestrial gravity stations', $dbRecord['details']);
        
        // Assert that satellite-specific fields are NULL for type G
        $this->assertNull($dbRecord['S_value_name'], 'S_value_name should be NULL for type G');
    }
    
    /**
     * Test: Save simple Altimetry (A) data source
     * Assert: Correct fields populated, type-specific fields not present
     */
    public function testSaveSimpleAltimetryDataSource(): void
    {
        $resource_id = $this->createResource('test.altimetry', 'Test Altimetry Data Source');
        
        $mockData = self::altimetryRow();
        $postData = self::rowsToPostData([$mockData]);
        
        saveGGMsDataSources($this->connection, $postData, $resource_id);
        
        $dbRecord = $this->getDataSourceFromDb(
            $resource_id,
            'A',
            'Satellite altimetry data'
        );
        
        $this->assertNotNull($dbRecord);
        $this->assertEquals('A', $dbRecord['type']);
        $this->assertEquals('Direct observations from altimetry satellites', $dbRecord['details']);
        
        // Assert that satellite-specific fields are NULL for type A
        $this->assertNull($dbRecord['S_value_name']);
    }
    
    /**
     * Test: Save simple Terrain (T) data source
     * Assert: Correct fields populated including compensation_depth, type-specific fields not present
     */
    public function testSaveSimpleTerrainDataSource(): void
    {
        $resource_id = $this->createResource('test.terrain', 'Test Terrain Data Source');
        
        $mockData = self::terrainRow(750);
        $postData = self::rowsToPostData([$mockData]);
        
        saveGGMsDataSources($this->connection, $postData, $resource_id);
        
        $dbRecord = $this->getDataSourceFromDb(
            $resource_id,
            'T',
            'Topographic data for gravity field modeling'
        );
        
        $this->assertNotNull($dbRecord);
        $this->assertEquals('T', $dbRecord['type']);
        $this->assertEquals('Digital Elevation Model (DEM/DTM)', $dbRecord['details']);
        $this->assertEquals(750, $dbRecord['T_Isostasy_compensation_depth']);
        
        // Assert that satellite-specific fields are NULL for type T
        $this->assertNull($dbRecord['S_value_name']);
    }
    
    /**
     * Test: Save single Satellite (S) data source with one platform
     * Assert: Data source saved AND thesaurus keyword created
     */
    public function testSaveSingleSatelliteDataSourceWithThesaurusKeyword(): void
    {
        $resource_id = $this->createResource('test.satellite.single', 'Test Single Satellite');
        
        $mockData = self::satelliteRow(['GRACE']);
        $postData = self::rowsToPostData([$mockData]);
        
        saveGGMsDataSources($this->connection, $postData, $resource_id);
        
        // Get data source
        $dataSources = $this->getDataSourcesForResource($resource_id);
        $this->assertCount(1, $dataSources, 'Should have 1 data source');
        
        $ds = $dataSources[0];
        $this->assertEquals('S', $ds['type']);
        $this->assertNotNull($ds['S_value_name']);
        
        // Get thesaurus keywords
        $keywords = $this->getThesaurusKeywordsForResource($resource_id);
        $this->assertCount(1, $keywords, 'Should have 1 thesaurus keyword');
        
        $keyword = $keywords[0];
        $this->assertStringContainsString('GRACE', $keyword['keyword']);
    }
    
    /**
     * Test: Save Satellite (S) data source with multiple platforms
     * Assert: 3 data sources created AND 3 thesaurus keywords created
     */
    public function testSaveMultipleSatellitePlatformsExpansion(): void
    {
        $resource_id = $this->createResource('test.satellite.multi', 'Test Multiple Satellites');
        
        $platforms = ['GRACE', 'GRACE-FO', 'GOCE'];
        $mockData = self::satelliteRow($platforms);
        $postData = self::rowsToPostData([$mockData]);
        
        saveGGMsDataSources($this->connection, $postData, $resource_id);
        
        // Get all data sources - should be 3 (one per platform)
        $dataSources = $this->getDataSourcesForResource($resource_id);
        $this->assertCount(3, $dataSources, 'Should have 3 data sources (one per platform)');
        
        // Verify all are type S
        foreach ($dataSources as $ds) {
            $this->assertEquals('S', $ds['type']);
            $this->assertNotNull($ds['S_value_name']);
        }
        
        // Get thesaurus keywords - should be 3 (one per platform)
        $keywords = $this->getThesaurusKeywordsForResource($resource_id);
        $this->assertCount(3, $keywords, 'Should have 3 thesaurus keywords');
        
        // Verify keywords contain platform names
        $keywordValues = array_column($keywords, 'keyword');
        foreach ($platforms as $platform) {
            $found = false;
            foreach ($keywordValues as $kv) {
                if (strpos($kv, $platform) !== false) {
                    $found = true;
                    break;
                }
            }
            $this->assertTrue($found, "Platform {$platform} should have a keyword");
        }
    }
    
    /**
     * Test: Save Model (M) data source
     * Assert: Data source saved AND related work created with IsDerivedFrom relation
     */
    public function testSaveModelDataSourceWithRelatedWork(): void
    {
        $resource_id = $this->createResource('test.model', 'Test Model Data Source');
        
        $mockData = self::modelRow('DOI');
        $postData = self::rowsToPostData([$mockData]);
        
        saveGGMsDataSources($this->connection, $postData, $resource_id);
        
        // Get data source
        $dataSources = $this->getDataSourcesForResource($resource_id);
        $this->assertCount(1, $dataSources, 'Should have 1 data source');
        
        $ds = $dataSources[0];
        $this->assertEquals('M', $ds['type']);
        $this->assertEquals('10.5880/icgem.2024.001', $ds['M_identifier']);
        $this->assertEquals('DOI', $ds['M_identifier_type']);
        $this->assertNull($ds['S_value_name']);
        
        // Get related works
        $relatedWorks = $this->getRelatedWorksForResource($resource_id);
        $this->assertCount(1, $relatedWorks, 'Should have 1 related work');
        
        $rw = $relatedWorks[0];
        $this->assertEquals('10.5880/icgem.2024.001', $rw['Identifier']);
    }
    
    /**
     * Test: Save all 5 types at once
     * - 1 Ground (G)
     * - 1 Altimetry (A)
     * - 1 Terrain (T)
     * - 1 Satellite (S) with 3 platforms -> expands to 3 data sources
     * - 1 Model (M)
     * 
     * Assert:
     * - Total 7 data sources (1 + 1 + 1 + 3 + 1)
     * - 3 thesaurus keywords from satellite platforms
     * - 1 related work from model
     */
    public function testSaveAllDataSourceTypesAtOnce(): void
    {
        $resource_id = $this->createResource('test.all.types', 'Test All Data Source Types');
        
        // Create rows for all 5 types
        $rows = [
            self::groundRow(),
            self::altimetryRow(),
            self::terrainRow(600),
            self::satelliteRow(['GRACE', 'GRACE-FO', 'GOCE']),
            self::modelRow('DOI')
        ];
        
        $postData = self::rowsToPostData($rows);
        
        // Save all at once
        saveGGMsDataSources($this->connection, $postData, $resource_id);
        
        // ========== ASSERTIONS ==========
        
        // 1. Check total data sources: 1G + 1A + 1T + 3S (expanded) + 1M = 7
        $dataSources = $this->getDataSourcesForResource($resource_id);
        $this->assertCount(7, $dataSources, 'Should have 7 total data sources');
        
        // 2. Verify type distribution
        $typeCount = array_count_values(array_column($dataSources, 'type'));
        $this->assertEquals(1, $typeCount['G'] ?? 0, 'Should have 1 Ground');
        $this->assertEquals(1, $typeCount['A'] ?? 0, 'Should have 1 Altimetry');
        $this->assertEquals(1, $typeCount['T'] ?? 0, 'Should have 1 Terrain');
        $this->assertEquals(3, $typeCount['S'] ?? 0, 'Should have 3 Satellite (expanded)');
        $this->assertEquals(1, $typeCount['M'] ?? 0, 'Should have 1 Model');
        
        // 3. Verify Ground type has correct fields
        $gRecord = array_values(array_filter($dataSources, fn($ds) => $ds['type'] === 'G'))[0];
        $this->assertEquals('Terrestrial gravity stations', $gRecord['details']);
        $this->assertNull($gRecord['S_value_name']);
        
        // 4. Verify Altimetry type has correct fields
        $aRecord = array_values(array_filter($dataSources, fn($ds) => $ds['type'] === 'A'))[0];
        $this->assertEquals('Direct observations from altimetry satellites', $aRecord['details']);
        $this->assertNull($aRecord['S_value_name']);
        
        // 5. Verify Terrain type has correct fields and compensation depth
        $tRecord = array_values(array_filter($dataSources, fn($ds) => $ds['type'] === 'T'))[0];
        $this->assertEquals('Digital Elevation Model (DEM/DTM)', $tRecord['details']);
        $this->assertEquals(600, $tRecord['T_Isostasy_compensation_depth']);
        $this->assertNull($tRecord['S_value_name']);
        
        // 6. Verify Model type has correct fields
        $mRecord = array_values(array_filter($dataSources, fn($ds) => $ds['type'] === 'M'))[0];
        $this->assertEquals('10.5880/icgem.2024.001', $mRecord['M_identifier']);
        $this->assertEquals('DOI', $mRecord['M_identifier_type']);
        $this->assertNull($mRecord['S_value_name']);
        
        // 7. Verify Satellite types have platform values
        $sRecords = array_values(array_filter($dataSources, fn($ds) => $ds['type'] === 'S'));
        foreach ($sRecords as $sRecord) {
            $this->assertNotNull($sRecord['S_value_name']);
        }
        
        // 8. Verify 3 thesaurus keywords created from satellite platforms
        $keywords = $this->getThesaurusKeywordsForResource($resource_id);
        $this->assertCount(3, $keywords, 'Should have 3 thesaurus keywords from satellites');
        
        // 9. Verify 1 related work created from model
        $relatedWorks = $this->getRelatedWorksForResource($resource_id);
        $this->assertCount(1, $relatedWorks, 'Should have 1 related work from model');
        $this->assertEquals('10.5880/icgem.2024.001', $relatedWorks[0]['Identifier']);
    }
}
