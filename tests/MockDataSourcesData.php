<?php
namespace Tests;

/**
 * MockDataSourcesData - Generate realistic mock postData for Data Sources form
 * 
 * This helper generates postData structures matching what the GGMsDataSources form sends.
 * 
 * Key understanding:
 * - satellite_platform[] is a Tagify field that sends JSON-serialized array of tag objects
 * - Each tag object has: value, id, scheme, schemeURI, language
 * - All other fields are simple POST arrays indexed 0..N
 * - Type determines which fields are populated:
 *   - S (Satellite): type, satellite_platform, description
 *   - G (Ground): type, datasource_details, description
 *   - A (Altimetry): type, datasource_details, description
 *   - T (Terrain): type, datasource_details, compensation_depth, description
 *   - M (Model): type, datasource_details, dIdentifier, dIdentifierType, dName, description
 */
class MockDataSourcesData
{
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
                'value' => "Space-based Platforms > {$name}",  // Full path from jsTree
                'id' => 'gcmd_' . strtolower(str_replace('-', '_', $name)),
                'scheme' => 'GCMD Platforms',
                'schemeURI' => 'https://gcmd.earthdata.nasa.gov/',
                'language' => 'en'
            ];
        }
        
        return [
            'type' => 'S',
            'satellite_platform' => json_encode($platforms),  // JSON-encoded array of tag objects
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
            'datasource_details' => 'Terrestrial',
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
            'dIdentifier' => '10.5880/icgem.2024.001',  // Example DOI
            'dIdentifierType' => $identifierType,
            'dName' => 'ICGEM_Global_Model_2024',
            'description' => 'Reference gravity model from ICGEM',
            'satellite_platform' => '',
            'compensation_depth' => ''
        ];
    }
    
    /**
     * Generate complete postData for multiple data sources (mixed types)
     * 
     * Example with 3 data sources: Satellite, Ground, Model
     * 
     * @return array Complete postData with all field arrays
     */
    public static function multipleDataSources(): array
    {
        $rows = [
            self::satelliteRow(['GRACE', 'GRACE-FO', 'GOCE']),
            self::groundRow(),
            self::modelRow('DOI')
        ];
        
        // Convert rows to indexed POST arrays
        return self::rowsToPostData($rows);
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
            $postData['datasource_details'][] = $row['details'] ?? '';
            $postData['compensation_depth'][] = $row['compensation_depth'] ?? '';
            $postData['satellite_platform'][] = $row['satellite_platform'] ?? '';
            $postData['dIdentifier'][] = $row['identifier'] ?? '';
            $postData['dIdentifierType'][] = $row['identifier_type'] ?? '';
            $postData['dName'][] = $row['model_name'] ?? '';
            $postData['datasource_description'][] = $row['description'] ?? '';
        }
        
        return $postData;
    }
}
