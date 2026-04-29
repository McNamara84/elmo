<?php
/**
 * Save script for GGMsModelTypes form group
 * 
 * Saves model-type-specific properties:
 * - Static models: time-variable coefficients info
 * - Temporal models: start/end dates, temporal resolution
 * - Topographic models: layer approach, domain, density information
 * 
 * Reuses existing GGM_Properties record and validates model type
 */

// lookupForeignKeyId is used in this file
require_once __DIR__ . '/save_ggms_definition.php';

/**
 * Retrieves the GGM_Properties_id and Model_type_id linked to a resource
 *
 * @param mysqli $connection Database connection
 * @param int    $resourceId Resource ID
 *
 * @return array Array with 'ggm_id' and 'model_type_id'
 * @throws Exception On query error or missing data
 */
function getGGMAndModelType(mysqli $connection, int $resourceId): array
{
    // Model_type_id is in GGM_Definition, linked via Resource_has_GGM_Definition
    $sql = "SELECT gd.Model_type_id, rg.GGM_Properties_GGM_Properties_id
            FROM `Resource_has_GGM_Definition` rhgd
            JOIN `GGM_Definition` gd ON rhgd.GGM_Definition_GGM_Definition_id = gd.GGM_Definition_id
            LEFT JOIN `Resource_has_GGM_Properties` rg ON rhgd.Resource_resource_id = rg.Resource_resource_id
            WHERE rhgd.Resource_resource_id = ?
            LIMIT 1";
    
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare query: " . $connection->error);
    }
    $stmt->bind_param('i', $resourceId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    if (!$row) {
        throw new Exception('Resource not found');
    }
    if ($row['GGM_Properties_GGM_Properties_id'] === null) {
        throw new Exception('No GGM_Properties record found for this resource. Ensure GGMs Definition form is saved first.');
    }

    return [
        'ggm_id' => (int) $row['GGM_Properties_GGM_Properties_id'],
        'model_type_id' => $row['Model_type_id']
    ];
}

/**
 * Retrieves the model type name from Model_type_id
 *
 * @param mysqli $connection  Database connection
 * @param int    $modelTypeId Model type ID
 *
 * @return string|null Model type name in lowercase
 * @throws Exception On query error
 */
function getModelTypeName(mysqli $connection, int $modelTypeId): ?string
{
    $sql = "SELECT name FROM `Model_Type` WHERE Model_type_id = ? LIMIT 1";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare query: " . $connection->error);
    }
    $stmt->bind_param('i', $modelTypeId);
    $stmt->execute();
    $stmt->bind_result($name);
    $found = $stmt->fetch();
    $stmt->close();

    return $found ? strtolower($name) : null;
}

/**
 * Helper: return the first non-empty value for any of the provided keys.
 * If a value is an array (e.g., posted with []), the first element is used.
 */
function firstNonEmpty(array $data, array $keys)
{
    foreach ($keys as $key) {
        if (!array_key_exists($key, $data)) {
            continue;
        }
        $val = $data[$key];
        if (is_array($val)) {
            $val = reset($val);
        }
        if ($val !== '' && $val !== null) {
            return $val;
        }
    }
    return null;
}

/**
 * Saves time-variable coefficients info for Static models
 *
 * @param mysqli $connection  Database connection
 * @param array  $postData    Form data
 * @param int    $resourceId  Resource ID
 *
 * @return void
 * @throws Exception On database error
 */
function saveStaticModelData(mysqli $connection, array $postData, int $resourceId): void
{
    // Frontend posts this information via staticDescription[] (camelCase)
    $info_tv_coefficients = firstNonEmpty($postData, ['staticDescription']);

    // Insert new static model data
    $sql = "INSERT INTO `Static_Model_Properties`
                (`info_time_variable_coefficients`)
            VALUES (?)";

    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare insert statement: " . $connection->error);
    }

    $stmt->bind_param('s', $info_tv_coefficients);
    if (!$stmt->execute()) {
        throw new Exception('Error inserting Static_Model_Properties: ' . $stmt->error);
    }
    $staticId = $stmt->insert_id;
    $stmt->close();

    // Link to resource
    $linkSql = "INSERT INTO `Resource_has_Static_Model_Properties`
                (`resource_id`, `static_model_property_id`)
            VALUES (?, ?)";
    $stmt = $connection->prepare($linkSql);
    if (!$stmt) {
        throw new Exception('Failed to prepare linking statement: ' . $connection->error);
    }
    $stmt->bind_param('ii', $resourceId, $staticId);
    if (!$stmt->execute()) {
        throw new Exception('Error linking Static_Model_Properties: ' . $stmt->error);
    }
    $stmt->close();
}

