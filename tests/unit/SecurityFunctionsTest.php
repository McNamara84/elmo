<?php
/**
 * Unit Tests for Security Functions
 *
 * Tests core security features:
 * - CSRF token validation, generation, and invalidation
 * - Honeypot validation for bot detection
 * - Session-scoped rate limiting
 * - logSuspiciousAttempt sanitization and throttling
 */

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class SecurityFunctionsTest extends TestCase
{
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
        $_SESSION['csrf_interaction_start_time'] = time() - 5;
        
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

    // ========== Session Rate Limit Tests ==========

    /** @test */
    public function checkSessionRateLimit_AllowsWithinLimit(): void
    {
        recordSessionRateLimit('save', RATE_LIMIT_WINDOW_SECONDS);
        $this->assertTrue(checkSessionRateLimit('save', 2, RATE_LIMIT_WINDOW_SECONDS));
    }

    /** @test */
    public function recordSessionRateLimit_StoresTimestampInSession(): void
    {
        recordSessionRateLimit('submit', RATE_LIMIT_WINDOW_SECONDS);
        $this->assertCount(1, $_SESSION[RATE_LIMIT_SESSION_KEY]['submit']);
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
     */
    public function logSuspiciousAttempt_WritesToErrorLog(): void
    {
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt('save', 'honeypot filled');
        $content = $this->readAndCleanLog($logFile);

        $this->assertStringContainsString('[SECURITY]', $content);
        $this->assertStringContainsString('Suspicious save attempt', $content);
        $this->assertStringNotContainsString('IP', $content);
    }

    /** @test */
    public function logSuspiciousAttempt_SanitizesSpecialCharsInOperation(): void
    {
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt('save/op@attack!', 'reason');
        $content = $this->readAndCleanLog($logFile);

        $this->assertStringContainsString('save_op_attack_', $content);
        $this->assertStringNotContainsString('save/op@attack!', $content);
    }

    /** @test */
    public function logSuspiciousAttempt_SanitizesControlCharsInReason(): void
    {
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt('submit', "invalid\x00token\x1Fvalue");
        $content = $this->readAndCleanLog($logFile);

        $this->assertStringNotContainsString("\x00", $content);
        $this->assertStringNotContainsString("\x1F", $content);
    }

    /** @test */
    public function logSuspiciousAttempt_DoesNotThrow(): void
    {
        $logFile = $this->captureErrorLog();
        logSuspiciousAttempt('submit', 'test');
        $content = $this->readAndCleanLog($logFile);

        $this->assertStringContainsString('[SECURITY]', $content);
    }
}
