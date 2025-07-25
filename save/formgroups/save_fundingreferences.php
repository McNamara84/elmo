<?php
require_once __DIR__ . '/../validation.php';
/**
 * Validates that all required funding reference arrays are present.
 *
 * @param array $postData The POST data from the form.
 *
 * @return bool True if all arrays exist, false otherwise.
 */
function fundingReferenceArraysExist($postData)
{
    return isset(
        $postData['funder'],
        $postData['funderId'],
        $postData['grantNummer'],
        $postData['grantName'],
        $postData['awardURI']
    ) &&
        is_array($postData['funder']) &&
        is_array($postData['funderId']) &&
        is_array($postData['grantNummer']) &&
        is_array($postData['grantName']) &&
        is_array($postData['awardURI']);
}

/**
 * Prepares funder ID string and type.
 *
 * @param string $funderId Raw funder ID.
 *
 * @return array Array with the processed funder ID and the ID type.
 */
function prepareFunderIdDetails($funderId)
{
    if (!empty($funderId)) {
        $funderIdString = extractLastTenDigits($funderId);
        $funderIdType = !empty($funderIdString) ? "Crossref Funder ID" : "Unknown";
    } else {
        $funderIdString = null;
        $funderIdType = null;
    }

    return [$funderIdString, $funderIdType];
}

/**
 * Handles storage of a single funding reference entry.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $entry       Funding reference data for one row.
 * @param int    $resource_id Associated resource ID.
 *
 * @return bool True on success, false otherwise.
 */
function saveFundingReferenceEntry($connection, $entry, $resource_id)
{
    if (!validateFundingReferenceDependencies($entry)) {
        return false;
    }

    if (
        empty($entry['funder']) &&
        empty($entry['funderId']) &&
        empty($entry['grantNumber']) &&
        empty($entry['grantName'])
    ) {
        return true;
    }

    [$funderIdString, $funderIdType] = prepareFunderIdDetails($entry['funderId']);
    $awardUri = !empty($entry['awardUri']) ? $entry['awardUri'] : null;

    $funding_reference_id = insertFundingReference(
        $connection,
        $entry['funder'],
        $funderIdString,
        $funderIdType,
        $entry['grantNumber'],
        $entry['grantName'],
        $awardUri
    );

    if (!$funding_reference_id) {
        error_log('Failed to insert Funding Reference');
        return false;
    }

    if (!linkResourceToFundingReference($connection, $resource_id, $funding_reference_id)) {
        error_log('Failed to link resource to funding reference');
        return false;
    }

    return true;
}
/**
 * Saves the funding reference information into the database.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return bool Returns true if the saving was successful, otherwise false.
 */
function saveFundingReferences($connection, $postData, $resource_id)
{
    if (!$resource_id) {
        error_log('Invalid resource_id provided');
        return false;
    }

    if (!fundingReferenceArraysExist($postData)) {
        return true; // No data provided is valid
    }

    $allSuccessful = true;
    $len = count($postData['funder']);

    for ($i = 0; $i < $len; $i++) {
        $entry = [
            'funder' => $postData['funder'][$i] ?? '',
            'funderId' => $postData['funderId'][$i] ?? '',
            'grantNumber' => $postData['grantNummer'][$i] ?? '',
            'grantName' => $postData['grantName'][$i] ?? '',
            'awardUri' => $postData['awardURI'][$i] ?? ''
        ];

        if (!saveFundingReferenceEntry($connection, $entry, $resource_id)) {
            $allSuccessful = false;
        }
    }

    return $allSuccessful;
}

/**
 * Inserts a funding reference into the database if it doesn't already exist.
 *
 * @param mysqli      $connection    The database connection.
 * @param string      $funder        The funder's name.
 * @param string|null $funderId      The funder's ID.
 * @param string|null $funderIdType  The type of the funder's ID.
 * @param string|null $grantNumber   The grant number.
 * @param string|null $grantName     The grant name.
 * @param string|null $awardUri      The award URI.
 *
 * @return int|null Returns the funding reference ID if successful, otherwise null.
 */
