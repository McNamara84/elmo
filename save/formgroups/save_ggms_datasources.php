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
 * Returns a POST field as a sequential array.
 *
 * Browser-submitted FormData omits disabled controls, so type-specific arrays are sparse by row.
 * We normalize them to sequential queues and consume values only for row types that actually submit them.
 *
 * @param array $postData Raw POST data
 * @param string $fieldName POST field name
 * @return array Sequential field values
 */
function getSequentialPostFieldValues(array $postData, string $fieldName): array
{
    $values = $postData[$fieldName] ?? [];

    if (!is_array($values)) {
        return [];
    }

    return array_values($values);
}

/**
 * Consumes the next value from a sequential POST field queue.
 *
 * @param array $values Sequential field values
 * @param int $cursor Current queue position, updated by reference
 * @return mixed|null Next value or null when exhausted
 */
function consumeSequentialPostFieldValue(array $values, int &$cursor)
{
    if (!array_key_exists($cursor, $values)) {
        return null;
    }

    $value = $values[$cursor];
    $cursor++;

    return $value;
}

/**
 * Returns a field value either by row index or by consuming the next queued value.
 *
 * @param array $values Sequential field values
 * @param int $cursor Current queue position, updated by reference when queue mode is used
 * @param bool $isRowAligned Whether the field array is aligned 1:1 with datasource rows
 * @param int $rowIndex Datasource row index
 * @return mixed|null Field value or null when missing
 */
function getMappedPostFieldValue(array $values, int &$cursor, bool $isRowAligned, int $rowIndex)
{
    if ($isRowAligned) {
        return $values[$rowIndex] ?? null;
    }

    return consumeSequentialPostFieldValue($values, $cursor);
}

/**
 * Extracts individual data source rows from POST arrays.
 * The frontend disables non-applicable controls per row, so only type-specific fields are submitted.
 * Row order therefore comes from datasource_type[] and datasource_description[], while the remaining
 * arrays must be consumed as sparse queues based on the row type.
 * 
 * @param array $postData Raw POST data with array fields
 * @return array Array of individual data source row objects, indexed 0..N
 */
