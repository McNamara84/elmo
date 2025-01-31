<?php
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
        // Extract data for easier validation
        $latitudeMin  = $postData['tscLatitudeMin'][$i];
        $latitudeMax  = $postData['tscLatitudeMax'][$i];
        $longitudeMin = $postData['tscLongitudeMin'][$i];
        $longitudeMax = $postData['tscLongitudeMax'][$i];
        $description  = $postData['tscDescription'][$i];
        $dateStart    = $postData['tscDateStart'][$i];
        $dateEnd      = $postData['tscDateEnd'][$i];
        $timeStart    = $postData['tscTimeStart'][$i];
        $timeEnd      = $postData['tscTimeEnd'][$i];
        $timezone     = $postData['tscTimezone'][$i];

        // Check if all fields are empty
        if (empty($latitudeMin) && empty($latitudeMax) && empty($longitudeMin) && empty($longitudeMax) && empty($description) && empty($dateStart) && empty($dateEnd) && empty($timeStart) && empty($timeEnd) && empty($timezone)) {
            continue; // Skip saving if all fields are empty
        }

        // Validate required fields when any field is filled
        if (empty($latitudeMin) || empty($longitudeMin) || empty($description) || empty($dateStart) || empty($dateEnd) || empty($timezone)) {
            $allSuccessful = false;
            continue; // Skip this entry if any required fields are missing
        }

        // Validate time fields (if timeStart is given, timeEnd is mandatory)
        if (!empty($timeStart) && empty($timeEnd)) {
            $allSuccessful = false;
            continue;
        }

        // Validate latitudeMax and longitudeMax
        if (!empty($longitudeMax) && empty($latitudeMax)) {
            $allSuccessful = false;
            continue;
        }

        // Prepare data to be saved
        $stcData = [
            'latitudeMin'  => $latitudeMin,
            'latitudeMax'  => $latitudeMax,
            'longitudeMin' => $longitudeMin,
            'longitudeMax' => $longitudeMax,
            'description'  => $description,
            'dateStart'    => $dateStart,
            'dateEnd'      => $dateEnd,
            'timeStart'    => empty($timeStart) ? NULL : $timeStart,
            'timeEnd'      => empty($timeEnd) ? NULL : $timeEnd,
            'timezone'     => $timezone
        ];

        // Save STC entry
        $stc_id = insertSpatialTemporalCoverage($connection, $stcData);
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
