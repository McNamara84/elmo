<?php
require_once __DIR__ . '/../validation.php';

/**
 * Summarizes a thesaurus (or free-keyword) POST value as present/absent tag `value`s.
 *
 * @param mixed $raw Missing, JSON string, list of JSON strings, or decoded tags.
 * @return array{present: bool, count?: int, values?: list<string>, jsonError?: string, rawLength?: int}
 */
function summarizeThesaurusKeywordPostField(mixed $raw): array
{
    if ($raw === null) {
        return ['present' => false];
    }

    if (is_array($raw)) {
        if ($raw === []) {
            return ['present' => true, 'count' => 0, 'values' => []];
        }

        $values = [];
        foreach ($raw as $item) {
            if (is_array($item) && array_key_exists('value', $item) && $item['value'] !== null) {
                $values[] = (string) $item['value'];
                continue;
            }
            if (is_string($item)) {
                $part = summarizeThesaurusKeywordPostField($item);
                if (!empty($part['jsonError'])) {
                    return [
                        'present' => true,
                        'jsonError' => $part['jsonError'],
                        'rawLength' => strlen($item),
                    ];
                }
                if (!empty($part['values'])) {
                    $values = array_merge($values, $part['values']);
                }
                continue;
            }
            $encoded = json_encode($item, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $values[] = is_string($encoded) ? $encoded : '';
        }

        return ['present' => true, 'count' => count($values), 'values' => $values];
    }

    if (!is_string($raw)) {
        $raw = (string) $raw;
    }
    if ($raw === '') {
        return ['present' => true, 'count' => 0, 'values' => []];
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'present' => true,
            'jsonError' => json_last_error_msg(),
            'rawLength' => strlen($raw),
        ];
    }
    if (!is_array($decoded)) {
        return [
            'present' => true,
            'jsonError' => 'not-array',
            'rawLength' => strlen($raw),
        ];
    }

    return summarizeThesaurusKeywordPostField($decoded);
}

/**
 * Builds one greppable log line for a thesaurus POST field.
 *
 * @param string $tag Log prefix such as `[SAVE]` or `[💿SAVE]`.
 * @param string $field POST key.
 * @param array{present: bool, count?: int, values?: list<string>, jsonError?: string, rawLength?: int} $summary
 */
function formatThesaurusKeywordPostLogLine(string $tag, string $field, array $summary): string
{
    if (empty($summary['present'])) {
        return "{$tag} thesaurus POST {$field}: present=no";
    }
    if (!empty($summary['jsonError'])) {
        $rawLength = $summary['rawLength'] ?? 0;
        return "{$tag} thesaurus POST {$field}: present=yes jsonError={$summary['jsonError']} rawLength={$rawLength}";
    }
    $count = $summary['count'] ?? 0;
    $values = json_encode($summary['values'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return "{$tag} thesaurus POST {$field}: present=yes count={$count} values={$values}";
}

/**
 * Logs summarized thesaurus keyword fields from PHP `$_POST`.
 *
 * @param array<string, mixed> $postData Submitted form data.
 * @param string               $tag      Greppable log prefix.
 */
function logThesaurusKeywordPostData(array $postData, string $tag = '[SAVE]'): void
{
    // `freekeywords` is PHP's name for the form field `freekeywords[]`.
    $fields = [
        'gcmdScienceKeywords',
        'MSLKeywords',
        'platforms',
        'instruments',
        'chronostratKeywords',
        'gemetKeywords',
        'freekeywords',
    ];
    foreach ($fields as $field) {
        $raw = array_key_exists($field, $postData) ? $postData[$field] : null;
        error_log(formatThesaurusKeywordPostLogLine($tag, $field, summarizeThesaurusKeywordPostField($raw)));
    }
}

/**
 * Saves the thesaurus keywords into the database.
 *
 * @param mysqli $connection  The database connection.
 * @param array  $postData    The POST data from the form.
 * @param int    $resource_id The ID of the associated resource.
 *
 * @return bool Returns true if keywords are saved successfully, false if validation fails
 */
function saveKeywords($connection, $postData, $resource_id)
{
    logThesaurusKeywordPostData($postData, '[💿SAVE]');

    // Defines the fields to process
    $fieldsToProcess = [
        'gcmdScienceKeywords',  // GCMD Science Keywords
        'MSLKeywords',          // MSL Keywords
        'platforms',            // GCMD Platforms
        'instruments',          // GCMD Instruments
        'chronostratKeywords',  // ICS Chronostratigraphy
        'gemetKeywords',        // GEMET Thesaurus
    ];

    // Iterates over the fields and checks if they exist in the POST data and are not empty
    foreach ($fieldsToProcess as $field) {
        if (isset($postData[$field]) && $postData[$field] !== '') {
            $fieldObject = $postData[$field];                 // JSON string
            $fieldArray = json_decode($fieldObject, true);   // Decodes the JSON string into an array

            // Validate the keyword entries if they exist
            if ($fieldArray && !validateKeywordEntries($fieldArray)) {
                return false;
            }

            // Processes each keyword in the array
            foreach ($fieldArray as $entry) {
                processThesaurusKeyword($connection, $entry, $resource_id, $field);
            }
        }
    }

    return true;
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
    $valueURI = isset($entry['id']) && $entry['id'] !== '' ? $entry['id'] : null;
    $scheme = isset($entry['scheme']) && $entry['scheme'] !== '' ? $entry['scheme'] : null;

    // Workaround until Utrecht fixed it in the original source
    if ($field === 'MSLKeywords') {
        $scheme = 'EPOS MSL vocabulary';
    }

    $schemeURI = isset($entry['schemeURI']) && $entry['schemeURI'] !== '' ? $entry['schemeURI'] : null;
    $language = isset($entry['language']) && $entry['language'] !== '' ? $entry['language'] : null;

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
 * @param string|null $scheme     The scheme of the keyword.
 * @param string|null $schemeURI  The URI of the scheme.
 * @param string|null $valueURI   The URI of the value.
 * @param string|null $language   The language of the keyword.
 *
 * @return int The ID of the thesaurus keyword.
 */
function getOrCreateThesaurusKeyword($connection, $value, $scheme, $schemeURI, $valueURI, $language)
{
    // Checks if the keyword with the exact same attributes already exists.
    // Uses NULL-safe comparison (<=>) so that NULL values match correctly.
    $stmt = $connection->prepare(
        "SELECT thesaurus_keywords_id FROM Thesaurus_Keywords
         WHERE keyword = ? AND scheme <=> ? AND schemeURI <=> ? AND valueURI <=> ? AND language <=> ?"
    );
    $stmt->bind_param("sssss", $value, $scheme, $schemeURI, $valueURI, $language);
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
