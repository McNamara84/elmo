<?php
require_once dirname(__FILE__) . '/../validation.php';

/**
 * Saves or updates resource information and rights in the database.
 *
 * If a record with the same DOI exists, it updates the existing record.
 * For records without DOI, it creates a new entry with a NEW Resource ID.
 * Duplicate titles are only saved once.
 *
 * @param mysqli $connection The database connection
 * @param array  $postData   The POST data from the form containing:
 *                          - doi (string|null): The DOI of the resource
 *                          - year (int): Publication year
 *                          - dateCreated (string): Creation date
 *                          - dateEmbargo (string|null): Embargo date
 *                          - resourcetype (int): Resource type ID
 *                          - version (float|null): Version number
 *                          - language (int): Language ID
 *                          - Rights (int): Rights ID
 *                          - title (array): Array of titles
 *                          - titleType (array): Array of title types
 *
 * @return int|false The ID of the created/updated resource or false if validation fails
 * @throws mysqli_sql_exception If a database error occurs
 */
function saveResourceInformationAndRights($connection, $postData)
{
    global $showLicense;
    
    try {        
        // Only require Rights field if license form group is shown
        global $showLicense;
        $action = $postData['action'] ?? 'save_and_download';
        if ($action === 'submit') {
            $requiredFields = ['year', 'dateCreated', 'resourcetype'];
            $requiredArrayFields = ['title', 'titleType'];

            if ($showLicense) {
                $requiredFields[] = 'Rights';
            }

            if (!validateRequiredFields($postData, $requiredFields, $requiredArrayFields)) {
                return false;
            }
        }

        // Sanitize and prepare data
        $resourceData = prepareResourceData($postData);


        // Check for existing DOI and handle accordingly
        $resource_id = handleExistingResource($connection, $resourceData);
        if ($resource_id === false) {
            // Create new resource if no existing one was found/updated
            $resource_id = createNewResource($connection, $resourceData);
        }

        // IMPORTANT: Always save titles after resource is created/updated
        if (!$resource_id) {
            return false;
        }
        
        if (!saveTitles($connection, $resource_id, $postData['title'], $postData['titleType'])) {
            return false;
        }

        return $resource_id;

    } catch (Exception $e) {
        error_log("Error in saveResourceInformationAndRights: " . $e->getMessage());
        return false;
    }
}

/**
 * Prepares and sanitizes resource data for database operations.
 *
 * @param array $postData The POST data to prepare
 * @return array Sanitized and typed resource data
 */
function prepareResourceData($postData)
{
    global $connection, $defaultLicense;

    $rightsId = null;
    
    // Try to get Rights from POST data
    if (isset($postData['Rights']) && !empty($postData['Rights'])) {
        try {
            $rightsId = (int) $postData['Rights'];
            // Check if casting resulted in 0 or invalid value
            if ($rightsId <= 0) {
                error_log("Rights value is not a valid positive integer: " . var_export($postData['Rights'], true));
                $rightsId = null;
            }
        } catch (Exception $e) {
            error_log("Failed to cast Rights to int: " . $e->getMessage() . ". Value: " . var_export($postData['Rights'], true));
            $rightsId = null;
        }
        
        // Validate that this rights_id actually exists
        if ($rightsId !== null) {
            $stmt = $connection->prepare("SELECT rights_id FROM Rights WHERE rights_id = ?");
            $stmt->bind_param("i", $rightsId);
            $stmt->execute();
            if ($stmt->get_result()->num_rows === 0) {
                error_log("Invalid Rights ID provided: $rightsId. Falling back to default.");
                $rightsId = null;
            }
        }
    }
    
    // If no valid Rights from POST, use default
    if ($rightsId === null) {
        $stmt = $connection->prepare("SELECT rights_id FROM Rights WHERE rightsIdentifier = ? LIMIT 1");
        $stmt->bind_param("s", $defaultLicense);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($row = $result->fetch_assoc()) {
            $rightsId = $row['rights_id'];
        } else {
            // Fallback to first available rights (not hardcoded ID)
            $stmt = $connection->prepare("SELECT rights_id FROM Rights ORDER BY rights_id ASC LIMIT 1");
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                $rightsId = $row['rights_id'];
                error_log("Default license '$defaultLicense' not found. Using first available: {$rightsId}");
            } else {
                error_log("CRITICAL: No Rights records exist in database!");
                return true; // Cannot proceed without a valid rights_id
            }
        }
    }
    return [
        'doi' => isset($postData['doi']) ? trim($postData['doi']) : null,
        'year' => isset($postData['year']) && trim($postData['year']) !== ''
            ? (int) $postData['year']: null,
        'dateCreated' => isset($postData['dateCreated']) && trim($postData['dateCreated']) !== ''
            ? trim($postData['dateCreated']): null,
        'dateEmbargoUntil' => isset($postData['dateEmbargo']) && trim($postData['dateEmbargo']) !== ''
            ? trim($postData['dateEmbargo']) : null,
        'resourceType' => isset($postData['resourcetype']) && trim($postData['resourcetype']) !== ''
            ? trim($postData['resourcetype']): null,
        'version' => isset($postData['version']) && trim($postData['version']) !== ''
            ? (float) $postData['version'] : null,
        'language' => isset($postData['language']) && trim($postData['language']) !== ''
            ? trim($postData['language']): null,
        'rights' => (int) $rightsId
    ];
}

