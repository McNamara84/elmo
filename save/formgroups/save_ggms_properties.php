<?php
/**
 * Save script for GGMsProperties form group
 *
 * Saves GGM Properties characteristics (tide system, degree, errors, etc.)
 * and Ellipsoidal Parameters when applicable.
 *
 * Two flows:
 *   save_and_download — accepts incomplete data; NULLs are stored as-is.
 *   submit            — validates required fields before any DB write.
 */

/**
 * Validates GGM Properties form data for the submit action.
 *
 * Required: tide_system, degree, errors, earth_gravity_constant
 * Optional: radius, error_handling_approach
 *
 * @param array $data       Posted form data
 *
 * @return array            Cleaned data array
 * @throws Exception        On validation failure
 */
function validateGGMPropertiesData(array $data): array
{
    $required = ['tide_system', 'degree', 'errors', 'earth_gravity_constant'];
    foreach ($required as $field) {
        $value = $data[$field] ?? null;
        if ($value === null || $value === '' || $value === 'Choose') {
            throw new Exception("Field {$field} is required and must not be empty");
        }
    }

    // Cast numeric fields to their proper types
    try {
        $data['degree'] = intval($data['degree']);
        $data['earth_gravity_constant'] = floatval($data['earth_gravity_constant']);
        if (isset($data['radius']) && $data['radius'] !== null && $data['radius'] !== '') {
            $data['radius'] = floatval($data['radius']);
        }
    } catch (Exception $e) {
        throw new Exception('Numeric fields must be valid numbers: ' . $e->getMessage());
    }

    return $data;
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
 * @throws Exception On any validation, data consistency or database error
 */
function saveGGMsProperties(mysqli $connection, array $postData, int $resourceId): bool
{
    $action = $postData['action'] ?? 'save_and_download';

    // 1) Validate on submit only
    if ($action === 'submit') {
        $postData = validateGGMPropertiesData($postData);
    }

    // 2) Normalize optional freetext inputs. turn empty strings tu NULL for optional fields
    $optionalFreetextInputs = ['radius', 'earth_gravity_constant', 'error_handling_approach'];
    foreach ($optionalFreetextInputs as $field) {
        if (isset($postData[$field]) && $postData[$field] === '') {
            $postData[$field] = null;
        }
    }   

    // 3) Insert new GGM_Properties record
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

    // 4) Insert Ellipsoidal Parameters (if applicable)
    insertEllipsoidalParameters($connection, $postData, $resourceId);

    return true;
}