<?php
/**
 * Lookup helper: retrieves the primary key ID from a lookup table by name.
 *
 * @param mysqli  $connection  Database connection
 * @param string  $table       Lookup table name
 * @param string  $idColumn    Primary key column in lookup table
 * @param string  $nameColumn  Name column in lookup table
 * @param string  $value       Value to look up
 *
 * @return int|null  Matching ID, or null if not found
 * @throws Exception On query error
 */
function lookupForeignKeyId(mysqli $connection, string $table, string $idColumn, string $nameColumn, string $value): ?int
{
    $sql = "SELECT `{$idColumn}` FROM `{$table}` WHERE `{$nameColumn}` = ? LIMIT 1";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare lookup on {$table}: " . $connection->error);
    }
    $stmt->bind_param("s", $value);
    $stmt->execute();
    $stmt->bind_result($id);
    $found = $stmt->fetch();
    $stmt->close();
    return $found ? (int) $id : null;
}

/**
 * Validates the form data for GGM Properties before any database action.
 *
 * @param array $data       Posted form data
 * @param int   $resourceId Resource ID
 *
 * @return array           Cleaned data array
 * @throws Exception       On validation failure
 */
function validateGGMData(array $data, int $resourceId): array
{
    if ($resourceId <= 0) {
        throw new Exception('Invalid resource ID');
    }

    // Required fields and trimming
    $fields = ['model_name', 'model_type', 'math_representation', 'file_format'];
    foreach ($fields as $f) {
        if (empty($data[$f]) || !is_string($data[$f])) {
            throw new Exception("Field {$f} is required and must be a string");
        }
        $data[$f] = trim($data[$f]);
    }

    // Optional fields
    $optional = ['celestial_body', 'product_type', 'degree', 'errors', 'error_handling_approach', 'tide_system'];
    foreach ($optional as $f) {
        if (isset($data[$f])) {
            $data[$f] = is_string($data[$f]) ? trim($data[$f]) : $data[$f];
        }
    }

    // model_name pattern
    if (!preg_match('/^[A-Za-z0-9_\-]+$/', $data['model_name'])) {
        throw new Exception('Model name must be alphanumeric, underscore or hyphen only');
    }

    // degree validation
    if (isset($data['degree']) && $data['degree'] !== '') {
        if (!filter_var($data['degree'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]])) {
            throw new Exception('Degree must be an integer >= 0');
        }
        $data['degree'] = (int) $data['degree'];
    } else {
        $data['degree'] = null;
    }

    // length validations
    if (isset($data['errors']) && mb_strlen($data['errors']) > 100) {
        throw new Exception('Errors text is too long');
    }
    if (isset($data['error_handling_approach']) && mb_strlen($data['error_handling_approach']) > 5000) {
        throw new Exception('Error handling approach is too long');
    }
    if (isset($data['tide_system']) && mb_strlen($data['tide_system']) > 100) {
        throw new Exception('Tide system is too long');
    }

    // Enumerated options
    $allowed = [
        'model_type' => ['Static', 'Temporal', 'Topographic'],
        'math_representation' => ['Spherical Harmonics', 'Ellipsoidal Harmonics', 'Other', 'MASCONs'],
        'file_format' => ['icgem1.0', 'icgem2.0'],
        'celestial_body' => ['Earth', 'Moon of the Earth', 'Mars', 'Ceres', 'Venus', 'Other'],
        'product_type' => ['Gravity Field', 'Topographic Gravity Field', 'Geoid'],
    ];
    foreach ($allowed as $key => $vals) {
        if (isset($data[$key]) && !in_array($data[$key], $vals, true)) {
            throw new Exception("Invalid value for {$key}");
        }
    }

    return $data;
}

/**
 * Inserts or updates the GGM_Properties record linked to a resource.
 *
 * @param mysqli $connection  Database connection
 * @param array  $data        Validated GGM data
 * @param int    $resourceId  Resource ID
 *
 * @return int  GGM_Properties_id of the inserted/updated record
 * @throws Exception On database errors
 */
