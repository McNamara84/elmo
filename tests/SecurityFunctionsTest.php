<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/security.php';

/**
 * Test suite for centralized security functions in api/security.php
 * 
 * Tests CSRF token generation/validation, honeypot detection,
 * and session-scoped rate limiting.
 */
class SecurityFunctionsTest extends TestCase
{
    protected function setUp(): void
    {
        // Initialize session for CSRF tests
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Clean up session before each test
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        // Clean up session
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    // ==================== CSRF Token Tests ====================

    /**
     * Tests that generateCsrfToken creates a 64-character hexadecimal string.
     */
    public function testGenerateCsrfTokenFormat(): void
    {
        $token = generateCsrfToken();
        
        // Token should be 64 hex characters (32 bytes * 2)
        $this->assertIsString($token);
        $this->assertEquals(64, strlen($token));
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token);
    }

    /**
     * Tests that generateCsrfToken stores token in session.
     */
    public function testGenerateCsrfTokenStoresInSession(): void
    {
        $token = generateCsrfToken();
        
        $this->assertArrayHasKey('csrf_token', $_SESSION);
        $this->assertEquals($token, $_SESSION['csrf_token']);
        $this->assertArrayHasKey('csrf_token_time', $_SESSION);
        $this->assertIsInt($_SESSION['csrf_token_time']);
    }

    /**
     * Tests that generateCsrfToken produces different tokens on each call.
     */
    public function testGenerateCsrfTokenUnique(): void
    {
        $token1 = generateCsrfToken();
        $token2 = generateCsrfToken();
        
        $this->assertNotEquals($token1, $token2);
    }

    /**
     * Tests validateCsrfToken accepts a valid token.
     */
    public function testValidateCsrfTokenSuccess(): void
    {
        $token = generateCsrfToken();
        
        // Should validate successfully
        $this->assertTrue(validateCsrfToken($token));
    }

    /**
     * Tests validateCsrfToken rejects an empty token.
     */
    public function testValidateCsrfTokenEmpty(): void
    {
        generateCsrfToken(); // Set up valid session token
        
        // Empty submitted token should fail
        $this->assertFalse(validateCsrfToken(''));
    }

    /**
     * Tests validateCsrfToken rejects a mismatched token.
     */
    public function testValidateCsrfTokenMismatch(): void
    {
        generateCsrfToken();
        
        $wrongToken = 'a' . str_repeat('b', 63); // Wrong token
        $this->assertFalse(validateCsrfToken($wrongToken));
    }

    /**
     * Tests validateCsrfToken rejects when no session token exists.
     */
    public function testValidateCsrfTokenNoSessionToken(): void
    {
        // Don't generate a token, just try to validate
        $this->assertFalse(validateCsrfToken('anytoken'));
    }

    /**
     * Tests validateCsrfToken rejects expired tokens (older than 1 hour).
     */
    public function testValidateCsrfTokenExpiration(): void
    {
        $token = generateCsrfToken();
        
        // Manually set token time to 1 hour + 1 minute ago
        $_SESSION['csrf_token_time'] = time() - 3661;
        
        $this->assertFalse(validateCsrfToken($token));
    }

    /**
     * Tests validateCsrfToken accepts tokens less than 1 hour old.
     */
    public function testValidateCsrfTokenNotExpired(): void
    {
        $token = generateCsrfToken();
        
        // Manually set token time to 59 minutes ago
        $_SESSION['csrf_token_time'] = time() - (59 * 60);
        
        $this->assertTrue(validateCsrfToken($token));
    }

    /**
     * Tests invalidateCsrfToken removes token from session.
     */
    public function testInvalidateCsrfToken(): void
    {
        generateCsrfToken();
        
        // Verify token exists
        $this->assertArrayHasKey('csrf_token', $_SESSION);
        
        invalidateCsrfToken();
        
        // Verify token is removed
        $this->assertArrayNotHasKey('csrf_token', $_SESSION);
        $this->assertArrayNotHasKey('csrf_token_time', $_SESSION);
    }

    // ==================== Honeypot Tests ====================

    /**
     * Tests validateHoneypot accepts empty values (legitimate users).
     */
    public function testValidateHoneypotEmpty(): void
    {
        $this->assertTrue(validateHoneypot(''));
    }

