<?php
require_once __DIR__ . '/save_affiliations.php';

/**
 * Saves the originating laboratories in the database.
 *
 * @param mysqli $connection  The database connection
 * @param array  $postData    The POST data from the form
 * @param int    $resource_id The ID of the associated resource
 *
 * @return bool Returns true if saving was successful, false otherwise
 */
function saveOriginatingLaboratories($connection, $postData, $resource_id)
{
    // Validate dependencies only if laboratories are provided
    if (isset($postData['laboratoryName']) && is_array($postData['laboratoryName'])) {
        $dependencies = [
            ['primary' => 'laboratoryName', 'dependent' => 'laboratoryAffiliation']
        ];
        if (!validateArrayDependencies($postData, $dependencies)) {
            return false;
        }
    }

    $success = true;
    $len = count($postData['laboratoryName']);

    for ($i = 0; $i < $len; $i++) {

        // Parse laboratory name
        $labNameData = $postData['laboratoryName'][$i];

        $labNameArray = json_decode($labNameData, true);
        if (!$labNameArray || !isset($labNameArray[0]['value'])) {
            continue;
        }

        $labName = $labNameArray[0]['value'];
        $labId = isset($postData['LabId'][$i]) ? $postData['LabId'][$i] : null;

        // Parse affiliation data
        $affiliation = null;
        $rorId = null;

        if (isset($postData['laboratoryAffiliation'][$i])) {
            $affiliationData = $postData['laboratoryAffiliation'][$i];


            $affiliationArray = json_decode($affiliationData, true);
            if ($affiliationArray && isset($affiliationArray[0]['value'])) {
                $affiliation = $affiliationArray[0]['value'];
            }
        }

        if (isset($postData['laboratoryRorIds'][$i])) {
            $rorData = $postData['laboratoryRorIds'][$i];

            $rorArray = json_decode($rorData, true);
            if ($rorArray && isset($rorArray[0]['value'])) {
                $rorId = $rorArray[0]['value'];
            } else {
                $rorId = $rorData;
            }
        }

        // Save laboratory
        if (!empty($labName)) {
            try {
                $lab_id = saveOrUpdateOriginatingLaboratory($connection, $labName, $labId);

                if (!$lab_id) {
                    $success = false;
                    continue;
                }

                $linkResult = linkResourceToOriginatingLaboratory($connection, $resource_id, $lab_id);

                if (!$linkResult) {
                    $success = false;
                    continue;
                }

                if (!empty($affiliation)) {
                    $affiliation_id = saveLabAffiliation($connection, $affiliation, $rorId);

                    if ($affiliation_id) {
                        $linkAffResult = linkLaboratoryToAffiliation($connection, $lab_id, $affiliation_id);

                        if (!$linkAffResult) {
                            $success = false;
                        }
                    } else {
                        $success = false;
                    }
                }
            } catch (Exception $e) {
                $success = false;
            }
        } else {
            error_log("Empty laboratory name, skipping");
        }
    }

    return $success;
}

/**
 * Saves or updates an originating laboratory in the database.
 * Uses UPSERT operation to handle duplicate entries.
 *
 * @param mysqli      $connection The database connection
 * @param string     $labName    The name of the laboratory
 * @param string|null $labId      The ID of the laboratory
 *
 * @return int|false The ID of the saved or updated laboratory, or false on failure
 */
