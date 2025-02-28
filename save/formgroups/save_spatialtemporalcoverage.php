<?php
require_once __DIR__ . '/../validation.php';

function saveSpatialTemporalCoverage($connection, $postData, $resource_id)
{
    // Basic array field validation
    $requiredArrayFields = [
        'tscLatitudeMin',
        'tscLongitudeMin',
        'tscDescription',
        'tscDateStart',
        'tscDateEnd',
        'tscTimezone'
    ];

    // Ensure arrays exist
    foreach ($requiredArrayFields as $field) {
        if (!isset($postData[$field]) || !is_array($postData[$field])) {
            return false;
        }
    }

    // Get the length from any of the required arrays
    $len = count($postData['tscLatitudeMin']);
    $allSuccessful = true;

    for ($i = 0; $i < $len; $i++) {
        // Extract data for easier handling
        $entry = [
            'latitudeMin' => $postData['tscLatitudeMin'][$i] ?? '',
            'latitudeMax' => $postData['tscLatitudeMax'][$i] ?? '',
            'longitudeMin' => $postData['tscLongitudeMin'][$i] ?? '',
            'longitudeMax' => $postData['tscLongitudeMax'][$i] ?? '',
            'description' => $postData['tscDescription'][$i] ?? '',
            'dateStart' => $postData['tscDateStart'][$i] ?? '',
            'dateEnd' => $postData['tscDateEnd'][$i] ?? '',
            'timeStart' => $postData['tscTimeStart'][$i] ?? '',
            'timeEnd' => $postData['tscTimeEnd'][$i] ?? '',
            'timezone' => $postData['tscTimezone'][$i] ?? ''
        ];

        if (!validateSTCDependencies($entry)) {
            $allSuccessful = false;
            continue;
        }

        // Prepare optional fields
        $entry['latitudeMax'] = empty($entry['latitudeMax']) ? NULL : $entry['latitudeMax'];
        $entry['longitudeMax'] = empty($entry['longitudeMax']) ? NULL : $entry['longitudeMax'];
        $entry['timeStart'] = empty($entry['timeStart']) ? NULL : $entry['timeStart'];
        $entry['timeEnd'] = empty($entry['timeEnd']) ? NULL : $entry['timeEnd'];

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
