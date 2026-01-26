<?php
require_once __DIR__ . '/../validation.php';

function saveSpatialTemporalCoverage($connection, $postData, $resource_id)
{
    // If no STC data provided, treat as successful (it's optional)
    if (!isset($postData['tscLatitudeMin']) || !is_array($postData['tscLatitudeMin']) || count($postData['tscLatitudeMin']) === 0 ||
        !isset($postData['tscDateStart']) || !is_array($postData['tscDateStart']) || count($postData['tscDateStart']) === 0 ) {
        return true;
    }
    // Basic array field validation - only truly required fields
    $requiredArrayFields = [
        'tscLatitudeMin',
        'tscLongitudeMin',
        'tscDateStart',
    ];

    // Ensure required arrays exist
    foreach ($requiredArrayFields as $field) {
        if (!isset($postData[$field]) || !is_array($postData[$field])) {
            return false;
        }
    }

    // Get the length from any of the required arrays
    $len = count($postData['tscLatitudeMin']);
    $allSuccessful = true;

    for ($i = 0; $i < $len; $i++) {
        // Extract data for easier handling - include latitudeMax which was missing
        $entry = [
            'latitudeMin' => $postData['tscLatitudeMin'][$i] ?? NULL,
            'latitudeMax' => $postData['tscLatitudeMax'][$i] ?? NULL,
            'longitudeMin' => $postData['tscLongitudeMin'][$i] ?? NULL,
            'longitudeMax' => $postData['tscLongitudeMax'][$i] ?? NULL,
            'description' => $postData['tscDescription'][$i] ?? NULL,
            'dateStart' => $postData['tscDateStart'][$i] ?? NULL,
            'dateEnd' => $postData['tscDateEnd'][$i] ?? NULL,
            'timeStart' => $postData['tscTimeStart'][$i] ?? NULL,
            'timeEnd' => $postData['tscTimeEnd'][$i] ?? NULL,
            'timezone' => $postData['tscTimezone'][$i] ?? NULL
        ];

        if (!validateSTCDependencies($entry)) {
            $allSuccessful = false;
            continue;
        }

        // Prepare optional fields - convert empty strings to NULL for database
        // Use strict comparison (=== '') instead of empty() because empty('0') returns true,
        // which would incorrectly convert valid coordinate values like 0 (equator/prime meridian) to NULL
        $entry['latitudeMin']  = (trim($entry['latitudeMin'] ?? '') === '')  ? NULL : $entry['latitudeMin'];
        $entry['latitudeMax']  = (trim($entry['latitudeMax'] ?? '') === '')  ? NULL : $entry['latitudeMax'];
        $entry['longitudeMin'] = (trim($entry['longitudeMin'] ?? '') === '') ? NULL : $entry['longitudeMin'];
        $entry['longitudeMax'] = (trim($entry['longitudeMax'] ?? '') === '') ? NULL : $entry['longitudeMax'];
        $entry['timeStart'] = (trim($entry['timeStart'] ?? '') === '') ? NULL : $entry['timeStart'];
        $entry['timeEnd'] = (trim($entry['timeEnd'] ?? '') === '') ? NULL : $entry['timeEnd'];
        $entry['dateEnd'] = (trim($entry['dateEnd'] ?? '') === '') ? NULL : $entry['dateEnd'];
        $entry['description'] = (trim($entry['description'] ?? '') === '') ? NULL : $entry['description'];

        // Check required fields using strict comparison (allows 0 values for coordinates)
        // Both latitudeMin and longitudeMin are required for a valid coordinate pair
        if (
            (trim($entry['latitudeMin'] ?? '') === '') ||
            (trim($entry['longitudeMin'] ?? '') === '') ||
            (trim($entry['dateStart'] ?? '') === '')
        ) {
            return true;
        }
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
    // temporary measure before ERNIE implementation
    // reason: the old editor can't handle Date+Timezone 
    error_log("Starting stc insertion with data: " . print_r($stcData, true));
    if ($stcData['timeStart'] === NULL || $stcData['timeEnd'] === NULL) {
        error_log("Nullifying timezone due to missing timeStart or timeEnd");
        $stcData['timezone'] = NULL;
        error_log("Timezone after nullification: " . var_export($stcData['timezone'], true));
    }
    
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
