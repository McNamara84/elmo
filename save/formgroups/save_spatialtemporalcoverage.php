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
        $stcData = [
            'latitudeMin'  => empty($postData['tscLatitudeMin'][$i]) ? null : $postData['tscLatitudeMin'][$i],
            'latitudeMax'  => empty($postData['tscLatitudeMax'][$i]) ? null : $postData['tscLatitudeMax'][$i],
            'longitudeMin' => empty($postData['tscLongitudeMin'][$i]) ? null : $postData['tscLongitudeMin'][$i],
            'longitudeMax' => empty($postData['tscLongitudeMax'][$i]) ? null : $postData['tscLongitudeMax'][$i],
            'description'  => empty($postData['tscDescription'][$i]) ? null : $postData['tscDescription'][$i],
            'dateStart'    => empty($postData['tscDateStart'][$i]) ? null : $postData['tscDateStart'][$i],
            'dateEnd'      => empty($postData['tscDateEnd'][$i]) ? null : $postData['tscDateEnd'][$i],
            'timeStart'    => empty($postData['tscTimeStart'][$i]) ? null : $postData['tscTimeStart'][$i],
            'timeEnd'      => empty($postData['tscTimeEnd'][$i]) ? null : $postData['tscTimeEnd'][$i],
            'timezone'     => empty($postData['tscTimezone'][$i]) ? null : $postData['tscTimezone'][$i]
        ];

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
