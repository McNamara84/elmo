<?php

declare(strict_types=1);

/** Confirms DOI subtypes using public registry records, never prefix guesses. */
class IdentifierDetectionService
{
    /** @var Closure(string, float): array{status: int, body: string} */
    private Closure $transport;
    /** @var Closure(): float */
    private Closure $clock;
    private string $cacheDirectory;
    private int $cacheCapacity;

    /**
     * Allows HTTP and time to be replaced without contacting live registries.
     *
     * @param (callable(string, float): array{status: int, body: string})|null $transport URL and remaining timeout in seconds.
     * @param (callable(): float)|null $clock Current Unix time in seconds.
     * @param string|null $cacheDirectory Cache location; an empty string disables disk caching.
     * @param int $cacheCapacity Maximum cached identifiers, clamped to at least one.
     */
    public function __construct(?callable $transport = null, ?callable $clock = null, ?string $cacheDirectory = null, int $cacheCapacity = 1024)
    {
        $this->transport = $transport !== null ? Closure::fromCallable($transport) : $this->fetch(...);
        $this->clock = $clock !== null ? Closure::fromCallable($clock) : static fn(): float => microtime(true);
        $this->cacheDirectory = $cacheDirectory ?? __DIR__ . '/../../../storage/cache/identifier-detection';
        $this->cacheCapacity = max(1, $cacheCapacity);
    }

    /**
     * Resolves a bare DOI using the exact registry record and its owning client.
     *
     * @return array{identifierType: ?string, status: string, source: ?string}
     * @throws InvalidArgumentException When the input is not a valid bare DOI.
     * @throws RuntimeException When a registry is unavailable or the shared deadline expires.
     */
    public function detect(string $doi): array
    {
        $doi = strtolower(trim($doi));
        if (strlen($doi) > 2048 || preg_match('~^10\.\d{4,9}/[^\s]+$~D', $doi) !== 1) {
            throw new InvalidArgumentException('Invalid DOI format');
        }
        $cached = $this->readCache($doi);
        if ($cached !== null) return $cached;
        // All registry requests share one budget, including the client lookup.
        $deadline = ($this->clock)() + 5;
        $record = $this->request('https://api.datacite.org/dois/' . rawurlencode($doi), $deadline);
        if ($record === null) {
            // Only a DataCite 404 permits Crossref fallback; outages never imply DOI.
            $crossref = $this->request('https://api.crossref.org/works/' . rawurlencode($doi), $deadline);
            $result = $crossref !== null && $this->sameDoi($crossref['message']['DOI'] ?? null, $doi)
                ? $this->result('DOI', 'crossref') : $this->result();
        } elseif (!$this->sameDoi($record['data']['attributes']['doi'] ?? null, $doi)) {
            $result = $this->result();
        } else {
            $clientId = $record['data']['relationships']['client']['data']['id'] ?? null;
            if (!is_string($clientId) || preg_match('/^[a-z0-9._-]+$/iD', $clientId) !== 1) {
                $result = $this->result();
            } else {
                $client = $this->request('https://api.datacite.org/clients/' . rawurlencode($clientId), $deadline);
                $clientType = is_array($client) && is_string($client['data']['id'] ?? null)
                    && strcasecmp($client['data']['id'], $clientId) === 0
                    ? ($client['data']['attributes']['clientType'] ?? null) : null;
                // Prefixes and resource types overlap; the registered client type is decisive.
                $name = match ($clientType) {
                    'igsnCatalog' => 'IGSN',
                    'raidRegistry' => 'RAiD',
                    'repository', 'periodical' => 'DOI',
                    default => null,
                };
                $result = $this->result($name, $name !== null ? 'datacite' : null);
            }
        }
        $this->writeCache($doi, $result);
        return $result;
    }

    private function sameDoi(mixed $value, string $doi): bool
    {
        return is_string($value) && strcasecmp($value, $doi) === 0;
    }

    /** @return array{identifierType: ?string, status: string, source: ?string} */
    private function result(?string $type = null, ?string $source = null): array
    {
        return ['identifierType' => $type, 'status' => $type !== null ? 'detected' : 'unknown', 'source' => $source];
    }

    /**
     * Reads JSON within the shared deadline; null means an explicit HTTP 404.
     *
     * @return array<mixed>|null
     * @throws RuntimeException For timeouts, other HTTP errors or invalid JSON.
     */
    private function request(string $url, float $deadline): ?array
    {
        $remaining = $deadline - ($this->clock)();
        if ($remaining <= 0) throw new RuntimeException('Registry lookup timed out', 504);
        $response = ($this->transport)($url, $remaining);
        if ($response['status'] === 404) return null;
        if ($response['status'] !== 200) throw new RuntimeException('Registry lookup unavailable', 502);
        $data = json_decode($response['body'], true);
        if (!is_array($data)) throw new RuntimeException('Invalid registry response', 502);
        return $data;
    }