function upsertGGMProperties(mysqli $connection, array $data, int $resourceId): int
{
    // Check existing link
    $sql = "SELECT GGM_Properties_GGM_Properties_id
              FROM `Resource_has_GGM_Properties`
             WHERE Resource_resource_id = ?";
    $stmt = $connection->prepare($sql);
    $stmt->bind_param('i', $resourceId);
    $stmt->execute();
    $stmt->bind_result($ggmId);
    $exists = (bool) $stmt->fetch();
    $stmt->close();

    if ($exists) {
        // Update
        $sql = "UPDATE `GGM_Properties` SET
                    `Model_Name`              = ?,
                    `Celestial_Body`          = ?,
                    `Product_Type`            = ?,
                    `Degree`                  = ?,
                    `Errors`                  = ?,
                    `Error_Handling_Approach` = ?,
                    `Tide_System`             = ?
                 WHERE `GGM_Properties_id`    = ?";
        $stmt = $connection->prepare($sql);
        $stmt->bind_param(
            'sssisssi',
            $data['model_name'],
            $data['celestial_body'],
            $data['product_type'],
            $data['degree'],
            $data['errors'],
            $data['error_handling_approach'],
            $data['tide_system'],
            $ggmId
        );
        $stmt->execute();
        if ($stmt->errno) {
            throw new Exception('Error updating GGM_Properties: ' . $stmt->error);
        }
        $stmt->close();
    } else {
        // Insert new
        $sql = "INSERT INTO `GGM_Properties`
                    (`Model_Name`,`Celestial_Body`,`Product_Type`,
                     `Degree`,`Errors`,`Error_Handling_Approach`,`Tide_System`)
                 VALUES (?,?,?,?,?,?,?)";
        $stmt = $connection->prepare($sql);
        $stmt->bind_param(
            'sssisss',
            $data['model_name'],
            $data['celestial_body'],
            $data['product_type'],
            $data['degree'],
            $data['errors'],
            $data['error_handling_approach'],
            $data['tide_system']
        );
        $stmt->execute();
        if ($stmt->errno) {
            throw new Exception('Error inserting GGM_Properties: ' . $stmt->error);
        }
        $ggmId = $stmt->insert_id;
        $stmt->close();

        // Create link
        $sql = "INSERT INTO `Resource_has_GGM_Properties`
                    (`Resource_resource_id`,`GGM_Properties_GGM_Properties_id`)
                 VALUES (?,?)";
        $stmt = $connection->prepare($sql);
        $stmt->bind_param('ii', $resourceId, $ggmId);
        $stmt->execute();
        if ($stmt->errno) {
            throw new Exception('Error linking GGM_Properties: ' . $stmt->error);
        }
        $stmt->close();
    }

    return $ggmId;
}

/**
 * Updates the Resource table foreign keys based on lookup names.
 *
 * @param mysqli $connection  Database connection
 * @param array  $data        Validated GGM data
 * @param int    $resourceId  Resource ID
 *
 * @return void
 * @throws Exception On lookup or update errors
 */
function updateResourceForeignKeys(mysqli $connection, array $data, int $resourceId): void
{
    $modelTypeId = lookupForeignKeyId($connection, 'Model_Type', 'Model_type_id', 'name', $data['model_type']);
    $mathRepId = lookupForeignKeyId($connection, 'Mathematical_Representation', 'Mathematical_representation_id', 'name', $data['math_representation']);
    $fileFmtId = lookupForeignKeyId($connection, 'File_Format', 'File_format_id', 'name', $data['file_format']);

    if (!$modelTypeId || !$mathRepId || !$fileFmtId) {
        throw new Exception('Failed to resolve Resource foreign keys');
    }

    $sql = "UPDATE `Resource` SET
                `Model_type_id`              = ?,
                `Mathematical_Representation` = ?,
                `File_format_id`             = ?
             WHERE `resource_id`              = ?";
    $stmt = $connection->prepare($sql);
    $stmt->bind_param('iiii', $modelTypeId, $mathRepId, $fileFmtId, $resourceId);
    $stmt->execute();
    if ($stmt->errno) {
        throw new Exception('Error updating Resource FKs: ' . $stmt->error);
    }
    $stmt->close();
}

/**
 * Orchestrates validation, upsert of GGM_Properties, and Resource FK update.
 *
 * @param mysqli $connection  Database connection
 * @param array  $postData    Posted form data
 * @param int    $resourceId  Resource ID
 *
 * @return bool  True on success
 * @throws Exception On any validation or database error
 */
function saveGGMsProperties(mysqli $connection, array $postData, int $resourceId): bool
{
    // 1) Validate
    $data = validateGGMData($postData, $resourceId);

    // 2) Insert/update GGM_Properties
    $ggmId = upsertGGMProperties($connection, $data, $resourceId);

    // 3) Update Resource FKs
    updateResourceForeignKeys($connection, $data, $resourceId);

    return true;
}
