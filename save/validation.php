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