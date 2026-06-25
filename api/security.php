<?php
/**
 * Shared Security Utilities
 * 
 * Central location for security functions used across the application:
 * - CSRF token generation and validation
 * - Honeypot validation
 * - Session-scoped rate limiting for feedback, save, and submit operations
 */

// Load environment variables from .env file
$envFile = dirname(__DIR__) . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '=') === false || strpos($line, '#') === 0) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (!isset($_ENV[$key])) {
            putenv("{$key}={$value}");
        }
    }
} else {
    error_log("Security.php: .env file not found at expected path: {$envFile}");
}

// Rate limiting configuration (loaded from .env or defaults)
define('RATE_LIMIT_FEEDBACK_MAX', (int) getenv('FEEDBACK_MAX_SUBMISSIONS') ?: 3);
define('RATE_LIMIT_SAVE_MAX', (int) getenv('SAVE_RATE_LIMIT') ?: 100);
define('RATE_LIMIT_SUBMIT_MAX', (int) getenv('SUBMIT_RATE_LIMIT') ?: 30);
define('RATE_LIMIT_WINDOW_SECONDS', (int) getenv('RATE_LIMIT_TIME_WINDOW') ?: 3600);
define('RATE_LIMIT_SUSPICIOUS_LOG_MAX', (int) getenv('SUSPICIOUS_LOG_RATE_LIMIT') ?: 10);
define('MIN_INTERACTION_SAVE_SECONDS', (int) getenv('SAVE_MIN_INTERACTION_SECONDS') ?: 2);
define('MIN_INTERACTION_SUBMIT_SECONDS', (int) getenv('SUBMIT_MIN_INTERACTION_SECONDS') ?: 3);
define('MIN_INTERACTION_FEEDBACK_SECONDS', (int) getenv('FEEDBACK_MIN_INTERACTION_SECONDS') ?: 2);
define('RATE_LIMIT_SESSION_KEY', 'rate_limits');

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
    return generateScopedCsrfToken('form');
}

/**
 * Generates a new CSRF token for a specific scope and stores it in the session.
 *
 * @param string $scope Token scope (e.g. form, feedback)
 * @return string
 */
function generateScopedCsrfToken(string $scope): string
{
    initializeCsrfSession();

    $normalizedScope = normalizeCsrfScope($scope);
    $tokenKey = getCsrfTokenSessionKey($normalizedScope);
    $tokenTimeKey = getCsrfTokenTimeSessionKey($normalizedScope);
    $interactionStartKey = getCsrfInteractionStartSessionKey($normalizedScope);

    $token = bin2hex(random_bytes(32));
    $_SESSION[$tokenKey] = $token;
    $_SESSION[$tokenTimeKey] = time();
    $_SESSION[$interactionStartKey] = time();

    return $token;
}

/**
 * Validates a CSRF token from a POST request.
 * Checks for token existence, validity, and expiration (1 hour).
 *
 * @param string $submittedToken The token from the form submission
 * @return bool True if token is valid, false otherwise
 */
