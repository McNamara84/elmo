<?php
/**
 * DraftController handles autosave draft persistence for the metadata editor.
 */

class DraftController
{
    /**
     * Absolute path to the directory where draft payloads are stored.
     *
     * @var string
     */
    private string $storageRoot;

    /**
     * Number of days draft payloads are retained before being purged.
     *
     * @var int
     */
    private int $retentionDays;

    /**
     * Creates the controller instance and ensures the storage directory exists.
     */
    public function __construct()
    {
        $this->storageRoot = rtrim(getenv('ELMO_DRAFT_STORAGE') ?: (__DIR__ . '/../../../storage/drafts'), DIRECTORY_SEPARATOR);
        $this->retentionDays = (int) (getenv('ELMO_DRAFT_RETENTION_DAYS') ?: 30);

        if (!is_dir($this->storageRoot)) {
            mkdir($this->storageRoot, 0775, true);
        }
    }

    /**
     * Creates a new autosave draft for the active user session.
     *
     * @param array $vars Route variables provided by the router.
     * @param array|null $body Optional parsed request payload for testing.
     * @return void
     */
    public function create(array $vars = [], ?array $body = null): void
    {
        $sessionId = $this->ensureSession();
        $this->cleanupOldDrafts();
        $payload = $body ?? $this->readJsonBody();

        if (!$this->isValidPayload($payload)) {
            $this->respond(422, ['error' => 'Invalid payload']);
            return;
        }

        $draftId = bin2hex(random_bytes(16));
        $record = $this->createRecord($draftId, $sessionId, $payload['payload']);
        $this->persistRecord($record);

        $this->respond(201, $this->responseMetadata($record));
    }

    /**
     * Updates an existing autosave draft belonging to the current session.
     *
     * @param array $vars Route variables containing the draft identifier.
     * @param array|null $body Optional parsed request payload for testing.
     * @return void
     */
    public function update(array $vars = [], ?array $body = null): void
    {
        $sessionId = $this->ensureSession();
        $this->cleanupOldDrafts();
        $payload = $body ?? $this->readJsonBody();
        $draftId = $this->sanitizeDraftId($vars['id'] ?? '');

        if (!$draftId) {
            $this->respond(400, ['error' => 'Missing draft id']);
            return;
        }

        if (!$this->isValidPayload($payload)) {
            $this->respond(422, ['error' => 'Invalid payload']);
            return;
        }

        $forbidden = false;
        $record = $this->readRecord($sessionId, $draftId, $forbidden);
        if ($forbidden) {
            $this->respond(403, ['error' => 'Forbidden']);
            return;
        }

        if (!$record) {
            $this->respond(404, ['error' => 'Draft not found']);
            return;
        }

        $record['payload'] = $payload['payload'];
        $record['updatedAt'] = $this->now();
        $record['checksum'] = $this->checksum($record['payload']);

        $this->persistRecord($record);
        $this->respond(200, $this->responseMetadata($record));
    }

    /**
     * Retrieves the payload of the specified draft if it belongs to the session.
     *
     * @param array $vars Route variables containing the draft identifier.
     * @param array|null $body Optional parsed request payload (unused).
     * @return void
     */
    public function get(array $vars = [], ?array $body = null): void
    {
        $sessionId = $this->ensureSession();
        $draftId = $this->sanitizeDraftId($vars['id'] ?? '');

        if (!$draftId) {
            $this->respond(400, ['error' => 'Missing draft id']);
            return;
        }

        $forbidden = false;
        $record = $this->readRecord($sessionId, $draftId, $forbidden);
        if ($forbidden) {
            $this->respond(403, ['error' => 'Forbidden']);
            return;
        }

        if (!$record) {
            $this->respond(404, ['error' => 'Draft not found']);
            return;
        }

        $this->respond(200, $this->exposeRecord($record));
    }

    /**
     * Deletes the specified draft for the current session.
     *
     * @param array $vars Route variables containing the draft identifier.
     * @param array|null $body Optional parsed request payload (unused).
     * @return void
     */
    public function delete(array $vars = [], ?array $body = null): void
    {
        $sessionId = $this->ensureSession();
        $draftId = $this->sanitizeDraftId($vars['id'] ?? '');

        if (!$draftId) {
            $this->respond(400, ['error' => 'Missing draft id']);
            return;
        }

        $path = $this->recordPath($sessionId, $draftId);
        if (!is_file($path)) {
            $this->respond(404, ['error' => 'Draft not found']);
            return;
        }

        unlink($path);
        $this->respond(204, null);
    }

