<?php
require_once __DIR__ . '/../validation.php';

function saveSpatialTemporalCoverage($connection, $postData, $resource_id)
{
    $action = $postData['action'] ?? 'save_and_download';
    $fieldMap = [
        'latitudeMin' => 'tscLatitudeMin',
        'latitudeMax' => 'tscLatitudeMax',
        'longitudeMin' => 'tscLongitudeMin',
        'longitudeMax' => 'tscLongitudeMax',
        'description' => 'tscDescription',
        'dateStart' => 'tscDateStart',
        'dateEnd' => 'tscDateEnd',
        'timeStart' => 'tscTimeStart',
        'timeEnd' => 'tscTimeEnd',
        'timezone' => 'tscTimezone',
    ];
    $rowCount = 0;

    foreach ($fieldMap as $postField) {
        if (isset($postData[$postField]) && is_array($postData[$postField])) {
            $rowCount = max($rowCount, count($postData[$postField]));
        }
    }

    $entriesToSave = [];
    for ($i = 0; $i < $rowCount; $i++) {
        $entry = [
            'latitudeMin' => null,
            'latitudeMax' => null,
            'longitudeMin' => null,
            'longitudeMax' => null,
            'description' => null,
            'dateStart' => null,
            'dateEnd' => null,
            'timeStart' => null,
            'timeEnd' => null,
            'timezone' => null,
        ];

        foreach ($fieldMap as $entryField => $postField) {
            $values = is_array($postData[$postField] ?? null) ? $postData[$postField] : [];
            $entry[$entryField] = $values[$i] ?? null;
        }

        // A timezone selected by default does not create an otherwise empty STC row.
        $dataFields = array_diff(array_keys($entry), ['timezone']);
        $hasAnyData = false;
        foreach ($dataFields as $field) {
            if (trim((string) ($entry[$field] ?? '')) !== '') {
                $hasAnyData = true;
                break;
            }
        }

        if (!$hasAnyData) {
            continue;
        }

        // Draft saves may persist partial rows; final submit must satisfy all dependencies.
        if ($action === 'submit' && !validateSTCDependencies($entry)) {
            return false;
        }

        // Keep coordinate value 0, but store genuinely empty optional values as NULL.
        foreach (array_keys($entry) as $field) {
            if (trim((string) ($entry[$field] ?? '')) === '') {
                $entry[$field] = null;
            }
        }

        $entriesToSave[] = $entry;
    }

    $allSuccessful = true;
    foreach ($entriesToSave as $entry) {

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
