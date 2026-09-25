<?php

require_once __DIR__ . '/save_contributorpersons.php';
require_once __DIR__ . '/save_contributorinstitutions.php';

/** Normalize the ordered card payload. An explicit empty array is authoritative. */
function normalizeContributorsPayload(array $postData, bool $allowInstitutionContact = false): ?array
{
    if (!array_key_exists('contributorsPayload', $postData)) return null;
    if (!is_string($postData['contributorsPayload'])) throw new InvalidArgumentException('Invalid Contributors payload.');
    $raw = json_decode($postData['contributorsPayload'], true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($raw) || !array_is_list($raw)) {
        throw new InvalidArgumentException('Invalid Contributors payload.');
    }
    $entries = [];
    foreach ($raw as $item) {
        if (!is_array($item) || !in_array($item['type'] ?? null, ['person', 'institution'], true)) {
            throw new InvalidArgumentException('Invalid Contributor entry.');
        }
        $type = $item['type'];
        $roles = [];
        if (!is_array($item['roles'] ?? [])) throw new InvalidArgumentException('Invalid Contributor roles.');
        foreach ($item['roles'] ?? [] as $role) {
            $value = trim((string) (is_array($role) ? ($role['value'] ?? '') : $role));
            if ($value !== '' && ($value !== 'Contact Person' || $type === 'person' || $allowInstitutionContact)) {
                $roles[] = $value;
            }
        }
        $affiliations = [];
        if (!is_array($item['affiliations'] ?? [])) throw new InvalidArgumentException('Invalid Contributor affiliations.');
        foreach ($item['affiliations'] ?? [] as $affiliation) {
            if (!is_array($affiliation)) continue;
            $label = trim((string) ($affiliation['label'] ?? ''));
            if ($label !== '') $affiliations[] = ['label' => $label, 'rorId' => trim((string) ($affiliation['rorId'] ?? ''))];
        }
        $entry = [
            'type' => $type,
            'familyname' => trim((string) ($item['familyname'] ?? '')),
            'givenname' => trim((string) ($item['givenname'] ?? '')),
            'orcid' => preg_replace('~^https?://orcid\.org/~', '', trim((string) ($item['orcid'] ?? ''))),
            'institutionname' => trim((string) ($item['institutionname'] ?? '')),
            'roles' => array_values(array_unique($roles)),
            'affiliations' => $affiliations,
            'email' => trim((string) ($item['email'] ?? '')),
            'website' => trim((string) ($item['website'] ?? '')),
            'order' => count($entries),
        ];
        if ($entry['familyname'] || $entry['givenname'] || $entry['institutionname'] || $entry['orcid'] ||
            $entry['roles'] || $entry['affiliations'] || $entry['email'] || $entry['website']) {
            $entries[] = $entry;
        }
    }
    return $entries;
}

/** Upgrade existing link tables before opening a resource transaction. */
function ensureContributorLinkSchema($connection): void
{
    foreach (['Resource_has_Contributor_Person', 'Resource_has_Contributor_Institution'] as $table) {
        foreach ([
            'sort_order' => 'INT NULL',
            'roles_json' => 'LONGTEXT NULL',
            'affiliations_json' => 'LONGTEXT NULL',
            'contact_email' => 'VARCHAR(255) NULL',
            'contact_website' => 'VARCHAR(2048) NULL',
        ] as $column => $definition) {
            $result = $connection->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
            if (!$result || $result->num_rows === 0) {
                if (!$connection->query("ALTER TABLE `$table` ADD COLUMN `$column` $definition")) {
                    throw new RuntimeException("Could not migrate $table.$column: " . $connection->error);
                }
            }
        }
    }
    $connection->query("INSERT INTO Role (name, forInstitutions) VALUES ('Contact Person', 2) ON DUPLICATE KEY UPDATE forInstitutions = 2");
}

/** Save card-specific roles, affiliations, order and contact details on the resource link. */
function saveContributorsPayload($connection, array $postData, int $resourceId, bool $allowInstitutionContact): bool
{
    $entries = normalizeContributorsPayload($postData, $allowInstitutionContact);
    if ($entries === null) return true;
    foreach ($entries as $entry) {
        $person = $entry['type'] === 'person';
        $name = $person ? $entry['familyname'] : $entry['institutionname'];
        if ($name === '') {
            if (($postData['action'] ?? '') === 'submit') throw new InvalidArgumentException('Contributor name is required.');
            continue;
        }
        if ($person && $entry['orcid'] !== '' && ($postData['action'] ?? '') === 'submit' && !isValidOrcidChecksum($entry['orcid'])) {
            throw new InvalidArgumentException('Invalid Contributor ORCID.');
        }
        $id = $person
            ? saveOrUpdateContributorPerson($connection, $entry['familyname'], $entry['givenname'], $entry['orcid'] ?: null)
            : saveOrUpdateContributorInstitution($connection, $entry['institutionname']);
        $table = $person ? 'Resource_has_Contributor_Person' : 'Resource_has_Contributor_Institution';
        $idColumn = $person ? 'Contributor_Person_contributor_person_id' : 'Contributor_Institution_contributor_institution_id';
        $sql = "INSERT INTO `$table` (Resource_resource_id, `$idColumn`, sort_order, roles_json, affiliations_json, contact_email, contact_website) VALUES (?, ?, ?, ?, ?, ?, ?)";
        $stmt = $connection->prepare($sql);
        if (!$stmt) throw new RuntimeException('Could not prepare Contributor link.');
        $order = $entry['order'];
        $rolesJson = json_encode($entry['roles'], JSON_THROW_ON_ERROR);
        $affiliationsJson = json_encode($entry['affiliations'], JSON_THROW_ON_ERROR);
        $stmt->bind_param('iiissss', $resourceId, $id, $order, $rolesJson, $affiliationsJson, $entry['email'], $entry['website']);
        if (!$stmt->execute()) throw new RuntimeException('Could not save Contributor link: ' . $stmt->error);
        $stmt->close();
    }
    return true;
}