    /**
     * Returns the latest draft belonging to the current session, if available.
     *
     * @param array $vars Route variables (unused).
     * @param array|null $body Optional parsed request payload (unused).
     * @return void
     */
    public function latestForSession(array $vars = [], ?array $body = null): void
    {
        $sessionId = $this->ensureSession();
        $files = glob($this->sessionDirectory($sessionId) . DIRECTORY_SEPARATOR . '*.json');

        if (!$files) {
            $this->respond(204, null);
            return;
        }

        $latestRecord = null;
        $latestScore = -INF;

        foreach ($files as $file) {
            $contents = file_get_contents($file);
            if ($contents === false) {
                continue;
            }

            $record = json_decode($contents, true);
            if (!is_array($record)) {
                continue;
            }

            $score = $this->recordTimestampScore($record, $file);

            if ($score > $latestScore) {
                $latestScore = $score;
                $latestRecord = $record;
                continue;
            }

            if ($score === $latestScore && $latestRecord !== null) {
                $latestRecord = $this->preferLatestRecord($latestRecord, $record);
            }
        }

        if ($latestRecord === null) {
            $this->respond(204, null);
            return;
        }

        $this->respond(200, $this->exposeRecord($latestRecord));
    }

    /**
     * Ensures a PHP session is active and returns its identifier.
     *
     * @return string
     */
    private function ensureSession(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        return session_id();
    }

