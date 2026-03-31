<?php
/**
 * Saves used instruments as Related Work entries with relationType "IsCollectedBy".
 *
 * Instruments from the PID4INST vocabulary are stored in the Related_Work table
 * using the same structure as other related identifiers. The relation type is
 * always "IsCollectedBy" and the identifier type comes from the pidType field
 * (typically "Handle").
 *
 * This file reuses helper functions from save_relatedwork.php:
 * - getRelationId() - resolves "IsCollectedBy" to its DB ID
 * - getIdentifierTypeId() - resolves pidType (e.g. "Handle") to its DB ID
 * - insertRelatedWork() - inserts into Related_Work table
 * - linkResourceToRelatedWork() - creates Resource_has_Related_Work link
 */

require_once __DIR__ . '/save_relatedwork.php';

/**
 * Saves used instruments into the database as related work entries.
 *
 * Each instrument is stored with:
 * - Identifier: the PID value (e.g. "21.11157/1234")
 * - Relation: "IsCollectedBy" (fixed)
 * - Identifier Type: from pidType field (dynamic, typically "Handle")
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return bool Returns true if saving was successful, false otherwise.
 *
 * @throws mysqli_sql_exception If a database error occurs.
 */
function saveUsedInstruments($connection, $postData, $resource_id)
{
    // Check if instrument data exists
    if (
        !isset($postData['instrumentPid']) ||
        !is_array($postData['instrumentPid']) ||
        empty($postData['instrumentPid'])
    ) {
        return true; // No instrument data provided is valid
    }

    $action = $postData['action'] ?? 'save_and_download';
    $allSuccessful = true;

    // The relation type for instruments is always "IsCollectedBy"
    $relationName = 'IsCollectedBy';
    $relation_id = getRelationId($connection, $relationName);

    if ($relation_id === null) {
        error_log("Failed to resolve relation ID for '$relationName'");
        return false;
    }

    $pids = $postData['instrumentPid'];
    $pidTypes = $postData['instrumentPidType'] ?? [];
    $len = count($pids);

    for ($i = 0; $i < $len; $i++) {
        $pid = trim($pids[$i] ?? '');
        $pidType = trim($pidTypes[$i] ?? 'Handle');

        // Skip empty entries
        if ($pid === '') {
            continue;
        }

        // Resolve the identifier type from the pidType value
        $identifier_type_id = getIdentifierTypeId($connection, $pidType);

        if ($identifier_type_id === null) {
            error_log("Failed to resolve identifier type for PID type '$pidType'");
            if ($action === 'submit') {
                $allSuccessful = false;
            }
            continue;
        }

        // Insert the instrument as a related work entry
        $related_work_id = insertRelatedWork(
            $connection,
            $pid,
            $relation_id,
            $identifier_type_id
        );

        if ($related_work_id) {
            linkResourceToRelatedWork($connection, $resource_id, $related_work_id);
        } else {
            error_log("Failed to save instrument with PID '$pid'");
            if ($action === 'submit') {
                $allSuccessful = false;
            }
        }
    }

    return $allSuccessful;
}
