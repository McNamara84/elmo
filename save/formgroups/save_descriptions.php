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
    // Validate that abstract is present
    $action = $postData['action'] ?? 'save_and_download';

    if ($action === 'submit') {
        $requiredFields = ['descriptionAbstract'];

        if (!validateRequiredFields($postData, $requiredFields)) {
            return false;
        }
    }

    $descriptionTypes = [
        'Abstract' => 'descriptionAbstract',
        'Methods' => 'descriptionMethods',
        'TechnicalInfo' => 'descriptionTechnical',
        'General model description' => 'descriptionGeneralModelDescription',   // ELMOGEM specific
        'Input data' => 'descriptionInputData',                               // ELMOGEM specific 
        'Processing procedures' => 'descriptionProcessingProcedures',        // ELMOGEM specific                                   
        'Specific features of resulting gravity field' => 'descriptionSpecificFeaturesOfResultingGravityField', // ELMOGEM specific
        'Other' => 'descriptionOther'
    ];

    $elmogem_specific_types = [
        'General model description',
        'Input data',
        'Processing procedures',
        'Specific features of resulting gravity field'
    ];
    
    $elmogem_texts = [];

    // Iterate over each description type and insert if present
    foreach ($descriptionTypes as $type => $postKey) {
        if (isset($postData[$postKey]) && !empty($postData[$postKey])) {
            $text = trim($postData[$postKey]);
            insertDescription($connection, $type, $text, $resource_id);
            
            // Collect ELMOGEM-specific texts to append to abstract
            if (in_array($type, $elmogem_specific_types, true)) {
                $elmogem_texts[] = $text;
            }
        }
    }

    // Append ELMOGEM-specific descriptions to Abstract for DataCite indexing
    if (!empty($elmogem_texts)) {
        $abstract_text = isset($postData['descriptionAbstract']) ? trim($postData['descriptionAbstract']) : '';
        $combined_abstract = $abstract_text . "\n\n" . implode("\n\n", $elmogem_texts);
        insertDescription($connection, 'Abstract', $combined_abstract, $resource_id);
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