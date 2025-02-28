<?php
require_once dirname(__FILE__) . '/../validation.php';

/**
 * Saves or updates resource information and rights in the database.
 *
 * If a record with the same DOI exists, it updates the existing record.
 * For records without DOI, it creates a new entry.
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
    try {
        // Validate required fields
        $requiredFields = ['year', 'dateCreated', 'resourcetype', 'language', 'Rights'];
        $requiredArrayFields = ['title', 'titleType'];

        if (!validateRequiredFields($postData, $requiredFields, $requiredArrayFields)) {
            return false;
        }

        // Sanitize and prepare data
        $resourceData = prepareResourceData($postData);

        // Begin transaction
        $connection->begin_transaction();

        // Check for existing DOI and handle accordingly
        $resource_id = handleExistingResource($connection, $resourceData);
        if ($resource_id === false) {
            // Create new resource if no existing one was found/updated
            $resource_id = createNewResource($connection, $resourceData);
        }

        // Save titles
        if (!saveTitles($connection, $resource_id, $postData['title'], $postData['titleType'])) {
            $connection->rollback();
            return false;
        }

        $connection->commit();
        return $resource_id;

    } catch (Exception $e) {
        $connection->rollback();
        error_log("Error in saveResourceInformationAndRights: " . $e->getMessage());
        throw $e;
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
    return [
        'doi' => isset($postData['doi']) ? trim($postData['doi']) : null,
        'year' => (int) $postData['year'],
        'dateCreated' => $postData['dateCreated'],
        'dateEmbargoUntil' => isset($postData['dateEmbargo']) && trim($postData['dateEmbargo']) !== ''
            ? trim($postData['dateEmbargo']) : null,
        'resourceType' => (int) $postData['resourcetype'],
        'version' => isset($postData['version']) && trim($postData['version']) !== ''
            ? (float) $postData['version'] : null,
        'language' => (int) $postData['language'],
        'rights' => (int) $postData['Rights']
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

    $stmt->execute();
    return $stmt->insert_id;
}

/**
 * Saves titles for a resource, handling duplicates.
 *
 * @param mysqli $connection The database connection
 * @param int $resource_id The resource ID
 * @param array $titles Array of titles
 * @param array $titleTypes Array of title types
 * @return bool True if successful, false otherwise
 */
function saveTitles($connection, $resource_id, $titles, $titleTypes)
{
    $uniqueTitles = [];
    for ($i = 0; $i < count($titles); $i++) {
        $key = $titles[$i] . '|' . $titleTypes[$i];
        if (!isset($uniqueTitles[$key])) {
            $uniqueTitles[$key] = [
                'text' => $titles[$i],
                'type' => $titleTypes[$i]
            ];
        }
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
            return false;
        }
    }

    return true;
}