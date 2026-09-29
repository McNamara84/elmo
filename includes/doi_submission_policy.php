<?php

require_once __DIR__ . '/resource_information_payload.php';

/**
 * Validate an existing DOI before a Standard/MSL/IGSN submission is persisted.
 * The lookup callback is shared with the public DOI proxy in production.
 *
 * @param array<string, mixed> $postData
 * @param callable(string): array $lookup
 * @return array<string, mixed>
 */
function validateSubmissionResourceInformation(
    array $postData,
    bool $isIcgem,
    callable $lookup,
    string $curationContact
): array {
    $postData = normalizeResourceInformationPostData($postData);
    if (trim((string) ($postData['language'] ?? '')) === '') {
        throw new DomainException('Please select a dataset language.');
    }
    $version = trim((string) ($postData['version'] ?? ''));
    if ($version !== '' && !preg_match('/^\d+\.\d+$/D', $version)) {
        throw new DomainException('Please enter a version in the form x.y.');
    }
    $doi = trim((string) ($postData['doi'] ?? ''));
    if ($doi === '' || $isIcgem) return $postData;

    if (!preg_match('~^10\.\d{4,9}/\S+$~D', $doi)) {
        throw new DomainException('Please enter a valid DOI or leave the DOI field empty for a new registration.');
    }
    if (!preg_match('~^10\.5880/~i', $doi)) {
        throw new DomainException('Only an existing GFZ Data Services DOI beginning with 10.5880 can be submitted here. Remove this DOI to request a new one.');
    }

    try {
        $result = $lookup($doi);
    } catch (Throwable $error) {
        throw new DomainException("The DOI could not be verified with DataCite. Please contact {$curationContact}.", 0, $error);
    }
    if (empty($result['found']) || !is_array($result['attributes'] ?? null)) {
        throw new DomainException("The DOI was not found in public DataCite records. Please contact {$curationContact}.");
    }
    $attributes = $result['attributes'];
    if (isset($attributes['doi']) && strcasecmp(trim((string) $attributes['doi']), $doi) !== 0) {
        throw new DomainException("DataCite returned a different DOI. Please contact {$curationContact}.");
    }

    $sourceVersion = trim((string) ($attributes['version'] ?? ''));
    if ($sourceVersion === '') {
        $nextVersion = '1.0';
    } elseif (preg_match('/^(\d+)\.\d+$/D', $sourceVersion, $matches)) {
        $major = filter_var($matches[1], FILTER_VALIDATE_INT);
        if ($major === false || $major >= PHP_INT_MAX) {
            throw new DomainException("The published DOI has an unclear version. Please contact {$curationContact}.");
        }
        $nextVersion = ($major + 1) . '.0';
    } else {
        throw new DomainException("The published DOI has an unclear version. Please contact {$curationContact}.");
    }
    $submittedVersion = trim((string) ($postData['version'] ?? ''));
    if ($submittedVersion !== '' && $submittedVersion !== $nextVersion) {
        throw new DomainException("The version for this existing DOI must be {$nextVersion}. Please review the suggested major version.");
    }
    $postData['version'] = $nextVersion;
    $postData['existingGfzDoi'] = '1';
    if (array_key_exists('resourceInformationPayload', $postData)) {
        $payload = json_decode((string) $postData['resourceInformationPayload'], true, 512, JSON_THROW_ON_ERROR);
        $payload['version'] = $nextVersion;
        $postData['resourceInformationPayload'] = json_encode($payload, JSON_THROW_ON_ERROR);
    }
    return $postData;
}
