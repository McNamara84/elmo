<?php
/**
 * Save Data Sources for GGM
 * 
 * Handles multiple data source rows with type-specific field validation.
 * Each row type (S/G/A/T/M) determines which fields must be filled and which must be NULL.
 * 
 * Type-specific rules:
 * - Type S (Satellite): requires S_value_name, S_value_uri, S_scheme_name, S_scheme_uri
 * - Type G (Gravity): requires G_details
 * - Type A (Altimetry): requires A_details
 * - Type T (Topography): requires T_details, T_Isostasy_compensation_depth
 * - Type M (Model): requires M_details, M_identifier, M_identifier_type
 * 
 * All other type-specific fields must be NULL for each row.
 * 
 * Uses shared keyword management functions from save_thesauruskeywords.php
 */

require_once __DIR__ . '/save_thesauruskeywords.php';
require_once __DIR__ . '/save_relatedwork.php';

/**
 * Extracts individual data source rows from POST arrays
 * 
 * @param array $postData Raw POST data with array fields
 * @return array Array of individual data source row objects, indexed 0..N
 */
function extractDataSourceRows(array $postData): array
{
    $rows = [];
    
    // Get the count of rows (all arrays should have same length)
    $types = $postData['datasource_type'] ?? [];
    $count = count($types);
    
    if ($count === 0) {
        return $rows;
    }
    
    // Extract corresponding values from each array by index
    $details = $postData['datasource_details'] ?? array_fill(0, $count, '');
    $compensationDepths = $postData['compensation_depth'] ?? array_fill(0, $count, '');
    $platforms = $postData['satellite_platform'] ?? array_fill(0, $count, '');
    $identifiers = $postData['dIdentifier'] ?? array_fill(0, $count, '');
    $identifierTypes = $postData['dIdentifierType'] ?? array_fill(0, $count, '');
    $modelNames = $postData['dName'] ?? array_fill(0, $count, '');
    $descriptions = $postData['datasource_description'] ?? array_fill(0, $count, '');
    
    // Build row objects
    for ($i = 0; $i < $count; $i++) {
        $rows[] = [
            'type' => $types[$i] ?? null,
            'details' => $details[$i] ?? '',
            'compensation_depth' => $compensationDepths[$i] ?? '',
            'satellite_platform' => $platforms[$i] ?? '',
            'identifier' => $identifiers[$i] ?? '',
            'identifier_type' => $identifierTypes[$i] ?? '',
            'model_name' => $modelNames[$i] ?? '',
            'description' => $descriptions[$i] ?? '',
        ];
    }
    
    return $rows;
}

/**
 * Validates a single data source row based on its type.
 * Each type must have ONLY its specific fields filled, all others must be NULL.
 * 
 * @param array $row Single data source row
 * @return array ['valid' => bool, 'errors' => array of error messages]
 */
function validateDataSourceRow(array $row): array
{
    $errors = [];
    $type = trim($row['type'] ?? '');
    
    // Basic validation: type must exist and be recognized
    if (empty($type)) {
        return ['valid' => false, 'errors' => ['Data source type is required']];
    }
    
    $allowedTypes = ['S', 'G', 'A', 'T', 'M'];
    if (!in_array($type, $allowedTypes, true)) {
        return ['valid' => false, 'errors' => ["Invalid data source type: {$type}"]];
    }
    
    // Define what each type requires and what must be empty
    $typeRules = [
        'S' => [
            'required' => ['satellite_platform'],
            'mustBeEmpty' => ['details', 'compensation_depth', 'identifier', 'identifier_type', 'model_name']
        ],
        'G' => [
            'required' => [],
            'mustBeEmpty' => ['satellite_platform', 'compensation_depth', 'identifier', 'identifier_type', 'model_name']
        ],
        'A' => [
            'required' => [],
            'mustBeEmpty' => ['satellite_platform', 'compensation_depth', 'identifier', 'identifier_type', 'model_name']
        ],
        'T' => [
            'required' => [],
            'mustBeEmpty' => ['satellite_platform', 'identifier', 'identifier_type', 'model_name']
            // Note: compensation_depth is optional for T
        ],
        'M' => [
            'required' => ['model_name'],
            'mustBeEmpty' => ['satellite_platform', 'compensation_depth']
        ]
    ];
    
    $rules = $typeRules[$type];
    
    // Check required fields are not empty
    foreach ($rules['required'] as $field) {
        if (empty(trim($row[$field] ?? ''))) {
            $errors[] = ucfirst($field) . " is required for type {$type}";
        }
    }
    
    // Check forbidden fields ARE empty
    foreach ($rules['mustBeEmpty'] as $field) {
        if (!empty(trim($row[$field] ?? ''))) {
            $errors[] = "For type {$type}, field {$field} must be empty (got: {$row[$field]})";
        }
    }
    
    return [
        'valid' => count($errors) === 0,
        'errors' => $errors
    ];
}

