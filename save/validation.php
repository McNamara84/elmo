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
 * Validates contributor person dependencies.
 * 
 * @param array $entry Array containing the fields for one contributor person entry
 * @return bool True if the entry is valid
 */
function validateContributorPersonDependencies($entry)
{
    // If all relevant fields are empty, entry is valid (no data provided)
    if (
        empty($entry['lastname']) && empty($entry['firstname']) &&
        empty($entry['orcid']) && empty($entry['roles'])
    ) {
        return true;
    }

    // Ensure 'roles' is properly decoded from JSON if it's a string
    if (is_string($entry['roles'])) {
        $entry['roles'] = json_decode($entry['roles'], true);
    }

    // If any field is filled, check if required fields (lastname, firstname, and roles) are filled
    if (!empty($entry['firstname']) || !empty($entry['lastname']) || !empty($entry['roles'])) {
        // Ensure lastname and roles are filled if any of the relevant fields is filled
        if (empty($entry['lastname']) || empty($entry['roles']) || !is_array($entry['roles']) || count($entry['roles']) == 0) {
            return false;
        }
    }

    return true;
}


/**
 * Validates contributor institution dependencies.
 * 
 * @param array $entry Array containing the fields for one contributor institution entry
 * @return bool True if the entry is valid
 */
function validateContributorInstitutionDependencies($entry)
{
    // If all fields are empty, entry is valid (no data provided)
    if (empty($entry['name']) && empty($entry['roles'])) {
        return true;
    }

    // Both name and roles are required if any is filled
    if (empty($entry['name']) || empty($entry['roles'])) {
        return false;
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

/**
 * Validates funding reference dependencies.
 * If any of FunderID, GrantNumber, or GrantName is filled, Funder must also be filled.
 *
 * @param array $entry Array containing the fields for one funding reference entry
 * @return bool True if the entry is valid
 */
function validateFundingReferenceDependencies($entry)
{
    // If all fields are empty, the entry is valid (no data provided)
    if (
        empty($entry['funder']) && empty($entry['funderId']) &&
        empty($entry['grantNumber']) && empty($entry['grantName']) &&
        empty($entry['awardUri'])
    ) {
        return true;
    }

    // If any dependent field is filled, funder must be filled
    if (
        !empty($entry['funderId']) || !empty($entry['grantNumber']) ||
        !empty($entry['grantName']) || !empty($entry['awardUri'])
    ) {
        return !empty($entry['funder']);
    }

    // If only funder is filled, that's valid
    return true;
}

/**
 * Retrieves valid roles from the database.
 *
 * @param mysqli $connection The database connection.
 * @return array An array with role names as keys and role IDs as values.
 */
function getValidRoles($connection)
{
    $valid_roles = [];
    $stmt = $connection->prepare("SELECT role_id, name FROM Role");
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $valid_roles[$row['name']] = $row['role_id'];
    }
    $stmt->close();
    return $valid_roles;
}