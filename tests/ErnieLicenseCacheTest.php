<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/services/ErnieLicenseCache.php';

#[CoversClass(\ErnieLicenseCache::class)]
final class ErnieLicenseCacheTest extends TestCase
{
    private string $directory;
    private string $response;
    /** @var list<string> */
    private array $requests = [];

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/elmo_license_' . bin2hex(random_bytes(8));
        mkdir($this->directory);
        $this->response = file_get_contents(__DIR__ . '/fixtures/ernie-licenses/dataset-elmo.json');
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory . '/*') as $path) {
            unlink($path);
        }
        rmdir($this->directory);
    }

    private function cache(string $profile = 'elmo', int $ttl = 3600, string $url = 'https://ernie.test'): \ErnieLicenseCache
    {
        return new \ErnieLicenseCache($url, $profile, $ttl, $this->directory,
            function (string $endpoint, float $timeout): string {
                self::assertGreaterThan(0, $timeout);
                $this->requests[] = $endpoint;
                if ($this->response === 'offline') {
                    throw new \RuntimeException('Simulated timeout or HTTP error.');
                }
                return $this->response;
            });
    }

    public function testFreshCacheAvoidsRequestsAndEmptyResponseIsAuthoritative(): void
    {
        $cache = $this->cache();
        self::assertSame('ernie', $cache->get('dataset')['source']);
        self::assertSame('cache', $cache->get('dataset')['source']);
        self::assertCount(1, $this->requests);
        $this->response = '[]';
        self::assertSame('empty', $cache->get('dataset', true)['availability']);
        $this->response = 'offline';
        $stale = $cache->get('dataset', true);
        self::assertSame('empty', $stale['availability']);
        self::assertSame('stale-cache', $stale['source']);
        self::assertSame([], $stale['licenses']);
        self::assertSame(0, $cache->status()['licenses:dataset']['itemCount']);
        self::assertTrue($cache->status()['licenses:dataset']['valid']);
    }

    public function testInvalidRefreshKeepsSnapshotAndOriginalTimestamp(): void
    {
        $cache = $this->cache(ttl: 0);
        $first = $cache->get('software');
        foreach (['{}', '{"error":"unauthorized"}', '[{"id":1}]', 'broken', 'offline'] as $body) {
            $this->response = $body;
            $stale = $cache->get('software');
            self::assertSame($first['licenses'], $stale['licenses']);
            self::assertSame($first['lastUpdated'], $stale['lastUpdated']);
            self::assertSame('stale-cache', $stale['source']);
            self::assertNotNull($stale['error']);
        }
    }

    public function testRefreshLocksDescribeTheirContextAndAreReused(): void
    {
        $cache = $this->cache();
        $cache->get('dataset');
        $locks = glob($this->directory . '/*.json.lock');
        self::assertCount(1, $locks);
        $body = file_get_contents($locks[0]);
        $metadata = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        self::assertStringContainsString('Do not delete', $metadata['purpose']);
        self::assertSame('https://ernie.test', $metadata['origin']);
        self::assertSame('elmo', $metadata['profile']);
        self::assertSame('dataset', $metadata['scope']);

        $cache->get('dataset');
        $cache->get('dataset', true);
        $this->response = 'offline';
        self::assertSame('stale-cache', $cache->get('dataset', true)['source']);
        self::assertSame($locks, glob($this->directory . '/*.json.lock'));
        self::assertSame($body, file_get_contents($locks[0]));
        self::assertCount(2, glob($this->directory . '/*'));
    }

    public function testLegacyEmptyLockIsAnnotatedInPlaceOnlyAfterItsOwnerReleasesIt(): void
    {
        $path = $this->directory . '/ernie_licenses_' . hash('sha256', 'https://ernie.test') . '_elmo_dataset.json.lock';
        $owner = fopen($path, 'c+');
        self::assertTrue(flock($owner, LOCK_EX | LOCK_NB));
        try {
            $cache = $this->cache();
            $busy = $cache->get('dataset', timeout: 0.02);
            self::assertSame('unavailable', $busy['availability']);
            self::assertStringContainsString('busy', $busy['error']);
            self::assertSame(0, fstat($owner)['size']);
            self::assertSame([], $this->requests);

            flock($owner, LOCK_UN);
            self::assertSame('ernie', $cache->get('dataset')['source']);
            // Read through the original open handle: replacing the lock would
            // leave this handle pointing to the old, empty file.
            rewind($owner);
            $metadata = json_decode(stream_get_contents($owner), true, 512, JSON_THROW_ON_ERROR);
            self::assertSame('dataset', $metadata['scope']);

            self::assertTrue(flock($owner, LOCK_EX | LOCK_NB));
            $busy = $cache->get('dataset', true, 0.02);
            self::assertSame('stale-cache', $busy['source']);
            self::assertSame('available', $busy['availability']);
            self::assertStringContainsString('busy', $busy['error']);
            self::assertCount(1, $this->requests);
        } finally {
            flock($owner, LOCK_UN);
            fclose($owner);
        }
    }

    public function testFailedFirstFetchIsRememberedAcrossCacheInstances(): void
    {
        $this->response = 'offline';
        self::assertSame('unavailable', $this->cache()->get('software')['availability']);
        self::assertSame([], glob($this->directory . '/*.json'));
        $locks = glob($this->directory . '/*.json.lock');
        self::assertCount(1, $locks);
        self::assertSame('software', json_decode(file_get_contents($locks[0]), true, 512, JSON_THROW_ON_ERROR)['scope']);

        $cache = $this->cache();
        self::assertFalse($cache->status()['licenses:software']['exists']);
        self::assertSame('unavailable', $cache->status()['licenses:software']['state']);
        $this->response = '[]';
        $this->requests = [];
        self::assertSame(['licenses:all' => true, 'licenses:software' => true], $cache->refresh());
        self::assertSame(['/api/v1/licenses/elmo', '/api/v1/licenses/elmo/software'], $this->requests);
        self::assertSame('empty', $cache->get('software')['availability']);
    }

    public function testUnavailableWithoutSuitableCacheAndUnknownScopeRejected(): void
    {
        $cache = $this->cache();
        $cache->get('dataset');
        $this->response = 'offline';
        self::assertSame('unavailable', $cache->get('software')['availability']);
        self::assertNull($cache->get()['source']);
        $this->expectException(\InvalidArgumentException::class);
        $cache->get('../dataset');
    }

    public function testEditorAndOriginIsolation(): void
    {
        $this->cache()->get('dataset');
        $this->response = 'offline';
        self::assertSame('unavailable', $this->cache('elmo-msl')->get('dataset')['availability']);
        self::assertSame('unavailable', $this->cache(url: 'https://another.test')->get('dataset')['availability']);
        self::assertSame('available', $this->cache()->get('dataset')['availability']);
        self::assertSame('/api/v1/licenses/elmo-msl/dataset', $this->requests[1]);
    }

    public function testNewCatalogRevokesOlderResourceTypeGrants(): void
    {
        $cache = $this->cache();
        $cache->get('dataset');
        $this->response = '[]';
        $cache->get();
        self::assertSame([], $cache->get('dataset')['licenses']);
        self::assertSame('empty', $cache->get('dataset')['availability']);
    }

    public function testRefreshFetchesOnlyCatalogAndPreviouslyUsedScopesWithPartialResults(): void
    {
        $cache = $this->cache();
        $cache->get('dataset');
        $this->requests = [];
        self::assertSame(['licenses:all' => true, 'licenses:dataset' => true], $cache->refresh());
        self::assertSame(['/api/v1/licenses/elmo', '/api/v1/licenses/elmo/dataset'], $this->requests);
        $this->requests = [];
        self::assertSame(['licenses:all' => false, 'licenses:dataset' => false], $cache->refresh(0));
        self::assertSame([], $this->requests);
        self::assertStringContainsString('budget', $cache->status()['licenses:all']['error']);
    }

    public function testCorruptedCacheCannotSupplyGrants(): void
    {
        $cache = $this->cache();
        $cache->get();
        foreach (glob($this->directory . '/*.json') as $path) {
            file_put_contents($path, '{"version":1,"data":[]}');
        }
        $this->response = 'offline';
        self::assertSame('unavailable', $cache->get()['availability']);
        self::assertFalse($cache->status()['licenses:all']['valid']);
    }

    public function testMissingDirectoryAndUnconfiguredSourceAreReported(): void
    {
        $cache = new \ErnieLicenseCache('https://ernie.test', 'elmo', 60, $this->directory . '/missing', fn() => '[]');
        self::assertSame('unavailable', $cache->get()['availability']);
        self::assertStringContainsString('writable', $cache->get()['error']);
        self::assertSame('unavailable', $this->cache(url: '')->get()['availability']);
    }

    public function testWriteFailureDoesNotReplaceFreshEmptyResponseWithOlderGrants(): void
    {
        $cache = $this->cache();
        $cache->get();
        $path = glob($this->directory . '/*.json')[0];
        unlink($path);
        mkdir($path);
        try {
            $this->response = '[]';
            $result = $cache->get(null, true);
            self::assertSame('empty', $result['availability']);
            self::assertSame('ernie', $result['source']);
            self::assertStringContainsString('write', $result['error']);
            self::assertFalse($cache->refresh()['licenses:all']);
        } finally {
            rmdir($path);
        }
    }
}