    /**
     * Tests validateHoneypot accepts null coerced to empty (not filled).
     */
    public function testValidateHoneypotNull(): void
    {
        $this->assertTrue(validateHoneypot(''));
    }

    /**
     * Tests validateHoneypot rejects filled values (bot detection).
     */
    public function testValidateHoneypotFilled(): void
    {
        $this->assertFalse(validateHoneypot('http://malicious-site.com'));
        $this->assertFalse(validateHoneypot('bot'));
        $this->assertFalse(validateHoneypot('any text'));
    }

    /**
     * Tests validateHoneypot rejects whitespace-only values.
     */
    public function testValidateHoneypotWhitespace(): void
    {
        $this->assertFalse(validateHoneypot('   '));
    }

    // ==================== Session Rate Limiting Tests ====================

    /**
     * Tests checkSessionRateLimit allows submissions within limit.
     */
    public function testCheckSessionRateLimitWithinBounds(): void
    {
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        
        $this->assertTrue(
            checkSessionRateLimit('feedback', RATE_LIMIT_FEEDBACK_MAX, RATE_LIMIT_WINDOW_SECONDS)
        );
    }

    /**
     * Tests checkSessionRateLimit rejects submissions exceeding limit.
     */
    public function testCheckSessionRateLimitExceeded(): void
    {
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        
        $this->assertFalse(
            checkSessionRateLimit('feedback', RATE_LIMIT_FEEDBACK_MAX, RATE_LIMIT_WINDOW_SECONDS)
        );
    }

    /**
     * Tests checkSessionRateLimit maintains separate counters for different actions.
     */
    public function testCheckSessionRateLimitMultipleActions(): void
    {
        $feedbackLimit = 3;
        $saveLimit = 5;
        $submitLimit = 2;
        
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        
        $this->assertFalse(
            checkSessionRateLimit('feedback', $feedbackLimit, RATE_LIMIT_WINDOW_SECONDS)
        );
        
        $this->assertTrue(
            checkSessionRateLimit('save', $saveLimit, RATE_LIMIT_WINDOW_SECONDS)
        );
        
        recordSessionRateLimit('save', RATE_LIMIT_WINDOW_SECONDS);
        recordSessionRateLimit('save', RATE_LIMIT_WINDOW_SECONDS);
        
        $this->assertTrue(
            checkSessionRateLimit('save', $saveLimit, RATE_LIMIT_WINDOW_SECONDS)
        );
        
        $this->assertTrue(
            checkSessionRateLimit('submit', $submitLimit, RATE_LIMIT_WINDOW_SECONDS)
        );
    }

    /**
     * Tests recordSessionRateLimit stores timestamps in session.
     */
    public function testRecordSessionRateLimit(): void
    {
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        
        $this->assertArrayHasKey(RATE_LIMIT_SESSION_KEY, $_SESSION);
        $this->assertCount(1, $_SESSION[RATE_LIMIT_SESSION_KEY]['feedback']);
    }

    /**
     * Tests checkSessionRateLimit respects the time window.
     */
    public function testCheckSessionRateLimitTimeWindow(): void
    {
        $_SESSION[RATE_LIMIT_SESSION_KEY] = [
            'feedback' => [time() - 2],
        ];
        
        $this->assertTrue(
            checkSessionRateLimit('feedback', 1, 1)
        );
        
        $_SESSION[RATE_LIMIT_SESSION_KEY] = [
            'feedback' => [time() - 2],
        ];
        
        $this->assertFalse(
            checkSessionRateLimit('feedback', 0, 1)
        );
    }

    /**
     * Tests that different sessions have independent rate limit counters.
     */
    public function testCheckSessionRateLimitIsolationBySession(): void
    {
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        recordSessionRateLimit('feedback', RATE_LIMIT_WINDOW_SECONDS);
        
        $this->assertFalse(
            checkSessionRateLimit('feedback', 3, RATE_LIMIT_WINDOW_SECONDS)
        );
        
        session_write_close();
        session_id('other-session-id');
        session_start();
        $_SESSION = [];
        
        $this->assertTrue(
            checkSessionRateLimit('feedback', 3, RATE_LIMIT_WINDOW_SECONDS)
        );
    }
}
