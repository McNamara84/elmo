<?php
require_once __DIR__ . '/../validation.php';

/**
 * Saves the descriptions of a resource in the database.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return bool Returns true if descriptions are saved successfully; false if the abstract is missing.
 */
function saveDescriptions($connection, $postData, $resource_id)
{
    global $showGGMsProperties;
    
    // Validate that abstract is present
    $action = $postData['action'] ?? 'save_and_download';

    if ($action === 'submit') {
        $requiredFields = ['descriptionAbstract'];

        if (!validateRequiredFields($postData, $requiredFields)) {
            return false;
        }
    }

    // Generic description types (always available)
    $genericDescriptionTypes = [
        'Methods' => 'descriptionMethods',
        'Technical Information' => 'descriptionTechnical'
    ];

    // Save generic descriptions (excluding Abstract and Other, which are handled separately)
    foreach ($genericDescriptionTypes as $type => $postKey) {
        if (isset($postData[$postKey]) && !empty($postData[$postKey])) {
            $text = trim($postData[$postKey]);
            insertDescription($connection, $type, $text, $resource_id);
        }
    }

    // ELMOGEM-specific handling (if enabled)
    $abstract_text = isset($postData['descriptionAbstract']) ? trim($postData['descriptionAbstract']) : '';
    
    if ($showGGMsProperties) {
        // ELMOGEM-specific description types
        $elmogem_description_types = [
            'General model description' => 'descriptionGeneralModelDescription',
            'Input data' => 'descriptionInputData',
            'Processing procedures' => 'descriptionProcessingProcedures',
            'Specific features of resulting gravity field' => 'descriptionSpecificFeaturesOfResultingGravityField'
        ];
        
        $elmogem_texts = [];

        // Save ELMOGEM-specific descriptions and collect them for appending to abstract
        foreach ($elmogem_description_types as $type => $postKey) {
            if (isset($postData[$postKey]) && !empty($postData[$postKey])) {
                $text = trim($postData[$postKey]);
                insertDescription($connection, $type, $text, $resource_id);
                $elmogem_texts[] = $text;
            }
        }

        // Insert combined Abstract with ELMOGEM texts appended for DataCite indexing
        if (!empty($elmogem_texts)) {
            $combined_abstract = $abstract_text . "\n\n" . implode("\n\n", $elmogem_texts);
            insertDescription($connection, 'Abstract', $combined_abstract, $resource_id);
        } elseif (!empty($abstract_text)) {
            insertDescription($connection, 'Abstract', $abstract_text, $resource_id);
        }
    } else {
        // Non-ELMOGEM mode: just save the abstract as-is
        if (!empty($abstract_text)) {
            insertDescription($connection, 'Abstract', $abstract_text, $resource_id);
        }
    }

    // Save Other
    if (isset($postData['descriptionOther']) && !empty($postData['descriptionOther'])) {
        $text = trim($postData['descriptionOther']);
        insertDescription($connection, 'Other', $text, $resource_id);
    }

    return true;
}

/**
 * Inserts a single description into the database.
 *
 * @param mysqli $connection  The database connection.
 * @param string $type        The type of the description.
 * @param string $description The content of the description.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return void
 */
function insertDescription($connection, $type, $description, $resource_id)
{
    $stmt = $connection->prepare("INSERT INTO Description (`type`, `description`, `resource_id`) VALUES (?, ?, ?)");
    $stmt->bind_param("ssi", $type, $description, $resource_id);
    $stmt->execute();
    $stmt->close();
}