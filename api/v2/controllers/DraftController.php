<?php
/**
 * DraftController handles autosave draft persistence for the metadata editor.
 */

class DraftController
{
    private string $storageRoot;
    private int $retentionDays;

    public function __construct()
    {
        $this->storageRoot = rtrim(getenv('ELMO_DRAFT_STORAGE') ?: (__DIR__ . '/../../../storage/drafts'), DIRECTORY_SEPARATOR);
        $this->retentionDays = (int) (getenv('ELMO_DRAFT_RETENTION_DAYS') ?: 30);

        if (!is_dir($this->storageRoot)) {
            mkdir($this->storageRoot, 0775, true);
        }
    }

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

    public function latestForSession(array $vars = [], ?array $body = null): void
    {
        $sessionId = $this->ensureSession();
        $files = glob($this->sessionDirectory($sessionId) . DIRECTORY_SEPARATOR . '*.json');

        if (!$files) {
            $this->respond(204, null);
            return;
        }

        usort($files, static fn($a, $b) => filemtime($b) <=> filemtime($a));
        $record = json_decode(file_get_contents($files[0]), true);

        if (!$record) {
            $this->respond(204, null);
            return;
        }

        $this->respond(200, $this->exposeRecord($record));
    }

    private function ensureSession(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        return session_id();
    }

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

    private function isValidPayload(?array $data): bool
    {
        if (!$data || !isset($data['payload']) || !is_array($data['payload'])) {
            return false;
        }

        if (!isset($data['payload']['values']) || !is_array($data['payload']['values'])) {
            return false;
        }

        return true;
    }

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

    private function persistRecord(array $record): void
    {
        $dir = $this->sessionDirectory($record['sessionId']);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        file_put_contents($this->recordPath($record['sessionId'], $record['id']), json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    private function readRecord(string $sessionId, string $draftId, bool &$forbidden = false): ?array
    {
        $path = $this->recordPath($sessionId, $draftId);
        if (!is_file($path)) {
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

    private function exposeRecord(array $record): array
    {
        return [
            'id' => $record['id'],
            'updatedAt' => $record['updatedAt'],
            'payload' => $record['payload'],
            'checksum' => $record['checksum']
        ];
    }

    private function responseMetadata(array $record): array
    {
        return [
            'id' => $record['id'],
            'updatedAt' => $record['updatedAt'],
            'checksum' => $record['checksum']
        ];
    }

    private function sanitizeDraftId(string $draftId): string
    {
        return preg_match('/^[a-f0-9]{32}$/', $draftId) ? $draftId : '';
    }

    private function recordPath(string $sessionId, string $draftId): string
    {
        return $this->sessionDirectory($sessionId) . DIRECTORY_SEPARATOR . $draftId . '.json';
    }

    private function sessionDirectory(string $sessionId): string
    {
        return $this->storageRoot . DIRECTORY_SEPARATOR . $sessionId;
    }

    private function now(): string
    {
        return gmdate('c');
    }

    private function checksum(array $payload): string
    {
        return hash('sha256', json_encode($payload));
    }

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