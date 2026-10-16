<?php

declare(strict_types=1);

namespace Tests;

use IdentifierDetectionService;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;
use RuntimeException;

require_once __DIR__ . '/../api/v2/services/IdentifierDetectionService.php';

#[CoversClass(IdentifierDetectionService::class)]
final class IdentifierDetectionServiceTest extends TestCase
{
    private string $doi = '10.60510/gf1211s-47';

    private function record(): array
    {
        return ['data' => ['id' => $this->doi, 'attributes' => ['doi' => $this->doi], 'relationships' => ['client' => ['data' => ['id' => 'gfz.samples']]]]];
    }

    private function response(array $body, int $status = 200): array
    {
        return ['status' => $status, 'body' => json_encode($body)];
    }

    private function service(array $responses, array &$urls, ?string $cache = ''): IdentifierDetectionService
    {
        return new IdentifierDetectionService(function (string $url, float $timeout) use (&$responses, &$urls): array {
            $urls[] = $url;
            self::assertGreaterThan(0, $timeout);
            self::assertLessThanOrEqual(5, $timeout);
            self::assertNotEmpty($responses, 'Unexpected registry request');
            return array_shift($responses);
        }, null, $cache);
    }

    public static function repositoryTypes(): array
    {
        return [['igsnCatalog', 'IGSN'], ['raidRegistry', 'RAiD'], ['repository', 'DOI'], ['periodical', 'DOI'], ['futureType', null], [null, null]];
    }

    #[DataProvider('repositoryTypes')]
    public function testConfirmsTheRepositoryType(?string $clientType, ?string $expected): void
    {
        $urls = [];
        $service = $this->service([$this->response($this->record()), $this->response(['data' => ['id' => 'gfz.samples', 'attributes' => ['clientType' => $clientType]]])], $urls);
        self::assertSame($expected, $service->detect(strtoupper($this->doi))['identifierType']);
        self::assertSame('https://api.datacite.org/dois/10.60510%2Fgf1211s-47', $urls[0]);
        self::assertSame('https://api.datacite.org/clients/gfz.samples', $urls[1]);
    }

    public function testChecksCrossrefOnlyAfterDataciteNotFound(): void
    {
        $urls = [];
        $service = $this->service([$this->response([], 404), $this->response(['message' => ['DOI' => strtoupper($this->doi)]])], $urls);
        self::assertSame(['identifierType' => 'DOI', 'status' => 'detected', 'source' => 'crossref'], $service->detect($this->doi));
        self::assertSame('https://api.crossref.org/works/10.60510%2Fgf1211s-47', $urls[1]);
    }

    public function testBothRegistriesNotFoundRemainUnknown(): void
    {
        $urls = [];
        $service = $this->service([$this->response([], 404), $this->response([], 404)], $urls);
        self::assertNull($service->detect($this->doi)['identifierType']);
    }

    public static function malformedRecords(): array
    {
        return [
            [[]],
            [['data' => ['attributes' => ['doi' => '10.1234/other']]]],
            [['data' => ['attributes' => ['doi' => '10.60510/gf1211s-47', 'types' => ['resourceTypeGeneral' => 'PhysicalObject']]]]],
            [['data' => ['attributes' => ['doi' => '10.60510/gf1211s-47'], 'relationships' => ['client' => ['data' => ['id' => 'https://evil.org']]]]]],
        ];
    }

    #[DataProvider('malformedRecords')]
    public function testDoesNotGuessFromMissingOrWrongMetadata(array $record): void
    {
        $urls = [];
        self::assertNull($this->service([$this->response($record)], $urls)->detect($this->doi)['identifierType']);
        self::assertCount(1, $urls);
    }

    public function testWrongClientIdentityAndClientNotFoundRemainUnknown(): void
    {
        foreach ([$this->response(['data' => ['id' => 'other', 'attributes' => ['clientType' => 'igsnCatalog']]]), $this->response([], 404)] as $client) {
            $urls = [];
            self::assertNull($this->service([$this->response($this->record()), $client], $urls)->detect($this->doi)['identifierType']);
        }
    }

    public function testWrongCrossrefIdentityRemainsUnknown(): void
    {
        $urls = [];
        self::assertNull($this->service([$this->response([], 404), $this->response(['message' => ['DOI' => '10.1234/wrong']])], $urls)->detect($this->doi)['identifierType']);
    }

    public static function failures(): array
    {
        return [[429, '{}'], [500, '{}'], [301, '{}'], [200, 'bad json'], [200, 'null']];
    }

    #[DataProvider('failures')]
    public function testFailuresNeverBecomeDoiOrCrossrefFallback(int $status, string $body): void
    {
        $urls = [];
        $service = $this->service([['status' => $status, 'body' => $body]], $urls);
        try { $service->detect($this->doi); self::fail('Expected a registry failure'); }
        catch (RuntimeException $error) { self::assertSame(502, $error->getCode()); }
        self::assertCount(1, $urls);
    }

