<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/v2/controllers/DraftController.php';

class DraftControllerTest extends TestCase
{
    private string $storagePath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->storagePath = sys_get_temp_dir() . '/elmo_drafts_' . uniqid('', true);
        mkdir($this->storagePath, 0777, true);
        putenv('ELMO_DRAFT_STORAGE=' . $this->storagePath);
        putenv('ELMO_DRAFT_RETENTION_DAYS=30');
        $this->startSession('session-test');
    }

    protected function tearDown(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $this->removeDirectory($this->storagePath);
        putenv('ELMO_DRAFT_STORAGE');
        putenv('ELMO_DRAFT_RETENTION_DAYS');
        parent::tearDown();
    }

    private function startSession(string $id): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        session_id($id);
        session_start();
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }
        $items = scandir($directory);
        if ($items === false) {
            return;
        }
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $directory . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                unlink($path);
            }
        }
        rmdir($directory);
    }

    private function captureResponse(callable $callback): array
    {
        ob_start();
        $callback();
        $output = ob_get_clean();
        $status = http_response_code();
        $decoded = $output !== '' ? json_decode($output, true) : null;
        return [$status, $decoded];
    }

    public function testCreateDraftPersistsPayload(): void
    {
        $controller = new DraftController();
        [$status, $data] = $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'values' => [
                        'title' => 'Test dataset'
                    ],
                    'timestamp' => '2024-01-01T00:00:00Z'
                ]
            ]);
        });

        $this->assertSame(201, $status);
        $this->assertIsArray($data);
        $this->assertArrayHasKey('id', $data);
        $this->assertNotEmpty($data['id']);

        $draftFile = $this->storagePath . '/session-test/' . $data['id'] . '.json';
        $this->assertFileExists($draftFile);
        $stored = json_decode(file_get_contents($draftFile), true);
        $this->assertSame('Test dataset', $stored['payload']['values']['title']);
    }

    public function testCreateDraftAllowsPartialPayload(): void
    {
        $controller = new DraftController();
        [$status, $data] = $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'timestamp' => '2024-01-01T00:00:00Z'
                ]
            ]);
        });

        $this->assertSame(201, $status);
        $this->assertIsArray($data);
        $this->assertArrayHasKey('id', $data);

        $draftFile = $this->storagePath . '/session-test/' . $data['id'] . '.json';
        $this->assertFileExists($draftFile);
        $stored = json_decode(file_get_contents($draftFile), true);
        $this->assertSame('2024-01-01T00:00:00Z', $stored['payload']['timestamp']);
    }

    public function testUpdateDraftOverwritesPayload(): void
    {
        $controller = new DraftController();
        [$status, $data] = $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'values' => ['title' => 'Initial'],
                    'timestamp' => '2024-01-01T00:00:00Z'
                ]
            ]);
        });

        $this->assertSame(201, $status);
        $draftId = $data['id'];

        [$updateStatus] = $this->captureResponse(function () use ($controller, $draftId) {
            $controller->update(['id' => $draftId], [
                'payload' => [
                    'values' => ['title' => 'Updated'],
                    'timestamp' => '2024-01-02T00:00:00Z'
                ]
            ]);
        });

        $this->assertSame(200, $updateStatus);
        $draftFile = $this->storagePath . '/session-test/' . $draftId . '.json';
        $stored = json_decode(file_get_contents($draftFile), true);
        $this->assertSame('Updated', $stored['payload']['values']['title']);
    }

    public function testUpdateDraftAcceptsPartialPayload(): void
    {
        $controller = new DraftController();
        [$status, $data] = $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'values' => ['title' => 'Initial']
                ]
            ]);
        });

        $this->assertSame(201, $status);
        $draftId = $data['id'];

        [$updateStatus, $updateData] = $this->captureResponse(function () use ($controller, $draftId) {
            $controller->update(['id' => $draftId], [
                'payload' => [
                    'timestamp' => '2024-01-02T00:00:00Z'
                ]
            ]);
        });

        $this->assertSame(200, $updateStatus);
        $this->assertArrayHasKey('checksum', $updateData);

        $draftFile = $this->storagePath . '/session-test/' . $draftId . '.json';
        $stored = json_decode(file_get_contents($draftFile), true);
        $this->assertArrayNotHasKey('values', $stored['payload']);
        $this->assertSame('2024-01-02T00:00:00Z', $stored['payload']['timestamp']);
    }

    public function testLatestForSessionReturnsMostRecentDraft(): void
    {
        $controller = new DraftController();
        $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'values' => ['title' => 'First'],
                    'timestamp' => '2024-01-01T00:00:00Z'
                ]
            ]);
        });
        usleep(100000);
        $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'values' => ['title' => 'Second'],
                    'timestamp' => '2024-01-02T00:00:00Z'
                ]
            ]);
        });

        [$status, $data] = $this->captureResponse(function () use ($controller) {
            $controller->latestForSession();
        });

        $this->assertSame(200, $status);
        $this->assertSame('Second', $data['payload']['values']['title']);
    }

    public function testLatestForSessionIgnoresFileModificationOrdering(): void
    {
        $controller = new DraftController();
        [$statusFirst, $first] = $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'values' => ['title' => 'First'],
                    'timestamp' => '2024-01-01T00:00:00Z'
                ]
            ]);
        });
        $this->assertSame(201, $statusFirst);

        usleep(1000);

        [$statusSecond, $second] = $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'values' => ['title' => 'Second'],
                    'timestamp' => '2024-01-02T00:00:00Z'
                ]
            ]);
        });
        $this->assertSame(201, $statusSecond);

        $firstPath = $this->storagePath . '/session-test/' . $first['id'] . '.json';
        $secondPath = $this->storagePath . '/session-test/' . $second['id'] . '.json';

        $newerTimestamp = time() + 10;
        touch($firstPath, $newerTimestamp);
        touch($secondPath, $newerTimestamp - 5);

        [$status, $data] = $this->captureResponse(function () use ($controller) {
            $controller->latestForSession();
        });

        $this->assertSame(200, $status);
        $this->assertSame('Second', $data['payload']['values']['title']);
        $this->assertMatchesRegularExpression('/\\.\\d{6}Z$/', $data['updatedAt']);
    }

    public function testDifferentSessionCannotReadDraft(): void
    {
        $controller = new DraftController();
        [$status, $data] = $this->captureResponse(function () use ($controller) {
            $controller->create([], [
                'payload' => [
                    'values' => ['title' => 'Private'],
                    'timestamp' => '2024-01-01T00:00:00Z'
                ]
            ]);
        });
        $this->assertSame(201, $status);
        $draftId = $data['id'];

        $this->startSession('session-other');
        $otherController = new DraftController();
        [$forbiddenStatus] = $this->captureResponse(function () use ($otherController, $draftId) {
            $otherController->get(['id' => $draftId]);
        });

        $this->assertSame(403, $forbiddenStatus);
    }
}