function extractDataSourceRows(array $postData): array
{
    $types = getSequentialPostFieldValues($postData, 'datasource_type');

    if (count($types) === 0) {
        return [];
    }

    $fieldValues = [
        'datasource_description' => getSequentialPostFieldValues($postData, 'datasource_description'),
        'datasource_details' => getSequentialPostFieldValues($postData, 'datasource_details'),
        'compensation_depth' => getSequentialPostFieldValues($postData, 'compensation_depth'),
        'satellite_platform' => getSequentialPostFieldValues($postData, 'satellite_platform'),
        'dIdentifier' => getSequentialPostFieldValues($postData, 'dIdentifier'),
        'dIdentifierType' => getSequentialPostFieldValues($postData, 'dIdentifierType'),
        'dName' => getSequentialPostFieldValues($postData, 'dName')
    ];

    $fieldCursors = array_fill_keys(array_keys($fieldValues), 0);
    // datasource_description is submitted by every row type and is therefore always row-aligned.
    // All type-specific fields (details, platform, etc.) are only submitted by the rows that use
    // them, so they must always be consumed as a sequential queue - never treated as row-aligned.

    $rows = [];
    foreach ($types as $rowIndex => $type) {
        $row = [
            'type' => $type,
            'description' => getMappedPostFieldValue(
                $fieldValues['datasource_description'],
                $fieldCursors['datasource_description'],
                true,
                $rowIndex
            ),
            'datasource_details' => null,
            'compensation_depth' => null,
            'satellite_platform' => null,
            'dIdentifier' => null,
            'dIdentifierType' => null,
            'dName' => null
        ];

        switch (trim((string) $type)) {
            case 'S':
                $row['satellite_platform'] = consumeSequentialPostFieldValue(
                    $fieldValues['satellite_platform'],
                    $fieldCursors['satellite_platform']
                );
                break;

            case 'G':
            case 'A':
                $row['datasource_details'] = consumeSequentialPostFieldValue(
                    $fieldValues['datasource_details'],
                    $fieldCursors['datasource_details']
                );
                break;

            case 'T':
                $row['datasource_details'] = consumeSequentialPostFieldValue(
                    $fieldValues['datasource_details'],
                    $fieldCursors['datasource_details']
                );

                if (trim((string) ($row['datasource_details'] ?? '')) === 'Isostasy') {
                    $row['compensation_depth'] = consumeSequentialPostFieldValue(
                        $fieldValues['compensation_depth'],
                        $fieldCursors['compensation_depth']
                    );
                }
                break;

            case 'M':
                $row['datasource_details'] = consumeSequentialPostFieldValue(
                    $fieldValues['datasource_details'],
                    $fieldCursors['datasource_details']
                );
                $row['dIdentifier'] = consumeSequentialPostFieldValue(
                    $fieldValues['dIdentifier'],
                    $fieldCursors['dIdentifier']
                );
                $row['dIdentifierType'] = consumeSequentialPostFieldValue(
                    $fieldValues['dIdentifierType'],
                    $fieldCursors['dIdentifierType']
                );
                $row['dName'] = consumeSequentialPostFieldValue(
                    $fieldValues['dName'],
                    $fieldCursors['dName']
                );
                break;

            default:
                throw new \RuntimeException(
                    "Unknown data source type '{$type}' at row index {$rowIndex}. Expected one of: S, G, A, T, M."
                );
        }
        
        $rows[] = $row;
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

    if (empty($type)) {
        return ['valid' => false, 'errors' => ['Data source type is required']];
    }

    $allowedTypes = ['S', 'G', 'A', 'T', 'M'];
    if (!in_array($type, $allowedTypes, true)) {
        return ['valid' => false, 'errors' => ["Invalid data source type: {$type}"]];
    }

    // Validation rules now use the postData variable names
    $typeRules = [
        'S' => [
            'required' => ['satellite_platform'],
            'mustBeEmpty' => ['datasource_details', 'compensation_depth', 'dIdentifier', 'dIdentifierType', 'dName']
        ],
        'G' => [
            'required' => ['datasource_details'],
            'mustBeEmpty' => ['satellite_platform', 'compensation_depth', 'dIdentifier', 'dIdentifierType', 'dName']
        ],
        'A' => [
            'required' => ['datasource_details'],
            'mustBeEmpty' => ['satellite_platform', 'compensation_depth', 'dIdentifier', 'dIdentifierType', 'dName']
        ],
        'T' => [
            'required' => ['datasource_details'],
            'mustBeEmpty' => ['satellite_platform', 'dIdentifier', 'dIdentifierType', 'dName']
        ],
        'M' => [
            'required' => ['datasource_details'],
            'mustBeEmpty' => ['satellite_platform', 'compensation_depth']
        ]
    ];

    $rules = $typeRules[$type];

    foreach ($rules['required'] as $field) {
        if (empty($row[$field]) || $row[$field] === null) {
            $errors[] = "Field '{$field}' is required for type {$type}";
        }
    }

    foreach ($rules['mustBeEmpty'] as $field) {
        if (!empty(trim($row[$field] ?? ''))) {
            $errors[] = "Field '{$field}' must be empty for type {$type} (got: {$row[$field]})";
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
    $details = trim($row['datasource_details'] ?? ''); // Add this line

    // Initialize all type-specific columns as NULL
    $dbRow = [
        'type' => $type,
        'description' => !empty($description) ? $description : null,
        'details' => !empty($details) ? $details : null,
        'S_value_name' => null,
        'S_value_uri' => null,
        'S_scheme_name' => null,
        'S_scheme_uri' => null,
        'T_Isostasy_compensation_depth' => null,
        'M_identifier' => null,
        'M_identifier_type' => null,
        'M_name' => null,
    ];

    // Populate type-specific columns from the $row array (which uses postData names)
    switch ($type) {
        case 'S': // Satellite
            $platformData = $row['satellite_platform'];
            
            // Handle both JSON string and array (array comes from expandSatellitePlatformsToRows)
            if (is_string($platformData)) {
                $platformMetadata = json_decode($platformData, true);
            } else {
                $platformMetadata = $platformData;
            }
            
            if (!empty($platformMetadata) && is_array($platformMetadata)) {
                $dbRow['S_value_name'] = $platformMetadata['value'] ?? null;
                $dbRow['S_value_uri'] = $platformMetadata['id'] ?? null;
                $dbRow['S_scheme_name'] = $platformMetadata['scheme'] ?? 'NASA/GCMD Earth Platforms Keywords';
                $dbRow['S_scheme_uri'] = $platformMetadata['schemeURI'] ?? 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms';
            }
            break;

        case 'G': // Ground data
        case 'A': // Altimetry
            // These types only need 'details' which is already set above
            break;
            
        case 'T': // Terrain
            // Set compensation depth if provided
            if (!empty($row['compensation_depth'])) {
                $dbRow['T_Isostasy_compensation_depth'] = (int)$row['compensation_depth'];
            }
            break;
            
        case 'M': // Model
            if (!empty($row['dName'])) {
                $dbRow['M_name'] = trim($row['dName']);
            }
            if (!empty($row['dIdentifier'])) {
                $dbRow['M_identifier'] = trim($row['dIdentifier']);
            }
            if (!empty($row['dIdentifierType'])) {
                $dbRow['M_identifier_type'] = trim($row['dIdentifierType']);
            }
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
            (type, description, details, S_value_name, S_value_uri, S_scheme_name, S_scheme_uri,
             T_Isostasy_compensation_depth, M_identifier, M_identifier_type, M_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare insert statement: " . $connection->error);
    }

    $stmt->bind_param(
        'sssssssisss',
        $dbRow['type'],
        $dbRow['description'],
        $dbRow['details'],
        $dbRow['S_value_name'],
        $dbRow['S_value_uri'],
        $dbRow['S_scheme_name'],
        $dbRow['S_scheme_uri'],
        $dbRow['T_Isostasy_compensation_depth'],
        $dbRow['M_identifier'],
        $dbRow['M_identifier_type'],
        $dbRow['M_name']
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
    
    $platformMetadata = json_decode($row['satellite_platform'], true);
    
    if (!is_array($platformMetadata)) {
        return $expandedRows;
    }
    
    // Create a separate row for each platform keyword
    foreach ($platformMetadata as $entry) {
        if (!is_array($entry) || empty($entry['value'])) {
            continue;
        }
        
        $platformValue = $entry['value'];
        
        // Create a new row with this specific platform.
        // All potential keys must be present to avoid "Undefined array key" errors in validateDataSourceRow.
        $expandedRows[] = [
            'type' => 'S',
            'description' => $row['description'],          // Keep the description for all the satellites.
            'satellite_platform' => $entry,      
            // --- Fields for other types, set to null to pass validation for type 'S' ---
            'datasource_details' => null,
            'compensation_depth' => null,
            'dIdentifier' => null,
            'dIdentifierType' => null,
            'dName' => null
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
function ingestSatellitePlatformAsKeyword(mysqli $connection, array $dbRow, int $resourceId): void
{
    // This function now receives the database-ready row, so we use DB column names.
    if (!is_array($dbRow) || empty($dbRow['S_value_name'])) {
        return;
    }
    


    $value = $dbRow['S_value_name'];
    $valueURI = $dbRow['S_value_uri'] ?? null;
    $scheme = $dbRow['S_scheme_name'] ?? 'GCMD Platforms';
    $schemeURI = $dbRow['S_scheme_uri'] ?? 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms';
    $language = 'en'; // Assuming 'en' as platform keywords are generally in English

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
function ingestModelDataSourceAsRelatedWork(mysqli $connection, array $dbRow, int $resourceId): void
{
    if (!is_array($dbRow) || empty($dbRow['M_identifier']) || empty($dbRow['M_identifier_type'])) {
        return;
    }
    
    $identifier = trim($dbRow['M_identifier']);
    $identifierTypeName = trim($dbRow['M_identifier_type']);
        
    // Check if this related work already exists for this resource
    $checkSql = "SELECT rw.related_work_id FROM `Related_Work` rw
                INNER JOIN `Resource_has_Related_Work` rhw ON rw.related_work_id = rhw.Related_Work_related_work_id
                WHERE rhw.Resource_resource_id = ? 
                AND rw.Identifier = ?
                AND rw.identifier_type_fk = (SELECT identifier_type_id FROM `Identifier_Type` WHERE name = ?)
                LIMIT 1";
    
    $checkStmt = $connection->prepare($checkSql);
    if (!$checkStmt) {
        throw new Exception("Failed to prepare check statement: " . $connection->error);
    }
    
    $checkStmt->bind_param('iss', $resourceId, $identifier, $identifierTypeName);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    // If already exists, skip insertion
    if ($result->num_rows > 0) {
        $checkStmt->close();
        return;
    }
    $checkStmt->close();
    
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
    $action = $postData['action'] ?? 'save_and_download';

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
        // Validate only on submit
        if ($action === 'submit') {
            $validation = validateDataSourceRow($row);
            if (!$validation['valid']) {
                $errorMsg = "Data source row " . ($index + 1) . ": " . implode('; ', $validation['errors']);
                throw new Exception($errorMsg);
            }
        }
        
        // Prepare for database
        $dbRow = prepareDataSourceForDb($row);
        
        // Insert data source
        $dataSourceId = insertDataSource($connection, $dbRow);
        
        // Link to resource
        linkResourceToDataSource($connection, $resourceId, $dataSourceId);
        
        // For Satellite (S) type, ingest platform as thesaurus keyword
        if (trim($row['type']) === 'S') {
            ingestSatellitePlatformAsKeyword($connection, $dbRow, $resourceId);
        }
        
        // For Model (M) type, ingest as related work with "IsDerivedFrom" relation
        // This happens AFTER data source insertion to ensure proper linking
        if (trim($row['type']) === 'M') {
            ingestModelDataSourceAsRelatedWork($connection, $dbRow, $resourceId);
        }
    }
}