    public static function invalidDois(): array
    {
        return [[''], ['10.12/test'], ['https://doi.org/10.1234/test'], ['10.1234/a b'], ['10.1234/a' . "\n" . 'b'], [str_repeat('x', 2049)]];
    }

    #[DataProvider('invalidDois')]
    public function testInvalidParametersNeverReachRegistry(string $doi): void
    {
        $urls = [];
        $this->expectException(InvalidArgumentException::class);
        $this->service([], $urls)->detect($doi);
    }

    public function testSharedDeadlineStopsFurtherRequests(): void
    {
        $now = 0.0;
        $calls = 0;
        $service = new IdentifierDetectionService(function () use (&$now, &$calls): array {
            $calls++; $now = 6;
            return $this->response($this->record());
        }, static function () use (&$now): float { return $now; }, '');
        try { $service->detect($this->doi); self::fail('Expected timeout'); }
        catch (RuntimeException $error) { self::assertSame(504, $error->getCode()); }
        self::assertSame(1, $calls);
    }

    public function testCacheExpiresAndFailuresDoNotPoisonIt(): void
    {
        $directory = sys_get_temp_dir() . '/elmo-identifiers-' . bin2hex(random_bytes(6));
        $now = 0.0; $calls = 0;
        $service = new IdentifierDetectionService(function (string $url) use (&$calls): array {
            $calls++;
            return str_contains($url, '/clients/') ? $this->response(['data' => ['id' => 'gfz.samples', 'attributes' => ['clientType' => 'igsnCatalog']]]) : $this->response($this->record());
        }, static function () use (&$now): float { return $now; }, $directory);
        try {
            self::assertSame('IGSN', $service->detect($this->doi)['identifierType']);
            self::assertSame('IGSN', $service->detect(strtoupper($this->doi))['identifierType']);
            self::assertSame(2, $calls);
            $now = 21601;
            self::assertSame('IGSN', $service->detect($this->doi)['identifierType']);
            self::assertSame(4, $calls);
            file_put_contents(glob($directory . '/*.json')[0], 'bad json');
            $service->detect($this->doi);
            self::assertSame(6, $calls);
        } finally {
            foreach (glob($directory . '/*') ?: [] as $file) unlink($file);
            if (is_dir($directory)) rmdir($directory);
        }
    }

    public function testUnknownCacheHasShortLifetimeAndInvalidEntriesAreIgnored(): void
    {
        $directory = sys_get_temp_dir() . '/elmo-identifiers-' . bin2hex(random_bytes(6));
        $now = 0.0; $calls = 0;
        $service = new IdentifierDetectionService(function () use (&$calls): array {
            $calls++;
            return $this->response([], 404);
        }, static function () use (&$now): float { return $now; }, $directory);
        try {
            $service->detect($this->doi); $service->detect($this->doi);
            self::assertSame(2, $calls);
            $now = 61;
            $service->detect($this->doi);
            self::assertSame(4, $calls);
            foreach ([['expires' => 500, 'result' => 'bad'], ['expires' => 500, 'result' => ['identifierType' => 'URL']], ['expires' => 'bad'] ] as $entry) {
                file_put_contents(glob($directory . '/*.json')[0], json_encode($entry));
                self::assertNull($service->detect($this->doi)['identifierType']);
            }
            self::assertSame(10, $calls);
        } finally {
            foreach (glob($directory . '/*') ?: [] as $file) unlink($file);
            if (is_dir($directory)) rmdir($directory);
        }
    }

