<?php
/**
 * Saves the thesaurus keywords into the database.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return void
 */
function saveKeywords($connection, $postData, $resource_id)
{
    // Defines the fields to process
    $fieldsToProcess = [
        'gcmdScienceKeywords', // Thesaurus Keywords
        'MSLKeywords',        // MSL Keywords
        'platforms',          // GCMD Platforms
        'instruments'         // GCMD Instruments
    ];

    // Iterates over the fields and checks if they exist in the POST data and are not empty
    foreach ($fieldsToProcess as $field) {
        if (isset($postData[$field]) && $postData[$field] !== '') {
            $fieldObject = $postData[$field];                 // JSON string
            $fieldArray = json_decode($fieldObject, true);   // Decodes the JSON string into an array

            // Processes each keyword in the array
            foreach ($fieldArray as $entry) {
                processThesaurusKeyword($connection, $entry, $resource_id, $field);
            }
        }
    }
}

/**
 * Processes a single thesaurus keyword.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $entry       The data of the keyword.
 * @param int    $resource_id The ID of the associated resource.
 * @param string $field       The current field, either 'gcmdScienceKeywords', 'GCMD Platforms', 'GCMD Instruments' or 'MSLKeywords'.
 *
 * @return void
 */
function processThesaurusKeyword($connection, $entry, $resource_id, $field)
{
    // Retrieves the values from the keyword array
    $value = $entry['value'];
    $valueURI = isset($entry['id']) ? $entry['id'] : null;       // Uses the URI if available
    $scheme = isset($entry['scheme']) ? $entry['scheme'] : $field; // If no scheme, use the field name
    $schemeURI = isset($entry['schemeURI']) ? $entry['schemeURI'] : ''; // Optional: URI of the scheme
    $language = isset($entry['language']) ? $entry['language'] : 'en'; // Default language: English

    // If the value is not empty, process it
    if (!empty($value)) {
        // Gets the ID of the keyword or creates a new one if it doesn't exist
        $thesaurus_keywords_id = getOrCreateThesaurusKeyword($connection, $value, $scheme, $schemeURI, $valueURI, $language);
        // Links the resource with the keyword
        linkResourceToThesaurusKeyword($connection, $resource_id, $thesaurus_keywords_id);
    }
}

/**
 * Retrieves an existing thesaurus keyword or creates a new one.
 *
 * @param mysqli      $connection The database connection.
 * @param string      $value      The value of the keyword.
 * @param string      $scheme     The scheme of the keyword.
 * @param string      $schemeURI  The URI of the scheme.
 * @param string|null $valueURI   The URI of the value.
 * @param string      $language   The language of the keyword.
 *
 * @return int The ID of the thesaurus keyword.
 */
function getOrCreateThesaurusKeyword($connection, $value, $scheme, $schemeURI, $valueURI, $language)
{
    // Checks if the keyword already exists
    $stmt = $connection->prepare("SELECT thesaurus_keywords_id FROM Thesaurus_Keywords WHERE keyword = ?");
    $stmt->bind_param("s", $value);
    $stmt->execute();
    $stmt->store_result();

    // If it exists, retrieve the ID
    if ($stmt->num_rows > 0) {
        $stmt->bind_result($thesaurus_keywords_id);
        $stmt->fetch();
    } else {
        // If not, insert a new keyword into the database
        $stmt->close();
        $stmt = $connection->prepare("INSERT INTO Thesaurus_Keywords (`keyword`, `scheme`, `schemeURI`, `valueURI`, `language`) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssss", $value, $scheme, $schemeURI, $valueURI, $language);
        $stmt->execute();
        // Retrieve the ID of the newly inserted keyword
        $thesaurus_keywords_id = $stmt->insert_id;
    }
    $stmt->close();

    return $thesaurus_keywords_id; // Returns the ID of the keyword
}

/**
 * Links a resource to a thesaurus keyword.
 *
 * @param mysqli $connection           The database connection.
 * @param int    $resource_id          The ID of the resource.
 * @param int    $thesaurus_keywords_id The ID of the thesaurus keyword.
 *
 * @return void
 */
function linkResourceToThesaurusKeyword($connection, $resource_id, $thesaurus_keywords_id)
{
    // Inserts a link between the resource and the keyword into the database
    $stmt = $connection->prepare("INSERT INTO Resource_has_Thesaurus_Keywords (`Resource_resource_id`, `Thesaurus_Keywords_thesaurus_keywords_id`) VALUES (?, ?)");
    $stmt->bind_param("ii", $resource_id, $thesaurus_keywords_id);
    $stmt->execute();
    $stmt->close();
}
