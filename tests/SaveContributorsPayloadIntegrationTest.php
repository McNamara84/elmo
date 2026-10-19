<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_contributors_payload.php';
require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

final class SaveContributorsPayloadIntegrationTest extends DatabaseTestCase
{
    public function testOrderAndContactRoleBelongToResourceLink(): void
    {
        ensureContributorLinkSchema($this->connection);
        ensureContributorLinkSchema($this->connection);
        $resourceA = $this->resource('10.5880/GFZ.TEST.CONTRIBUTORS.A');
        $resourceB = $this->resource('10.5880/GFZ.TEST.CONTRIBUTORS.B');
        $first = ['type' => 'institution', 'institutionname' => 'Institute', 'roles' => ['Hosting Institution']];
        $person = ['type' => 'person', 'familyname' => 'Doe', 'givenname' => 'Jane',
            'roles' => ['Contact Person', 'Data Collector'], 'email' => 'jane@example.org'];
        self::assertTrue(saveContributorsPayload($this->connection,
            ['contributorsPayload' => json_encode([$first, $person])], $resourceA, false));
        self::assertTrue(saveContributorsPayload($this->connection,
            ['contributorsPayload' => json_encode([array_merge($person, ['roles' => ['Data Curator'], 'email' => ''])])],
            $resourceB, false));

        $controller = (new \ReflectionClass(\DatasetController::class))->newInstanceWithoutConstructor();
        $a = $controller->getContributors($this->connection, $resourceA)['entries'];
        $b = $controller->getContributors($this->connection, $resourceB)['entries'];
        self::assertSame(['institution', 'person'], array_column($a, 'type'));
        self::assertSame(['Contact Person', 'Data Collector'], array_column($a[1]['Roles'], 'name'));
        self::assertSame('jane@example.org', $a[1]['email']);
        self::assertSame(['Data Curator'], array_column($b[0]['Roles'], 'name'));
        self::assertSame('', $b[0]['email']);
    }

    private function resource(string $doi): int
    {
        return saveResourceInformationAndRights($this->connection, [
            'doi' => $doi, 'year' => 2026, 'dateCreated' => '2026-09-23',
            'resourcetype' => 1, 'language' => 1, 'Rights' => 1,
            'title' => ['Contributor payload integration'], 'titleType' => [1],
        ]);
    }
}
