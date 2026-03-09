<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\MockObject\MockObject;

/**
 * Unit tests for ICGEMController
 * 
 * Part 1: GET* functions - Mock database responses and verify data fetching/transformation
 * These tests use reflection to instantiate the controller without triggering the global $connection
 */
final class ICGEMControllerTest extends TestCase
{
    private \ICGEMController $controller;
    private MockObject $mockConnection;

    protected function setUp(): void
    {
        // Load controller classes
        require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
        require_once __DIR__ . '/../api/v2/controllers/ICGEMController.php';

        // Create mock connection
        $this->mockConnection = $this->createMock(\mysqli::class);

        // Create controller instance without calling constructor
        $reflection = new \ReflectionClass(\ICGEMController::class);
        $this->controller = $reflection->newInstanceWithoutConstructor();

        // Set the mock connection directly via reflection
        $connectionProperty = $reflection->getParentClass()->getProperty('connection');
        $connectionProperty->setAccessible(true);
        $connectionProperty->setValue($this->controller, $this->mockConnection);
    }

    // ============================================
    // PART 1: GET* FUNCTIONS TESTS
    // ============================================

    /**
     * Test getGGMData returns complete GGM data array
     */
    public function testGetGGMDataReturnsCompleteGGMData(): void
    {
        $resourceId = 1;
        $expectedData = [
            'publication_year' => '2024',
            'model_type_name' => 'Static',
            'mathematical_representation_name' => 'Spherical Harmonics',
            'file_format_name' => 'binary',
            'model_name' => 'EIGEN-6S',
            'celestial_body' => 'Earth',
            'product_type' => 'gravity_field',
            'errors' => 'formal errors',
            'error_handling_approach' => 'covariance matrices',
            'tide_system' => 'tide-free',
            'degree' => '2190',
            'radius' => '6378137',
            'earth_gravity_constant' => '398600.4418'
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_assoc')
            ->willReturn($expectedData);

        $mockStmt->expects($this->once())
            ->method('close');

        $result = $this->controller->getGGMData($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertEquals('EIGEN-6S', $result['model_name']);
        $this->assertEquals('2024', $result['publication_year']);
        $this->assertEquals('Static', $result['model_type_name']);
        $this->assertEquals('2190', $result['degree']);
        $this->assertCount(13, $result);
    }

    /**
     * Test getGGMData filters out null values
     */
    public function testGetGGMDataFiltersOutNullValues(): void
    {
        $resourceId = 1;
        // Database returns some null values
        $dbData = [
            'publication_year' => '2024',
            'model_type_name' => 'Static',
            'mathematical_representation_name' => null,
            'file_format_name' => 'binary',
            'model_name' => 'EIGEN-6S',
            'celestial_body' => null,
            'product_type' => 'gravity_field',
            'errors' => null,
            'error_handling_approach' => null,
            'tide_system' => 'tide-free',
            'degree' => null,
            'radius' => '6378137',
            'earth_gravity_constant' => '398600.4418'
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_assoc')
            ->willReturn($dbData);

        $mockStmt->expects($this->once())
            ->method('close');

        $result = $this->controller->getGGMData($this->mockConnection, $resourceId);

        // Should contain only non-null values
        $this->assertIsArray($result);
        $this->assertArrayHasKey('model_name', $result);
        $this->assertArrayHasKey('publication_year', $result);
        $this->assertArrayHasKey('tide_system', $result);
        $this->assertArrayNotHasKey('mathematical_representation_name', $result);
        $this->assertArrayNotHasKey('celestial_body', $result);
        $this->assertArrayNotHasKey('errors', $result);
        $this->assertCount(7, $result);
    }

    /**
     * Test getGGMData returns null when no data found
     */
    public function testGetGGMDataReturnsNullWhenNoDataFound(): void
    {
        $resourceId = 999;

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_assoc')
            ->willReturn(null);

        $mockStmt->expects($this->once())
            ->method('close');

        $result = $this->controller->getGGMData($this->mockConnection, $resourceId);

        $this->assertNull($result);
    }

    /**
     * Test getDataSources returns array of data sources
     */
    public function testGetDataSourcesReturnsArrayOfDataSources(): void
    {
        $resourceId = 1;
        $expectedDataSources = [
            [
                'data_source_id' => 1,
                'type' => 'S',
                'description' => 'GRACE satellite data',
                'details' => null,
                'S_value_name' => 'GRACE',
                'S_value_uri' => 'https://grace.nasa.gov',
                'S_scheme_name' => 'NASA',
                'S_scheme_uri' => 'https://nasa.gov',
                'T_Isostasy_compensation_depth' => null,
                'M_identifier' => null,
                'M_identifier_type' => null,
                'M_name' => null
            ],
            [
                'data_source_id' => 2,
                'type' => 'G',
                'description' => 'Ground gravity measurements',
                'details' => 'Terrestrial gravity data',
                'S_value_name' => null,
                'S_value_uri' => null,
                'S_scheme_name' => null,
                'S_scheme_uri' => null,
                'T_Isostasy_compensation_depth' => null,
                'M_identifier' => null,
                'M_identifier_type' => null,
                'M_name' => null
            ]
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->any())
            ->method('fetch_assoc')
            ->willReturnOnConsecutiveCalls(
                $expectedDataSources[0],
                $expectedDataSources[1],
                null
            );

        $result = $this->controller->getDataSources($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertCount(2, $result);
        $this->assertEquals('S', $result[0]['type']);
        $this->assertEquals('GRACE', $result[0]['S_value_name']);
        $this->assertEquals('G', $result[1]['type']);
        $this->assertEquals('Terrestrial gravity data', $result[1]['details']);
    }

    /**
     * Test getDataSources returns empty array when no sources found
     */
    public function testGetDataSourcesReturnsEmptyArrayWhenNoSourcesFound(): void
    {
        $resourceId = 999;

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_assoc')
            ->willReturn(null);

        $result = $this->controller->getDataSources($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    /**
     * Test getTopographicModelProperties returns array of properties
     */
    public function testGetTopographicModelPropertiesReturnsPropertiesArray(): void
    {
        $resourceId = 1;
        $expectedProperties = [
            [
                'layer_approach' => 'constant density',
                'forward_modelling_domain' => 'space',
                'density_information' => 'Density-model',
                'density_information_details' => 'CRUST 1.0',
                'mantle_density_information' => 'Density-model',
                'mantle_density_information_details' => 'Mantle reference model',
                'crust_density_information' => 'Density-model',
                'crust_density_information_details' => 'Crustal structure',
                'approximation' => 'Point-mass'
            ]
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_all')
            ->with(\MYSQLI_ASSOC)
            ->willReturn($expectedProperties);

        $result = $this->controller->getTopographicModelProperties($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        $this->assertEquals('constant density', $result[0]['layer_approach']);
        $this->assertEquals('Point-mass', $result[0]['approximation']);
    }

    /**
     * Test getTemporalModelProperties returns array of properties
     */
    public function testGetTemporalModelPropertiesReturnsPropertiesArray(): void
    {
        $resourceId = 1;
        $expectedProperties = [
            [
                'generating_institution' => 'GFZ Potsdam',
                'temporal_resolution_days' => '30',
                'start_date' => '2002-01-01',
                'end_date' => '2023-12-31',
                'release' => 'Release 01'
            ]
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_all')
            ->with(\MYSQLI_ASSOC)
            ->willReturn($expectedProperties);

        $result = $this->controller->getTemporalModelProperties($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        $this->assertEquals('GFZ Potsdam', $result[0]['generating_institution']);
        $this->assertEquals('2002-01-01', $result[0]['start_date']);
    }

    /**
     * Test getStaticModelProperties returns array of properties
     */
    public function testGetStaticModelPropertiesReturnsPropertiesArray(): void
    {
        $resourceId = 1;
        $expectedProperties = [
            [
                'info_time_variable_coefficients' => 'Time-dependent gravity field model'
            ]
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_all')
            ->with(\MYSQLI_ASSOC)
            ->willReturn($expectedProperties);

        $result = $this->controller->getStaticModelProperties($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        $this->assertEquals('Time-dependent gravity field model', $result[0]['info_time_variable_coefficients']);
    }

    /**
     * Test getEllipsoidalParameters returns array of parameters
     */
    public function testGetEllipsoidalParametersReturnsParametersArray(): void
    {
        $resourceId = 1;
        $expectedParameters = [
            [
                'semimajor_axis_a' => '6378137.0',
                'semiminor_axis_b' => '6356752.314245',
                'flattening' => '0.00335281066474748',
                'reciprocal_flattening' => '298.257223563',
                'description' => 'WGS84',
                'excentricity' => '0.0818191908426'
            ]
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_all')
            ->with(\MYSQLI_ASSOC)
            ->willReturn($expectedParameters);

        $result = $this->controller->getEllipsoidalParameters($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        $this->assertEquals('6378137.0', $result[0]['semimajor_axis_a']);
        $this->assertEquals('WGS84', $result[0]['description']);
    }

    /**
     * Test getEllipsoidalParameters returns empty array when no parameters found
     */
    public function testGetEllipsoidalParametersReturnsEmptyArrayWhenNotFound(): void
    {
        $resourceId = 999;

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->once())
            ->method('fetch_all')
            ->with(\MYSQLI_ASSOC)
            ->willReturn([]);

        $result = $this->controller->getEllipsoidalParameters($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    /**
     * Test getTopographicModelProperties returns empty array on database error
     */
    public function testGetTopographicModelPropertiesReturnsEmptyArrayOnPrepareError(): void
    {
        $resourceId = 1;

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn(false);

        $result = $this->controller->getTopographicModelProperties($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    /**
     * Test getTemporalModelProperties returns empty array on database error
     */
    public function testGetTemporalModelPropertiesReturnsEmptyArrayOnPrepareError(): void
    {
        $resourceId = 1;

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn(false);

        $result = $this->controller->getTemporalModelProperties($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    /**
     * Test getStaticModelProperties returns empty array on database error
     */
    public function testGetStaticModelPropertiesReturnsEmptyArrayOnPrepareError(): void
    {
        $resourceId = 1;

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn(false);

        $result = $this->controller->getStaticModelProperties($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    /**
     * Test getDataSources returns empty array on database error
     */
    public function testGetDataSourcesReturnsEmptyArrayOnPrepareError(): void
    {
        $resourceId = 1;

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn(false);

        $result = $this->controller->getDataSources($this->mockConnection, $resourceId);

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    /**
     * Test getGGMData returns null on database error
     */
    public function testGetGGMDataReturnsNullOnPrepareError(): void
    {
        $resourceId = 1;

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn(false);

        $result = $this->controller->getGGMData($this->mockConnection, $resourceId);

        $this->assertNull($result);
    }

    // ============================================
    // PART 2: INSERT* FUNCTIONS TESTS
    // ============================================

    /**
     * Test insertSphericalHarmonicModelProperties adds all properties to XML
     */
    public function testInsertSphericalHarmonicModelPropertiesAddsAllProperties(): void
    {
        $ggmData = [
            'model_name' => 'EIGEN-6S',
            'publication_year' => '2024',
            'model_type_name' => 'Static',
            'mathematical_representation_name' => 'Spherical Harmonics',
            'product_type' => 'gravity_field',
            'file_format_name' => 'binary',
            'tide_system' => 'tide-free',
            'degree' => '2190',
            'radius' => '6378137',
            'earth_gravity_constant' => '398600.4418'
        ];

        // Create XML element with ICGEM namespace
        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        // Call the insert method using reflection since it's protected
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertSphericalHarmonicModelProperties');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $ggmData);

        // Verify XML structure
        $this->assertNotNull($xml->children('http://icgem.gfz.de/schema')->modelName);
        $this->assertEquals('EIGEN-6S', (string)$xml->children('http://icgem.gfz.de/schema')->modelName);
        
        $this->assertNotNull($xml->children('http://icgem.gfz.de/schema')->publicationYear);
        $this->assertEquals('2024', (string)$xml->children('http://icgem.gfz.de/schema')->publicationYear);
        
        $this->assertNotNull($xml->children('http://icgem.gfz.de/schema')->modelType);
        $this->assertEquals('Static', (string)$xml->children('http://icgem.gfz.de/schema')->modelType);
        
        $this->assertNotNull($xml->children('http://icgem.gfz.de/schema')->degreeOrderMax);
        $this->assertEquals('2190', (string)$xml->children('http://icgem.gfz.de/schema')->degreeOrderMax);
        
        $this->assertNotNull($xml->children('http://icgem.gfz.de/schema')->tideSystem);
        $this->assertEquals('Tide-free', (string)$xml->children('http://icgem.gfz.de/schema')->tideSystem);
    }

    /**
     * Test insertSphericalHarmonicModelProperties with null data
     */
    public function testInsertSphericalHarmonicModelPropertiesWithNullData(): void
    {
        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        // Call with null data
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertSphericalHarmonicModelProperties');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, null);

        // XML should have no children added
        $children = $xml->children('http://icgem.gfz.de/schema');
        $this->assertCount(0, $children);
    }

    /**
     * Test insertSphericalHarmonicModelProperties with empty values
     */
    public function testInsertSphericalHarmonicModelPropertiesSkipsEmptyValues(): void
    {
        $ggmData = [
            'model_name' => 'EIGEN-6S',
            'model_type_name' => '',  // Empty value
            'publication_year' => null,  // Null value
            'degree' => '2190'
        ];

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertSphericalHarmonicModelProperties');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $ggmData);

        // Should only have modelName and degree (not empty/null ones)
        $children = $xml->children('http://icgem.gfz.de/schema');
        $this->assertNotNull($children->modelName);
        $this->assertNull($children->modelType);  // Should not be added
        $this->assertNotNull($children->degreeOrderMax);
    }

    /**
     * Test insertErrors adds errors element with type and handling
     */
    public function testInsertErrorsAddsErrorsElement(): void
    {
        $ggmData = [
            'errors' => 'formal errors',
            'error_handling_approach' => 'covariance matrices'
        ];

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertErrors');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $ggmData);

        // Verify errors element and children
        $children = $xml->children('http://icgem.gfz.de/schema');
        $this->assertNotNull($children->errors);
        
        $errorsElement = $children->errors;
        $errorChildren = $errorsElement->children('http://icgem.gfz.de/schema');
        $this->assertEquals('Formal errors', (string)$errorChildren->errorType);
        $this->assertEquals('Covariance matrices', (string)$errorChildren->errorHandling);
    }

    /**
     * Test insertErrors skips when no error data
     */
    public function testInsertErrorsSkipsWhenNoErrorData(): void
    {
        $ggmData = [
            'errors' => '',
            'error_handling_approach' => 'covariance matrices'
        ];

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertErrors');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $ggmData);

        // Should not add errors element if errors field is empty
        $children = $xml->children('http://icgem.gfz.de/schema');
        $this->assertNull($children->errors);
    }

    /**
     * Test insertInputDataSources creates elements for each source
     */
    public function testInsertInputDataSourcesCreatesSourceElements(): void
    {
        $dataSources = [
            [
                'type' => 'S',
                'description' => 'GRACE satellite data',
                'S_value_name' => 'GRACE',
                'S_value_uri' => 'https://grace.nasa.gov',
                'S_scheme_name' => 'NASA',
                'S_scheme_uri' => null,
                'T_Isostasy_compensation_depth' => null,
                'M_identifier' => null,
                'M_identifier_type' => null,
                'M_name' => null,
                'details' => null
            ],
            [
                'type' => 'G',
                'description' => 'Ground gravity',
                'details' => 'Terrestrial data',
                'S_value_name' => null,
                'S_value_uri' => null,
                'S_scheme_name' => null,
                'S_scheme_uri' => null,
                'T_Isostasy_compensation_depth' => null,
                'M_identifier' => null,
                'M_identifier_type' => null,
                'M_name' => null
            ]
        ];

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:globalGravityProduct xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertInputDataSources');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $dataSources);

        // Verify data source elements
        $children = $xml->children('http://icgem.gfz.de/schema');
        $sources = $children->inputDataSource;
        
        $this->assertCount(2, $sources);
        
        // First source (Satellite)
        $sourceChildren = $sources[0]->children('http://icgem.gfz.de/schema');
        $this->assertEquals('Satellite', (string)$sourceChildren->inputDataSourceType);
        $this->assertEquals('GRACE satellite data', (string)$sourceChildren->description);
        $this->assertEquals('GRACE', (string)$sourceChildren->satelliteValueName);
        
        // Second source (Ground data)
        $sourceChildren = $sources[1]->children('http://icgem.gfz.de/schema');
        $this->assertEquals('Ground data', (string)$sourceChildren->inputDataSourceType);
        $this->assertEquals('Ground gravity', (string)$sourceChildren->description);
    }

    /**
     * Test insertInputDataSources with empty array
     */
    public function testInsertInputDataSourcesWithEmptyArray(): void
    {
        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:globalGravityProduct xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertInputDataSources');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, []);

        // Should not add any elements
        $children = $xml->children('http://icgem.gfz.de/schema');
        $this->assertNull($children->inputDataSource);
    }

    /**
     * Test insertTopographicModelPropertiesIcgem adds properties with density information
     */
    public function testInsertTopographicModelPropertiesIcgemAddsProperties(): void
    {
        $properties = [
            [
                'layer_approach' => 'point masses',
                'forward_modelling_domain' => 'space',
                'density_information' => 'Density-model',
                'density_information_details' => 'CRUST 1.0',
                'mantle_density_information' => 'Density-model',
                'mantle_density_information_details' => 'Reference model',
                'crust_density_information' => 'Density-model',
                'crust_density_information_details' => 'Crustal data',
                'approximation' => 'Point-mass'
            ]
        ];

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertTopographicModelPropertiesIcgem');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $properties);

        // Verify structure
        $children = $xml->children('http://icgem.gfz.de/schema');
        $tmpElements = $children->topographicModelProperties;
        
        $this->assertCount(1, $tmpElements);
        
        $tmpChildren = $tmpElements[0]->children('http://icgem.gfz.de/schema');
        $this->assertEquals('Point masses', (string)$tmpChildren->layerApproach);
        $this->assertEquals('Space', (string)$tmpChildren->forwardModellingDomain);
        $this->assertEquals('Point-mass', (string)$tmpChildren->approximation);
        
        // Check density information elements
        $densityElements = $tmpChildren->densityInformation;
        $this->assertCount(3, $densityElements);  // Whole, Mantle, Crust
    }

    /**
     * Test insertTemporalModelPropertiesIcgem adds temporal properties
     */
    public function testInsertTemporalModelPropertiesIcgemAddsProperties(): void
    {
        $properties = [
            [
                'generating_institution' => 'GFZ Potsdam',
                'temporal_resolution_days' => '30',
                'start_date' => '2002-01-01',
                'end_date' => '2023-12-31',
                'release' => 'Release 01'
            ]
        ];

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertTemporalModelPropertiesIcgem');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $properties);

        // Verify structure
        $children = $xml->children('http://icgem.gfz.de/schema');
        $tmpElements = $children->temporalModelProperties;
        
        $this->assertCount(1, $tmpElements);
        
        $tmpChildren = $tmpElements[0]->children('http://icgem.gfz.de/schema');
        $this->assertEquals('2002-01-01', (string)$tmpChildren->startDate);
        $this->assertEquals('2023-12-31', (string)$tmpChildren->stopDate);
        $this->assertEquals('GFZ Potsdam', (string)$tmpChildren->generatingInstitution);
        $this->assertEquals('Release 01', (string)$tmpChildren->release);
    }

    /**
     * Test insertStaticModelPropertiesIcgem adds static properties
     */
    public function testInsertStaticModelPropertiesIcgemAddsProperties(): void
    {
        $properties = [
            [
                'info_time_variable_coefficients' => 'Time-dependent gravity field'
            ]
        ];

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertStaticModelPropertiesIcgem');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $properties);

        // Verify structure
        $children = $xml->children('http://icgem.gfz.de/schema');
        $smpElements = $children->staticModelProperties;
        
        $this->assertCount(1, $smpElements);
        
        $smpChildren = $smpElements[0]->children('http://icgem.gfz.de/schema');
        $this->assertEquals('Time-dependent gravity field', (string)$smpChildren->infoTimeVariableCoefficients);
    }

    /**
     * Test insertEllipsoidalParametersIcgem adds parameters
     */
    public function testInsertEllipsoidalParametersIcgemAddsParameters(): void
    {
        $parameters = [
            [
                'semimajor_axis_a' => '6378137.0',
                'semiminor_axis_b' => '6356752.314245',
                'flattening' => '0.00335281066474748',
                'reciprocal_flattening' => '298.257223563',
                'description' => 'WGS84',
                'excentricity' => '0.0818191908426'
            ]
        ];

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertEllipsoidalParametersIcgem');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $parameters);

        // Verify structure
        $children = $xml->children('http://icgem.gfz.de/schema');
        $epElement = $children->ellipsoidalParameters;
        
        $this->assertNotNull($epElement);
        
        $epChildren = $epElement->children('http://icgem.gfz.de/schema');
        $this->assertEquals('6378137.0', (string)$epChildren->semimajorAxisA);
        $this->assertEquals('6356752.314245', (string)$epChildren->semiminorAxisB);
        $this->assertEquals('0.00335281066474748', (string)$epChildren->flattening);
        $this->assertEquals('298.257223563', (string)$epChildren->reciprocalFlattening);
    }

    /**
     * Test insertEllipsoidalParametersIcgem with empty array
     */
    public function testInsertEllipsoidalParametersIcgemWithEmptyArray(): void
    {
        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:gravityFieldModel xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertEllipsoidalParametersIcgem');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, []);

        // Should not add ellipsoidal parameters element
        $children = $xml->children('http://icgem.gfz.de/schema');
        $this->assertNull($children->ellipsoidalParameters);
    }

    /**
     * Test insertDescriptions adds descriptions with validated types
     */
    public function testInsertDescriptionsAddsValidDescriptions(): void
    {
        $resourceId = 1;
        $descriptions = [
            ['type' => 'Abstract', 'description' => 'This is an abstract'],
            ['type' => 'General model description', 'description' => 'Model description'],
            ['type' => 'Input data', 'description' => 'Input data description'],
            ['type' => 'Methods', 'description' => 'Invalid type - should be skipped'],
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->any())
            ->method('fetch_assoc')
            ->willReturnOnConsecutiveCalls(
                $descriptions[0],
                $descriptions[1],
                $descriptions[2],
                $descriptions[3],
                null
            );

        $mockStmt->expects($this->once())
            ->method('close');

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:globalGravityProduct xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );

        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $resourceId);

        // Verify descriptions were added (only valid types)
        $this->assertNotNull($xml->descriptions);
        $descElements = $xml->descriptions->description;
        
        // Should have at least 3 valid descriptions (Abstract, General model description, Input data)
        $this->assertGreaterThanOrEqual(3, count($descElements));
    }

    /**
     * Test insertDescriptions with no valid descriptions
     */
    public function testInsertDescriptionsWithNoValidTypes(): void
    {
        $resourceId = 1;
        $descriptions = [
            ['type' => 'Methods', 'description' => 'Invalid type'],
            ['type' => 'TechnicalInfo', 'description' => 'Also invalid'],
        ];

        $mockStmt = $this->createMock(\mysqli_stmt::class);
        $mockResult = $this->createMock(\mysqli_result::class);

        $this->mockConnection->expects($this->once())
            ->method('prepare')
            ->willReturn($mockStmt);

        $mockStmt->expects($this->once())
            ->method('bind_param')
            ->with('i', $resourceId);

        $mockStmt->expects($this->once())
            ->method('execute')
            ->willReturn(true);

        $mockStmt->expects($this->once())
            ->method('get_result')
            ->willReturn($mockResult);

        $mockResult->expects($this->any())
            ->method('fetch_assoc')
            ->willReturnOnConsecutiveCalls(
                $descriptions[0],
                $descriptions[1],
                null
            );

        $mockStmt->expects($this->once())
            ->method('close');

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:globalGravityProduct xmlns:icgv="http://icgem.gfz.de/schema"/>'
        );
        // Workaround to call a protected method
        $reflection = new \ReflectionClass($this->controller);
        $method = $reflection->getMethod('insertDescriptions');
        $method->setAccessible(true);
        $method->invoke($this->controller, $xml, $resourceId);

        // Should have descriptions element but no child elements (all invalid types filtered out)
        $this->assertNotNull($xml->descriptions);
        $descElements = $xml->descriptions->description;
        $this->assertCount(0, $descElements);
    }
}