/**
 * Prepares a validated row for database insertion
 * Maps row fields to database columns based on type, ensuring type-specific fields are populated
 * and all other type fields are NULL.
 * 
 * @param array $row Validated data source row
 * @return array Database-ready row with all columns populated
 */
function prepareDataSourceForDb(array $row): array
{
    $type = trim($row['type']);
    $description = trim($row['description'] ?? '');
    
    // Initialize all type-specific columns as NULL
    $dbRow = [
        'type' => $type,
        'description' => !empty($description) ? $description : null,
        'S_value_name' => null,
        'S_value_uri' => null,
        'S_scheme_name' => null,
        'S_scheme_uri' => null,
        'G_details' => null,
        'A_details' => null,
        'T_details' => null,
        'T_Isostasy_compensation_depth' => null,
        'M_details' => null,
        'M_identifier' => null,
        'M_identifier_type' => null,
    ];
    
    // Populate type-specific columns - ALL OTHERS REMAIN NULL
    switch ($type) {
        case 'S': // Satellite
            $platformMetadata = $row['platform_metadata'] ?? null;
            $dbRow['S_value_name'] = $row['satellite_platform'] ?? null;
            $dbRow['S_value_uri'] = $platformMetadata['id'] ?? null;
            $dbRow['S_scheme_name'] = $platformMetadata['scheme'] ?? 'NASA/GCMD Earth Platforms Keywords';
            $dbRow['S_scheme_uri'] = $platformMetadata['schemeURI'] ?? 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms';
            break;

        case 'G': // Ground data
            $dbRow['G_details'] = trim($row['details']);
            // All others NULL
            break;
            
        case 'A': // Altimetry
            $dbRow['A_details'] = trim($row['details']);
            // All others NULL
            break;
            
        case 'T': // Terrain
            $dbRow['T_details'] = trim($row['details']);
            if (!empty($row['compensation_depth'])) {
                $depth = intval($row['compensation_depth']);
                if ($depth > 0) {
                    $dbRow['T_Isostasy_compensation_depth'] = $depth;
                }
            }
            // All others NULL
            break;
            
        case 'M': // Model
            $dbRow['M_details'] = trim($row['details']);
            $dbRow['M_identifier'] = trim($row['identifier']);
            $dbRow['M_identifier_type'] = trim($row['identifier_type']);
            // All others NULL
            break;
    }
    
    return $dbRow;
}

/**
 * Inserts a single data source into the database
 * 
 * @param mysqli $connection Database connection
 * @param array $dbRow Database-ready row
 * @return int Data source ID
 * @throws Exception On database error
 */