function saveOrUpdateOriginatingLaboratory($connection, $labName, $labId)
{
    try {
        $stmt = $connection->prepare("INSERT INTO Originating_Laboratory (laboratoryname, labId) 
                                    VALUES (?, ?) 
                                    ON DUPLICATE KEY UPDATE 
                                        laboratoryname = VALUES(laboratoryname),
                                        labId = COALESCE(VALUES(labId), labId)");
        $stmt->bind_param("ss", $labName, $labId);

        if (!$stmt->execute()) {
            $stmt->close();
            return false;
        }

        $id = $stmt->insert_id ?: $connection->insert_id;
        $stmt->close();

        if (!$id) {
            // If no insert ID (because of update), get the existing ID
            $stmt = $connection->prepare("SELECT originating_laboratory_id FROM Originating_Laboratory WHERE laboratoryname = ?");
            $stmt->bind_param("s", $labName);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $id = $row['originating_laboratory_id'];
            $stmt->close();
        }

        return $id;
    } catch (mysqli_sql_exception $e) {
        error_log("Database error in saveOrUpdateOriginatingLaboratory: " . $e->getMessage());
        return false;
    }
}


/**
 * Saves an affiliation into the database using the preferred name from ROR.
 * Handles ROR ID processing and avoids duplicate entries.
 *
 * @param mysqli      $connection       The database connection
 * @param string     $affiliation_name The name of the affiliation (not used anymore)
 * @param string|null $rorId           The ROR ID (can be full URL)
 *
 * @return int|false The ID of the saved affiliation, or false on failure
 */
function saveLabAffiliation($connection, $affiliation_name, $rorId)
{
    try {
        // If no ROR ID provided, return false
        if (!$rorId) {
            error_log("No ROR ID provided for affiliation");
            return false;
        }

        // Load the affiliations JSON file
        $jsonPath = __DIR__ . '/../../json/affiliations.json';
        if (!file_exists($jsonPath)) {
            error_log("Affiliations JSON file not found at: " . $jsonPath);
            return false;
        }

        $affiliationsJson = file_get_contents($jsonPath);
        $affiliations = json_decode($affiliationsJson, true);

        if (!$affiliations) {
            error_log("Failed to parse affiliations JSON");
            return false;
        }

        // Clean ROR ID if provided
        $cleanRorId = str_replace("https://ror.org/", "", $rorId);
        $fullRorId = "https://ror.org/" . $cleanRorId;

        // Find the matching affiliation in the JSON
        $matchingAffiliation = null;
        foreach ($affiliations as $affiliation) {
            if ($affiliation['id'] === $fullRorId) {
                $matchingAffiliation = $affiliation;
                break;
            }
        }

        if (!$matchingAffiliation) {
            error_log("No matching affiliation found for ROR ID: " . $fullRorId);
            return false;
        }

        // Use the preferred name from the JSON file
        $preferredName = $matchingAffiliation['name'];

        // Check if the affiliation already exists
        $stmt = $connection->prepare("SELECT affiliation_id FROM Affiliation WHERE rorId = ?");
        $stmt->bind_param("s", $cleanRorId);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            $row = $result->fetch_assoc();

            // Update the name to ensure it matches the current preferred name
            $updateStmt = $connection->prepare("UPDATE Affiliation SET name = ? WHERE affiliation_id = ?");
            $updateStmt->bind_param("si", $preferredName, $row['affiliation_id']);
            $updateStmt->execute();
            $updateStmt->close();

            $stmt->close();
            return $row['affiliation_id']; // Return the existing ID
        }
        $stmt->close();

        // Insert a new affiliation if it doesn't exist
        $stmt = $connection->prepare("INSERT INTO Affiliation (name, rorId) VALUES (?, ?)");
        $stmt->bind_param("ss", $preferredName, $cleanRorId);

        if (!$stmt->execute()) {
            $stmt->close();
            return false;
        }

        $id = $stmt->insert_id ?: $connection->insert_id;
        $stmt->close();

        return $id;
    } catch (mysqli_sql_exception $e) {
        error_log("Database error in saveLabAffiliation: " . $e->getMessage());
        return false;
    }
}


/**
 * Links a resource to an originating laboratory.
 * Uses INSERT IGNORE to handle duplicate entries safely.
 *
 * @param mysqli $connection  The database connection
 * @param int    $resource_id The ID of the resource
 * @param int    $lab_id      The ID of the originating laboratory
 *
 * @return bool True if link was created successfully, false otherwise
 */
function linkResourceToOriginatingLaboratory($connection, $resource_id, $lab_id)
{
    try {
        $stmt = $connection->prepare("INSERT IGNORE INTO Resource_has_Originating_Laboratory 
                                    (Resource_resource_id, Originating_Laboratory_originating_laboratory_id) 
                                    VALUES (?, ?)");
        $stmt->bind_param("ii", $resource_id, $lab_id);

        $result = $stmt->execute();
        $stmt->close();

        return $result;
    } catch (mysqli_sql_exception $e) {
        error_log("Database error in linkResourceToOriginatingLaboratory: " . $e->getMessage());
        return false;
    }
}

/**
 * Links an originating laboratory to an affiliation.
 * Ensures that the lab-affiliation relationship is created only if it doesn't already exist.
 *
 * @param mysqli $connection     The database connection
 * @param int    $lab_id         The ID of the originating laboratory
 * @param int    $affiliation_id The ID of the affiliation
 *
 * @return bool True if the link was created successfully or already exists, false otherwise
 */
function linkLaboratoryToAffiliation($connection, $lab_id, $affiliation_id)
{
    try {
        // Check if the lab-affiliation link already exists
        $stmt = $connection->prepare("SELECT 1 FROM Originating_Laboratory_has_Affiliation 
                                      WHERE Originating_Laboratory_originating_laboratory_id = ? 
                                      AND Affiliation_affiliation_id = ?");
        $stmt->bind_param("ii", $lab_id, $affiliation_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $exists = $result->num_rows > 0;
        $stmt->close();

        if ($exists) {
            return true; // Link already exists
        }

        // Insert the new link if it doesn't exist
        $stmt = $connection->prepare("INSERT INTO Originating_Laboratory_has_Affiliation 
                                      (Originating_Laboratory_originating_laboratory_id, Affiliation_affiliation_id) 
                                      VALUES (?, ?)");
        $stmt->bind_param("ii", $lab_id, $affiliation_id);

        $result = $stmt->execute();
        $stmt->close();

        return $result;
    } catch (mysqli_sql_exception $e) {
        error_log("Database error in linkLaboratoryToAffiliation: " . $e->getMessage());
        return false;
    }
}
