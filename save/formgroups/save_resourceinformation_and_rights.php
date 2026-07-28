<?php
require_once dirname(__FILE__) . '/../validation.php';

/**
 * Creates a new resource information and rights entry in the database.
 *
 * Always creates a new Resource entry with a new Resource ID.
 * Duplicate titles are deduplicated within the same resource.
 * Titles are only validated on submit action; save_and_download allows partial data.
 *
 * @param mysqli $connection The database connection
 * @param array  $postData   The POST data from the form containing:
 *                          - action (string): Either 'submit' or 'save_and_download'
 *                          - doi (string|null): The DOI of the resource
 *                          - year (int): Publication year
 *                          - dateCreated (string|null): Creation date
 *                          - dateEmbargo (string|null): Embargo date
 *                          - resourcetype (int): Resource type ID
 *                          - version (float|null): Version number
 *                          - language (int): Language ID
 *                          - Rights (int): Rights ID
 *                          - title (array): Array of titles
 *                          - titleType (array): Array of title types
 *
 * @return int|false The ID of the newly created resource or false if validation fails
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
            $requiredFields = ['year', 'resourcetype'];
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
        // Create new resource 
        $resource_id = createNewResource($connection, $resourceData);
        // Save titles after resource is created
        if (!saveTitles($connection, $resource_id, $postData['title'], $postData['titleType'], $action)) {
            error_log("[SAVE] Failed to save titles for resource_id: $resource_id");
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
 * Resolves and caches default title type IDs ("Main Title" and "Alternative Title").
 *
 * Runs at most two queries on the first call per connection and caches the
 * results for the lifetime of the request. Subsequent calls with the same
 * connection return the cached values.
 *
 * @param mysqli $connection The database connection
 * @return array{main: int|null, alternative: int|null} Resolved IDs (null when the row does not exist)
 */
function resolveDefaultTitleTypeIds($connection)
{
    static $cache = [];
    $connId = spl_object_id($connection);
    if (isset($cache[$connId])) {
        return $cache[$connId];
    }

    $ids = ['main' => null, 'alternative' => null];

    $stmt = $connection->prepare(
        "SELECT name, title_type_id FROM Title_Type WHERE name IN ('Main Title', 'Alternative Title')"
    );
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        if ($row['name'] === 'Main Title') {
            $ids['main'] = (int) $row['title_type_id'];
        } elseif ($row['name'] === 'Alternative Title') {
            $ids['alternative'] = (int) $row['title_type_id'];
        }
    }

    // Fallback: first available title type
    if ($ids['main'] === null || $ids['alternative'] === null) {
        $stmt = $connection->prepare("SELECT title_type_id FROM Title_Type ORDER BY title_type_id ASC LIMIT 1");
        $stmt->execute();
        $fallback = $stmt->get_result()->fetch_assoc();
        $fallbackId = $fallback ? (int) $fallback['title_type_id'] : null;
        $ids['main'] = $ids['main'] ?? $fallbackId;
        $ids['alternative'] = $ids['alternative'] ?? $fallbackId;
    }

    $cache[$connId] = $ids;
    return $cache[$connId];
}

/**
 * Returns the default title type ID for a given title position.
 *
 * - First saved title (savedCount === 0): returns "Main Title" type ID
 * - Subsequent saved titles: returns "Alternative Title" type ID
 *
 * Uses cached IDs from resolveDefaultTitleTypeIds().
 *
 * @param mysqli $connection The database connection
 * @param int $savedCount Number of titles already collected for saving
 * @return int|null The default title type ID, or null if no Title_Type rows exist
 */
function getDefaultTitleTypeId($connection, $savedCount)
{
    $ids = resolveDefaultTitleTypeIds($connection);
    return $savedCount === 0 ? $ids['main'] : $ids['alternative'];
}

/**
 * Saves titles for a resource, handling duplicates.
 * Allows saving:
 * - Titles with both text and titleType
 * - Titles with text but no titleType (defaults to "Main Title" for the
 *   first saved title, "Alternative Title" for subsequent ones)
 *
 * Will SKIP without a failure:
 * - Titles with titleType only (text must be present if type is present)
 * - Entirely empty entries (both text and type are empty)
 * - (submit action only) Titles whose titleType ID does not exist in the
 *   Title_Type table (validated via isTitleTypeValid())
 *
 * Title types are validated against the Title_Type table in the database.
 *
 * @param mysqli $connection The database connection
 * @param int $resource_id The resource ID
 * @param array $titles Array of titles
 * @param array $titleTypes Array of title types (as integers from form)
 * @param string $action The save action ('save_and_download' or 'submit')
 * @return bool True if successful, false otherwise
 */
function saveTitles($connection, $resource_id, $titles, $titleTypes, $action = 'save_and_download')
{
    $uniqueTitles = [];
    for ($i = 0; $i < count($titles); $i++) {
        $title_text = isset($titles[$i]) ? trim($titles[$i]) : '';
        $title_type_str = isset($titleTypes[$i]) ? trim($titleTypes[$i]) : '';
        error_log("Processing title index $i: text='$title_text', type='$title_type_str'");


        // Skip if text is empty (text is required)
        if (empty($title_text)) {
            continue;
        }
        // Convert title_type string to integer if present
        $title_type = intval($title_type_str);

        // If type is empty but text exists, assign a default title type
        if (empty($title_type_str)) {
            $defaultId = getDefaultTitleTypeId($connection, count($uniqueTitles));
            if ($defaultId === null) {
                error_log("Cannot assign default title type: no Title_Type rows exist in database");
                return false;
            }
            $title_type = $defaultId;
        } elseif ($action === 'submit' && !isTitleTypeValid($connection, $title_type)) {
            error_log("Invalid title type ID provided: $title_type. Skipping this title.");
            continue;
        }

        // Create unique key for deduplication
        $key = $title_text . '|' . $title_type;
        if (!isset($uniqueTitles[$key])) {
            $uniqueTitles[$key] = [
                'text' => $title_text,
                'type' => $title_type
            ];
        }
    }

    if (empty($uniqueTitles)) {
        if ($action !== 'submit') {
            return true;
        }
        error_log("[SAVE] Failed to save titles: no valid unique titles provided for resource_id: $resource_id");
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
    }

    return true;
}