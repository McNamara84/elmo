<?php
/**
 * Unit Tests for Security Functions
 *
 * Tests core security features:
 * - CSRF token validation, generation, and invalidation
 * - Honeypot validation for bot detection
 * - Client IP detection from various headers
 * - recordRateLimit fail-open behavior
 * - logSuspiciousAttempt sanitization and fallback
 */

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class SecurityFunctionsTest extends TestCase
{
    private string $testIp = '192.168.1.100';

    protected function setUp(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION = [];

        if (!function_exists('generateCsrfToken')) {
            require_once __DIR__ . '/../../api/security.php';
        }
    }

    protected function tearDown(): void
    {
        $_SESSION = [];
        unset($_SERVER['REMOTE_ADDR'], $_SERVER['HTTP_X_FORWARDED_FOR'], $_SERVER['HTTP_X_REAL_IP']);
    }

    // ========== CSRF Token Tests ==========

    /**
     * @test
     * hash_equals() comparison prevents timing attacks on token validation.
     */
    public function validateCsrfToken_RejectsEmptyToken(): void
    {
        $this->assertFalse(validateCsrfToken(''));
    }

    /**
     * @test
     */
    public function validateCsrfToken_AcceptsValidToken(): void
    {
        $token = generateCsrfToken();
        $this->assertTrue(validateCsrfToken($token));
    }

    /**
     * @test
     */
    public function validateCsrfToken_RejectsInvalidToken(): void
    {
        generateCsrfToken();
        $this->assertFalse(validateCsrfToken('wrong-token-value'));
    }

    /**
     * @test
     */
    public function validateCsrfToken_RejectsWhenNoSessionToken(): void
    {
        $_SESSION = [];
        $this->assertFalse(validateCsrfToken('any-token'));
    }

    /**
     * @test
     */
    public function validateCsrfToken_RejectsExpiredToken(): void
    {
        $token = generateCsrfToken();
        $_SESSION['csrf_token_time'] = time() - 3601; // 1 hour + 1 second ago
        $this->assertFalse(validateCsrfToken($token));
    }

    /**
     * @test
     */
    public function validateCsrfToken_AcceptsTokenWithinWindow(): void
    {
        $token = generateCsrfToken();
        $_SESSION['csrf_token_time'] = time() - 1800; // 30 minutes ago
        $this->assertTrue(validateCsrfToken($token));
    }

    /**
     * @test
     */
    public function invalidateCsrfToken_RemovesToken(): void
    {
        $token = generateCsrfToken();
        $this->assertTrue(validateCsrfToken($token));
        
        invalidateCsrfToken();
        
        $this->assertFalse(validateCsrfToken($token));
    }

    /**
     * @test
     */
    public function generateCsrfToken_StoresTimeInSession(): void
    {
        $beforeTime = time();
        $token = generateCsrfToken();
        $afterTime = time();

        $this->assertIsString($token);
        $this->assertNotEmpty($token);
        $this->assertArrayHasKey('csrf_token_time', $_SESSION);
        $this->assertGreaterThanOrEqual($beforeTime, $_SESSION['csrf_token_time']);
        $this->assertLessThanOrEqual($afterTime, $_SESSION['csrf_token_time']);
    }

    /**
     * @test
     */
    public function getCsrfTokenAgeSeconds_ReturnsZeroWhenNoToken(): void
    {
        $_SESSION = [];
        $this->assertEquals(0, getCsrfTokenAgeSeconds());
    }

    /**
     * @test
     */
    public function getCsrfTokenAgeSeconds_ReturnsElapsedTime(): void
    {
        generateCsrfToken();
        $_SESSION['csrf_token_time'] = time() - 5;
        
        $age = getCsrfTokenAgeSeconds();
        $this->assertGreaterThanOrEqual(4, $age);
        $this->assertLessThanOrEqual(6, $age);
    }

    // ========== Honeypot Tests ==========

    /**
     * @test
     * Honeypot rejects any non-empty value (indicates bot automation).
     */
    public function validateHoneypot_AcceptsEmpty(): void
    {
        $this->assertTrue(validateHoneypot(''));
    }

    /**
     * @test
     */
    public function validateHoneypot_RejectsFilled(): void
    {
        $this->assertFalse(validateHoneypot('bot-value'));
    }

    /**
     * @test
     */
    public function validateHoneypot_RejectsWhitespace(): void
    {
        $this->assertFalse(validateHoneypot('   '));
    }

    // ========== Client IP Detection Tests ==========

    /**
     * @test
     * IP detection prioritizes forwarded headers (X-Forwarded-For, X-Real-IP).
     */
    public function getClientIp_UsesRemoteAddr(): void
    {
        $_SERVER['REMOTE_ADDR'] = '10.0.0.1';
        $this->assertEquals('10.0.0.1', getClientIp());
    }

    /**
     * @test
     */
    public function getClientIp_PrefersXForwardedFor(): void
    {
        $_SERVER['REMOTE_ADDR'] = '10.0.0.1';
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.5, 198.51.100.1';

        $this->assertEquals('203.0.113.5', getClientIp());
    }

    /**
     * @test
     */
    public function getClientIp_UsesXRealIp(): void
    {
        $_SERVER['REMOTE_ADDR'] = '10.0.0.1';
        $_SERVER['HTTP_X_REAL_IP'] = '192.0.2.1';

        $this->assertEquals('192.0.2.1', getClientIp());
    }

    // ========== Rate Limit Storage: Fail-Open Tests ==========

    /**
     * @test
     * All rate-limit functions degrade gracefully (fail-open) when storage is unavailable.
     */
    public function isRateLimitStorageAvailable_FalseForNullConnection(): void
    {
        $this->assertFalse(isRateLimitStorageAvailable(null));
    }

    /** @test */
    public function isRateLimitStorageAvailable_FalseForNonMysqliObject(): void
    {
        $this->assertFalse(isRateLimitStorageAvailable(new \stdClass()));
    }

    // ========== recordRateLimit Tests ==========

    /** @test */
    public function recordRateLimit_ReturnsFalseForNullConnection(): void
    {
        $result = recordRateLimit(null, $this->testIp, 'save');
        $this->assertFalse($result);
    }

    /** @test */
    public function recordRateLimit_ReturnsFalseForInvalidConnection(): void
    {
        $result = recordRateLimit(new \stdClass(), $this->testIp, 'submit');
        $this->assertFalse($result);
    }

    // ========== logSuspiciousAttempt Tests ==========

    /**
     * Redirect PHP error_log to a temp file for the duration of one assertion block.
     * Returns the temp file path; caller must pass it to readAndCleanLog().
     */
    private function captureErrorLog(): string
    {
        $logFile = (string) tempnam(sys_get_temp_dir(), 'phpunit_sectest_');
        ini_set('error_log', $logFile);
        return $logFile;
    }

    private function readAndCleanLog(string $logFile): string
    {
        $content = (string) file_get_contents($logFile);
        ini_restore('error_log');
        @unlink($logFile);
        return $content;
    }

    /**
     * @test
     * When no DB is available the function must not throw and must write to error_log.
     */
    public function logSuspiciousAttempt_FallsBackToErrorLogWhenNoConnection(): void
    {
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt(null, 'save', 'honeypot filled', $this->testIp);
        $content = $this->readAndCleanLog($logFile);

        $this->assertStringContainsString('[SECURITY]', $content);
        $this->assertStringContainsString('Suspicious save attempt', $content);
        $this->assertStringContainsString($this->testIp, $content);
    }

    /** @test */
    public function logSuspiciousAttempt_SanitizesSpecialCharsInOperation(): void
    {
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt(null, 'save/op@attack!', 'reason', $this->testIp);
        $content = $this->readAndCleanLog($logFile);

        // Dangerous chars must be replaced with underscores in the log line
        $this->assertStringContainsString('save_op_attack_', $content);
        $this->assertStringNotContainsString('save/op@attack!', $content);
    }

    /** @test */
    public function logSuspiciousAttempt_SanitizesControlCharsInReason(): void
    {
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt(null, 'submit', "invalid\x00token\x1Fvalue", $this->testIp);
        $content = $this->readAndCleanLog($logFile);

        $this->assertStringNotContainsString("\x00", $content);
        $this->assertStringNotContainsString("\x1F", $content);
    }

    /** @test */
    public function logSuspiciousAttempt_UsesProvidedIpAddress(): void
    {
        $customIp = '10.0.0.50';
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt(null, 'submit', 'csrf invalid', $customIp);
        $content = $this->readAndCleanLog($logFile);

        $this->assertStringContainsString($customIp, $content);
    }

    /** @test */
    public function logSuspiciousAttempt_DoesNotThrowOnInvalidConnection(): void
    {
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt(new \stdClass(), 'submit', 'test', $this->testIp);
        $content = $this->readAndCleanLog($logFile);

        $this->assertStringContainsString('[SECURITY]', $content);
    }
}
