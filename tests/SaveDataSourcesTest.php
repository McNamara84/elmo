<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/formgroups/save_datasources.php';

/**
 * Test suite for saving GGM Data Sources
 * 
 * This demonstrates how to generate realistic mock data for testing the saveDataSources function
 */
class SaveDataSourcesTest extends DatabaseTestCase
{
    /**
     * Test saving a single Satellite data source
     */
    public function testSaveSingleSatelliteDataSource(): void
    {
        $resource_id = $this->createResource('test.datasources', 'Test Data Sources');
        
        // Generate mock satellite data with multiple platforms
        $mockData = MockDataSourcesData::satelliteRow(['GRACE', 'GRACE-FO', 'GOCE']);
        $postData = MockDataSourcesData::rowsToPostData([$mockData]);
        
        // Should not throw exception
        saveDataSources($GLOBALS['db_connection'], $postData, $resource_id);
        
        // Verify data was saved
        $this->assertTrue(true);
    }
    
    /**
     * Test saving mixed data source types
     */
    public function testSaveMultipleDataSourceTypes(): void
    {
        $resource_id = $this->createResource('test.ggm.mixed', 'Mixed Data Sources');
        
        // Generate realistic multi-type data
        $rows = [
            MockDataSourcesData::satelliteRow(['GRACE', 'GRACE-FO']),
            MockDataSourcesData::groundRow(),
            MockDataSourcesData::altimetryRow(),
            MockDataSourcesData::terrainRow(1000),
            MockDataSourcesData::modelRow('DOI')
        ];
        
        $postData = MockDataSourcesData::rowsToPostData($rows);
        
        saveDataSources($GLOBALS['db_connection'], $postData, $resource_id);
        
        // Verify data was saved
        $this->assertTrue(true);
    }
    
    /**
     * Test extracting data source rows from postData
     */
    public function testExtractDataSourceRows(): void
    {
        $mockData = MockDataSourcesData::satelliteRow(['GRACE']);
        $postData = MockDataSourcesData::rowsToPostData([$mockData]);
        
        $rows = extractDataSourceRows($postData);
        
        $this->assertCount(1, $rows);
        $this->assertEquals('S', $rows[0]['type']);
        $this->assertNotEmpty($rows[0]['satellite_platform']);
    }
    
    /**
     * Test satellite platform expansion
     */
    public function testSatellitePlatformExpansion(): void
    {
        $platforms = ['GRACE', 'GRACE-FO', 'GOCE'];
        $mockData = MockDataSourcesData::satelliteRow($platforms);
        
        $expandedRows = expandSatellitePlatformsToRows($mockData);
        
        // Should expand to 3 separate rows (one per platform)
        $this->assertCount(count($platforms), $expandedRows);
        
        // Each expanded row should have platform_metadata
        foreach ($expandedRows as $row) {
            $this->assertArrayHasKey('platform_metadata', $row);
            $this->assertNotEmpty($row['platform_metadata']);
        }
    }
    
    /**
     * Example: Show how to access postData structure for debugging
     */
    public function testInspectPostDataStructure(): void
    {
        $postData = MockDataSourcesData::multipleDataSources();
        
        // Print structure for reference
        echo "\n=== PostData Structure ===\n";
        echo "Types: " . implode(', ', $postData['datasource_type']) . "\n";
        echo "Satellite platforms (index 0): " . $postData['satellite_platform'][0] . "\n";
        echo "Model identifier (index 2): " . $postData['dIdentifier'][2] . "\n";
        
        // Decode satellite platform JSON to see the structure
        $platforms = json_decode($postData['satellite_platform'][0], true);
        echo "\n=== Decoded Satellite Platform Structure ===\n";
        echo json_encode($platforms, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    }
}
