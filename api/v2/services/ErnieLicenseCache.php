<?php

declare(strict_types=1);

require_once __DIR__ . '/LicenseService.php';

/** Validated license snapshots, isolated by ERNIE instance, editor and scope. */
final class ErnieLicenseCache
{
    /** @var array<string, string> */
    private array $errors = [];

    /** @param Closure(string, float): string $fetch Fetch raw JSON or throw on transport/HTTP failure. */
    public function __construct(
        private string $baseUrl,
        private string $profile,
        private int $ttl,
        private string $directory,
        private Closure $fetch
    ) {
    }

    /**
     * Empty lists are successful snapshots. Failed refreshes never replace them.
     * A newer catalog can revoke grants from an older resource-type snapshot.
     *
     * @return array<string, mixed> Licenses, availability, provenance and refresh diagnostics.
     */
    public function get(?string $slug = null, bool $force = false, float $timeout = 10): array
    {
        $scope = $slug ?? 'all';
        if ($slug !== null && !in_array($slug, LicenseService::resourceTypeSlugs(), true)) {
            throw new InvalidArgumentException('Unknown license resource type.');
        }
        $snapshot = $this->read($scope);
        $source = 'cache';
        if ($force || $snapshot === null || microtime(true) - $snapshot['fetchedAt'] >= $this->ttl) {
            $source = 'stale-cache';
            $lock = null;
            try {
                if ($this->baseUrl === '') {
                    throw new RuntimeException('ERNIE is not configured.');
                }
                if ($timeout <= 0) {
                    throw new RuntimeException('License refresh time budget exhausted.');
                }
                $deadline = microtime(true) + $timeout;
                $lock = @fopen($this->path($scope) . '.lock', 'c');
                if ($lock === false) {
                    throw new RuntimeException('License cache directory is not writable.');
                }
                while (!flock($lock, LOCK_EX | LOCK_NB)) {
                    if (microtime(true) >= $deadline) {
                        throw new RuntimeException('License cache is busy.');
                    }
                    usleep(10000);
                }
                // Another request may already have refreshed this scope while we waited.
                $latest = $this->read($scope);
                if (!$force && $latest !== null && microtime(true) - $latest['fetchedAt'] < $this->ttl) {
                    $snapshot = $latest;
                    $source = 'cache';
                } else {
                    $endpoint = '/api/v1/licenses/' . $this->profile . ($slug === null ? '' : '/' . $slug);
                    $requestedAt = microtime(true);
                    $data = LicenseService::decodeLicenses(($this->fetch)($endpoint, max(0.001, $deadline - microtime(true))));
                    $fresh = [
                        'version' => 1, 'origin' => $this->baseUrl, 'profile' => $this->profile,
                        'scope' => $scope, 'fetchedAt' => $requestedAt, 'lastUpdated' => gmdate('c'), 'data' => $data,
                    ];
                    $snapshot = $fresh;
                    $source = 'ernie';
                    // A write failure is reported separately; it must not revive an older grant.
                    try {
                        $this->write($scope, $fresh);
                    } catch (RuntimeException $error) {
                        $this->errors[$scope] = $error->getMessage();
                        return $this->result($snapshot, $source, $scope);
                    }
                }
                unset($this->errors[$scope]);
            } catch (RuntimeException $error) {
                $this->errors[$scope] = $error->getMessage();
                // Re-read under/after the lock: never fall back to a pre-refresh generation.
                $snapshot = $this->read($scope);
            } finally {
                if (is_resource($lock)) {
                    flock($lock, LOCK_UN);
                    fclose($lock);
                }
            }
        }

        return $this->result($snapshot, $source, $scope);
    }