function insertDataSource(mysqli $connection, array $dbRow): int
{
    $sql = "INSERT INTO `Data_Sources` 
            (type, description, S_value_name, S_value_uri, S_scheme_name, S_scheme_uri,
             G_details, A_details, T_details, T_Isostasy_compensation_depth, 
             M_details, M_identifier, M_identifier_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare insert statement: " . $connection->error);
    }
    
    $stmt->bind_param(
        'sssssssssisss',
        $dbRow['type'],
        $dbRow['description'],
        $dbRow['S_value_name'],
        $dbRow['S_value_uri'],
        $dbRow['S_scheme_name'],
        $dbRow['S_scheme_uri'],
        $dbRow['G_details'],
        $dbRow['A_details'],
        $dbRow['T_details'],
        $dbRow['T_Isostasy_compensation_depth'],
        $dbRow['M_details'],
        $dbRow['M_identifier'],
        $dbRow['M_identifier_type']
    );
    
    $stmt->execute();
    if ($stmt->errno) {
        throw new Exception("Error inserting data source: " . $stmt->error);
    }
    
    $dataSourceId = $stmt->insert_id;
    $stmt->close();
    
    return $dataSourceId;
}

/**
 * Creates the link between Resource and Data_Sources
 * 
 * @param mysqli $connection Database connection
 * @param int $resourceId Resource ID
 * @param int $dataSourceId Data source ID
 * @throws Exception On database error
 */
function linkResourceToDataSource(mysqli $connection, int $resourceId, int $dataSourceId): void
{
    $sql = "INSERT INTO `Resource_has_Data_Sources` 
            (resource_id, data_source_id)
            VALUES (?, ?)";
    
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare link statement: " . $connection->error);
    }
    
    $stmt->bind_param('ii', $resourceId, $dataSourceId);
    $stmt->execute();
    if ($stmt->errno) {
        throw new Exception("Error creating resource link: " . $stmt->error);
    }
    
    $stmt->close();
}

/**
 * Expands a satellite data source row into multiple rows (one per platform keyword)
 * Each unique platform gets its own Data_Sources entry with type=S
 * 
 * @param array $row Original satellite data source row
 * @return array Array of expanded rows (one per platform keyword)
 */
function expandSatellitePlatformsToRows(array $row): array
{
    $expandedRows = [];
    
    // Parse the JSON-encoded platforms
    if (empty($row['satellite_platform'])) {
        return $expandedRows;
    }
    
    $platforms = json_decode($row['satellite_platform'], true);
    
    if (!is_array($platforms)) {
        return $expandedRows;
    }
    
    // Create a separate row for each platform keyword
    foreach ($platforms as $entry) {
        if (!is_array($entry) || empty($entry['value'])) {
            continue;
        }
        
        $platformValue = $entry['value'];
        
        // Create a new row with this specific platform
        $expandedRows[] = [
            'type' => 'S',
            'description' => $row['description'],  // Keep original description
            'satellite_platform' => $platformValue,  // Single platform value
            'platform_metadata' => $entry,  // Store full metadata for keyword ingestion
            'details' => '',
            'compensation_depth' => '',
            'identifier' => '',
            'identifier_type' => '',
            'model_name' => ''
        ];
    }
    
    return $expandedRows;
}

/**
 * Ingests a satellite platform entry as a thesaurus keyword
 * 
 * Uses the shared getOrCreateThesaurusKeyword and linkResourceToThesaurusKeyword
 * functions from save_thesauruskeywords.php to maintain consistency.
 * 
 * @param mysqli $connection Database connection
 * @param array $platformEntry Single platform entry with metadata
 * @param int $resourceId Resource ID
 * @return void
 * @throws Exception On database errors
 */
function ingestSatellitePlatformAsKeyword(mysqli $connection, array $platformEntry, int $resourceId): void
{
    if (!is_array($platformEntry) || empty($platformEntry['value'])) {
        return;
    }
    
    $value = $platformEntry['value'];
    $valueURI = $platformEntry['id'] ?? null;
    $scheme = $platformEntry['scheme'] ?? 'GCMD Platforms';
    $schemeURI = $platformEntry['schemeURI'] ?? '';
    $language = $platformEntry['language'] ?? 'en';
    
    // Reuse shared functions from save_thesauruskeywords.php
    $thesaurus_keywords_id = getOrCreateThesaurusKeyword(
        $connection,
        $value,
        $scheme,
        $schemeURI,
        $valueURI,
        $language
    );
    
    linkResourceToThesaurusKeyword($connection, $resourceId, $thesaurus_keywords_id);
}

