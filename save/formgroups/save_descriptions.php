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
    if (!validateRequiredFields($postData, ['descriptionAbstract'])) {
        return false;
    }

    $descriptionTypes = [
        'Abstract' => 'descriptionAbstract',
        'Methods' => 'descriptionMethods',
        'Technical Information' => 'descriptionTechnical',
        'Other' => 'descriptionOther'
    ];

    // Iterate over each description type and insert if present
    foreach ($descriptionTypes as $type => $postKey) {
        if (isset($postData[$postKey]) && !empty($postData[$postKey])) {
            insertDescription($connection, $type, $postData[$postKey], $resource_id);
        }
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