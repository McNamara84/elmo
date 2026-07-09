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
    public function getOrCreateCsrfToken_ReusesExistingToken(): void
    {
        $first = getOrCreateCsrfToken();
        $second = getOrCreateCsrfToken();

        $this->assertSame($first, $second);
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
    public function getPageInteractionAgeSeconds_ReturnsZeroWhenNoTimestamp(): void
    {
        $_SESSION = [];
        $this->assertEquals(0.0, getPageInteractionAgeSeconds());
    }

    /**
     * @test
     */
    public function getPageInteractionAgeSeconds_ReturnsElapsedTime(): void
    {
        $_SESSION['interaction_start_time'] = microtime(true) - 5.0;

        $age = getPageInteractionAgeSeconds();
        $this->assertGreaterThanOrEqual(4.9, $age);
        $this->assertLessThanOrEqual(6.0, $age);
    }

    /**
     * @test
     */
    public function resetPageInteractionTime_ResetsTimerRegardlessOfTokenState(): void
    {
        $_SESSION['interaction_start_time'] = microtime(true) - 442.0;

        resetPageInteractionTime('form');
        $this->assertLessThanOrEqual(0.1, getPageInteractionAgeSeconds());
    }

    /**
     * @test
     */
    public function resetPageInteractionTime_DoesNotRotateExistingToken(): void
    {
        $token = getOrCreateCsrfToken();
        $_SESSION['interaction_start_time'] = microtime(true) - 442.0;

        resetPageInteractionTime('form');

        $this->assertSame($token, $_SESSION['csrf_token']);
        $this->assertLessThanOrEqual(0.1, getPageInteractionAgeSeconds());
    }

    /**
     * @test
     */
    public function evaluateInteractionTime_UsesOnlyServerTimer(): void
    {
        $_SESSION['interaction_start_time'] = microtime(true) - 10.0;

        $result = evaluateInteractionTime(2.0);

        $this->assertTrue($result['isValid']);
        $this->assertGreaterThanOrEqual(9.9, $result['effectiveSeconds']);
        $this->assertArrayNotHasKey('clientSeconds', $result);
    }

    /**
     * @test
     */
    public function evaluateInteractionTime_RejectsWhenTooFast(): void
    {
        $_SESSION['interaction_start_time'] = microtime(true) - 0.5;

        $result = evaluateInteractionTime(2.0);

        $this->assertFalse($result['isValid']);
        $this->assertLessThan(2.0, $result['effectiveSeconds']);
        $this->assertFalse($result['timerWasMissing']);
    }

    /**
     * @test
     */
    public function evaluateInteractionTime_SeedsTimerWhenMissing(): void
    {
        $_SESSION = [];

        $result = evaluateInteractionTime(3.0);

        $this->assertFalse($result['isValid']);
        $this->assertTrue($result['timerWasMissing']);
        $this->assertLessThan(3.0, $result['effectiveSeconds']);
        $this->assertArrayHasKey('interaction_start_time', $_SESSION);
    }

    /**
     * @test
     */
    public function evaluateInteractionTime_AllowsRetryAfterTimerWasRestored(): void
    {
        $_SESSION = [];

        evaluateInteractionTime(3.0);
        $_SESSION['interaction_start_time'] = microtime(true) - 3.5;

        $result = evaluateInteractionTime(3.0);

        $this->assertTrue($result['isValid']);
        $this->assertFalse($result['timerWasMissing']);
    }

    /**
     * @test
     */
    public function getPageInteractionAgeSeconds_DoesNotSeedMissingTimer(): void
    {
        $_SESSION = [];

        $this->assertSame(0.0, getPageInteractionAgeSeconds());
        $this->assertArrayNotHasKey('interaction_start_time', $_SESSION);
    }

    /**
     * @test
     */
    public function generateCsrfToken_DoesNotResetInteractionTimer(): void
    {
        $_SESSION['interaction_start_time'] = microtime(true) - 442.0;

        generateCsrfToken();

        $this->assertGreaterThanOrEqual(441.0, getPageInteractionAgeSeconds());
    }

    /**
     * @test
     */
    public function getSubmittedCsrfToken_ReadsHyphenatedFieldName(): void
    {
        $this->assertSame(
            'token-value',
            getSubmittedCsrfToken(['csrf-token' => 'token-value'])
        );
    }

    /**
     * @test
     */
    public function getSubmittedCsrfToken_FallsBackToLegacyUnderscoreName(): void
    {
        $this->assertSame(
            'legacy-token',
            getSubmittedCsrfToken(['csrf_token' => 'legacy-token'])
        );
    }

    /**
     * @test
     */
    public function getSubmittedHoneypotValue_ReadsConfiguredFieldName(): void
    {
        $this->assertSame(
            '',
            getSubmittedHoneypotValue(['please-fill-in-this-field' => ''])
        );
        $this->assertSame(
            'bot',
            getSubmittedHoneypotValue(['please-fill-in-this-field' => 'bot'])
        );
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