function validateCsrfToken(string $submittedToken, string $scope = 'form'): bool
{
    initializeCsrfSession();

    $normalizedScope = normalizeCsrfScope($scope);
    $tokenKey = getCsrfTokenSessionKey($normalizedScope);
    $tokenTimeKey = getCsrfTokenTimeSessionKey($normalizedScope);
    
    $sessionToken = $_SESSION[$tokenKey] ?? '';
    $tokenTime = (int) ($_SESSION[$tokenTimeKey] ?? 0);
    
    // Token must exist in session and submitted form
    if (empty($submittedToken) || empty($sessionToken)) {
        return false;
    }
    
    try {
        // Token must match (timing-safe comparison)
        if (!hash_equals($sessionToken, $submittedToken)) {
            return false;
        }
    } catch (\ValueError $e) {
        // Token format invalid (e.g., mismatched lengths)
        error_log("CSRF token validation error: " . $e->getMessage());
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
    invalidateScopedCsrfToken('form');
}

/**
 * Invalidates a CSRF token for a specific scope.
 *
 * @param string $scope Token scope (e.g. form, feedback)
 * @return void
 */
function invalidateScopedCsrfToken(string $scope): void
{
    initializeCsrfSession();

    $normalizedScope = normalizeCsrfScope($scope);
    unset($_SESSION[getCsrfTokenSessionKey($normalizedScope)]);
    unset($_SESSION[getCsrfTokenTimeSessionKey($normalizedScope)]);
    unset($_SESSION[getCsrfInteractionStartSessionKey($normalizedScope)]);
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
 * Returns the age of the current CSRF token in seconds.
 *
 * This can be used as a server-trustworthy interaction timer because
 * the interaction start timestamp is set when the form CSRF token is initialized.
 *
 * @return int Age in seconds, or 0 if no token timestamp is available
 */
function getCsrfTokenAgeSeconds(string $scope = 'form'): int
{
    initializeCsrfSession();

    $normalizedScope = normalizeCsrfScope($scope);
    $interactionStart = (int) ($_SESSION[getCsrfInteractionStartSessionKey($normalizedScope)] ?? 0);
    if ($interactionStart <= 0) {
        return 0;
    }

    return max(0, time() - $interactionStart);
}

/**
 * Evaluates whether the interaction time meets a minimum threshold.
 *
 * Uses a trust-preserving strategy by combining client-reported time with
 * server-measured CSRF token age and taking the lower bound when both exist.
 *
 * @param int $reportedTimeSpentSeconds Client-reported interaction time
 * @param int $minimumSeconds Required minimum interaction time
 * @return array{isValid: bool, effectiveSeconds: int, clientSeconds: int, serverSeconds: int, minimumSeconds: int}
 */
function evaluateInteractionTime(int $reportedTimeSpentSeconds, int $minimumSeconds, string $scope = 'form'): array
{
    $clientSeconds = max(0, $reportedTimeSpentSeconds);
    $serverSeconds = getCsrfTokenAgeSeconds($scope);
    $effectiveSeconds = $clientSeconds > 0
        ? min($clientSeconds, $serverSeconds)
        : $serverSeconds;

    return [
        'isValid' => $effectiveSeconds >= $minimumSeconds,
        'effectiveSeconds' => $effectiveSeconds,
        'clientSeconds' => $clientSeconds,
        'serverSeconds' => $serverSeconds,
        'minimumSeconds' => $minimumSeconds,
    ];
}

/**
 * Normalizes allowed CSRF scopes.
 *
 * @param string $scope
 * @return string
 */
function normalizeCsrfScope(string $scope): string
{
    $normalized = strtolower(trim($scope));
    return in_array($normalized, ['form', 'feedback'], true) ? $normalized : 'form';
}

/**
 * @param string $scope
 * @return string
 */
function getCsrfTokenSessionKey(string $scope): string
{
    return $scope === 'form' ? 'csrf_token' : 'csrf_token_' . $scope;
}

/**
 * @param string $scope
 * @return string
 */
function getCsrfTokenTimeSessionKey(string $scope): string
{
    return $scope === 'form' ? 'csrf_token_time' : 'csrf_token_time_' . $scope;
}

/**
 * @param string $scope
 * @return string
 */
function getCsrfInteractionStartSessionKey(string $scope): string
{
    return $scope === 'form' ? 'csrf_interaction_start_time' : 'csrf_interaction_start_time_' . $scope;
}

/**
 * Normalizes a rate-limit action name for use as a session key segment.
 *
 * @param string $action
 * @return string
 */
function normalizeRateLimitAction(string $action): string
{
    $normalized = preg_replace('/[^a-zA-Z0-9_-]/', '', $action) ?? '';
    return $normalized !== '' ? $normalized : 'unknown';
}

/**
 * Returns recent rate-limit timestamps for an action, pruning expired entries.
 *
 * @param string $action Action bucket (save, submit, feedback, suspicious)
 * @param int $windowSeconds Rolling window length in seconds
 * @return list<int>
 */
function getSessionRateLimitTimestamps(string $action, int $windowSeconds): array
{
    initializeCsrfSession();

    $actionKey = normalizeRateLimitAction($action);
    $cutoff = time() - $windowSeconds;

    $all = $_SESSION[RATE_LIMIT_SESSION_KEY] ?? [];
    if (!is_array($all)) {
        $all = [];
    }

    $timestamps = $all[$actionKey] ?? [];
    if (!is_array($timestamps)) {
        $timestamps = [];
    }

    $timestamps = array_values(array_filter(
        $timestamps,
        static fn($timestamp) => is_int($timestamp) && $timestamp > $cutoff
    ));

    $all[$actionKey] = $timestamps;
    $_SESSION[RATE_LIMIT_SESSION_KEY] = $all;

    return $timestamps;
}

/**
 * Checks whether the current session is within the rate limit for an action.
 *
 * @param string $action Action bucket (save, submit, feedback, suspicious)
 * @param int $maxRequests Maximum allowed requests in the rolling window
 * @param int $windowSeconds Rolling window length in seconds
 * @return bool True if within limit, false if exceeded
 */
function checkSessionRateLimit(string $action, int $maxRequests, int $windowSeconds = 3600): bool
{
    return count(getSessionRateLimitTimestamps($action, $windowSeconds)) < $maxRequests;
}

/**
 * Records a rate-limited event for the current session.
 *
 * @param string $action Action bucket (save, submit, feedback, suspicious)
 * @param int $windowSeconds Rolling window length used when pruning stale entries
 * @return void
 */
function recordSessionRateLimit(string $action, int $windowSeconds = 3600): void
{
    getSessionRateLimitTimestamps($action, $windowSeconds);
    $actionKey = normalizeRateLimitAction($action);
    $_SESSION[RATE_LIMIT_SESSION_KEY][$actionKey][] = time();
}

/**
 * Logs suspicious request attempts with a session-scoped hourly cap.
 *
 * @param string $operation High-level operation name (save, submit, ...)
 * @param string $reason Rejection reason
 * @return void
 */
function logSuspiciousAttempt(string $operation, string $reason): void
{
    $operationSafe = preg_replace('/[^a-zA-Z0-9_-]/', '_', $operation);
    $reasonSafe = preg_replace('/[\x00-\x1F\x7F]/', '', $reason);
    $message = "[SECURITY]: Suspicious {$operationSafe} attempt blocked ({$reasonSafe})";

    try {
        if (!checkSessionRateLimit('suspicious', RATE_LIMIT_SUSPICIOUS_LOG_MAX, RATE_LIMIT_WINDOW_SECONDS)) {
            return;
        }

        error_log($message);
        recordSessionRateLimit('suspicious', RATE_LIMIT_WINDOW_SECONDS);
    } catch (Throwable $exception) {
        error_log($message . ' [log-throttle fallback: ' . $exception->getMessage() . ']');
    }
}
?>
