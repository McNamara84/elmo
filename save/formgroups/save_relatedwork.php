<?php
require_once __DIR__ . '/../validation.php';
/**
 * Saves the related work information into the database.
 *
 * This function processes the input data for related work, saving entries
 * where all fields in a row are filled. It saves the data into the database
 * and creates the linkage to the resource.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return bool Returns true if saving was successful, false otherwise.
 *
 * @throws mysqli_sql_exception If a database error occurs.
 */
function saveRelatedWork($connection, $postData, $resource_id)
{
    // Check if the required arrays exist
    if (
        !isset($postData['rIdentifier'], $postData['relation'], $postData['rIdentifierType']) ||
        !is_array($postData['rIdentifier']) || !is_array($postData['relation']) ||
        !is_array($postData['rIdentifierType'])
    ) {
        return true; // No data provided is valid
    }

    $action = $postData['action'] ?? 'save_and_download';

    $allSuccessful = true;
    $len = count($postData['rIdentifier']);

    for ($i = 0; $i < $len; $i++) {
        $entry = [
            'identifier' => $postData['rIdentifier'][$i] ?? '',
            'relation' => $postData['relation'][$i] ?? '',
            'identifierType' => $postData['rIdentifierType'][$i] ?? ''
        ];

        // Skip if no data provided for this entry
        if (
            $entry['identifier'] === '' &&
            $entry['relation'] === '' &&
            $entry['identifierType'] === ''
        ) {
            continue;
        }

        // Skip if required fields are missing
        if ($entry['identifier'] === '' || $entry['relation'] === '') {
            continue;
        }

        if ($action === 'submit') {
            if (!validateRelatedWorkDependencies($entry)) {
                error_log('Related Work entry validation failed: ' . json_encode($entry));
                $allSuccessful = false;
                continue;
            }

            $relation_id = getRelationId($connection, $entry['relation']);
            $identifier_type_id = getIdentifierTypeId($connection, $entry['identifierType']);

            if ($relation_id === null || $identifier_type_id === null) {
                error_log('Failed to retrieve IDs for Related Work entry : ' . json_encode($entry));
                $allSuccessful = false;
                continue;
            }

        } else {
            if ($entry['relation'] === '' || $entry['relation'] === null) {
                $relation_id = null;
            } else {
                $relation_id = getRelationId($connection, $entry['relation']);
            }

            if ($entry['identifierType'] === '' || $entry['identifierType'] === null) {
                $identifier_type_id = null;
            } else {
                $identifier_type_id = getIdentifierTypeId($connection, $entry['identifierType']);
            }

        }

        $related_work_id = insertRelatedWork(
            $connection,
            $entry['identifier'],
            $relation_id,
            $identifier_type_id
        );

        if ($related_work_id) {
            linkResourceToRelatedWork($connection, $resource_id, $related_work_id);
        } else {
            error_log('Failed to link resource to Related Work for entry: ' . json_encode($entry));
            if ($action === 'submit') {
                $allSuccessful = false;
            }
        }
    }

    return $allSuccessful;
}

/**
 * Retrieves the relation id based on name or numeric ID.
 * @param mysqli $connection The database connection.
 * @param string|int $relationNameOrId The relation name or ID to search for.
 *
 * @return int|null The found relation ID or null if not found.
 */
function getRelationId(mysqli $connection, string|int $relationNameOrId): ?int
{
    // If numeric, verify the ID exists
    if (is_numeric($relationNameOrId)) {
        $stmt = $connection->prepare("SELECT `relation_id` FROM `Relation` WHERE `relation_id` = ?");
        if (!$stmt) {
            error_log("Failed to prepare statement for getRelationId: " . $connection->error);
            return null;
        }
        $id = (int)$relationNameOrId;
        $stmt->bind_param("i", $id);
    } else {
        // Search by name
        $stmt = $connection->prepare("SELECT `relation_id` FROM `Relation` WHERE `name` = ?");
        if (!$stmt) {
            error_log("Failed to prepare statement for getRelationId: " . $connection->error);
            return null;
        }
        $stmt->bind_param("s", $relationNameOrId);
    }
    
    if (!$stmt->execute()) {
        error_log("Failed to execute statement for getRelationId: " . $stmt->error);
        $stmt->close();
        return null;
    }
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row ? (int)$row['relation_id'] : null;
}

/**
 * Retrieves the identifier type ID based on the given name.
 *
 * @param mysqli $connection           The database connection.
 * @param string $identifier_type_name The name of the identifier type.
 *
 * @return int|null The found identifier type ID or null if not found.
 */
function getIdentifierTypeId(mysqli $connection,string $identifier_type_name): ?int
{
    $stmt = $connection->prepare("SELECT `identifier_type_id` FROM `Identifier_Type` WHERE `name` = ?");
    if (!$stmt) {
        error_log("Failed to prepare statement for getIdentifierTypeId: " . $connection->error);
        return null;
    }
    $stmt->bind_param("s", $identifier_type_name);
    if (!$stmt->execute()) {
        error_log("Failed to execute statement for getIdentifierTypeId: " . $stmt->error);
        $stmt->close();
        return null;
    }
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    $result = $row ? (int)$row['identifier_type_id'] : null;
    error_log("I found the id for the idType. it is " . $result);
    return $result;
}

/**
 * Inserts a related work entry into the database.
 *
 * @param mysqli $connection         The database connection.
 * @param string $identifier         The identifier of the related work.
 * @param int    $relation_id        The relation ID.
 * @param int    $identifier_type_id The identifier type ID.
 *
 * @return int|null The ID of the inserted related work entry or null on failure.
 */
function insertRelatedWork($connection, $identifier, $relation_id, $identifier_type_id)
{
    $stmt = $connection->prepare("INSERT INTO Related_Work (`Identifier`, `relation_fk`, `identifier_type_fk`) VALUES (?, ?, ?)");
    if (!$stmt) {
        error_log("Error preparing statement for insertRelatedWork: " . $connection->error);
        return false;
    }
    $stmt->bind_param("sii", $identifier, $relation_id, $identifier_type_id);
    if ($stmt->execute()) {
        $related_work_id = $stmt->insert_id;
        $stmt->close();
        return $related_work_id;
    } else {
        error_log("Error inserting Related Work: " . $stmt->error);
        $stmt->close();
        return false;
    }
}

/**
 * Links a resource to a related work entry.
 *
 * @param mysqli $connection      The database connection.
 * @param int    $resource_id     The ID of the resource.
*/
function linkResourceToRelatedWork($connection, $resource_id, $related_work_id)
{
    $stmt = $connection->prepare("INSERT INTO Resource_has_Related_Work (`Resource_resource_id`, `Related_Work_related_work_id`) VALUES (?, ?)");
    if (!$stmt) {
        error_log("Error preparing statement for linkResourceToRelatedWork: " . $connection->error);
        return;
    }
    $stmt->bind_param("ii", $resource_id, $related_work_id);
    if (!$stmt->execute()) {
        error_log("Error executing statement for linkResourceToRelatedWork: " . $stmt->error);
    }
    $stmt->close();
}
