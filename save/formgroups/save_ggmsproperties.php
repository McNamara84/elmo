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
    $sql = "SELECT `$idColumn` FROM `$table` WHERE `$nameColumn` = ? LIMIT 1";
    if (!$stmt = $connection->prepare($sql)) {
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
 * Handles saving of GGM Properties data for a resource and updates Resource foreign keys.
 *
 * On first save:
 *   - Inserts a new GGM_Properties row
 *   - Links it via Resource_has_GGM_Properties
 *   - Updates Resource.Model_type_id, Resource.Mathematical_Representation, Resource.File_format_id
 *
 * On subsequent saves:
 *   - Updates the existing GGM_Properties row
 *   - Updates Resource foreign-key columns
 *
 * @param mysqli  $connection    Database connection
 * @param array   $postData      Posted form data
 * @param int     $resource_id   Resource ID to associate with the GGM Properties
 *
 * @return bool  True on success, false on validation failure
 * @throws Exception On lookup or database errors
 */
function saveGGMsProperties(mysqli $connection, array $postData, int $resource_id): bool
{
    // Validate required form fields
    $required = ['model_name', 'model_type', 'math_representation', 'file_format'];
    foreach ($required as $field) {
        if (empty($postData[$field])) {
            return false;
        }
    }

    // Extract form values (nullable fields default to null)
    $modelName = $postData['model_name'];
    $modelTypeName = $postData['model_type'];
    $mathRepName = $postData['math_representation'];
    $fileFormatName = $postData['file_format'];
    $celestialBody = $postData['celestial_body'] ?? null;
    $productType = $postData['product_type'] ?? null;
    $degree = (isset($postData['degree']) && $postData['degree'] !== '')
        ? (int) $postData['degree'] : null;
    $errors = $postData['errors'] ?? null;
    $errorHandlingApproach = $postData['error_handling_approach'] ?? null;
    $tideSystem = $postData['tide_system'] ?? null;

    // Determine if a GGM_Properties record is already linked
    $sel = $connection->prepare(
        "SELECT GGM_Properties_GGM_Properties_id
           FROM `Resource_has_GGM_Properties`
          WHERE Resource_resource_id = ?"
    );
    $sel->bind_param("i", $resource_id);
    $sel->execute();
    $sel->bind_result($existingGgmId);
    $hasExisting = (bool) $sel->fetch();
    $sel->close();

    if ($hasExisting) {
        // Update existing GGM_Properties
        $upd = $connection->prepare(
            "UPDATE `GGM_Properties` SET
                `Model_Name`              = ?,
                `Celestial_Body`          = ?,
                `Product_Type`            = ?,
                `Degree`                  = ?,
                `Errors`                  = ?,
                `Error_Handling_Approach` = ?,
                `Tide_System`             = ?
             WHERE `GGM_Properties_id`    = ?"
        );
        $upd->bind_param(
            "sssisssi",
            $modelName,
            $celestialBody,
            $productType,
            $degree,
            $errors,
            $errorHandlingApproach,
            $tideSystem,
            $existingGgmId
        );
        $upd->execute();
        if ($upd->errno) {
            throw new Exception("Failed to update GGM_Properties: " . $upd->error);
        }
        $upd->close();
        $ggmId = $existingGgmId;
    } else {
        // Insert new GGM_Properties
        $ins = $connection->prepare(
            "INSERT INTO `GGM_Properties`
                (`Model_Name`, `Celestial_Body`, `Product_Type`,
                 `Degree`, `Errors`, `Error_Handling_Approach`, `Tide_System`)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $ins->bind_param(
            "sssisss",
            $modelName,
            $celestialBody,
            $productType,
            $degree,
            $errors,
            $errorHandlingApproach,
            $tideSystem
        );
        $ins->execute();
        if ($ins->errno) {
            throw new Exception("Failed to insert GGM_Properties: " . $ins->error);
        }
        $ggmId = $ins->insert_id;
        $ins->close();

        // Link resource to GGM_Properties
        $link = $connection->prepare(
            "INSERT INTO `Resource_has_GGM_Properties`
                (`Resource_resource_id`, `GGM_Properties_GGM_Properties_id`)
             VALUES (?, ?)"
        );
        $link->bind_param("ii", $resource_id, $ggmId);
        $link->execute();
        if ($link->errno) {
            throw new Exception("Failed to link Resource to GGM_Properties: " . $link->error);
        }
        $link->close();
    }

    // Lookup FK IDs for Resource table
    $modelTypeId = lookupForeignKeyId($connection, 'Model_Type', 'Model_type_id', 'name', $modelTypeName);
    $mathRepId = lookupForeignKeyId($connection, 'Mathematical_Representation', 'Mathematical_representation_id', 'name', $mathRepName);
    $fileFormatId = lookupForeignKeyId($connection, 'File_Format', 'File_format_id', 'name', $fileFormatName);

    if (!$modelTypeId || !$mathRepId || !$fileFormatId) {
        throw new Exception("Failed to resolve foreign key IDs for Resource");
    }

    // Update Resource FK columns
    $updRes = $connection->prepare(
        "UPDATE `Resource` SET
            `Model_type_id`            = ?,
            `Mathematical_Representation` = ?,
            `File_format_id`           = ?
         WHERE `resource_id`            = ?"
    );
    $updRes->bind_param("iiii", $modelTypeId, $mathRepId, $fileFormatId, $resource_id);
    $updRes->execute();
    if ($updRes->errno) {
        throw new Exception("Failed to update Resource FKs: " . $updRes->error);
    }
    $updRes->close();

    return true;
}
