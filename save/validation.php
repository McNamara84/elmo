<?php
/**
 * Validates that all required fields are present and not empty
 *
 * @param array $postData The POST data to validate
 * @param array $requiredFields Array of field names that must be present and filled
 * @param array $requiredArrayFields Array of field names that must be present as non-empty arrays
 * @return bool True if all required fields are present and filled, false otherwise
 */
function validateRequiredFields($postData, $requiredFields = [], $requiredArrayFields = [])
{
    // Check regular fields
    foreach ($requiredFields as $field) {
        if (!isset($postData[$field]) || $postData[$field] === '' || $postData[$field] === null) {
            return false;
        }
    }

    // Check array fields
    foreach ($requiredArrayFields as $field) {
        if (!isset($postData[$field]) || !is_array($postData[$field]) || empty($postData[$field])) {
            return false;
        }
    }

    return true;
}

/**
 * Validates that dependent array fields have matching entries.
 * Each primary array element must have a corresponding dependent element.
 *
 * @param array $data The data to validate
 * @param array $dependencies Array of ['primary' => 'field1', 'dependent' => 'field2']
 * @return bool True if all dependencies are satisfied
 */
function validateArrayDependencies($data, $dependencies)
{
    foreach ($dependencies as $dep) {
        $primaryField = $dep['primary'];
        $dependentField = $dep['dependent'];

        // Check if primary field exists and is array
        if (!isset($data[$primaryField]) || !is_array($data[$primaryField])) {
            return false;
        }

        // Check each primary value for corresponding dependent value
        foreach ($data[$primaryField] as $i => $primaryValue) {
            // Skip empty primary values
            if (empty($primaryValue)) {
                continue;
            }

            // Decode JSON if needed and check value
            if (is_string($primaryValue) && json_decode($primaryValue)) {
                $decoded = json_decode($primaryValue, true);
                if (empty($decoded[0]['value'])) {
                    continue;
                }
            }

            // Check if corresponding dependent value exists
            if (!isset($data[$dependentField][$i]) || empty($data[$dependentField][$i])) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Validates that all required fields are present in JSON-structured keyword entries.
 *
 * @param array $keywordData The decoded JSON data to validate
 * @param array $requiredFields Array of field names that must be present in each entry
 * @return bool True if all entries contain all required fields with non-empty values
 */
function validateKeywordEntries($keywordData, $requiredFields = ['value', 'id', 'scheme', 'schemeURI', 'language'])
{
    if (!is_array($keywordData)) {
        return false;
    }

    foreach ($keywordData as $entry) {
        foreach ($requiredFields as $field) {
            if (!isset($entry[$field]) || empty($entry[$field])) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Validates dependencies for Spatial Temporal Coverage entries.
 * 
 * @param array $entry The STC entry data
 * @return bool Returns true if dependencies are valid
 */
function validateSTCDependencies($entry)
{
    // Validate required base fields
    if (
        empty($entry['latitudeMin']) || empty($entry['longitudeMin']) ||
        empty($entry['description']) || empty($entry['dateStart']) ||
        empty($entry['dateEnd']) || empty($entry['timezone'])
    ) {
        return false;
    }

    // If timeStart is given, timeEnd must also be given
    if (!empty($entry['timeStart']) && empty($entry['timeEnd'])) {
        return false;
    }

    // If longitudeMax is given, latitudeMax must also be given and vice versa
    if (
        (!empty($entry['longitudeMax']) && empty($entry['latitudeMax'])) ||
        (empty($entry['longitudeMax']) && !empty($entry['latitudeMax']))
    ) {
        return false;
    }

    return true;
}

/**
 * Validates related work entries.
 * If any field in a row is filled, all fields in that row must be filled.
 *
 * @param array $entry Array containing the fields for one related work entry
 * @return bool True if the entry is valid
 */
function validateRelatedWorkDependencies($entry)
{
    // If all fields are empty, the entry is valid (no data provided)
    if (empty($entry['identifier']) && empty($entry['relation']) && empty($entry['identifierType'])) {
        return true;
    }

    // If any field is filled, all fields must be filled
    if (empty($entry['identifier']) || empty($entry['relation']) || empty($entry['identifierType'])) {
        return false;
    }

    return true;
}