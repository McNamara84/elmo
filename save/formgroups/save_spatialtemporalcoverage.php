<?php
/**
 * Validates a single Spatial Temporal Coverage (STC) entry.
 *
 * @param array $entry The STC entry data.
 * @return bool Returns true if the entry is valid, otherwise false.
 */
function validateSpatialTemporalEntry($entry)
{
    // Check if all fields are empty
    if (empty($entry['latitudeMin']) && empty($entry['latitudeMax']) &&
        empty($entry['longitudeMin']) && empty($entry['longitudeMax']) &&
        empty($entry['description']) && empty($entry['dateStart']) &&
        empty($entry['dateEnd']) && empty($entry['timeStart']) &&
        empty($entry['timeEnd']) && empty($entry['timezone'])) {
        return false; // Skip saving if all fields are empty
    }

    // Validate required fields when any field is filled
    if (empty($entry['latitudeMin']) || empty($entry['longitudeMin']) ||
        empty($entry['description']) || empty($entry['dateStart']) ||
        empty($entry['dateEnd']) || empty($entry['timezone'])) {
        return false;
    }

    // Validate time fields (if timeStart is given, timeEnd is mandatory)
    if (!empty($entry['timeStart']) && empty($entry['timeEnd'])) {
        return false;
    }

    // Validate latitudeMax and longitudeMax (both should be filled together)
    if (!empty($entry['longitudeMax']) && empty($entry['latitudeMax'])) {
        return false;
    }

    return true;
}

/**
 * Saves the Spatial Temporal Coverage (STC) information into the database.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return bool Returns true if the saving was successful, otherwise false.
 */
function saveSpatialTemporalCoverage($connection, $postData, $resource_id)
{
    $len = isset($postData['tscLatitudeMin']) ? count($postData['tscLatitudeMin']) : 0;
    $allSuccessful = true;

    for ($i = 0; $i < $len; $i++) {
        // Extract data for easier handling
        $entry = [
            'latitudeMin'  => $postData['tscLatitudeMin'][$i]  ?? null,
            'latitudeMax'  => $postData['tscLatitudeMax'][$i]  ?? null,
            'longitudeMin' => $postData['tscLongitudeMin'][$i] ?? null,
            'longitudeMax' => $postData['tscLongitudeMax'][$i] ?? null,
            'description'  => $postData['tscDescription'][$i]  ?? null,
            'dateStart'    => $postData['tscDateStart'][$i]    ?? null,
            'dateEnd'      => $postData['tscDateEnd'][$i]      ?? null,
            'timeStart'    => $postData['tscTimeStart'][$i]    ?? null,
            'timeEnd'      => $postData['tscTimeEnd'][$i]      ?? null,
            'timezone'     => $postData['tscTimezone'][$i]     ?? null
        ];

        if (!validateSpatialTemporalEntry($entry)) {
            $allSuccessful = false;
            continue;
        }

        // Prepare data to be saved
        $entry['latitudeMax']  = empty($entry['latitudeMax']) ? NULL : $entry['latitudeMax'];
        $entry['longitudeMax'] = empty($entry['longitudeMax']) ? NULL : $entry['longitudeMax'];
        $entry['timeStart']    = empty($entry['timeStart']) ? NULL : $entry['timeStart'];
        $entry['timeEnd']      = empty($entry['timeEnd']) ? NULL : $entry['timeEnd'];

        // Save STC entry
        $stc_id = insertSpatialTemporalCoverage($connection, $entry);
        if ($stc_id) {
            linkResourceToSTC($connection, $resource_id, $stc_id);
        } else {
            $allSuccessful = false;
        }
    }

    return $allSuccessful;
}


/**
 * Inserts a single Spatial Temporal Coverage entry into the database.
 *
 * @param mysqli $connection The database connection.
 * @param array  $stcData    The data for the STC entry.
 *
 * @return int|null The ID of the inserted STC entry, or null on failure.
 */
function insertSpatialTemporalCoverage($connection, $stcData)
{
    $stmt = $connection->prepare("INSERT INTO Spatial_Temporal_Coverage 
        (`latitudeMin`, `latitudeMax`, `longitudeMin`, `longitudeMax`, `description`, 
         `dateStart`, `dateEnd`, `timeStart`, `timeEnd`, `timezone`) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $stmt->bind_param(
        "ssssssssss",
        $stcData['latitudeMin'],
        $stcData['latitudeMax'],
        $stcData['longitudeMin'],
        $stcData['longitudeMax'],
        $stcData['description'],
        $stcData['dateStart'],
        $stcData['dateEnd'],
        $stcData['timeStart'],
        $stcData['timeEnd'],
        $stcData['timezone']
    );

    if ($stmt->execute()) {
        $stc_id = $stmt->insert_id;
        $stmt->close();
        return $stc_id;
    } else {
        error_log("Error inserting STC: " . $stmt->error);
        $stmt->close();
        return null;
    }
}

/**
 * Links a resource to a Spatial Temporal Coverage entry.
 *
 * @param mysqli $connection  The database connection.
 * @param int    $resource_id The ID of the resource.
 * @param int    $stc_id      The ID of the STC entry.
 *
 * @return void
 */
function linkResourceToSTC($connection, $resource_id, $stc_id)
{
    $stmt = $connection->prepare("INSERT INTO Resource_has_Spatial_Temporal_Coverage 
        (`Resource_resource_id`, `Spatial_Temporal_Coverage_spatial_temporal_coverage_id`) 
        VALUES (?, ?)");
    $stmt->bind_param("ii", $resource_id, $stc_id);
    $stmt->execute();
    $stmt->close();
}
