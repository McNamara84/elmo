<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\TestCase;

#[CoversFunction('normalizeSmtpSettings')]
#[CoversFunction('testGfzSmtpConnectivity')]
#[CoversFunction('getPriorityText')]
class SubmitHelpersTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        require_once __DIR__ . '/../includes/submit_helpers.php';
    }

    public function testNormalizeSmtpSettingsCastsValues(): void
    {
        $config = normalizeSmtpSettings([
            'host' => 'smtp.example.org',
            'port' => '2525',
            'user' => 'user',
            'password' => 'secret',
            'sender' => 'noreply@example.org',
            'secure' => 'TLS',
            'auth' => 'true',
        ]);

        self::assertSame('smtp.example.org', $config['host']);
        self::assertSame(2525, $config['port']);
        self::assertSame('user', $config['user']);
        self::assertSame('secret', $config['password']);
        self::assertSame('noreply@example.org', $config['sender']);
        self::assertSame('tls', $config['secure']);
        self::assertTrue($config['auth']);
    }

    public function testNormalizeSmtpSettingsHandlesBooleanAuth(): void
    {
        $config = normalizeSmtpSettings([
            'auth' => false,
        ]);

        self::assertFalse($config['auth']);
        self::assertSame(465, $config['port']);
        self::assertSame('test@example.com', $config['sender']);
    }

    public function testPriorityTextMapping(): void
    {
        self::assertSame('high', getPriorityText(2));
        self::assertSame('normal', getPriorityText(4));
        self::assertSame('low', getPriorityText(6));
        self::assertSame('undefined', getPriorityText(null));
        self::assertSame('undefined', getPriorityText(3));
    }

    public function testSmtpConnectivityDetectsOpenAndClosedPorts(): void
    {
        $server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        self::assertNotFalse($server, 'Failed to create test server: ' . $errstr);

        $address = stream_socket_get_name($server, false);
        self::assertIsString($address);
        [$host, $port] = explode(':', $address);
        $port = (int)$port;

        self::assertTrue(testGfzSmtpConnectivity($host, $port, 0.5));

        fclose($server);

        self::assertFalse(testGfzSmtpConnectivity($host, $port, 0.5));
    }
}