/**
 * Inserts Temporal_Model_Properties record and links it to resource
 *
 * @param mysqli $connection  Database connection
 * @param array  $postData    Form data
 * @param int    $resourceId  Resource ID
 *
 * @return int Temporal_model_property_id
 * @throws Exception On database error
 */
function insertTemporalModelProperties(mysqli $connection, array $postData, int $resourceId): int
{
    error_log("starting saving temporal model properties");

    // Helper to get single value, handling potential array wrapping or undefined keys
    $getVal = function ($key) use ($postData) {
        $val = $postData[$key] ?? '';
        if (is_array($val)) {
            $val = reset($val); // Get first element if it's an array
        }
        return ($val !== '' && $val !== null) ? $val : null;
    };

    // Parse temporal resolution from either custom value or predefined frequency
    $temporalResolutionDays = null;
    $customFreq = $postData['temporalFrequency'] ?? null;
    $predefFreq = $postData['temporalFrequencyPredef'] ?? null;
    if (!$customFreq && !$predefFreq) {
        error_log('Temporal resolution is missing: neither custom nor user-defined. If you are saving it is fine.');
    }

    if ($customFreq !== null) {
        $temporalResolutionDays = (int) $customFreq;
    } elseif ($predefFreq !== null) {
        $frequencyMap = [
            'daily' => 1,
            'weekly' => 7,
            'monthly' => 30,
            'quarterly' => 90,
            'yearly' => 365
        ];
        $temporalResolutionDays = $frequencyMap[$predefFreq] ?? null;
    }

    $startDate = $getVal('temporalStart');
    $endDate = $getVal('temporalEnd');
    $generatingInstitution = $getVal('temporalInstitution');
    $release = $getVal('releaseNumber');

    // Insert new temporal properties record
    $sql = "INSERT INTO `Temporal_Model_Properties`
                (`start_date`, `end_date`, `temporal_resolution_days`, `generating_institution`, `release`)
             VALUES (?, ?, ?, ?, ?)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare insert statement: " . $connection->error);
    }
    error_log("binding parameters: " . $startDate . ", " . $endDate . ", " . $temporalResolutionDays . ", " . $generatingInstitution . ", " . $release);
    $stmt->bind_param('ssiss', $startDate, $endDate, $temporalResolutionDays, $generatingInstitution, $release);
    if (!$stmt->execute()) {
        throw new Exception('Error inserting Temporal_Model_Properties: ' . $stmt->error);
    }
    $temporalId = $stmt->insert_id;
    $stmt->close();

    // Link to resource
    $sql = "INSERT INTO `Resource_has_Temporal_Model_Properties`
                (`resource_id`, `temporal_model_property_id`)
             VALUES (?, ?)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare linking statement: " . $connection->error);
    }

    $stmt->bind_param('ii', $resourceId, $temporalId);
    if (!$stmt->execute()) {
        throw new Exception('Error linking Temporal_Model_Properties: ' . $stmt->error);
    }
    $stmt->close();

    return $temporalId;
}

/**
 * Inserts Topographic_Models_Properties record and links it to resource
 *
 * @param mysqli $connection  Database connection
 * @param array  $postData    Form data
 * @param int    $resourceId  Resource ID
 *
 * @return int Topographic_model_property_id
 * @throws Exception On database error
 */