function insertFundingReference($connection, $funder, $funderId, $funderIdType, $grantNumber, $grantName, $awardUri)
{
    // Check if the funding reference already exists
    $checkQuery = "
        SELECT funding_reference_id
        FROM Funding_Reference
        WHERE funder = ?
          AND (funderid = ?)
          AND (funderidtyp = ?)
          AND (grantnumber = ?)
          AND (grantname = ?)
          AND (awarduri = ?)";
    $checkStmt = $connection->prepare($checkQuery);
    if (!$checkStmt) {
        error_log("Prepare failed for existence check: " . $connection->error);
        return null;
    }

    $checkStmt->bind_param(
        "ssssss",
        $funder,
        $funderId,
        $funderIdType,
        $grantNumber,
        $grantName,
        $awardUri
    );
    $checkStmt->execute();

    // Fetch the result and check if any funding reference exists
    $checkStmt->bind_result($existingId);
    $checkStmt->fetch();
    $checkStmt->close();

    if ($existingId) {
        // Return the existing ID if a match is found
        return $existingId;
    }

    // Insert a new funding reference if no match is found
    $insertQuery = "
        INSERT INTO Funding_Reference (`funder`, `funderid`, `funderidtyp`, `grantnumber`, `grantname`, `awarduri`)
        VALUES (?, ?, ?, ?, ?, ?)";
    $insertStmt = $connection->prepare($insertQuery);
    if (!$insertStmt) {
        error_log("Prepare failed for insert: " . $connection->error);
        return null;
    }

    $insertStmt->bind_param("ssssss", $funder, $funderId, $funderIdType, $grantNumber, $grantName, $awardUri);

    if ($insertStmt->execute()) {
        $funding_reference_id = $insertStmt->insert_id;
        $insertStmt->close();
        return $funding_reference_id;
    } else {
        error_log("Error inserting Funding Reference: " . $insertStmt->error);
        $insertStmt->close();
        return null;
    }
}

/**
 * Extracts the last ten digits from a given funder ID.
 *
 * @param string $funderId The funder ID.
 *
 * @return string The last ten digits of the numeric part of the funder ID.
 */
function extractLastTenDigits($funderId)
{
    // Remove all non-numeric characters
    $numericOnly = preg_replace('/[^0-9]/', '', $funderId);

    // Extract the last 10 digits
    return substr($numericOnly, -10);
}

/**
 * Links a resource to a funding reference.
 *
 * @param mysqli $connection          The database connection.
 * @param int    $resource_id         The ID of the resource.
 * @param int    $funding_reference_id The ID of the funding reference.
 *
 * @return bool Returns true if the linking was successful, otherwise false.
 */
function linkResourceToFundingReference($connection, $resource_id, $funding_reference_id)
{
    // Check if the IDs are valid
    if (!$resource_id || !$funding_reference_id) {
        return false;
    }

    // Check if the resource exists
    $resourceCheck = $connection->prepare("SELECT resource_id FROM Resource WHERE resource_id = ?");
    $resourceCheck->bind_param("i", $resource_id);
    $resourceCheck->execute();
    if ($resourceCheck->get_result()->num_rows === 0) {
        return false;
    }

    // Check if the funding reference exists
    $fundingCheck = $connection->prepare("SELECT funding_reference_id FROM Funding_Reference WHERE funding_reference_id = ?");
    $fundingCheck->bind_param("i", $funding_reference_id);
    $fundingCheck->execute();
    if ($fundingCheck->get_result()->num_rows === 0) {
        return false;
    }

    // Check if the linkage already exists
    $existingCheck = $connection->prepare(
        "SELECT 1 FROM Resource_has_Funding_Reference 
         WHERE Resource_resource_id = ? AND Funding_Reference_funding_reference_id = ?"
    );
    $existingCheck->bind_param("ii", $resource_id, $funding_reference_id);
    $existingCheck->execute();
    if ($existingCheck->get_result()->num_rows > 0) {
        return true;
    }

    // Create the linkage
    $stmt = $connection->prepare(
        "INSERT INTO Resource_has_Funding_Reference 
         (Resource_resource_id, Funding_Reference_funding_reference_id) 
         VALUES (?, ?)"
    );

    if (!$stmt) {
        return false;
    }

    $stmt->bind_param("ii", $resource_id, $funding_reference_id);

    $success = $stmt->execute();
    if (!$success) {
        $stmt->close();
        return false;
    }

    $stmt->close();
    return true;
}
