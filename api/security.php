<?php
/**
 * Shared Security Utilities
 * 
 * Central location for security functions used across the application:
 * - CSRF token generation and validation
 * - Honeypot validation
 * - Rate limiting for feedback, save, and submit operations
 * - Client IP detection
 */

/**
 * Initializes session if not already started.
 * Must be called before any session operations.
 *
 * @return void
 */
function initializeCsrfSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

/**
 * Generates a new CSRF token and stores it in the session.
 * The token is valid for 1 hour.
 *
 * @return string The generated CSRF token
 */
function generateCsrfToken(): string
{
    initializeCsrfSession();
    
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token'] = $token;
    $_SESSION['csrf_token_time'] = time();
    
    return $token;
}

/**
 * Validates a CSRF token from a POST request.
 * Checks for token existence, validity, and expiration (1 hour).
 *
 * @param string $submittedToken The token from the form submission
 * @return bool True if token is valid, false otherwise
 */
function validateCsrfToken(string $submittedToken): bool
{
    initializeCsrfSession();
    
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    $tokenTime = $_SESSION['csrf_token_time'] ?? 0;
    
    // Token must exist in session and submitted form
    if (empty($submittedToken) || empty($sessionToken)) {
        return false;
    }
    
    // Token must match (timing-safe comparison)
    if (!hash_equals($sessionToken, $submittedToken)) {
        return false;
    }
    
    // Token must not be older than 1 hour
    if (time() - $tokenTime > 3600) {
        return false;
    }
    
    return true;
}

/**
 * Invalidates the current CSRF token by removing it from session.
 * Should be called after a successful form submission.
 *
 * @return void
 */
function invalidateCsrfToken(): void
{
    initializeCsrfSession();
    unset($_SESSION['csrf_token']);
    unset($_SESSION['csrf_token_time']);
}

/**
 * Validates the honeypot field to detect bots.
 * Honeypot should be empty for legitimate users.
 *
 * @param string $honeypotValue The value from the honeypot field
 * @return bool True if honeypot is empty (legitimate), false if filled (bot)
 */
function validateHoneypot(string $honeypotValue): bool
{
    return empty($honeypotValue);
}

/**
 * Gets the client IP address, considering proxies and forwarding headers.
 *
 * @return string The client IP address
 */
function getClientIp(): string
{
    // Check for forwarded IP (behind proxy/load balancer)
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        return $_SERVER['HTTP_X_REAL_IP'];
    }
    
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

/**
 * Checks if an IP address has exceeded rate limit for a given action type.
 *
 * @param mysqli $connection Database connection
 * @param string $ipAddress The client IP address
 * @param string $actionType The action type ('feedback', 'save', 'submit')
 * @param int $maxRequests Maximum allowed requests in the time window
 * @param int $windowSeconds Time window in seconds (default 3600 = 1 hour)
 * @return bool True if within rate limit, false if exceeded
 */
function checkRateLimit(
    $connection,
    string $ipAddress,
    string $actionType,
    int $maxRequests = 3,
    int $windowSeconds = 3600
): bool
{
    // Clean up old entries (older than 24 hours)
    $cleanupSql = "DELETE FROM Rate_Limit WHERE submitted_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)";
    mysqli_query($connection, $cleanupSql);
    
    // Count recent submissions from this IP for this action type
    $stmt = $connection->prepare(
        "SELECT COUNT(*) as count FROM Rate_Limit 
         WHERE ip_address = ? AND action = ? AND submitted_at > DATE_SUB(NOW(), INTERVAL ? SECOND)"
    );
    $stmt->bind_param("ssi", $ipAddress, $actionType, $windowSeconds);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    return ($row['count'] ?? 0) < $maxRequests;
}

/**
 * Records a submission for rate limiting purposes.
 *
 * @param mysqli $connection Database connection
 * @param string $ipAddress The client IP address
 * @param string $actionType The action type ('feedback', 'save', 'submit')
 * @return bool True if successfully recorded, false on error
 */
function recordRateLimit(
    $connection,
    string $ipAddress,
    string $actionType
): bool
{
    $stmt = $connection->prepare(
        "INSERT INTO Rate_Limit (action, ip_address, submitted_at) VALUES (?, ?, NOW())"
    );
    $stmt->bind_param("ss", $actionType, $ipAddress);
    $success = $stmt->execute();
    $stmt->close();
    
    return $success;
}
?>
