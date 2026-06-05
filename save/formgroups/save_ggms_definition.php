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
 * Validates the form data for GGM Essential Definition formgroup before any database action.
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
    $fields = ['model_name', 'model_type', 'mathematical_representation'];
    foreach ($fields as $f) {
        if (empty($data[$f]) || !is_string($data[$f])) {
            throw new Exception("Field {$f} is required and must be a string");
        }
        $data[$f] = trim($data[$f]);
    }

    // Optional fields
    $optional = ['product_type','file_format', 'celestial_body'];
    foreach ($optional as $f) {
        if (isset($data[$f])) {
            $data[$f] = is_string($data[$f]) ? trim($data[$f]) : $data[$f];
        }
    }

    // model_name pattern
    if (!preg_match('/^[^\s]+$/', $data['model_name'])) {
        throw new Exception('Model name must not contain spaces');
    }

    return $data;
}

/**
 * Inserts the GGM_Definition record linked to a resource.
 *
 * @param mysqli $connection  Database connection
 * @param array  $data        Validated GGM data
 * @param int    $resourceId  Resource ID
 *
 * @return int  GGM_Definition_id of the inserted/updated record
 * @throws Exception On database errors
 */
function insertGGMDefinition(mysqli $connection, array $data, int $resourceId): int
{

    // Insert new GGM-Properties record
    $sql = "INSERT INTO `GGM_Definition`
                (`Model_Name`,`Celestial_Body`,`Product_Type`)
                VALUES (?,?,?)";
    $stmt = $connection->prepare($sql);
    $stmt->bind_param(
        'sss',
        $data['model_name'],
        $data['celestial_body'],
        $data['product_type']
    );
    $stmt->execute();
    if ($stmt->errno) {
        throw new Exception('Error inserting GGM_Definition: ' . $stmt->error);
    }
    $ggmId = $stmt->insert_id;
    $stmt->close();

    // Create link
    $sql = "INSERT INTO `Resource_has_GGM_Definition`
                (`Resource_resource_id`,`GGM_Definition_GGM_Definition_id`)
                VALUES (?,?)";
    $stmt = $connection->prepare($sql);
    $stmt->bind_param('ii', $resourceId, $ggmId);
    $stmt->execute();
    if ($stmt->errno) {
        throw new Exception('Error linking GGM_Definition: ' . $stmt->error);
    }
    $stmt->close();

    return $ggmId;
}

/**
 * Saves a new GGM_Definition and links it to the resource.
 *
 * @param mysqli $connection  Database connection
 * @param array  $postData    Posted form data
 * @param int    $resourceId  Resource ID
 *
 * @return bool  True on success
 * @throws Exception On any validation or database error
 */
function saveGGMsDefinition(mysqli $connection, array $postData, int $resourceId): bool
{
    $action = $postData['action'] ?? 'save_and_download';

    // 1) Validate the input data (only on submit)
    if ($action === 'submit') {
        $data = validateGGMData($postData, $resourceId);
    } else {
        // For save action, prepare data without strict validation
        if ($resourceId <= 0) {
            throw new Exception('Invalid resource ID');
        }
        $data = [
            'model_name' => trim($postData['model_name'] ?? ''),
            'model_type' => trim($postData['model_type'] ?? ''),
            'mathematical_representation' => trim($postData['mathematical_representation'] ?? ''),
            'product_type' => trim($postData['product_type'] ?? ''),
            'file_format' => trim($postData['file_format'] ?? ''),
            'celestial_body' => trim($postData['celestial_body'] ?? '')
        ];
    }

    // 2) Resolve foreign keys for Model_Type, Mathematical_Representation, and File_Format
    $modelTypeId = lookupForeignKeyId($connection, 'Model_Type', 'Model_type_id', 'name', $data['model_type']);
    $mathRepId = lookupForeignKeyId($connection, 'Mathematical_Representation', 'Mathematical_representation_id', 'name', $data['mathematical_representation']);
    $fileFmtId = lookupForeignKeyId($connection, 'File_Format', 'File_format_id', 'name', $data['file_format']);

    if ($action === 'submit' && (!$modelTypeId || !$mathRepId || !$fileFmtId)) {
        throw new Exception('Failed to resolve foreign keys for Model_Type, Mathematical_Representation, or File_Format.');
    }

    // 3) Insert a new GGM_Definition
    $sql = "INSERT INTO `GGM_Definition`
                (`Model_Name`, `Celestial_Body`, `Product_Type`, `Model_type_id`, `Mathematical_representation_id`, `File_format_id`)
            VALUES (?, ?, ?, ?, ?, ?)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception('Failed to prepare GGM_Definition insert: ' . $connection->error);
    }
    $stmt->bind_param(
        'sssiii',
        $data['model_name'],
        $data['celestial_body'],
        $data['product_type'],
        $modelTypeId,
        $mathRepId,
        $fileFmtId
    );
    $stmt->execute();
    if ($stmt->errno) {
        throw new Exception('Error inserting GGM_Definition: ' . $stmt->error);
    }
    $ggmDefinitionId = $stmt->insert_id;
    $stmt->close();

    // 4) Link the new GGM_Definition to the Resource
    $sql = "INSERT INTO `Resource_has_GGM_Definition`
                (`Resource_resource_id`, `GGM_Definition_GGM_Definition_id`)
            VALUES (?, ?)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception('Failed to prepare Resource_has_GGM_Definition insert: ' . $connection->error);
    }
    $stmt->bind_param('ii', $resourceId, $ggmDefinitionId);
    $stmt->execute();
    if ($stmt->errno) {
        throw new Exception('Error linking Resource to GGM_Definition: ' . $stmt->error);
    }
    $stmt->close();

    return true;
}
