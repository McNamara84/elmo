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
    // Basic validation: resource_id must be positive
    if ($resource_id <= 0) {
        return false;
    }

    // Required dropdown and text fields
    $required = ['model_name', 'model_type', 'math_representation', 'file_format'];
    foreach ($required as $field) {
        if (empty($postData[$field]) || !is_string($postData[$field])) {
            return false;
        }
    }

    // Extract form values
    $modelName = trim($postData['model_name']);
    $modelTypeName = trim($postData['model_type']);
    $mathRepName = trim($postData['math_representation']);
    $fileFormatName = trim($postData['file_format']);
    $celestialBody = isset($postData['celestial_body']) ? trim($postData['celestial_body']) : null;
    $productType = isset($postData['product_type']) ? trim($postData['product_type']) : null;
    $degree = (isset($postData['degree']) && $postData['degree'] !== '') ? $postData['degree'] : null;
    $errors = isset($postData['errors']) ? trim($postData['errors']) : null;
    $errorHandlingApproach = isset($postData['error_handling_approach']) ? trim($postData['error_handling_approach']) : null;
    $tideSystem = isset($postData['tide_system']) ? trim($postData['tide_system']) : null;

    // Pattern/value validations
    if (!preg_match('/^[A-Za-z0-9_\-]+$/', $modelName)) {
        // modelName must be alphanumeric, underscore or hyphen only
        return false;
    }
    if ($degree !== null) {
        if (!filter_var($degree, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]])) {
            return false;
        }
        $degree = (int) $degree;
    }
    if ($errors !== null && mb_strlen($errors) > 100) {
        return false;
    }
    if ($errorHandlingApproach !== null && mb_strlen($errorHandlingApproach) > 5000) {
        return false;
    }
    if ($tideSystem !== null && mb_strlen($tideSystem) > 100) {
        return false;
    }

    // Enumerated dropdown options
    $allowedModelTypes = ['Static', 'Temporal', 'Topographic'];
    $allowedMathReps = ['Spherical Harmonics', 'Ellipsoidal Harmonics', 'Other', 'MASCONs'];
    $allowedCelestials = ['Earth', 'Moon of the Earth', 'Mars', 'Ceres', 'Venus', 'Other'];
    $allowedProducts = ['Gravity Field', 'Topographic Gravity Field', 'Geoid'];
    $allowedFormats = ['icgem1.0', 'icgem2.0'];

    if (
        !in_array($modelTypeName, $allowedModelTypes, true)
        || !in_array($mathRepName, $allowedMathReps, true)
        || !in_array($fileFormatName, $allowedFormats, true)
    ) {
        return false;
    }
    if ($celestialBody !== null && !in_array($celestialBody, $allowedCelestials, true)) {
        return false;
    }
    if ($productType !== null && !in_array($productType, $allowedProducts, true)) {
        return false;
    }

    // Determine existing GGM linkage
    $stmtSel = $connection->prepare(
        "SELECT GGM_Properties_GGM_Properties_id
           FROM `Resource_has_GGM_Properties`
          WHERE Resource_resource_id = ?"
    );
    $stmtSel->bind_param("i", $resource_id);
    $stmtSel->execute();
    $stmtSel->bind_result($existingGgmId);
    $hasExisting = (bool) $stmtSel->fetch();
    $stmtSel->close();

    if ($hasExisting) {
        // Update existing GGM_Properties
        $stmtUpd = $connection->prepare(
            "UPDATE `GGM_Properties` SET
                 `Model_Name`              = ?,
                 `Celestial_Body`          = ?,
                 `Product_Type`            = ?,
                 `Degree`                  = ?,
                 `Errors`                  = ?,
                 `Error_Handling_Approach` = ?,
                 `Tide_System`             = ?
             WHERE `GGM_Properties_id`     = ?"
        );
        $stmtUpd->bind_param(
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
        $stmtUpd->execute();
        if ($stmtUpd->errno) {
            throw new Exception("Failed to update GGM_Properties: " . $stmtUpd->error);
        }
        $stmtUpd->close();
        $ggmId = $existingGgmId;
    } else {
        // Insert new GGM_Properties
        $stmtIns = $connection->prepare(
            "INSERT INTO `GGM_Properties`
                 (`Model_Name`, `Celestial_Body`, `Product_Type`,
                  `Degree`, `Errors`, `Error_Handling_Approach`, `Tide_System`)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmtIns->bind_param(
            "sssisss",
            $modelName,
            $celestialBody,
            $productType,
            $degree,
            $errors,
            $errorHandlingApproach,
            $tideSystem
        );
        $stmtIns->execute();
        if ($stmtIns->errno) {
            throw new Exception("Failed to insert GGM_Properties: " . $stmtIns->error);
        }
        $ggmId = $stmtIns->insert_id;
        $stmtIns->close();

        // Link resource to GGM_Properties
        $stmtLink = $connection->prepare(
            "INSERT INTO `Resource_has_GGM_Properties`
                 (`Resource_resource_id`, `GGM_Properties_GGM_Properties_id`)
             VALUES (?, ?)"
        );
        $stmtLink->bind_param("ii", $resource_id, $ggmId);
        $stmtLink->execute();
        if ($stmtLink->errno) {
            throw new Exception("Failed to link Resource to GGM_Properties: " . $stmtLink->error);
        }
        $stmtLink->close();
    }

    // Lookup FK IDs for Resource
    $modelTypeId = lookupForeignKeyId($connection, 'Model_Type', 'Model_type_id', 'name', $modelTypeName);
    $mathRepId = lookupForeignKeyId($connection, 'Mathematical_Representation', 'Mathematical_representation_id', 'name', $mathRepName);
    $fileFormatId = lookupForeignKeyId($connection, 'File_Format', 'File_format_id', 'name', $fileFormatName);
    if (!$modelTypeId || !$mathRepId || !$fileFormatId) {
        throw new Exception("Failed to resolve foreign key IDs for Resource");
    }

    // Update Resource FK columns
    $stmtRes = $connection->prepare(
        "UPDATE `Resource` SET
             `Model_type_id`            = ?,
             `Mathematical_Representation` = ?,
             `File_format_id`           = ?
         WHERE `resource_id`            = ?"
    );
    $stmtRes->bind_param("iiii", $modelTypeId, $mathRepId, $fileFormatId, $resource_id);
    $stmtRes->execute();
    if ($stmtRes->errno) {
        throw new Exception("Failed to update Resource FKs: " . $stmtRes->error);
    }
    $stmtRes->close();

    return true;
}