/**
 * Ingests a model data source as a related work entry
 * 
 * When a Model (M) type data source is saved, it's also recorded as a related work
 * with relation type "IsDerivedFrom". This creates a link between the GGM model
 * and the source data model it was derived from.
 * 
 * Uses shared functions from save_relatedwork.php to maintain consistency.
 * 
 * @param mysqli $connection Database connection
 * @param array $modelEntry Model data source entry with identifier and identifier_type
 * @param int $resourceId Resource ID
 * @return void
 * @throws Exception On database errors
 */
function ingestModelDataSourceAsRelatedWork(mysqli $connection, array $modelEntry, int $resourceId): void
{
    if (!is_array($modelEntry) || empty($modelEntry['identifier']) || empty($modelEntry['identifier_type'])) {
        return;
    }
    
    $identifier = trim($modelEntry['identifier']);
    $identifierTypeName = trim($modelEntry['identifier_type']);
    
    // Get the relation ID for "IsDerivedFrom"
    $relationId = getRelationId($connection, 'IsDerivedFrom');
    if (!$relationId) {
        throw new Exception("Relation 'IsDerivedFrom' not found in database");
    }
    
    // Get the identifier type ID
    $identifierTypeId = getIdentifierTypeId($connection, $identifierTypeName);
    if (!$identifierTypeId) {
        throw new Exception("Identifier type '{$identifierTypeName}' not found in database");
    }
    
    // Insert the related work entry
    $relatedWorkId = insertRelatedWork($connection, $identifier, $relationId, $identifierTypeId);
    if ($relatedWorkId) {
        // Link the resource to this related work
        linkResourceToRelatedWork($connection, $resourceId, $relatedWorkId);
    } else {
        throw new Exception("Failed to insert related work for model data source");
    }
}


/**
 * Main orchestration function: saves all data sources for a resource
 * 
 * For Satellite (S) type rows with multiple platforms:
 * - Expands into separate rows (one per platform keyword)
 * - Each row is saved to Data_Sources with a single platform
 * - Each platform is also ingested as a thesaurus keyword
 * 
 * @param mysqli $connection Database connection
 * @param array $postData Raw POST data
 * @param int $resourceId Resource ID
 * @return void
 * @throws Exception On validation or database errors
 */
function saveGGMsDataSources(mysqli $connection, array $postData, int $resourceId): void
{
    // 1. Extract rows from POST arrays
    $rows = extractDataSourceRows($postData);
    
    // If no rows, nothing to save
    if (empty($rows)) {
        return;
    }
    
    // 2. Process each row, expanding Satellite rows if needed
    $allRows = [];
    foreach ($rows as $row) {
        if (trim($row['type']) === 'S') {
            // Expand satellite rows: one per platform keyword
            $expandedRows = expandSatellitePlatformsToRows($row);
            if (!empty($expandedRows)) {
                $allRows = array_merge($allRows, $expandedRows);
            }
        } else {
            // Non-satellite rows: keep as-is
            $allRows[] = $row;
        }
    }
    
    // 3. Validate and save each row
    foreach ($allRows as $index => $row) {
        // Validate
        $validation = validateDataSourceRow($row);
        if (!$validation['valid']) {
            $errorMsg = "Data source row " . ($index + 1) . ": " . implode('; ', $validation['errors']);
            throw new Exception($errorMsg);
        }
        
        // For Satellite (S) type, ingest platform as thesaurus keyword
        if (trim($row['type']) === 'S' && isset($row['platform_metadata'])) {
            ingestSatellitePlatformAsKeyword($connection, $row['platform_metadata'], $resourceId);
        }
        
        // For Model (M) type, ingest as related work with "IsDerivedFrom" relation
        if (trim($row['type']) === 'M') {
            ingestModelDataSourceAsRelatedWork($connection, $row, $resourceId);
        }
        
        // Prepare for database
        $dbRow = prepareDataSourceForDb($row);
        
        // Insert data source
        $dataSourceId = insertDataSource($connection, $dbRow);
        
        // Link to resource
        linkResourceToDataSource($connection, $resourceId, $dataSourceId);
    }
}
