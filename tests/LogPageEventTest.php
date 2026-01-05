<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

class LogPageEventTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        if (!defined('UNIT_TESTING')) {
            define('UNIT_TESTING', true);
        }
        require_once dirname(__DIR__) . '/log_page_event.php';
    }

    public function testLogsValidEventAndTimestamp(): void
    {
        $logs = [];
        $timestamp = '2025-01-02T03:04:05.678Z';

        $result = handle_log_page_event(
            ['event' => 'page loaded', 'timestamp' => $timestamp],
            ['REQUEST_METHOD' => 'POST'],
            function (string $message) use (&$logs): void {
                $logs[] = $message;
            }
        );

        $this->assertSame('logged', $result['status']);
        $this->assertSame('page loaded', $result['event']);
        $this->assertSame($timestamp, $result['timestamp']);
        $this->assertNotEmpty($logs, 'Expected logger to be called.');
        $this->assertStringContainsString('page loaded', $logs[0]);
        $this->assertStringContainsString($timestamp, $logs[0]);
    }

    public function testInvalidEventAndTimestampFallbackAndSanitize(): void
    {
        $logs = [];
        $result = handle_log_page_event(
            ['event' => "<script>alert(1)</script>\n", 'timestamp' => 'not-a-date'],
            ['REQUEST_METHOD' => 'POST'],
            function (string $message) use (&$logs): void {
                $logs[] = $message;
            },
            fn () => '2024-01-01T00:00:00Z'
        );

        $this->assertSame('logged', $result['status']);
        $this->assertSame('unknown', $result['event']);
        $this->assertSame('2024-01-01T00:00:00Z', $result['timestamp']);
        $this->assertNotEmpty($logs, 'Expected logger to be called.');
        $this->assertStringContainsString('unknown', $logs[0]);
        $this->assertStringContainsString('2024-01-01T00:00:00Z', $logs[0]);
        $this->assertStringNotContainsString("\n", $logs[0], 'Control characters should be stripped from log output.');
    }
}
