<?php
/**
 * Save script for GGMsProperties form group
 * 
 * Saves GGM Properties characteristics (tide system, degree, errors, etc.)
 * and Ellipsoidal Parameters when applicable.
 * 
 * Reuses existing GGM_Properties record linked via Resource_has_GGM_Properties
 * Validation is handled by XML schema, this script only checks data consistency
 */

/**
 * Inserts Ellipsoidal_Parameters record and links it to resource
 *
 * @param mysqli $connection  Database connection
 * @param array  $data        Form data
 * @param int    $resourceId  Resource ID
 *
 * @return int|null Ellipsoidal_parameter_id or null if no ellipsoidal data
 * @throws Exception On database error
 */
function insertEllipsoidalParameters(mysqli $connection, array $data, int $resourceId): ?int
{
    // Only proceed if we have semimajor axis data
    if (empty($data['semimajor_axis_a'])) {
        return null;
    }

    // Convert empty strings to NULL for numeric fields
    $semimajorAxis = ($data['semimajor_axis_a'] === '') ? null : floatval($data['semimajor_axis_a']);
    
    // Map second_variable type to database column
    $secondVarMapping = [
        'axis_b' => 'semiminor_axis_b',
        'flattening' => 'flattening',
        'reciprocal_flattening' => 'reciprocal_flattening',
        'eccentricity' => 'eccentricity'
    ];

    // Insert new record
    if (!empty($data['second_variable'])) {
        $columnName = $secondVarMapping[$data['second_variable']];
        $secondVarValue = ($data['second_variable_value'] === '') ? null : floatval($data['second_variable_value']);
        $secondVarValue = ($secondVarValue === '') ? null : floatval($secondVarValue);
        $sql = "INSERT INTO `Ellipsoidal_Parameters`
                    (`semimajor_axis_a`, `{$columnName}`)
                 VALUES (?, ?)";
        $stmt = $connection->prepare($sql);
        $stmt->bind_param('dd', $semimajorAxis, $secondVarValue);
    } else {
        $sql = "INSERT INTO `Ellipsoidal_Parameters`
                    (`semimajor_axis_a`)
                 VALUES (?)";
        $stmt = $connection->prepare($sql);
        $stmt->bind_param('d', $semimajorAxis);
    }

    if (!$stmt->execute()) {
        throw new Exception('Error inserting Ellipsoidal_Parameters: ' . $stmt->error);
    }
    $ellipsoidalId = $stmt->insert_id;
    $stmt->close();

    // Link to resource
    $sql = "INSERT INTO `Resource_has_Ellipsoidal_Parameters`
                (`resource_id`, `ellipsoidal_parameter_id`)
             VALUES (?, ?)";
    $stmt = $connection->prepare($sql);
    $stmt->bind_param('ii', $resourceId, $ellipsoidalId);
    if (!$stmt->execute()) {
        throw new Exception('Error linking Ellipsoidal_Parameters: ' . $stmt->error);
    }
    $stmt->close();

    return $ellipsoidalId;
}

/**
 * Main orchestration function: saves GGM Properties characteristics and Ellipsoidal Parameters
 *
 * @param mysqli $connection  Database connection
 * @param array  $postData    Posted form data
 * @param int    $resourceId  Resource ID
 *
 * @return bool  True on success
 * @throws Exception On any data consistency or database error
 */
function saveGGMsProperties(mysqli $connection, array $postData, int $resourceId): bool
{
    // Normalize numeric inputs
    $numericFields = ['radius', 'earth_gravity_constant'];
    foreach ($numericFields as $field) {
        if (isset($postData[$field]) && $postData[$field] === '') {
            $postData[$field] = null;
        } elseif (isset($postData[$field]) && $postData[$field] !== null) {
            $postData[$field] = floatval($postData[$field]);
        }
    }

    // Normalize string inputs: empty string from "Choose" dropdowns → NULL
    $stringFields = ['tide_system', 'errors', 'error_handling_approach'];
    foreach ($stringFields as $field) {
        if (isset($postData[$field]) && $postData[$field] === '') {
            $postData[$field] = null;
        }
    }

    $integerFields = ['degree'];
    foreach ($integerFields as $field) {
        if (isset($postData[$field]) && $postData[$field] === '') {
            $postData[$field] = null;
        } elseif (isset($postData[$field]) && $postData[$field] !== null) {
            $postData[$field] = intval($postData[$field]);
        }
    }

    // Check if resource already has linked GGM_Properties
    $existingGgmId = null;
    $checkSql = "SELECT GGM_Properties_GGM_Properties_id FROM `Resource_has_GGM_Properties` WHERE Resource_resource_id = ? LIMIT 1";
    if ($stmt = $connection->prepare($checkSql)) {
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $stmt->bind_result($existingGgmId);
        $stmt->fetch();
        $stmt->close();
    } else {
        throw new Exception('Failed to check existing GGM_Properties link: ' . $connection->error);
    }

    if ($existingGgmId) {
        // Update existing GGM_Properties row
        $updateSql = "UPDATE `GGM_Properties`
            SET `Tide_System` = ?, `degree` = ?, `Errors` = ?, `Error_Handling_Approach` = ?, `radius` = ?, `earth_gravity_constant` = ?
            WHERE `GGM_Properties_id` = ?";
        $stmt = $connection->prepare($updateSql);
        if (!$stmt) {
            throw new Exception('Failed to prepare update statement: ' . $connection->error);
        }
        $stmt->bind_param(
            'sissddi',
            $postData['tide_system'],
            $postData['degree'],
            $postData['errors'],
            $postData['error_handling_approach'],
            $postData['radius'],
            $postData['earth_gravity_constant'],
            $existingGgmId
        );
        if (!$stmt->execute()) {
            throw new Exception('Error updating GGM_Properties: ' . $stmt->error);
        }
        $stmt->close();
        $ggmId = $existingGgmId;
    } else {
        // Insert new GGM_Properties and link to resource
        $insertSql = "INSERT INTO `GGM_Properties` (
                `Tide_System`, `degree`, `Errors`, `Error_Handling_Approach`, `radius`, `earth_gravity_constant`
            ) VALUES (?, ?, ?, ?, ?, ?)";

        $stmt = $connection->prepare($insertSql);
        if (!$stmt) {
            throw new Exception('Failed to prepare insert statement: ' . $connection->error);
        }

        $stmt->bind_param(
            'sissdd',
            $postData['tide_system'],
            $postData['degree'],
            $postData['errors'],
            $postData['error_handling_approach'],
            $postData['radius'],
            $postData['earth_gravity_constant']
        );

        if (!$stmt->execute()) {
            throw new Exception('Error inserting GGM_Properties: ' . $stmt->error);
        }
        $ggmId = $stmt->insert_id;
        $stmt->close();

        // Link to resource
        $linkSql = "INSERT INTO `Resource_has_GGM_Properties` (`Resource_resource_id`, `GGM_Properties_GGM_Properties_id`) VALUES (?, ?)";
        $stmt = $connection->prepare($linkSql);
        if (!$stmt) {
            throw new Exception('Failed to prepare link statement: ' . $connection->error);
        }
        $stmt->bind_param('ii', $resourceId, $ggmId);
        if (!$stmt->execute()) {
            throw new Exception('Error linking GGM_Properties to resource: ' . $stmt->error);
        }
        $stmt->close();
    }

    // 2) Insert Ellipsoidal Parameters (if applicable)
    insertEllipsoidalParameters($connection, $postData, $resourceId);

    return true;
}