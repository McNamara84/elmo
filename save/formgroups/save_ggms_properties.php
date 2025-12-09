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
 * Retrieves the GGM_Properties_id linked to a resource
 *
 * @param mysqli $connection Database connection
 * @param int    $resourceId Resource ID
 *
 * @return int|null GGM_Properties_id or null if not found
 * @throws Exception On query error or if multiple records found
 */
function getGGMPropertiesId(mysqli $connection, int $resourceId): ?int
{
    $sql = "SELECT GGM_Properties_GGM_Properties_id
            FROM `Resource_has_GGM_Properties`
            WHERE Resource_resource_id = ?";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare query: " . $connection->error);
    }
    $stmt->bind_param('i', $resourceId);
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    if (count($rows) === 0) {
        return null;
    }
    if (count($rows) > 1) {
        throw new Exception("Multiple GGM_Properties records found for this resource. Data integrity error.");
    }

    return (int) $rows[0]['GGM_Properties_GGM_Properties_id'];
}

/**
 * Updates the existing GGM_Properties record with form data
 *
 * @param mysqli $connection  Database connection
 * @param array  $data        Form data
 * @param int    $ggmId       GGM_Properties_id
 *
 * @return void
 * @throws Exception On database error
 */
function updateGGMProperties(mysqli $connection, array $data, int $ggmId): void
{
    $sql = "UPDATE `GGM_Properties` SET
                `Tide_System`              = ?,
                `degree`                   = ?,
                `Errors`                   = ?,
                `Error_Handling_Approach`  = ?,
                `radius`                   = ?,
                `earth_gravity_constant`   = ?
            WHERE `GGM_Properties_id`      = ?";

    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare update statement: " . $connection->error);
    }

    // Convert empty strings to NULL for numeric fields
    $numericFields = ['radius', 'earth_gravity_constant'];
    foreach ($numericFields as $field) {
        if (isset($data[$field]) && $data[$field] === '') {
            $data[$field] = null;
        } elseif (isset($data[$field]) && $data[$field] !== null) {
            $data[$field] = floatval($data[$field]);
        }
    }

    // Convert numeric integer fields
    $integerFields = ['degree'];
    foreach ($integerFields as $field) {
        if (isset($data[$field]) && $data[$field] === '') {
            $data[$field] = null;
        } elseif (isset($data[$field]) && $data[$field] !== null) {
            $data[$field] = intval($data[$field]);
        }
    }

    $stmt->bind_param(
        'sisisdi',
        $data['tide_system'],
        $data['degree'],
        $data['errors'],
        $data['error_handling_approach'],
        $data['radius'],
        $data['earth_gravity_constant'],
        $ggmId
    );

    if (!$stmt->execute()) {
        throw new Exception('Error updating GGM_Properties: ' . $stmt->error);
    }
    $stmt->close();
}

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
    ];

    // Insert new record
    if (!empty($data['second_variable'])) {
        $columnName = $secondVarMapping[$data['second_variable']];
        $secondVarValue = ($data['second_variable_value'] === '') ? null : floatval($data['second_variable_value']);
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
    // 1) Retrieve existing GGM_Properties_id (exactly one must exist)
    $ggmId = getGGMPropertiesId($connection, $resourceId);
    if ($ggmId === null) {
        throw new Exception('No GGM_Properties record found for this resource. Ensure GGMs Definition form is saved first.');
    }

    // 2) Update GGM_Properties with characteristics
    updateGGMProperties($connection, $postData, $ggmId);

    // 3) Insert Ellipsoidal Parameters (if applicable)
    insertEllipsoidalParameters($connection, $postData, $resourceId);

    return true;
}