<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_contributorpersons.php';
require_once __DIR__ . '/../save/formgroups/save_contributorinstitutions.php';

final class Issue1142ContributorSaveTest extends DatabaseTestCase
{
    public function testDraftPersonWithoutRoleIsSavedWithoutPersistedFallback(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.ISSUE.1142.PERSON.DRAFT', 'Roleless draft person');

        $saved = saveContributorPersons(
            $this->connection,
            [
                'action' => 'save_and_download',
                'cbPersonLastname' => ['Roleless'],
                'cbPersonFirstname' => ['Person'],
                'cbORCID' => [''],
                'cbAffiliation' => [''],
                'cbpRorIds' => [''],
            ],
            $resourceId
        );

        $this->assertTrue($saved);

        $stmt = $this->connection->prepare(
            'SELECT cp.contributor_person_id
             FROM Contributor_Person cp
             JOIN Resource_has_Contributor_Person rhcp
               ON cp.contributor_person_id = rhcp.Contributor_Person_contributor_person_id
             WHERE rhcp.Resource_resource_id = ? AND cp.familyname = ?'
        );
        $familyName = 'Roleless';
        $stmt->bind_param('is', $resourceId, $familyName);
        $stmt->execute();
        $person = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertIsArray($person, 'The roleless draft person must remain linked to the resource.');

        $stmt = $this->connection->prepare(
            'SELECT COUNT(*) AS role_count
             FROM Contributor_Person_has_Role
             WHERE Contributor_Person_contributor_person_id = ?'
        );
        $personId = (int) $person['contributor_person_id'];
        $stmt->bind_param('i', $personId);
        $stmt->execute();
        $roleCount = (int) $stmt->get_result()->fetch_assoc()['role_count'];
        $stmt->close();

        $this->assertSame(0, $roleCount, 'The export fallback must not be persisted as a person role.');
    }

    public function testDraftInstitutionWithoutRoleIsSavedWithoutPersistedFallback(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.ISSUE.1142.INSTITUTION.DRAFT', 'Roleless draft institution');

        $saved = saveContributorInstitutions(
            $this->connection,
            [
                'action' => 'save_and_download',
                'cbOrganisationName' => ['Roleless Institute'],
                'OrganisationAffiliation' => [''],
                'hiddenOrganisationRorId' => [''],
            ],
            $resourceId
        );

        $this->assertTrue($saved);

        $stmt = $this->connection->prepare(
            'SELECT ci.contributor_institution_id
             FROM Contributor_Institution ci
             JOIN Resource_has_Contributor_Institution rhci
               ON ci.contributor_institution_id = rhci.Contributor_Institution_contributor_institution_id
             WHERE rhci.Resource_resource_id = ? AND ci.name = ?'
        );
        $institutionName = 'Roleless Institute';
        $stmt->bind_param('is', $resourceId, $institutionName);
        $stmt->execute();
        $institution = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $this->assertIsArray($institution, 'The roleless draft institution must remain linked to the resource.');

        $stmt = $this->connection->prepare(
            'SELECT COUNT(*) AS role_count
             FROM Contributor_Institution_has_Role
             WHERE Contributor_Institution_contributor_institution_id = ?'
        );
        $institutionId = (int) $institution['contributor_institution_id'];
        $stmt->bind_param('i', $institutionId);
        $stmt->execute();
        $roleCount = (int) $stmt->get_result()->fetch_assoc()['role_count'];
        $stmt->close();

        $this->assertSame(0, $roleCount, 'The export fallback must not be persisted as an institution role.');
    }

    public function testSubmitRejectsPersonWithoutRole(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.ISSUE.1142.PERSON.SUBMIT', 'Invalid submitted person');

        $saved = saveContributorPersons(
            $this->connection,
            [
                'action' => 'submit',
                'cbPersonLastname' => ['NoRole'],
                'cbPersonFirstname' => ['Person'],
                'cbORCID' => [''],
                'cbAffiliation' => [''],
                'cbpRorIds' => [''],
            ],
            $resourceId
        );

        $this->assertFalse($saved);
        $this->assertSame(0, $this->countRows('Contributor_Person'));
        $this->assertSame(0, $this->countRows('Resource_has_Contributor_Person'));
    }

    public function testSubmitRejectsInstitutionWithoutRole(): void
    {
        $resourceId = $this->createResource('GFZ.TEST.ISSUE.1142.INSTITUTION.SUBMIT', 'Invalid submitted institution');

        $saved = saveContributorInstitutions(
            $this->connection,
            [
                'action' => 'submit',
                'cbOrganisationName' => ['No Role Institute'],
                'OrganisationAffiliation' => [''],
                'hiddenOrganisationRorId' => [''],
            ],
            $resourceId
        );

        $this->assertFalse($saved);
        $this->assertSame(0, $this->countRows('Contributor_Institution'));
        $this->assertSame(0, $this->countRows('Resource_has_Contributor_Institution'));
    }

    private function countRows(string $table): int
    {
        $allowedTables = [
            'Contributor_Person',
            'Resource_has_Contributor_Person',
            'Contributor_Institution',
            'Resource_has_Contributor_Institution',
        ];

        if (!in_array($table, $allowedTables, true)) {
            throw new \InvalidArgumentException("Unsupported test table: {$table}");
        }

        $result = $this->connection->query("SELECT COUNT(*) AS row_count FROM `{$table}`");

        return (int) $result->fetch_assoc()['row_count'];
    }
}
