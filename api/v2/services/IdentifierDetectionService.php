<?php

declare(strict_types=1);

/** Confirms DOI subtypes using public registry records, never prefix guesses. */
class IdentifierDetectionService
{
    private Closure $transport;
    private Closure $clock;
    private string $cacheDirectory;

    public function __construct(?callable $transport = null, ?callable $clock = null, ?string $cacheDirectory = null)
    {
        $this->transport = $transport !== null ? Closure::fromCallable($transport) : $this->fetch(...);
        $this->clock = $clock !== null ? Closure::fromCallable($clock) : static fn(): float => microtime(true);
        $this->cacheDirectory = $cacheDirectory ?? __DIR__ . '/../../../storage/cache/identifier-detection';
    }

    /** @return array{identifierType: ?string, status: string, source: ?string} */
    public function detect(string $doi): array
    {
        $doi = strtolower(trim($doi));
        if (strlen($doi) > 2048 || preg_match('~^10\.\d{4,9}/[^\s]+$~D', $doi) !== 1) {
            throw new InvalidArgumentException('Invalid DOI format');
        }
        $cached = $this->readCache($doi);
        if ($cached !== null) return $cached;
        $deadline = ($this->clock)() + 5;
        $record = $this->request('https://api.datacite.org/dois/' . rawurlencode($doi), $deadline);
        if ($record === null) {
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

    /** @return array<mixed>|null */
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

    /** @return array{status: int, body: string} */
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

    /** @return array{identifierType: ?string, status: string, source: ?string}|null */
    private function readCache(string $doi): ?array
    {
        if ($this->cacheDirectory === '') return null;
        $body = @file_get_contents($this->cachePath($doi));
        $entry = is_string($body) ? json_decode($body, true) : null;
        if (!is_array($entry) || !is_numeric($entry['expires'] ?? null) || $entry['expires'] <= ($this->clock)()) return null;
        $result = $entry['result'] ?? null;
        if (!is_array($result)) return null;
        if ($result === $this->result()) return $this->result();
        if (!in_array($result['identifierType'] ?? null, ['DOI', 'IGSN', 'RAiD'], true)
            || !in_array($result['source'] ?? null, ['datacite', 'crossref'], true)
            || ($result['status'] ?? null) !== 'detected') return null;
        return $this->result($result['identifierType'], $result['source']);
    }

    /** @param array{identifierType: ?string, status: string, source: ?string} $result */
    private function writeCache(string $doi, array $result): void
    {
        if ($this->cacheDirectory === '') return;
        if (!is_dir($this->cacheDirectory) && !@mkdir($this->cacheDirectory, 0775, true) && !is_dir($this->cacheDirectory)) return;
        $temporary = @tempnam($this->cacheDirectory, 'lookup-');
        if ($temporary === false) return;
        $body = json_encode(['expires' => ($this->clock)() + ($result['status'] === 'detected' ? 21600 : 60), 'result' => $result]);
        if (@file_put_contents($temporary, $body, LOCK_EX) !== false) @rename($temporary, $this->cachePath($doi));
        if (is_file($temporary)) @unlink($temporary);
    }
}