function insertTopographicModelProperties(mysqli $connection, array $postData, int $resourceId): int
{
    $layerApproach = firstNonEmpty($postData, ['topoLayerApproach', 'topo_layer_approach']);
    $domain = firstNonEmpty($postData, ['topoDomain', 'topo_domain']);
    $approximation = firstNonEmpty($postData, ['topoApproximation', 'topo_approximation']);
    $densityInformation = firstNonEmpty($postData, ['topoDensity', 'topo_density']);
    $densityDetails = firstNonEmpty($postData, ['topoDensityDetails', 'topo_density_details']);

    // Handle separate density inputs (form provides descriptions, not numeric values)
    $crustDensityInfo = firstNonEmpty($postData, ['topoDensityCrust']);
    $crustDensityDet = firstNonEmpty($postData, ['topoDensityDetailsCrust']);
    $mantleDensityInfo = firstNonEmpty($postData, ['topoDensityMantle']);
    $mantleDensityDet = firstNonEmpty($postData, ['topoDensityDetailsMantle']);

    // Store dropdown labels (e.g., "constant", "layer-specific") directly; columns are VARCHAR(100)

    // Insert new topographic properties record
    $sql = "INSERT INTO `Topographic_Models_Properties`
                (`layer_approach`, `forward_modelling_domain`, `density_information`, 
                 `density_information_details`, `crust_density_information`, `crust_density_information_details`,
                 `mantle_density_information`, `mantle_density_information_details`, `approximation`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare insert statement: " . $connection->error);
    }

    // Use string bindings to allow NULL propagation for nullable numeric fields
    $stmt->bind_param(
        'sssssssss',
        $layerApproach,
        $domain,
        $densityInformation,
        $densityDetails,
        $crustDensityInfo,
        $crustDensityDet,
        $mantleDensityInfo,
        $mantleDensityDet,
        $approximation
    );
    if (!$stmt->execute()) {
        throw new Exception('Error inserting Topographic_Models_Properties: ' . $stmt->error);
    }
    $topographicId = $stmt->insert_id;
    $stmt->close();

    // Link to resource
    $sql = "INSERT INTO `Resource_has_Topographic_Model_Properties`
                (`resource_id`, `topographic_model_property_id`)
             VALUES (?, ?)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare linking statement: " . $connection->error);
    }

    $stmt->bind_param('ii', $resourceId, $topographicId);
    if (!$stmt->execute()) {
        throw new Exception('Error linking Topographic_Models_Properties: ' . $stmt->error);
    }
    $stmt->close();

    return $topographicId;
}

/**
 * Main orchestration function: saves model-type-specific properties
 *
 * @param mysqli $connection  Database connection
 * @param array  $postData    Posted form data
 * @param int    $resourceId  Resource ID
 *
 * @return bool  True on success
 * @throws Exception On any data consistency or database error
 */
function saveGGMsModelTypes(mysqli $connection, array $postData, int $resourceId): bool
{
    // 1) Get the model type from GGM_Definition (or postData if provided)
    $modelTypeId = null;
    
    if (!empty($postData['model_type'])) {
        $modelTypeId = lookupForeignKeyId($connection, 'Model_Type', 'Model_type_id', 'name', $postData['model_type']);
    } else {
        // Try to get from GGM_Definition linked to this resource
        try {
            $ggmInfo = getGGMAndModelType($connection, $resourceId);
            $modelTypeId = $ggmInfo['model_type_id'];
        } catch (Exception $e) {
            // No GGM_Definition exists yet - nothing to process
            return true;
        }
    }

    // If no model type is set, no need to save model-specific properties
    if ($modelTypeId === null) {
        return true;
    }

    // 2) Get model type name and process accordingly
    $modelTypeName = getModelTypeName($connection, $modelTypeId);
    error_log("Model type name determined as: " . $modelTypeName);

    if ($modelTypeName === 'static') {
        saveStaticModelData($connection, $postData, $resourceId);
    } elseif ($modelTypeName === 'temporal') {
        insertTemporalModelProperties($connection, $postData, $resourceId);
    } elseif ($modelTypeName === 'topographic') {
        insertTopographicModelProperties($connection, $postData, $resourceId);
    }

    return true;
}