    /**
     * @param array<string, mixed>|null $snapshot
     * @return array<string, mixed>
     */
    private function result(?array $snapshot, string $source, string $scope): array
    {
        $licenses = $snapshot['data'] ?? [];
        if ($scope !== 'all' && $snapshot !== null) {
            $catalog = $this->read('all');
            if ($catalog !== null && $catalog['fetchedAt'] >= $snapshot['fetchedAt']) {
                $current = array_column($catalog['data'], null, 'id');
                $licenses = array_values(array_filter($licenses, static fn(array $row): bool =>
                    isset($current[$row['id']]) && $current[$row['id']] === $row));
            }
        }
        return [
            'licenses' => $licenses,
            'availability' => $snapshot === null ? 'unavailable' : ($licenses === [] ? 'empty' : 'available'),
            'source' => $snapshot === null ? null : $source,
            'lastUpdated' => $snapshot['lastUpdated'] ?? null,
            'profile' => $this->profile, 'scope' => $scope,
            'error' => $this->errors[$scope] ?? null,
        ];
    }

    /** @return array<string, bool> Refresh the catalog and only previously requested scopes. */
    public function refresh(float $budget = 20): array
    {
        $deadline = microtime(true) + max(0, $budget);
        $results = [];
        foreach ($this->scopes() as $scope) {
            $result = $this->get($scope === 'all' ? null : $scope, true, min(10, $deadline - microtime(true)));
            $results['licenses:' . $scope] = $result['source'] === 'ernie' && $result['error'] === null;
        }
        return $results;
    }

    /** @return array<string, array<string, mixed>> Inspect without making network requests. */
    public function status(): array
    {
        $results = [];
        foreach ($this->scopes() as $scope) {
            $snapshot = $this->read($scope);
            $valid = $snapshot !== null && microtime(true) - $snapshot['fetchedAt'] < $this->ttl;
            $results['licenses:' . $scope] = [
                'profile' => $this->profile, 'scope' => $scope, 'exists' => is_file($this->path($scope)),
                'valid' => $valid, 'lastUpdated' => $snapshot['lastUpdated'] ?? null,
                'itemCount' => count($snapshot['data'] ?? []), 'ttl' => $this->ttl,
                'state' => $snapshot === null ? 'unavailable' : ($valid ? 'fresh' : 'stale'),
                'error' => $this->errors[$scope] ?? ($snapshot === null ? 'No valid license snapshot.' : null),
            ];
        }
        return $results;
    }

    /** @return list<string> Lock files also remember scopes whose first fetch failed. */
    private function scopes(): array
    {
        $scopes = ['all'];
        foreach (LicenseService::resourceTypeSlugs() as $slug) {
            if (is_file($this->path($slug)) || is_file($this->path($slug) . '.lock')) {
                $scopes[] = $slug;
            }
        }
        return $scopes;
    }

    private function path(string $scope): string
    {
        return $this->directory . '/ernie_licenses_' . hash('sha256', $this->baseUrl) . '_' . $this->profile . '_' . $scope . '.json';
    }

    /** @return array<string, mixed>|null */
    private function read(string $scope): ?array
    {
        $body = @file_get_contents($this->path($scope));
        if ($body === false) {
            return null;
        }
        try {
            $row = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($row) || ($row['version'] ?? null) !== 1 || ($row['origin'] ?? null) !== $this->baseUrl
                || ($row['profile'] ?? null) !== $this->profile || ($row['scope'] ?? null) !== $scope
                || !is_numeric($row['fetchedAt'] ?? null) || $row['fetchedAt'] > microtime(true) + 1
                || !is_string($row['lastUpdated'] ?? null) || strtotime($row['lastUpdated']) === false
                || !isset($row['data']) || !is_array($row['data']) || !array_is_list($row['data'])) {
                return null;
            }
            $row['data'] = LicenseService::decodeLicenses(json_encode($row['data'], JSON_THROW_ON_ERROR));
            return $row;
        } catch (JsonException | UnexpectedValueException $error) {
            return null;
        }
    }

    /** @param array<string, mixed> $snapshot */
    private function write(string $scope, array $snapshot): void
    {
        $path = $this->path($scope);
        $temp = $path . '.tmp.' . bin2hex(random_bytes(8));
        try {
            if (@file_put_contents($temp, json_encode($snapshot, JSON_THROW_ON_ERROR), LOCK_EX) === false
                || !@rename($temp, $path)) {
                throw new RuntimeException('Could not atomically write the license cache.');
            }
        } finally {
            if (is_file($temp)) {
                @unlink($temp);
            }
        }
    }
}