    /**
     * Reads and decodes the JSON request payload from the input stream.
     *
     * @return array|null
     */
    private function readJsonBody(): ?array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return null;
        }

        $data = json_decode($raw, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return null;
        }

        return $data;
    }

    /**
     * Validates the autosave payload structure.
     *
     * @param array|null $data Request payload to validate.
     * @return bool
     */
    private function isValidPayload(?array $data): bool
    {
        if (!$data || !isset($data['payload']) || !is_array($data['payload'])) {
            return false;
        }
        return true;
    }

    /**
     * Creates a new record array for persistence.
     *
     * @param string $draftId Generated draft identifier.
     * @param string $sessionId Current session identifier.
     * @param array $payload Submitted payload data.
     * @return array
     */
    private function createRecord(string $draftId, string $sessionId, array $payload): array
    {
        return [
            'id' => $draftId,
            'sessionId' => $sessionId,
            'updatedAt' => $this->now(),
            'payload' => $payload,
            'checksum' => $this->checksum($payload)
        ];
    }

    /**
     * Persists the provided record to disk.
     *
     * @param array $record Draft record to store.
     * @return void
     */
    private function persistRecord(array $record): void
    {
        $dir = $this->sessionDirectory($record['sessionId']);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        file_put_contents($this->recordPath($record['sessionId'], $record['id']), json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    /**
     * Reads a draft record from disk when accessible to the session.
     *
     * @param string $sessionId Current session identifier.
     * @param string $draftId Draft identifier to load.
     * @param bool $forbidden Flag set to true when record belongs to another session.
     * @return array|null
     */
    private function readRecord(string $sessionId, string $draftId, bool &$forbidden = false): ?array
    {
        $path = $this->recordPath($sessionId, $draftId);
        if (!is_file($path)) {
            if ($this->draftExistsElsewhere($draftId)) {
                $forbidden = true;
            }

            return null;
        }

        $content = file_get_contents($path);
        if ($content === false) {
            return null;
        }

        $record = json_decode($content, true);
        if (!is_array($record)) {
            return null;
        }

        if (($record['sessionId'] ?? null) !== $sessionId) {
            $forbidden = true;
            return null;
        }

        return $record;
    }

    /**
     * Determines whether the draft exists for a different session.
     *
     * @param string $draftId Draft identifier to check.
     * @return bool
     */
    private function draftExistsElsewhere(string $draftId): bool
    {
        $pattern = $this->storageRoot . DIRECTORY_SEPARATOR . '*' . DIRECTORY_SEPARATOR . $draftId . '.json';
        $matches = glob($pattern) ?: [];

        return !empty($matches);
    }

    /**
     * Reduces a record to the fields exposed to API consumers.
     *
     * @param array $record Draft record to expose.
     * @return array
     */
    private function exposeRecord(array $record): array
    {
        return [
            'id' => $record['id'],
            'updatedAt' => $record['updatedAt'],
            'payload' => $record['payload'],
            'checksum' => $record['checksum']
        ];
    }

    /**
     * Prepares metadata payload for create/update responses.
     *
     * @param array $record Draft record to summarize.
     * @return array
     */
    private function responseMetadata(array $record): array
    {
        return [
            'id' => $record['id'],
            'updatedAt' => $record['updatedAt'],
            'checksum' => $record['checksum']
        ];
    }

    /**
     * Validates that the provided draft ID is well-formed.
     *
     * @param string $draftId Draft identifier to validate.
     * @return string
     */
    private function sanitizeDraftId(string $draftId): string
    {
        return preg_match('/^[a-f0-9]{32}$/', $draftId) ? $draftId : '';
    }

    /**
     * Computes the file path for a draft belonging to the provided session.
     *
     * @param string $sessionId Current session identifier.
     * @param string $draftId Draft identifier.
     * @return string
     */
    private function recordPath(string $sessionId, string $draftId): string
    {
        return $this->sessionDirectory($sessionId) . DIRECTORY_SEPARATOR . $draftId . '.json';
    }

    /**
     * Returns the directory path for a given session identifier.
     *
     * @param string $sessionId Current session identifier.
     * @return string
     */
    private function sessionDirectory(string $sessionId): string
    {
        return $this->storageRoot . DIRECTORY_SEPARATOR . $sessionId;
    }

    /**
     * Provides the current timestamp in ISO 8601 format.
     *
     * @return string
     */
    private function now(): string
    {
        $microtime = microtime(true);
        $date = \DateTimeImmutable::createFromFormat('U.u', sprintf('%.6F', $microtime), new \DateTimeZone('UTC'));

        if ($date === false) {
            return gmdate('c');
        }

        return $date->format('Y-m-d\\TH:i:s.u\\Z');
    }

    /**
     * Computes a checksum to track payload changes.
     *
     * @param array $payload Payload to hash.
     * @return string
     */
    private function checksum(array $payload): string
    {
        return hash('sha256', json_encode($payload));
    }

    /**
     * Calculates a comparable timestamp score for a persisted record.
     *
     * @param array $record Draft record to evaluate.
     * @param string $filePath Path to the record file used for fallbacks.
     * @return float
     */
    private function recordTimestampScore(array $record, string $filePath): float
    {
        $timestamp = $record['updatedAt'] ?? null;

        if (is_string($timestamp)) {
            $date = \DateTimeImmutable::createFromFormat('Y-m-d\\TH:i:s.u\\Z', $timestamp, new \DateTimeZone('UTC'));
            if ($date === false) {
                try {
                    $date = new \DateTimeImmutable($timestamp, new \DateTimeZone('UTC'));
                } catch (\Exception $exception) {
                    $date = false;
                }
            }

            if ($date !== false) {
                return (float) $date->format('U.u');
            }
        }

        return (float) filemtime($filePath);
    }

    /**
     * Determines which record should win when timestamp scores are identical.
     *
     * @param array $current Currently selected record.
     * @param array $candidate Candidate record being evaluated.
     * @return array
     */
    private function preferLatestRecord(array $current, array $candidate): array
    {
        $currentUpdated = $current['updatedAt'] ?? '';
        $candidateUpdated = $candidate['updatedAt'] ?? '';

        if ($candidateUpdated > $currentUpdated) {
            return $candidate;
        }

        if ($candidateUpdated < $currentUpdated) {
            return $current;
        }

        $currentId = $current['id'] ?? '';
        $candidateId = $candidate['id'] ?? '';

        return $candidateId > $currentId ? $candidate : $current;
    }

    /**
     * Removes expired draft files from storage.
     *
     * @return void
     */
    private function cleanupOldDrafts(): void
    {
        if ($this->retentionDays <= 0) {
            return;
        }

        $threshold = time() - ($this->retentionDays * 86400);
        $directories = glob($this->storageRoot . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) ?: [];

        foreach ($directories as $directory) {
            $files = glob($directory . DIRECTORY_SEPARATOR . '*.json') ?: [];
            foreach ($files as $file) {
                if (filemtime($file) < $threshold) {
                    @unlink($file);
                }
            }

            $remaining = glob($directory . DIRECTORY_SEPARATOR . '*.json') ?: [];
            if (empty($remaining)) {
                @rmdir($directory);
            }
        }
    }

    /**
     * Sends a JSON response with the provided HTTP status code.
     *
     * @param int $status HTTP status code to send.
     * @param array|null $payload Response payload.
     * @return void
     */
    private function respond(int $status, ?array $payload): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        if ($payload === null) {
            return;
        }

        echo json_encode($payload);
    }
}