<?php

/** Decode an optional structured payload without accepting malformed input. */
function decodeContactPayload(array $post, string $name): ?array
{
    if (!array_key_exists($name, $post)) {
        return [];
    }
    if (!is_string($post[$name])) {
        return null;
    }
    $decoded = json_decode($post[$name], true);
    return json_last_error() === JSON_ERROR_NONE && is_array($decoded) && array_is_list($decoded)
        ? $decoded : null;
}

function hasContributorContactRole(array $entry, bool $allowInstitution): bool
{
    $type = $entry['type'] ?? null;
    if ($type !== 'person' && !($type === 'institution' && $allowInstitution)) {
        return false;
    }
    $roles = $entry['roles'] ?? [];
    if (!is_array($roles)) {
        return false;
    }
    foreach ($roles as $role) {
        $value = is_array($role) ? ($role['value'] ?? null) : $role;
        if ($value === 'Contact Person') {
            return true;
        }
    }
    return false;
}

/** Submit-only contact requirement. Draft saves may remain incomplete. */
function validateSubmittedContact(array $post, bool $allowInstitution): bool
{
    $authors = decodeContactPayload($post, 'authorsPayload');
    $contributors = decodeContactPayload($post, 'contributorsPayload');
    if ($authors === null || $contributors === null) {
        return false;
    }
    foreach ($authors as $entry) {
        if (is_array($entry) && ($entry['type'] ?? null) === 'person' && ($entry['isContact'] ?? false) === true &&
            trim((string) ($entry['familyname'] ?? '')) !== '' &&
            filter_var(trim((string) ($entry['email'] ?? '')), FILTER_VALIDATE_EMAIL)) {
            return true;
        }
    }
    if (!array_key_exists('authorsPayload', $post) && is_array($post['familynames'] ?? null)) {
        foreach (($post['familynames'] ?? []) as $index => $familyname) {
            if (trim((string) $familyname) !== '' &&
                filter_var(trim((string) ($post['cpEmail'][$index] ?? '')), FILTER_VALIDATE_EMAIL)) {
                return true;
            }
        }
    }
    foreach ($contributors as $entry) {
        if (!is_array($entry) || !hasContributorContactRole($entry, $allowInstitution)) {
            continue;
        }
        $name = ($entry['type'] === 'person') ? ($entry['familyname'] ?? '') : ($entry['institutionname'] ?? '');
        if (trim((string) $name) !== '' &&
            filter_var(trim((string) ($entry['email'] ?? '')), FILTER_VALIDATE_EMAIL)) {
            return true;
        }
    }
    return false;
}
