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

    $allSuccessful = true;
    $len = count($postData['rIdentifier']);

    for ($i = 0; $i < $len; $i++) {
        $entry = [
            'identifier' => $postData['rIdentifier'][$i] ?? '',
            'relation' => $postData['relation'][$i] ?? '',
            'identifierType' => $postData['rIdentifierType'][$i] ?? ''
        ];

        // Validate dependencies for this entry
        if (!validateRelatedWorkDependencies($entry)) {
            $allSuccessful = false;
            continue;
        }

        // Skip if no data provided for this entry
        if (empty($entry['identifier']) && empty($entry['relation']) && empty($entry['identifierType'])) {
            continue;
        }

        $relation_id = getRelationId($connection, $entry['relation']);
        $identifier_type_id = getIdentifierTypeId($connection, $entry['identifierType']);

        if ($relation_id && $identifier_type_id) {
            $related_work_id = insertRelatedWork($connection, $entry['identifier'], $relation_id, $identifier_type_id);
            if ($related_work_id) {
                linkResourceToRelatedWork($connection, $resource_id, $related_work_id);
            } else {
                $allSuccessful = false;
            }
        } else {
            $allSuccessful = false;
        }
    }

    return $allSuccessful;
}

/**
 * Retrieves the relation ID based on the given relation.
 *
 * @param mysqli $connection  The database connection.
 * @param int    $relation_id The relation ID to search for.
 *
 * @return int|null The found relation ID or null if not found.
 */
function getRelationId($connection, $relation_id)
{
    $stmt = $connection->prepare("SELECT `relation_id` FROM `Relation` WHERE `relation_id` = ?");
    $stmt->bind_param("i", $relation_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row ? $row['relation_id'] : null;
}

/**
 * Retrieves the identifier type ID based on the given name.
 *
 * @param mysqli $connection           The database connection.
 * @param string $identifier_type_name The name of the identifier type.
 *
 * @return int|null The found identifier type ID or null if not found.
 */
function getIdentifierTypeId($connection, $identifier_type_name)
{
    $stmt = $connection->prepare("SELECT `identifier_type_id` FROM `Identifier_Type` WHERE `name` = ?");
    $stmt->bind_param("s", $identifier_type_name);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row ? $row['identifier_type_id'] : null;
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
    $stmt->bind_param("sii", $identifier, $relation_id, $identifier_type_id);
    if ($stmt->execute()) {
        $related_work_id = $stmt->insert_id;
        $stmt->close();
        return $related_work_id;
    } else {
        error_log("Error inserting Related Work: " . $stmt->error);
        $stmt->close();
        return null;
    }
}

/**
 * Links a resource to a related work entry.
 *
 * @param mysqli $connection      The database connection.
 * @param int    $resource_id     The ID of the resource.
 * @param int    $related_work_id The ID of the related work entry.
 *
 * @return void
 */
function linkResourceToRelatedWork($connection, $resource_id, $related_work_id)
{
    $stmt = $connection->prepare("INSERT INTO Resource_has_Related_Work (`Resource_resource_id`, `Related_Work_related_work_id`) VALUES (?, ?)");
    $stmt->bind_param("ii", $resource_id, $related_work_id);
    $stmt->execute();
    $stmt->close();
}
