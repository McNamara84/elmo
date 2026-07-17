<?php
require_once __DIR__ . '/../validation.php';

if (!function_exists('isEmptyArray')) {
    function isEmptyArray($arr) {
        if (!isset($arr) || !is_array($arr) || count($arr) === 0) {
            return true;
        }

        foreach ($arr as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }
}

function saveSpatialTemporalCoverage($connection, $postData, $resource_id)
{
    global $showGGMsProperties;

    $action = $postData['action'] ?? 'save_and_download';

    // If NO STC data provided at all, return early (it's optional)
    // Only skip if BOTH spatial and temporal fields are empty
    if (
        isEmptyArray($postData['tscLatitudeMin']) &&  //AND
        isEmptyArray($postData['tscLatitudeMax']) &&
        isEmptyArray($postData['tscLongitudeMin']) &&
        isEmptyArray($postData['tscLongitudeMax']) &&
        isEmptyArray($postData['tscDescription']) &&
        isEmptyArray($postData['tscDateStart']) &&
        isEmptyArray($postData['tscDateEnd']) &&
        isEmptyArray($postData['tscTimeStart']) &&
        isEmptyArray($postData['tscTimeEnd']) 
    ) {
        return true;
    }
    // Get the length from any of the provided arrays (latitude, longitude, or date)
    $len = count($postData['tscLatitudeMin'] ?? $postData['tscLongitudeMin'] ?? $postData['tscDateStart'] ?? []);
    $allSuccessful = true;

    for ($i = 0; $i < $len; $i++) {
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
        // Only validate on submit
        if ($action === 'submit') {
            $hasAnySpatial = (trim($entry['latitudeMin'] ?? '') !== '') || (trim($entry['latitudeMax'] ?? '') !== '')
                          || (trim($entry['longitudeMin'] ?? '') !== '') || (trim($entry['longitudeMax'] ?? '') !== '');
            $hasAnyData = $hasAnySpatial
                       || (trim($entry['dateStart'] ?? '') !== '')
                       || (trim($entry['dateEnd'] ?? '') !== '')
                       || (trim($entry['description'] ?? '') !== '');
            if (!$hasAnyData) {
                continue;
            }

            // Check required fields: latitudeMin and longitudeMin (0 is allowed, empty strings are not)
            if (!validateSTCDependencies($entry)) {
                $allSuccessful = false;
                continue;
            }

        } else {
            $hasAnySpatial = (trim($entry['latitudeMin'] ?? '') !== '') || (trim($entry['latitudeMax'] ?? '') !== '')
                          || (trim($entry['longitudeMin'] ?? '') !== '') || (trim($entry['longitudeMax'] ?? '') !== '');
            $hasAnyData = $hasAnySpatial
                       || (trim($entry['dateStart'] ?? '') !== '')
                       || (trim($entry['dateEnd'] ?? '') !== '')
                       || (trim($entry['description'] ?? '') !== '');
            if (!$hasAnyData) {
                continue;
            }
        }

        // Prepare optional fields - convert empty strings to NULL for database
        // Use strict comparison (=== '') instead of empty() because empty('0') returns true,
        // which would incorrectly convert valid coordinate values like 0 (equator/prime meridian) to NULL
        $entry['latitudeMin']  = (trim($entry['latitudeMin'] ?? '') === '')  ? NULL : $entry['latitudeMin'];
        $entry['latitudeMax']  = (trim($entry['latitudeMax'] ?? '') === '')  ? NULL : $entry['latitudeMax'];
        $entry['longitudeMin'] = (trim($entry['longitudeMin'] ?? '') === '') ? NULL : $entry['longitudeMin'];
        $entry['longitudeMax'] = (trim($entry['longitudeMax'] ?? '') === '') ? NULL : $entry['longitudeMax'];
        $entry['dateStart'] = (trim($entry['dateStart'] ?? '') === '') ? NULL : $entry['dateStart'];
        $entry['dateEnd'] = (trim($entry['dateEnd'] ?? '') === '') ? NULL : $entry['dateEnd'];
        $entry['timeStart'] = (trim($entry['timeStart'] ?? '') === '') ? NULL : $entry['timeStart'];
        $entry['timeEnd'] = (trim($entry['timeEnd'] ?? '') === '') ? NULL : $entry['timeEnd'];
        $entry['description'] = (trim($entry['description'] ?? '') === '') ? NULL : $entry['description'];

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
