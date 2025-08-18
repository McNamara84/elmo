<?php
require_once __DIR__ . '/../validation.php';
require_once __DIR__ . '/save_affiliations.php';

/**
 * Saves the contributor institutions into the database.
 *
 * @param mysqli $connection    The database connection.
 * @param array $postData       The POST data from the form.
 * @param int $resource_id      The ID of the resource.
 *
 * @return bool Returns true if saving was successful, otherwise false.
 */
function saveContributorInstitutions($connection, $postData, $resource_id)
{
    $valid_roles = getValidRoles($connection);

    if (
        !isset(
        $postData['cbOrganisationName'],
        $postData['cbOrganisationRoles'],
        $postData['OrganisationAffiliation']
    ) ||
        !is_array($postData['cbOrganisationName']) ||
        !is_array($postData['cbOrganisationRoles']) ||
        !is_array($postData['OrganisationAffiliation'])
    ) {
        return true; // No data provided is valid
    }

    $allSuccessful = true;
    $len = count($postData['cbOrganisationName']);

    for ($i = 0; $i < $len; $i++) {
        $entry = [
            'name' => $postData['cbOrganisationName'][$i] ?? '',
            'roles' => $postData['cbOrganisationRoles'][$i] ?? ''
        ];

        if (!validateContributorInstitutionDependencies($entry)) {
            $allSuccessful = false;
            continue;
        }

        // Skip if no data provided
        if (empty($entry['name']) && empty($entry['roles'])) {
            continue;
        }

        $contributor_institution_id = saveOrUpdateContributorInstitution($connection, $entry['name']);

        if (!$contributor_institution_id) {
            $allSuccessful = false;
            continue;
        }

        if (!linkResourceToContributorInstitution($connection, $resource_id, $contributor_institution_id)) {
            $allSuccessful = false;
        }

        if (!empty($postData['OrganisationAffiliation'][$i])) {
            if (
                !saveAffiliations(
                    $connection,
                    $contributor_institution_id,
                    $postData['OrganisationAffiliation'][$i],
                    $postData['hiddenOrganisationRorId'][$i] ?? null,
                    'Contributor_Institution_has_Affiliation',
                    'Contributor_Institution_contributor_institution_id'
                )
            ) {
                $allSuccessful = false;
            }
        }

        if (!saveContributorInstitutionRoles($connection, $contributor_institution_id, $entry['roles'], $valid_roles)) {
            $allSuccessful = false;
        }
    }

    return $allSuccessful;
}

/**
 * Saves or updates a Contributor Institution in the database.
 *
 * @param mysqli $connection    The Database Connection.
 * @param string $name          The Name of the Contributor Institution.
 *
 * @return int                  The ID of the saved or updated Contributor Institution.
 */
function saveOrUpdateContributorInstitution($connection, $name)
{
    $stmt = $connection->prepare("SELECT contributor_institution_id FROM Contributor_Institution WHERE name = ?");
    $stmt->bind_param("s", $name);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $contributor_institution_id = $row['contributor_institution_id'];
    } else {
        $stmt = $connection->prepare("INSERT INTO Contributor_Institution (name) VALUES (?)");
        $stmt->bind_param("s", $name);
        $stmt->execute();
        $contributor_institution_id = $stmt->insert_id;
    }
    $stmt->close();

    return $contributor_institution_id;
}

/**
 * Links a Resource with a Contributor Institution.
 *
 * @param mysqli $connection                The Database Connection.
 * @param int $resource_id                  The ID of the Resource.
 * @param int $contributor_institution_id   The ID of the Contributor Institution.
 *
 * @return void
 */
function linkResourceToContributorInstitution($connection, $resource_id, $contributor_institution_id)
{
    $stmt = $connection->prepare("INSERT IGNORE INTO Resource_has_Contributor_Institution (Resource_resource_id, Contributor_Institution_contributor_institution_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $resource_id, $contributor_institution_id);
    $stmt->execute();
    $stmt->close();
}

/**
 * Saves roles of a Contributor Institution.
 *
 * @param mysqli $connection                The database connection.
 * @param int $contributor_institution_id   The ID of the contributor institution.
 * @param array|string $roles               The roles of the institution.
 * @param array $valid_roles                Array with valid roles.
 *
 * @return void
 */
function saveContributorInstitutionRoles($connection, $contributor_institution_id, $roles, $valid_roles)
{
    // Check whether $roles is a JSON string, and if so, decode it
    if (is_string($roles)) {
        $roles = json_decode($roles, true);
    }

    // Make sure that $roles is an array
    if (!is_array($roles)) {
        $roles = [$roles];
    }

    // Delete existing roles
    $stmt = $connection->prepare("DELETE FROM Contributor_Institution_has_Role WHERE Contributor_Institution_contributor_institution_id = ?");
    $stmt->bind_param("i", $contributor_institution_id);
    $stmt->execute();
    $stmt->close();

    // Save new roles
    foreach ($roles as $role) {
        $role_name = is_array($role) ? $role['value'] ?? null : $role; // Extract the role name
        if ($role_name && isset($valid_roles[$role_name])) {
            $role_id = $valid_roles[$role_name];
            $stmt = $connection->prepare("INSERT INTO Contributor_Institution_has_Role (Contributor_Institution_contributor_institution_id, Role_role_id) VALUES (?, ?)");
            $stmt->bind_param("ii", $contributor_institution_id, $role_id);
            $stmt->execute();
            $stmt->close();
        } else {
            error_log("Ungültiger Rollenname für Contributor Institution $contributor_institution_id: $role_name");
        }
    }
}