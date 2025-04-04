<?php
/**
 * @description Handles saving of GGM Properties data
 * 
 * @param mysqli  $connection   Database connection
 * @param array   $postData     Posted form data
 * @param int     $resource_id  Resource ID to associate with the GGM Properties
 * 
 * @return bool   True on success, false on failure
 */
function saveGGMsProperties($connection, $postData, $resource_id) {
    try {
        // Validate required fields
        $requiredFields = ['model_name', 'model_type', 'math_representation'];
        
        foreach ($requiredFields as $field) {
            if (empty($postData[$field])) {
                return false;
            }
        }
        
        // Extract GGM Properties data from form
        $modelName = $postData['model_name'];
        $modelType = $postData['model_type'];
        $mathRepresentation = $postData['math_representation'];
        $celestialBody = $postData['celestial_body'] ?? null;
        $fileFormat = $postData['file_format'] ?? null;
        $productType = $postData['product_type'] ?? null;
        
        // Insert GGM Properties
        $stmt = $connection->prepare(
            "INSERT INTO GGM_Properties 
            (Model_Name, Model_Type, Mathematical_Representation, 
             Celestial_Body, File_Format, Product_Type)
            VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param(
            "ssssss",
            $modelName, $modelType, $mathRepresentation,
            $celestialBody, $fileFormat, $productType
        );
        $stmt->execute();
        $ggmPropertiesId = $stmt->insert_id;
        $stmt->close();
        
        // Link the resource to the GGM Properties
        $stmt = $connection->prepare(
            "INSERT INTO Resource_has_GGM_Properties 
            (Resource_resource_id, GGM_Properties_GGM_Properties_id) 
            VALUES (?, ?)"
        );
        $stmt->bind_param("ii", $resource_id, $ggmPropertiesId);
        $stmt->execute();
        $stmt->close();
        
        return true;
        
    } catch (Exception $e) {
        error_log("Error in saveGGMProperties: " . $e->getMessage());
        return false;
    }
}