/**
 * Handles existing resources, updating them if found.
 * Cleans up all related entries before update.
 *
 * @param mysqli $connection The database connection
 * @param array $resourceData The prepared resource data
 * @return int|false Resource ID if updated, false if no existing resource found
 */
function handleExistingResource($connection, $resourceData)
{
    if (empty($resourceData['doi'])) {
        return false;
    }

    $stmt = $connection->prepare("SELECT resource_id FROM Resource WHERE doi = ?");
    $stmt->bind_param("s", $resourceData['doi']);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        return false;
    }

    $row = $result->fetch_assoc();
    $resource_id = $row['resource_id'];

    // Delete entries from tables with direct resource_id reference
    $directTables = [
        'Description' => 'resource_id',  // Table name => column name
        'Title' => 'Resource_resource_id'
    ];

    foreach ($directTables as $table => $columnName) {
        $stmt = $connection->prepare("DELETE FROM " . $table . " WHERE " . $columnName . " = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
    }

    // Delete entries from relationship tables
    $relationTables = [
        'Resource_has_Author',
        'Resource_has_Contributor_Person',
        'Resource_has_Contributor_Institution',
        'Resource_has_Contact_Person',
        'Resource_has_Funding_Reference',
        'Resource_has_Originating_Laboratory',
        'Resource_has_Related_Work',
        'Resource_has_Spatial_Temporal_Coverage',
        'Resource_has_Thesaurus_Keywords',
        'Resource_has_Free_Keywords'
    ];

    foreach ($relationTables as $table) {
        $stmt = $connection->prepare("DELETE FROM " . $table . " WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
    }

    // Update existing resource
    $stmt = $connection->prepare("UPDATE Resource SET 
        version = ?, year = ?, dateCreated = ?, dateEmbargoUntil = ?,
        Rights_rights_id = ?, Resource_Type_resource_name_id = ?, Language_language_id = ?
        WHERE resource_id = ?");

    $stmt->bind_param(
        "dissiiii",
        $resourceData['version'],
        $resourceData['year'],
        $resourceData['dateCreated'],
        $resourceData['dateEmbargoUntil'],
        $resourceData['rights'],
        $resourceData['resourceType'],
        $resourceData['language'],
        $resource_id
    );

    $stmt->execute();

    return $resource_id;
}

/**
 * Creates a new resource in the database.
 *
 * @param mysqli $connection The database connection
 * @param array $resourceData The prepared resource data
 * @return int The ID of the newly created resource
 */
function createNewResource($connection, $resourceData)
{
    $stmt = $connection->prepare("INSERT INTO Resource 
        (doi, version, year, dateCreated, dateEmbargoUntil, 
        Rights_rights_id, Resource_Type_resource_name_id, Language_language_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    $stmt->bind_param(
        "sdissiii",
        $resourceData['doi'],
        $resourceData['version'],
        $resourceData['year'],
        $resourceData['dateCreated'],
        $resourceData['dateEmbargoUntil'],
        $resourceData['rights'],
        $resourceData['resourceType'],
        $resourceData['language']
    );

    try { $stmt->execute();
    } catch (Exception $e) {
        error_log("Error creating new resource: " . $e->getMessage());
        throw $e;
    }
    return $stmt->insert_id;
}

/**
 * Validates that a title type ID exists in the database.
 *
 * @param mysqli $connection The database connection
 * @param int $title_type_id The title type ID to validate
 * @return bool True if the title type exists, false otherwise
 */
function isTitleTypeValid($connection, $title_type_id)
{
    if ($title_type_id === null || $title_type_id <= 0) {
        return false;
    }
    
    $stmt = $connection->prepare("SELECT title_type_id FROM Title_Type WHERE title_type_id = ?");
    $stmt->bind_param("i", $title_type_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    return $result->num_rows > 0;
}

/**
 * Saves titles for a resource, handling duplicates.
 * Allows saving:
 * - Titles with both text and titleType
 *
 * Will SKIP without a failure:
 * - Titles with text only (type must be present)
 * - Titles with titleType only (text must be present if type is present)
 * - Entirely empty entries (both text and type are empty)
 *
 * Title types are validated against the Title_Type table in the database.
 *
 * @param mysqli $connection The database connection
 * @param int $resource_id The resource ID
 * @param array $titles Array of titles
 * @param array $titleTypes Array of title types (as integers from form)
 * @return bool True if successful, false otherwise
 */
function saveTitles($connection, $resource_id, $titles, $titleTypes)
{
    error_log("saveTitles called with resource_id: $resource_id, title count: " . count($titles));
    
    $uniqueTitles = [];
    for ($i = 0; $i < count($titles); $i++) {
        $title_text = isset($titles[$i]) ? trim($titles[$i]) : '';
        $title_type_str = isset($titleTypes[$i]) ? trim($titleTypes[$i]) : '';
        
        // Skip entirely empty entries (both text and type are empty)
        if (empty($title_text) && empty($title_type_str)) {
            error_log("Skipping completely empty title entry at index $i");
            continue;
        }
        
        // Skip if text is empty (text is required)
        if (empty($title_text)) {
            error_log("Skipping title entry at index $i: text is empty. Title text is required.");
            continue;
        }
        
        // Skip if type is empty (type is required)
        if (empty($title_type_str)) {
            error_log("Skipping title entry at index $i: type is empty. Title type is required.");
            continue;
        }
        
        // Convert title_type string to integer if present
        $title_type_int = intval($title_type_str);
        
        // Validate the title type exists in the database
        if (!isTitleTypeValid($connection, $title_type_int)) {
            error_log("Invalid title type at index $i. Type ID '$title_type_int' does not exist in Title_Type table. Skipping.");
            continue;
        }
        
        // Create unique key for deduplication
        $key = $title_text . '|' . $title_type_int;
        if (!isset($uniqueTitles[$key])) {
            $uniqueTitles[$key] = [
                'text' => $title_text,
                'type' => $title_type_int
            ];
            error_log("Added title to save: text='$title_text', type=$title_type_int");
        }
    }

    if (empty($uniqueTitles)) {
        error_log("No valid titles to save");
        return false;
    }

    foreach ($uniqueTitles as $title) {
        $stmt = $connection->prepare("INSERT INTO Title 
            (`text`, `Title_Type_fk`, `Resource_resource_id`) 
            VALUES (?, ?, ?)");
        $stmt->bind_param(
            "sii",
            $title['text'],
            $title['type'],
            $resource_id
        );
        
        if (!$stmt->execute()) {
            error_log("Failed to insert title: " . $stmt->error);
            return false;
        }
        error_log("Successfully inserted title: text='" . $title['text'] . "', type=" . $title['type']);
    }

    return true;
}