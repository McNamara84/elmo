<?php

declare(strict_types=1);

/**
 * Normalize SMTP configuration values to a strict, well-defined structure.
 *
 * @param array{host?:string|null, port?:int|string|null, user?:string|null, password?:string|null, sender?:string|null, secure?:string|null, auth?:bool|string|null} $settings
 * @return array{host:string, port:int, user:string, password:string, sender:string, secure:string, auth:bool}
 */
function normalizeSmtpSettings(array $settings): array
{
    $host = (string)($settings['host'] ?? 'localhost');
    $port = (int)($settings['port'] ?? 465);
    $user = (string)($settings['user'] ?? '');
    $password = (string)($settings['password'] ?? '');
    $sender = (string)($settings['sender'] ?? 'test@example.com');
    $secure = strtolower((string)($settings['secure'] ?? ''));

    $authValue = $settings['auth'] ?? false;
    if (is_string($authValue)) {
        $authValue = filter_var($authValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
    }

    $auth = (bool)$authValue;

    return [
        'host' => $host,
        'port' => $port,
        'user' => $user,
        'password' => $password,
        'sender' => $sender,
        'secure' => $secure,
        'auth' => $auth,
    ];
}

/**
 * Test SMTP connectivity by opening a socket to the configured host and port.
 */
function testGfzSmtpConnectivity(string $smtpHost, int $smtpPort, float $timeoutSeconds = 10.0): bool
{
    error_log("=== GFZ SMTP Connectivity Test (XML Submit) ===");

    $ip = gethostbyname($smtpHost);
    error_log("DNS Resolution: {$smtpHost} -> {$ip}");

    $connection = @fsockopen($smtpHost, $smtpPort, $errno, $errstr, $timeoutSeconds);
    if ($connection) {
        error_log("Port {$smtpPort} on {$smtpHost} is OPEN");
        fclose($connection);
        return true;
    }

    error_log("Port {$smtpPort} on {$smtpHost} is CLOSED or FILTERED. Error: {$errno} - {$errstr}");
    return false;
}

/**
 * Convert urgency in weeks to the textual priority representation.
 */
function getPriorityText(?int $weeks): string
{
    return match ($weeks) {
        2 => 'high',
        4 => 'normal',
        6 => 'low',
        default => 'undefined',
    };
}