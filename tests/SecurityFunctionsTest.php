<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../api/security.php';

/**
 * Test suite for centralized security functions in api/security.php
 * 
 * Tests CSRF token generation/validation, honeypot detection, 
 * rate limiting, and client IP detection.
 */
class SecurityFunctionsTest extends DatabaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // Initialize session for CSRF tests
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Clean up session before each test
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        
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
     * Tests validateHoneypot accepts null (not filled).
     */
    public function testValidateHoneypotNull(): void
    {
        $this->assertTrue(validateHoneypot(null));
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

    // ==================== Client IP Tests ====================

    /**
     * Tests getClientIp returns REMOTE_ADDR when no proxy headers.
     */
    public function testGetClientIpRemoteAddr(): void
    {
        // Save original
        $originalRemoteAddr = $_SERVER['REMOTE_ADDR'] ?? null;
        
        $_SERVER['REMOTE_ADDR'] = '192.168.1.100';
        unset($_SERVER['HTTP_X_FORWARDED_FOR']);
        unset($_SERVER['HTTP_X_REAL_IP']);
        
        $this->assertEquals('192.168.1.100', getClientIp());
        
        // Restore
        if ($originalRemoteAddr) {
            $_SERVER['REMOTE_ADDR'] = $originalRemoteAddr;
        }
    }

    /**
     * Tests getClientIp prioritizes X-Forwarded-For header.
     */
    public function testGetClientIpWithXForwardedFor(): void
    {
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.50, 198.51.100.1';
        $_SERVER['REMOTE_ADDR'] = '192.168.1.100';
        unset($_SERVER['HTTP_X_REAL_IP']);
        
        // Should return the first IP from X-Forwarded-For
        $this->assertEquals('203.0.113.50', getClientIp());
        
        unset($_SERVER['HTTP_X_FORWARDED_FOR']);
    }

    /**
     * Tests getClientIp uses X-Real-IP when X-Forwarded-For not available.
     */
    public function testGetClientIpWithXRealIp(): void
    {
        unset($_SERVER['HTTP_X_FORWARDED_FOR']);
        $_SERVER['HTTP_X_REAL_IP'] = '203.0.113.75';
        $_SERVER['REMOTE_ADDR'] = '192.168.1.100';
        
        $this->assertEquals('203.0.113.75', getClientIp());
        
        unset($_SERVER['HTTP_X_REAL_IP']);
    }

    /**
     * Tests getClientIp handles IPv6 addresses.
     */
    public function testGetClientIpIPv6(): void
    {
        $_SERVER['REMOTE_ADDR'] = '2001:db8::1';
        unset($_SERVER['HTTP_X_FORWARDED_FOR']);
        unset($_SERVER['HTTP_X_REAL_IP']);
        
        $this->assertEquals('2001:db8::1', getClientIp());
    }

    // ==================== Rate Limiting Tests ====================

    /**
     * Tests checkRateLimit allows submissions within limit.
     */
    public function testCheckRateLimitWithinBounds(): void
    {
        $clientIp = '203.0.113.100';
        
        // Record 2 submissions
        recordRateLimit($this->connection, $clientIp, 'feedback');
        recordRateLimit($this->connection, $clientIp, 'feedback');
        
        // Should allow 3rd submission (limit is 3 by default)
        $this->assertTrue(
            checkRateLimit(
                $this->connection,
                $clientIp,
                'feedback',
                RATE_LIMIT_FEEDBACK_MAX,
                RATE_LIMIT_WINDOW_SECONDS
            )
        );
    }

    /**
     * Tests checkRateLimit rejects submissions exceeding limit.
     */
    public function testCheckRateLimitExceeded(): void
    {
        $clientIp = '203.0.113.101';
        
        // Record 3 submissions (at the limit)
        recordRateLimit($this->connection, $clientIp, 'feedback');
        recordRateLimit($this->connection, $clientIp, 'feedback');
        recordRateLimit($this->connection, $clientIp, 'feedback');
        
        // 4th submission should be rejected
        $this->assertFalse(
            checkRateLimit(
                $this->connection,
                $clientIp,
                'feedback',
                RATE_LIMIT_FEEDBACK_MAX,
                RATE_LIMIT_WINDOW_SECONDS
            )
        );
    }

    /**
     * Tests checkRateLimit maintains separate counters for different actions.
     */
    public function testCheckRateLimitMultipleActions(): void
    {
        $clientIp = '203.0.113.102';
        
        // Max 3 for feedback, 5 for save, 2 for submit (testing with smaller numbers)
        $feedbackLimit = 3;
        $saveLimit = 5;
        $submitLimit = 2;
        
        // Record 3 feedback submissions (at limit)
        recordRateLimit($this->connection, $clientIp, 'feedback');
        recordRateLimit($this->connection, $clientIp, 'feedback');
        recordRateLimit($this->connection, $clientIp, 'feedback');
        
        // Feedback should be blocked
        $this->assertFalse(
            checkRateLimit($this->connection, $clientIp, 'feedback', $feedbackLimit, RATE_LIMIT_WINDOW_SECONDS)
        );
        
        // But save should still be allowed (separate counter)
        $this->assertTrue(
            checkRateLimit($this->connection, $clientIp, 'save', $saveLimit, RATE_LIMIT_WINDOW_SECONDS)
        );
        
        // Record 2 save submissions (at limit)
        recordRateLimit($this->connection, $clientIp, 'save');
        recordRateLimit($this->connection, $clientIp, 'save');
        
        // Save should be allowed (2 < 5)
        $this->assertTrue(
            checkRateLimit($this->connection, $clientIp, 'save', $saveLimit, RATE_LIMIT_WINDOW_SECONDS)
        );
        
        // Submit should be allowed
        $this->assertTrue(
            checkRateLimit($this->connection, $clientIp, 'submit', $submitLimit, RATE_LIMIT_WINDOW_SECONDS)
        );
    }

    /**
     * Tests recordRateLimit successfully records submission.
     */
    public function testRecordRateLimit(): void
    {
        $clientIp = '203.0.113.103';
        $actionType = 'feedback';
        
        $result = recordRateLimit($this->connection, $clientIp, $actionType);
        
        $this->assertTrue($result);
        
        // Verify it was recorded in database
        $stmt = $this->connection->prepare(
            "SELECT COUNT(*) as count FROM Rate_Limit WHERE ip_address = ? AND action = ?"
        );
        $stmt->bind_param("ss", $clientIp, $actionType);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        $this->assertEquals(1, $row['count']);
    }

    /**
     * Tests checkRateLimit respects the time window.
     */
    public function testCheckRateLimitTimeWindow(): void
    {
        $clientIp = '203.0.113.104';
        $actionType = 'feedback';
        
        // Record a submission now
        recordRateLimit($this->connection, $clientIp, $actionType);
        
        // Check with 1-second window (should be within)
        $this->assertTrue(
            checkRateLimit($this->connection, $clientIp, $actionType, 1, 1)
        );
        
        // Wait briefly
        sleep(2);
        
        // Check with 1-second window (should be outside, reset)
        $this->assertTrue(
            checkRateLimit($this->connection, $clientIp, $actionType, 0, 1)
        );
    }

    /**
     * Tests checkRateLimit cleans up old entries.
     */
    public function testCheckRateLimitCleanup(): void
    {
        $clientIp = '203.0.113.105';
        
        // Manually insert an old entry (25 hours ago)
        $oldTime = date('Y-m-d H:i:s', time() - (25 * 3600));
        $stmt = $this->connection->prepare(
            "INSERT INTO Rate_Limit (action, ip_address, submitted_at) VALUES (?, ?, ?)"
        );
        $action = 'feedback';
        $stmt->bind_param("sss", $action, $clientIp, $oldTime);
        $stmt->execute();
        $stmt->close();
        
        // Verify it exists
        $stmt = $this->connection->prepare(
            "SELECT COUNT(*) as count FROM Rate_Limit WHERE ip_address = ?"
        );
        $stmt->bind_param("s", $clientIp);
        $stmt->execute();
        $before = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        $this->assertGreaterThan(0, $before['count']);
        
        // Call checkRateLimit which should trigger cleanup
        checkRateLimit($this->connection, $clientIp, 'feedback', 3, 3600);
        
        // Verify old entry was cleaned up
        $stmt = $this->connection->prepare(
            "SELECT COUNT(*) as count FROM Rate_Limit WHERE ip_address = ? AND submitted_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        );
        $stmt->bind_param("s", $clientIp);
        $stmt->execute();
        $after = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        $this->assertEquals(0, $after['count']);
    }

    /**
     * Tests that different IPs have independent rate limit counters.
     */
    public function testCheckRateLimitIsolationByIP(): void
    {
        $ip1 = '203.0.113.106';
        $ip2 = '203.0.113.107';
        
        // Record 3 submissions from IP1
        recordRateLimit($this->connection, $ip1, 'feedback');
        recordRateLimit($this->connection, $ip1, 'feedback');
        recordRateLimit($this->connection, $ip1, 'feedback');
        
        // IP1 should be blocked
        $this->assertFalse(
            checkRateLimit($this->connection, $ip1, 'feedback', 3, RATE_LIMIT_WINDOW_SECONDS)
        );
        
        // IP2 should still be allowed
        $this->assertTrue(
            checkRateLimit($this->connection, $ip2, 'feedback', 3, RATE_LIMIT_WINDOW_SECONDS)
        );
    }
}
?>
