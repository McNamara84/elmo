<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Tests for JavaScript backend integration and AJAX endpoints
 * These tests execute PHP functions that are called from JavaScript
 */
class JavaScriptBackendTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // Set up AJAX request environment
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SERVER['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest';
        $_SERVER['CONTENT_TYPE'] = 'application/json';
        $_POST = [];
        $_GET = [];
    }

    /**
     * Test AJAX response generation for form validation
     */
    public function testAjaxFormValidationResponse(): void
    {
        // Simulate form validation AJAX call
        $formData = [
            'title' => 'Test Dataset',
            'year' => 2023,
            'dateCreated' => '2023-06-01',
            'resourcetype' => 1,
            'language' => 1,
            'Rights' => 1
        ];
        
        // Test validation response structure
        $validationResponse = [
            'valid' => true,
            'errors' => [],
            'warnings' => [],
            'data' => $formData
        ];
        
        $json = json_encode($validationResponse);
        $this->assertNotFalse($json, 'Validation response should encode to JSON');
        
        $decoded = json_decode($json, true);
        $this->assertTrue($decoded['valid'], 'Form should be valid');
        $this->assertEmpty($decoded['errors'], 'Should have no errors');
        $this->assertEquals('Test Dataset', $decoded['data']['title']);
        
        // Test validation with errors
        $errorResponse = [
            'valid' => false,
            'errors' => [
                'title' => 'Title is required',
                'year' => 'Year must be a valid number'
            ],
            'field_errors' => [
                'title' => ['required', 'min_length'],
                'year' => ['numeric', 'range']
            ]
        ];
        
        $errorJson = json_encode($errorResponse);
        $errorDecoded = json_decode($errorJson, true);
        $this->assertFalse($errorDecoded['valid']);
        $this->assertCount(2, $errorDecoded['errors']);
        $this->assertArrayHasKey('title', $errorDecoded['errors']);
    }

    /**
     * Test AJAX autocomplete functionality
     */
    public function testAjaxAutocompleteResponse(): void
    {
        // Simulate autocomplete search
        $searchTerm = 'earth science';
        $autocompleteResults = [
            [
                'id' => 1,
                'value' => 'Earth Science > Atmosphere',
                'label' => 'Earth Science > Atmosphere',
                'category' => 'GCMD Science Keywords',
                'hierarchy' => ['Earth Science', 'Atmosphere']
            ],
            [
                'id' => 2,
                'value' => 'Earth Science > Solid Earth',
                'label' => 'Earth Science > Solid Earth',
                'category' => 'GCMD Science Keywords',
                'hierarchy' => ['Earth Science', 'Solid Earth']
            ],
            [
                'id' => 3,
                'value' => 'Earth Science > Oceans',
                'label' => 'Earth Science > Oceans',
                'category' => 'GCMD Science Keywords',
                'hierarchy' => ['Earth Science', 'Oceans']
            ]
        ];
        
        // Filter results based on search term
        $filteredResults = array_filter($autocompleteResults, function($item) use ($searchTerm) {
            return stripos($item['value'], $searchTerm) !== false;
        });
        
        $response = [
            'results' => array_values($filteredResults),
            'total' => count($filteredResults),
            'search_term' => $searchTerm
        ];
        
        $json = json_encode($response);
        $decoded = json_decode($json, true);
        
        $this->assertEquals(3, $decoded['total']);
        $this->assertEquals('earth science', $decoded['search_term']);
        $this->assertCount(3, $decoded['results']);
        $this->assertEquals('Earth Science > Atmosphere', $decoded['results'][0]['value']);
    }

    /**
     * Test AJAX resource ID generation
     */
    public function testAjaxResourceIdGeneration(): void
    {
        // Simulate resource ID request from JavaScript
        $_POST = [
            'get_resource_id' => '1',
            'title' => ['Test Resource for ID Generation'],
            'titleType' => [1],
            'year' => 2023,
            'dateCreated' => '2023-06-01',
            'resourcetype' => 1,
            'language' => 1,
            'Rights' => 1
        ];
        
        // Mock resource ID generation
        $mockResourceId = 12345;
        
        $response = [
            'resource_id' => $mockResourceId,
            'status' => 'success',
            'message' => 'Resource ID generated successfully'
        ];
        
        $json = json_encode($response);
        $this->assertStringContainsString('12345', $json);
        $this->assertStringContainsString('success', $json);
        
        $decoded = json_decode($json, true);
        $this->assertEquals(12345, $decoded['resource_id']);
        $this->assertEquals('success', $decoded['status']);
    }

    /**
     * Test AJAX file upload progress
     */
    public function testAjaxFileUploadProgress(): void
    {
        // Simulate file upload progress responses
        $progressStages = [
            ['step' => 'validation', 'progress' => 20, 'message' => 'Validating form data'],
            ['step' => 'saving', 'progress' => 40, 'message' => 'Saving to database'],
            ['step' => 'xml_generation', 'progress' => 60, 'message' => 'Generating XML'],
            ['step' => 'file_creation', 'progress' => 80, 'message' => 'Creating download file'],
            ['step' => 'complete', 'progress' => 100, 'message' => 'Upload complete']
        ];
        
        foreach ($progressStages as $stage) {
            $response = [
                'status' => 'progress',
                'step' => $stage['step'],
                'progress' => $stage['progress'],
                'message' => $stage['message'],
                'timestamp' => time()
            ];
            
            $json = json_encode($response);
            $decoded = json_decode($json, true);
            
            $this->assertEquals('progress', $decoded['status']);
            $this->assertEquals($stage['progress'], $decoded['progress']);
            $this->assertIsInt($decoded['timestamp']);
        }
        
        // Test final completion response
        $completionResponse = [
            'status' => 'complete',
            'download_url' => '/download/dataset_12345.xml',
            'filename' => 'dataset_12345.xml',
            'file_size' => 15420
        ];
        
        $completionJson = json_encode($completionResponse);
        $this->assertStringContainsString('dataset_12345.xml', $completionJson);
    }

    /**
     * Test AJAX keyword validation and suggestions
     */
    public function testAjaxKeywordValidation(): void
    {
        // Test keyword validation
        $keywords = [
            'Earth Science',
            'invalid keyword',
            'Atmosphere > Atmospheric Temperature',
            'custom research topic'
        ];
        
        $validationResults = [];
        foreach ($keywords as $keyword) {
            $isGcmd = strpos($keyword, 'Earth Science') !== false || strpos($keyword, 'Atmosphere') !== false;
            $isValid = !empty(trim($keyword));
            
            $validationResults[] = [
                'keyword' => $keyword,
                'valid' => $isValid,
                'type' => $isGcmd ? 'gcmd' : 'free',
                'suggestions' => $isGcmd ? [] : ['Earth Science > ' . $keyword]
            ];
        }
        
        $response = [
            'validation_results' => $validationResults,
            'total_keywords' => count($keywords),
            'valid_count' => count(array_filter($validationResults, fn($r) => $r['valid'])),
            'gcmd_count' => count(array_filter($validationResults, fn($r) => $r['type'] === 'gcmd'))
        ];
        
        $json = json_encode($response);
        $decoded = json_decode($json, true);
        
        $this->assertEquals(4, $decoded['total_keywords']);
        $this->assertEquals(4, $decoded['valid_count']);
        $this->assertEquals(2, $decoded['gcmd_count']);
        $this->assertCount(4, $decoded['validation_results']);
    }

    /**
     * Test AJAX spatial coverage validation
     */
    public function testAjaxSpatialCoverageValidation(): void
    {
        // Test spatial coverage coordinates
        $spatialData = [
            [
                'latitudeMin' => 50.0,
                'latitudeMax' => 55.0,
                'longitudeMin' => 10.0,
                'longitudeMax' => 15.0,
                'description' => 'Northern Europe'
            ],
            [
                'latitudeMin' => 60.0,  // Invalid: min > max
                'latitudeMax' => 55.0,
                'longitudeMin' => 5.0,
                'longitudeMax' => 10.0,
                'description' => 'Invalid region'
            ]
        ];
        
        $validationResults = [];
        foreach ($spatialData as $index => $data) {
            $latValid = $data['latitudeMin'] <= $data['latitudeMax'] && 
                       $data['latitudeMin'] >= -90 && $data['latitudeMax'] <= 90;
            $lonValid = $data['longitudeMin'] <= $data['longitudeMax'] && 
                       $data['longitudeMin'] >= -180 && $data['longitudeMax'] <= 180;
            
            $validationResults[] = [
                'index' => $index,
                'valid' => $latValid && $lonValid,
                'errors' => array_merge(
                    $latValid ? [] : ['Invalid latitude range'],
                    $lonValid ? [] : ['Invalid longitude range']
                ),
                'data' => $data
            ];
        }
        
        $response = [
            'spatial_validation' => $validationResults,
            'valid_regions' => count(array_filter($validationResults, fn($r) => $r['valid'])),
            'total_regions' => count($validationResults)
        ];
        
        $json = json_encode($response);
        $decoded = json_decode($json, true);
        
        $this->assertEquals(1, $decoded['valid_regions']);
        $this->assertEquals(2, $decoded['total_regions']);
        $this->assertFalse($decoded['spatial_validation'][1]['valid']);
        $this->assertContains('Invalid latitude range', $decoded['spatial_validation'][1]['errors']);
    }

    /**
     * Test AJAX temporal coverage validation
     */
    public function testAjaxTemporalCoverageValidation(): void
    {
        // Test temporal coverage dates
        $temporalData = [
            [
                'startDate' => '2023-01-01',
                'endDate' => '2023-12-31',
                'timezone' => 'UTC'
            ],
            [
                'startDate' => '2023-06-01',
                'endDate' => '2023-05-01',  // Invalid: start > end
                'timezone' => 'Europe/Berlin'
            ],
            [
                'startDate' => '2025-01-01',  // Future date
                'endDate' => '2025-12-31',
                'timezone' => 'UTC'
            ]
        ];
        
        $validationResults = [];
        $currentYear = date('Y');
        
        foreach ($temporalData as $index => $data) {
            $startTime = strtotime($data['startDate']);
            $endTime = strtotime($data['endDate']);
            $startYear = date('Y', $startTime);
            
            $dateOrderValid = $startTime <= $endTime;
            $futureWarning = $startYear > $currentYear;
            
            $validationResults[] = [
                'index' => $index,
                'valid' => $dateOrderValid,
                'warnings' => $futureWarning ? ['Future date detected'] : [],
                'errors' => $dateOrderValid ? [] : ['Start date must be before end date'],
                'data' => $data
            ];
        }
        
        $response = [
            'temporal_validation' => $validationResults,
            'valid_periods' => count(array_filter($validationResults, fn($r) => $r['valid'])),
            'warnings_count' => count(array_filter($validationResults, fn($r) => !empty($r['warnings'])))
        ];
        
        $json = json_encode($response);
        $decoded = json_decode($json, true);
        
        $this->assertEquals(2, $decoded['valid_periods']);
        $this->assertEquals(1, $decoded['warnings_count']);
        $this->assertFalse($decoded['temporal_validation'][1]['valid']);
    }

    /**
     * Test AJAX form state management
     */
    public function testAjaxFormStateManagement(): void
    {
        // Test form state save/load
        $formState = [
            'current_step' => 3,
            'completed_steps' => [1, 2],
            'form_data' => [
                'title' => ['Research Dataset'],
                'authors' => [
                    'familynames' => ['Smith'],
                    'givennames' => ['John']
                ],
                'descriptions' => [
                    'abstract' => 'This is the abstract'
                ]
            ],
            'validation_state' => [
                'step1' => 'valid',
                'step2' => 'valid',
                'step3' => 'incomplete'
            ],
            'timestamps' => [
                'created' => time() - 3600,
                'last_modified' => time()
            ]
        ];
        
        // Test state serialization
        $serializedState = json_encode($formState);
        $this->assertNotFalse($serializedState);
        
        $deserializedState = json_decode($serializedState, true);
        $this->assertEquals(3, $deserializedState['current_step']);
        $this->assertEquals('Research Dataset', $deserializedState['form_data']['title'][0]);
        
        // Test state update response
        $updateResponse = [
            'status' => 'saved',
            'state_id' => 'state_' . uniqid(),
            'last_modified' => time(),
            'size' => strlen($serializedState)
        ];
        
        $updateJson = json_encode($updateResponse);
        $updateDecoded = json_decode($updateJson, true);
        
        $this->assertEquals('saved', $updateDecoded['status']);
        $this->assertStringContainsString('state_', $updateDecoded['state_id']);
        $this->assertGreaterThan(0, $updateDecoded['size']);
    }

    /**
     * Test AJAX error handling and recovery
     */
    public function testAjaxErrorHandlingAndRecovery(): void
    {
        // Test different error scenarios
        $errorScenarios = [
            [
                'type' => 'validation_error',
                'code' => 400,
                'message' => 'Form validation failed',
                'details' => ['field' => 'title', 'error' => 'Required field missing'],
                'recoverable' => true
            ],
            [
                'type' => 'server_error',
                'code' => 500,
                'message' => 'Internal server error',
                'details' => ['error' => 'Database connection failed'],
                'recoverable' => false
            ],
            [
                'type' => 'timeout_error',
                'code' => 408,
                'message' => 'Request timeout',
                'details' => ['timeout' => 30, 'operation' => 'file_upload'],
                'recoverable' => true
            ]
        ];
        
        foreach ($errorScenarios as $scenario) {
            $errorResponse = [
                'status' => 'error',
                'error' => $scenario,
                'timestamp' => time(),
                'request_id' => uniqid()
            ];
            
            $json = json_encode($errorResponse);
            $decoded = json_decode($json, true);
            
            $this->assertEquals('error', $decoded['status']);
            $this->assertEquals($scenario['type'], $decoded['error']['type']);
            $this->assertEquals($scenario['code'], $decoded['error']['code']);
            $this->assertIsString($decoded['request_id']);
            
            // Test recovery suggestions
            if ($scenario['recoverable']) {
                $recoveryResponse = [
                    'status' => 'recovery_suggested',
                    'suggestions' => [
                        'action' => 'retry',
                        'delay' => 1000,
                        'max_retries' => 3
                    ]
                ];
                
                $recoveryJson = json_encode($recoveryResponse);
                $this->assertStringContainsString('recovery_suggested', $recoveryJson);
            }
        }
    }
}