    public function testCacheWriteFailureDoesNotPreventDetection(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'elmo-cache-file-');
        $urls = [];
        try {
            $service = $this->service([$this->response([], 404), $this->response([], 404)], $urls, $file);
            self::assertSame('unknown', $service->detect($this->doi)['status']);
        } finally { unlink($file); }
    }

    public function testUnknownIdentifiersCannotGrowTheCacheBeyondCapacity(): void
    {
        $directory = sys_get_temp_dir() . '/elmo-identifiers-' . bin2hex(random_bytes(6));
        $now = 0.0; $calls = 0;
        $service = new IdentifierDetectionService(function () use (&$calls): array {
            $calls++;
            return $this->response([], 404);
        }, static function () use (&$now): float { return $now; }, $directory, 3);
        try {
            for ($i = 0; $i < 8; $i++) {
                $now++;
                self::assertSame('unknown', $service->detect('10.1234/unknown-' . $i)['status']);
                self::assertLessThanOrEqual(3, count(glob($directory . '/*.json')));
            }
            $service->detect('10.1234/unknown-7');
            self::assertSame(16, $calls, 'The newest entry should remain cached');
            $service->detect('10.1234/unknown-0');
            self::assertSame(18, $calls, 'The oldest entry should have been evicted');
            self::assertLessThanOrEqual(3, count(glob($directory . '/*.json')));
        } finally {
            foreach (glob($directory . '/*') ?: [] as $file) unlink($file);
            if (is_dir($directory)) rmdir($directory);
        }
    }

    public function testCacheHitsReclaimExpiredIdentifiersThatAreNeverRequestedAgain(): void
    {
        $directory = sys_get_temp_dir() . '/elmo-identifiers-' . bin2hex(random_bytes(6));
        $now = 0.0;
        $clock = static function () use (&$now): float { return $now; };
        $urls = [];
        $known = new IdentifierDetectionService(function (string $url) use (&$urls): array {
            $urls[] = $url;
            return str_contains($url, '/clients/')
                ? $this->response(['data' => ['id' => 'gfz.samples', 'attributes' => ['clientType' => 'igsnCatalog']]])
                : $this->response($this->record());
        }, $clock, $directory);
        $unknown = new IdentifierDetectionService(fn(): array => $this->response([], 404), $clock, $directory);
        try {
            $known->detect($this->doi);
            $unknown->detect('10.1234/not-requested-again');
            $abandoned = $directory . '/lookup-abandoned';
            $malformed = $directory . '/malformed.json';
            file_put_contents($abandoned, 'partial write');
            file_put_contents($malformed, 'not json');
            $expired = $directory . '/' . hash('sha256', '10.1234/not-requested-again') . '.json';
            self::assertFileExists($expired);
            $now = 61;
            self::assertSame('IGSN', $known->detect($this->doi)['identifierType']);
            self::assertCount(2, $urls, 'Cleanup should also run on a valid cache hit');
            self::assertFileDoesNotExist($expired);
            self::assertFileDoesNotExist($abandoned);
            self::assertFileDoesNotExist($malformed);
        } finally {
            foreach (glob($directory . '/*') ?: [] as $file) unlink($file);
            if (is_dir($directory)) rmdir($directory);
        }
    }

    public function testConcurrentWorkersShareTheSameCacheCapacity(): void
    {
        $directory = sys_get_temp_dir() . '/elmo-identifiers-' . bin2hex(random_bytes(6));
        $workers = [];
        $script = <<<'PHP'
require $argv[1];
$service = new IdentifierDetectionService(static fn(): array => ['status' => 404, 'body' => '{}'], null, $argv[2], 3);
for ($i = 0; $i < 8; $i++) $service->detect('10.1234/worker-' . $argv[3] . '-' . $i);
PHP;
        try {
            for ($i = 0; $i < 4; $i++) {
                $process = proc_open([PHP_BINARY, '-r', $script, __DIR__ . '/../api/v2/services/IdentifierDetectionService.php', $directory, (string) $i],
                    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
                self::assertIsResource($process);
                fclose($pipes[0]);
                $workers[] = [$process, $pipes];
            }
            foreach ($workers as [$process, $pipes]) {
                self::assertSame('', stream_get_contents($pipes[1]));
                self::assertSame('', stream_get_contents($pipes[2]));
                fclose($pipes[1]); fclose($pipes[2]);
                self::assertSame(0, proc_close($process));
            }
            $files = glob($directory . '/*.json');
            self::assertCount(3, $files);
            foreach ($files as $file) self::assertSame('unknown', json_decode(file_get_contents($file), true)['result']['status']);
            self::assertSame([], glob($directory . '/lookup-*'));
        } finally {
            foreach ($workers as [$process, $pipes]) {
                foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
                if (is_resource($process)) { proc_terminate($process); proc_close($process); }
            }
            foreach (glob($directory . '/*') ?: [] as $file) unlink($file);
            if (is_dir($directory)) rmdir($directory);
        }
    }

    public function testUnavailableRegistryIsRetriedWithoutCachingAnError(): void
    {
        $calls = 0;
        $service = new IdentifierDetectionService(function () use (&$calls): array {
            return $this->response([], ++$calls === 1 ? 429 : 404);
        }, null, '');
        try { $service->detect($this->doi); self::fail('Expected failure'); }
        catch (RuntimeException $error) { self::assertSame(502, $error->getCode()); }
        self::assertNull($service->detect($this->doi)['identifierType']);
        self::assertSame(3, $calls);
    }

    #[Group('live-registry')]
    public function testRealHttpTransportConfirmsTheIssueExamplesAndCrossref(): void
    {
        if (getenv('ELMO_LIVE_REGISTRY_TESTS') !== '1') self::markTestSkipped('Opt-in live registry verification');
        $service = new IdentifierDetectionService(cacheDirectory: '');
        foreach (['10.60510/gf1211s-47' => 'IGSN', '10.82210/162fda4d' => 'RAiD', '10.1080/10509585.2015.1092083' => 'DOI'] as $doi => $expected) {
            self::assertSame($expected, $service->detect($doi)['identifierType']);
        }
        $fetch = new \ReflectionMethod($service, 'fetch');
        $this->expectException(RuntimeException::class);
        $fetch->invoke($service, 'https://elmo-identifier-test.invalid/', 0.1);
    }
}
