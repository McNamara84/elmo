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
    $sql = "SELECT r.Model_type_id, rg.GGM_Properties_GGM_Properties_id
            FROM `Resource` r
            LEFT JOIN `Resource_has_GGM_Properties` rg ON r.resource_id = rg.Resource_resource_id
            WHERE r.resource_id = ?
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
 * Saves time-variable coefficients info for Static models
 *
 * @param mysqli $connection  Database connection
 * @param array  $postData    Form data
 * @param int    $ggmPropertiesId       GGM_Properties_id
 *
 * @return void
 * @throws Exception On database error
 */
function saveStaticModelData(mysqli $connection, array $postData, int $ggmPropertiesId): void
{
    $hasTimeVariableCoefficients = isset($postData['time_variable_coefficients']) && $postData['time_variable_coefficients'];
    $description = $hasTimeVariableCoefficients && isset($postData['time_variable_description']) 
        ? $postData['time_variable_description'] 
        : null;

    $sql = "UPDATE `GGM_Properties` SET
                `info_time_variable_coefficients` = ?
            WHERE `GGM_Properties_id` = ?";

    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare update statement: " . $connection->error);
    }

    $stmt->bind_param('si', $description, $ggmPropertiesId);
    if (!$stmt->execute()) {
        throw new Exception('Error updating GGM_Properties for Static model: ' . $stmt->error);
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
    // Parse temporal resolution from either custom value or predefined frequency
    $temporalResolutionDays = null;
    if (!empty($postData['temporal_frequency'])) {
        $temporalResolutionDays = (int) $postData['temporal_frequency'];
    } elseif (!empty($postData['temporal_frequency_predef'])) {
        $frequencyMap = [
            'daily' => 1,
            'weekly' => 7,
            'monthly' => 30,
            'quarterly' => 90,
            'yearly' => 365
        ];
        $temporalResolutionDays = $frequencyMap[$postData['temporal_frequency_predef']] ?? null;
    }

    $startDate = $postData['temporal_start'] ?? null;
    $endDate = $postData['temporal_end'] ?? null;
    $generatingInstitution = isset($postData['temporal_institution']) && $postData['temporal_institution'] ? 1 : 0;

    // Insert new temporal properties record
    $sql = "INSERT INTO `Temporal_Model_Properties`
                (`start_date`, `end_date`, `temporal_resolution_days`, `generating_institution`)
             VALUES (?, ?, ?, ?)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare insert statement: " . $connection->error);
    }

    $stmt->bind_param('ssii', $startDate, $endDate, $temporalResolutionDays, $generatingInstitution);
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
    $layerApproach = $postData['topo_layer_approach'] ?? null;
    $domain = $postData['topo_domain'] ?? null;
    $approximation = $postData['topo_approximation'] ?? null;
    $densityInformation = $postData['topo_density'] ?? null;
    $densityDetails = $postData['topo_density_details'] ?? null;

    // Handle separate density values for crust and mantle
    $crustDensityValue = null;
    $crustDensityDesc = null;
    $mantleDensityValue = null;
    $mantleDensityDesc = null;

    if (!empty($postData['separate_density'])) {
        $crustDensityValue = !empty($postData['topo_density_crust_value']) 
            ? (float) $postData['topo_density_crust_value'] 
            : null;
        $crustDensityDesc = $postData['topo_density_crust_description'] ?? null;

        $mantleDensityValue = !empty($postData['topo_density_mantle_value']) 
            ? (float) $postData['topo_density_mantle_value'] 
            : null;
        $mantleDensityDesc = $postData['topo_density_mantle_description'] ?? null;
    }

    // Insert new topographic properties record
    $sql = "INSERT INTO `Topographic_Models_Properties`
                (`layer_approach`, `forward_modelling_domain`, `density_information`, 
                 `density_information_details`, `crust_density_value`, `crust_density_description`,
                 `mantle_density_value`, `mantle_density_description`, `approximation`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $connection->prepare($sql);
    if (!$stmt) {
        throw new Exception("Failed to prepare insert statement: " . $connection->error);
    }

    $stmt->bind_param(
        'ssssddsds',
        $layerApproach,
        $domain,
        $densityInformation,
        $densityDetails,
        $crustDensityValue,
        $crustDensityDesc,
        $mantleDensityValue,
        $mantleDensityDesc,
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
    // 1) Retrieve GGM_Properties_id and Model_type_id
    $ggmData = getGGMAndModelType($connection, $resourceId);
    $ggmPropertiesId = $ggmData['ggm_id'];
    $modelTypeId = $ggmData['model_type_id'];

    // If no model type is set, no need to save model-specific properties
    if ($modelTypeId === null) {
        return true;
    }

    // 2) Get model type name and process accordingly
    $modelTypeName = getModelTypeName($connection, $modelTypeId);

    if ($modelTypeName === 'Static') {
        saveStaticModelData($connection, $postData, $ggmPropertiesId);
    } elseif ($modelTypeName === 'Temporal') {
        insertTemporalModelProperties($connection, $postData, $resourceId);
    } elseif ($modelTypeName === 'Topographic') {
        insertTopographicModelProperties($connection, $postData, $resourceId);
    }

    return true;
}