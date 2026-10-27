<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;

require_once __DIR__ . '/DatabaseTestCase.php';
require_once __DIR__ . '/../api/v2/services/LicenseRepository.php';
require_once __DIR__ . '/../api/v2/services/ErnieLicenseCache.php';

#[CoversClass(\LicenseRepository::class)]
final class LicenseRepositoryTest extends DatabaseTestCase
{
    /** @return list<array<string, mixed>> */
    private function licenses(): array
    {
        return \LicenseService::decodeLicenses(file_get_contents(__DIR__ . '/fixtures/ernie-licenses/catalog-elmo.json'));
    }

    public function testExternalIdsAreNotLocalIdsAndRepeatedMappingDoesNotWrite(): void
    {
        $repository = new \LicenseRepository($this->connection);
        $mapped = $repository->map($this->licenses(), hash('sha256', 'source'));
        self::assertNotSame($mapped[0]['ernie_id'], $mapped[0]['rights_id']);
        self::assertSame($this->licenses()[0]['uri'], $mapped[0]['rightsURI']);
        $before = $this->connection->query("SHOW SESSION STATUS LIKE 'Com_insert'")->fetch_assoc()['Value'];
        self::assertSame($mapped, $repository->map($this->licenses(), hash('sha256', 'source')));
        self::assertSame($before, $this->connection->query("SHOW SESSION STATUS LIKE 'Com_insert'")->fetch_assoc()['Value']);
    }

    public function testSameNamesDifferentSchemasAndMetadataRemainSeparate(): void
    {
        $repository = new \LicenseRepository($this->connection);
        $metadata = ['name' => 'Custom rights', 'identifier' => 'custom', 'uri' => null, 'scheme_uri' => null];
        $first = $repository->storeImported($metadata);
        self::assertSame($first, $repository->storeImported($metadata));
        foreach ([['uri' => 'urn:example:changed'], ['identifier' => 'CUSTOM'], ['scheme_uri' => 'urn:scheme']] as $change) {
            self::assertNotSame($first, $repository->storeImported(array_replace($metadata, $change)));
        }
        self::assertNull($repository->find($first)['ernie_id']);
        self::assertNull($repository->find($first)['rightsURI']);
        self::assertNull($repository->find($first)['schemeName']);
    }

    public function testCatalogUpdateCannotRewriteStoredDraftMetadata(): void
    {
        $repository = new \LicenseRepository($this->connection);
        $licenses = $this->licenses();
        $old = $repository->map($licenses, hash('sha256', 'source'));
        $licenses[0]['uri'] = 'https://example.org/new-terms';
        $new = $repository->map($licenses, hash('sha256', 'source'));
        self::assertNotSame($old[0]['rights_id'], $new[0]['rights_id']);
        self::assertSame($old[0]['rightsURI'], $repository->find($old[0]['rights_id'])['rightsURI']);
        $otherOrigin = $repository->map($licenses, hash('sha256', 'other'));
        self::assertNotSame($new[0]['rights_id'], $otherOrigin[0]['rights_id']);
    }

    public function testCacheRebuildsMappingAfterDatabaseResetWithoutErnie(): void
    {
        $directory = sys_get_temp_dir() . '/elmo_rebuild_' . bin2hex(random_bytes(8));
        mkdir($directory);
        try {
            $body = json_encode($this->licenses(), JSON_THROW_ON_ERROR);
            $cache = new \ErnieLicenseCache('https://ernie.test', 'elmo', 3600, $directory, fn() => $body);
            $repository = new \LicenseRepository($this->connection);
            $before = $repository->map($cache->get()['licenses'], hash('sha256', 'source'));
            $this->connection->query('DELETE FROM Rights');
            $cache = new \ErnieLicenseCache('https://ernie.test', 'elmo', 3600, $directory,
                static function (): string { throw new \RuntimeException('Network must not be used.'); });
            $after = $repository->map($cache->get()['licenses'], hash('sha256', 'source'));
            self::assertNotSame($before[0]['rights_id'], $after[0]['rights_id']);
            self::assertSame(array_column($before, 'rightsIdentifier'), array_column($after, 'rightsIdentifier'));
            self::assertSame(array_column($before, 'rightsURI'), array_column($after, 'rightsURI'));
        } finally {
            foreach (glob($directory . '/*') as $path) {
                unlink($path);
            }
            rmdir($directory);
        }
    }

    public function testLongMetadataIsPreservedAndOversizedValuesRejected(): void
    {
        $repository = new \LicenseRepository($this->connection);
        $metadata = ['name' => str_repeat('Name ', 200), 'identifier' => str_repeat('id-', 100), 'uri' => null];
        $id = $repository->storeImported($metadata);
        self::assertSame($metadata['name'], $repository->find($id)['text']);
        self::assertSame($metadata['identifier'], $repository->find($id)['rightsIdentifier']);
        $this->expectException(\InvalidArgumentException::class);
        $repository->storeImported(['name' => str_repeat('x', 32769)]);
    }
}
