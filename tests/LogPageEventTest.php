<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\TestCase;

if (!defined('UNIT_TESTING')) {
    define('UNIT_TESTING', true);
}
require_once dirname(__DIR__) . '/log_page_event.php';

#[CoversFunction('handle_log_page_event')]
final class LogPageEventTest extends TestCase
{
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
    
    public function testLogsEventWithStatus(): void
    {
        $logs = [];
        $timestamp = '2025-01-02T03:04:05.678Z';
        $status = 'success';

        handle_log_page_event(
            ['event' => 'save', 'timestamp' => $timestamp, 'status' => $status],
            ['REQUEST_METHOD' => 'POST'],
            function (string $message) use (&$logs): void {
                $logs[] = $message;
            }
        );

        $this->assertNotEmpty($logs, 'Expected logger to be called.');
        $this->assertStringContainsString('Type: save', $logs[0]);
        $this->assertStringContainsString('Message: success', $logs[0]);
        $this->assertStringContainsString("Timestamp: $timestamp", $logs[0]);
    }

    public function testSanitizesStatusParameter(): void
    {
        $logs = [];
        $statusWithControlChars = "failure\r\n<script>alert(1)</script>";

        handle_log_page_event(
            ['event' => 'submit', 'status' => $statusWithControlChars],
            ['REQUEST_METHOD' => 'POST'],
            function (string $message) use (&$logs): void {
                $logs[] = $message;
            }
        );

        $this->assertNotEmpty($logs, 'Expected logger to be called.');
        $this->assertStringNotContainsString("\n", $logs[0]);
        $this->assertStringNotContainsString("\r", $logs[0]);
        $this->assertStringContainsString('Message: failure<script>alert(1)</script>', $logs[0]);
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