    /**
     * Fetches HTTPS JSON from a fixed registry URL without following redirects.
     *
     * @param float $timeout Remaining lookup budget in seconds.
     * @return array{status: int, body: string}
     * @throws RuntimeException When the HTTP transport fails.
     */
    private function fetch(string $url, float $timeout): array
    {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS_STR => 'https',
            CURLOPT_CONNECTTIMEOUT_MS => min(2000, (int) ceil($timeout * 1000)),
            CURLOPT_TIMEOUT_MS => (int) ceil($timeout * 1000),
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_USERAGENT => 'ELMO/identifier-detection (https://github.com/McNamara84/elmo)',
        ]);
        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_errno($curl);
        unset($curl);
        if (!is_string($body)) throw new RuntimeException('Registry lookup unavailable', $error === CURLE_OPERATION_TIMEDOUT ? 504 : 502);
        return ['status' => $status, 'body' => $body];
    }

    private function cachePath(string $doi): string
    {
        return $this->cacheDirectory . '/' . hash('sha256', $doi) . '.json';
    }

    /**
     * Reuses only unexpired, structurally valid results from the local cache.
     *
     * @return array{identifierType: ?string, status: string, source: ?string}|null
     */
    private function readCache(string $doi): ?array
    {
        $lock = $this->lockCache();
        if ($lock === false) return null;
        try {
            // Sweep on cache hits too, so expired identifiers need never be requested again.
            $this->pruneCache($this->cacheCapacity);
            return $this->readCacheEntry($this->cachePath($doi))['result'] ?? null;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** @return array{expires: float, result: array{identifierType: ?string, status: string, source: ?string}}|null */
    private function readCacheEntry(string $path): ?array
    {
        $body = @file_get_contents($path);
        $entry = is_string($body) ? json_decode($body, true) : null;
        if (!is_array($entry) || !is_numeric($entry['expires'] ?? null) || $entry['expires'] <= ($this->clock)()) return null;
        $result = $entry['result'] ?? null;
        if (!is_array($result)) return null;
        if ($result !== $this->result() && (!in_array($result['identifierType'] ?? null, ['DOI', 'IGSN', 'RAiD'], true)
            || !in_array($result['source'] ?? null, ['datacite', 'crossref'], true)
            || ($result['status'] ?? null) !== 'detected')) return null;
        return ['expires' => (float) $entry['expires'], 'result' => $result === $this->result()
            ? $this->result() : $this->result($result['identifierType'], $result['source'])];
    }

    /**
     * Serializes eviction and atomic writes across PHP workers. The lock is never
     * held during registry HTTP requests, and an unavailable cache stays optional.
     * @return resource|false
     */
    private function lockCache()
    {
        if ($this->cacheDirectory === '') return false;
        if (!is_dir($this->cacheDirectory) && !@mkdir($this->cacheDirectory, 0775, true) && !is_dir($this->cacheDirectory)) return false;
        $lock = @fopen($this->cacheDirectory . '/cache.lock', 'c');
        if ($lock === false) return false;
        if (@flock($lock, LOCK_EX)) return $lock;
        fclose($lock);
        return false;
    }

    /**
     * Removes expired/malformed results and abandoned temporary files, then evicts
     * entries expiring soonest until capacity is met. Call only with the cache lock.
     * @return bool Whether there is enough room; failed deletion must not allow growth.
     */
    private function pruneCache(int $capacity): bool
    {
        try { $files = new DirectoryIterator($this->cacheDirectory); }
        catch (UnexpectedValueException) { return false; }
        $entries = [];
        foreach ($files as $file) {
            if (!$file->isFile()) continue;
            $path = $file->getPathname();
            if (str_starts_with($file->getFilename(), 'lookup-')) {
                if (!@unlink($path)) return false;
                continue;
            }
            if (!str_ends_with($file->getFilename(), '.json')) continue;
            $entry = $this->readCacheEntry($path);
            if ($entry === null && @unlink($path)) continue;
            $entries[$path] = $entry['expires'] ?? 0;
        }
        asort($entries, SORT_NUMERIC);
        foreach ($entries as $path => $expires) {
            if (count($entries) <= $capacity) break;
            if (@unlink($path)) unset($entries[$path]);
        }
        return count($entries) <= $capacity;
    }

    /**
     * Atomically caches confirmations for six hours and unknown records for one minute,
     * within a capacity shared by all workers.
     * Cache I/O failures must not prevent a valid registry result from reaching the UI.
     *
     * @param array{identifierType: ?string, status: string, source: ?string} $result
     */
    private function writeCache(string $doi, array $result): void
    {
        $lock = $this->lockCache();
        if ($lock === false) return;
        try {
            if (!$this->pruneCache($this->cacheCapacity - 1)) return;
            $temporary = @tempnam($this->cacheDirectory, 'lookup-');
            if ($temporary === false) return;
            try {
                $body = json_encode(['expires' => ($this->clock)() + ($result['status'] === 'detected' ? 21600 : 60), 'result' => $result]);
                if (@file_put_contents($temporary, $body, LOCK_EX) !== false) @rename($temporary, $this->cachePath($doi));
            } finally {
                if (is_file($temporary)) @unlink($temporary);
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
