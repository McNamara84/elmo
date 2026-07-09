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
 * Ensures the PHP application session is active.
 * Used by CSRF validation and session-based rate limiting.
 *
 * @return void
 */
function ensureAppSession(): void
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
    ensureAppSession();

    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token'] = $token;
    $_SESSION['csrf_token_time'] = time();

    return $token;
}

/**
 * Returns whether the session CSRF token exists and is still within its lifetime.
 *
 * @return bool
 */
function isCsrfTokenValid(): bool
{
    ensureAppSession();

    $sessionToken = $_SESSION['csrf_token'] ?? '';
    $tokenTime = (int) ($_SESSION['csrf_token_time'] ?? 0);

    return !empty($sessionToken) && (time() - $tokenTime <= 3600);
}

/**
 * Returns the current CSRF token or creates one when missing or expired.
 *
 * @return string
 */
function getOrCreateCsrfToken(): string
{
    ensureAppSession();

    if (isCsrfTokenValid()) {
        return (string) $_SESSION['csrf_token'];
    }

    return generateCsrfToken();
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
    ensureAppSession();

    $sessionToken = $_SESSION['csrf_token'] ?? '';
    $tokenTime = (int) ($_SESSION['csrf_token_time'] ?? 0);
    
    if (empty($submittedToken) || empty($sessionToken)) {
        return false;
    }
    
    try {
        if (!hash_equals($sessionToken, $submittedToken)) {
            return false;
        }
    } catch (\ValueError $e) {
        return false;
    }
    
    if (time() - $tokenTime > 3600) {
        return false;
    }
    
    return true;
}

/**
 * Invalidates the current CSRF token by removing it from session.
 *
 * @return void
 */
function invalidateCsrfToken(): void
{
    ensureAppSession();

    unset($_SESSION['csrf_token']);
    unset($_SESSION['csrf_token_time']);
}

/**
 * Reads the submitted CSRF token from request data.
 *
 * @param array<string, mixed> $requestData
 * @return string
 */
function getSubmittedCsrfToken(array $requestData): string
{
    return (string) ($requestData['csrf-token'] ?? $requestData['csrf_token'] ?? '');
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
 * Records the current time as the start of the user's interaction for a given scope.
 *
 * Call this on every full page load. The interaction start is independent
 * of the CSRF token — it tracks when the user opened the page.
 *
 * @param string $scope Interaction scope (form or feedback)
 * @return void
 */
function resetPageInteractionTime(string $scope = 'form'): void
{
    ensureAppSession();

    $normalizedScope = normalizeInteractionScope($scope);
    $_SESSION[getInteractionStartSessionKey($normalizedScope)] = microtime(true);
}

/**
 * Returns how many seconds have elapsed since the user loaded the current page.
 *
 * Pure read: does not create or reset the timer. The timestamp is written by
 * resetPageInteractionTime() on page load or when evaluateInteractionTime()
 * restores a missing session timer.
 *
 * @param string $scope Interaction scope (form or feedback)
 * @return float Elapsed seconds (sub-second precision), or 0.0 if not set
 */
function getPageInteractionAgeSeconds(string $scope = 'form'): float
{
    ensureAppSession();

    $normalizedScope = normalizeInteractionScope($scope);
    $interactionStart = (float) ($_SESSION[getInteractionStartSessionKey($normalizedScope)] ?? 0.0);
    if ($interactionStart <= 0.0) {
        return 0.0;
    }

    return max(0.0, microtime(true) - $interactionStart);
}

/**
 * Ensures an interaction timer exists for the scope, seeding it when missing.
 *
 * Used when session state was lost (container restart, stale tab) so the first
 * protected action can fail once and later retries succeed after the minimum wait.
 *
 * @param string $scope Interaction scope (form or feedback)
 * @return bool True when the timer was missing and was just initialized
 */
function ensureInteractionTimer(string $scope = 'form'): bool
{
    ensureAppSession();

    $normalizedScope = normalizeInteractionScope($scope);
    $sessionKey = getInteractionStartSessionKey($normalizedScope);
    if ((float) ($_SESSION[$sessionKey] ?? 0.0) > 0.0) {
        return false;
    }

    resetPageInteractionTime($normalizedScope);

    return true;
}

/**
 * Evaluates whether the server-measured page interaction time meets a minimum.
 *
 * Only the server-side session timer is used; client-reported values are
 * ignored to prevent manipulation. When the timer is missing, it is seeded
 * before measuring so a retry after the minimum wait can succeed.
 *
 * @param float $minimumSeconds Required minimum interaction time in seconds
 * @param string $scope Interaction scope (form or feedback)
 * @return array{isValid: bool, effectiveSeconds: float, minimumSeconds: float, timerWasMissing: bool}
 */
function evaluateInteractionTime(float $minimumSeconds, string $scope = 'form'): array
{
    $normalizedScope = normalizeInteractionScope($scope);
    $timerWasMissing = ensureInteractionTimer($normalizedScope);
    $effectiveSeconds = getPageInteractionAgeSeconds($normalizedScope);

    return [
        'isValid' => $effectiveSeconds >= $minimumSeconds,
        'effectiveSeconds' => $effectiveSeconds,
        'minimumSeconds' => $minimumSeconds,
        'timerWasMissing' => $timerWasMissing,
    ];
}

/**
 * Normalizes allowed interaction timer scopes.
 *
 * @param string $scope
 * @return string
 */
function normalizeInteractionScope(string $scope): string
{
    $normalized = strtolower(trim($scope));
    return in_array($normalized, ['form', 'feedback'], true) ? $normalized : 'form';
}

/**
 * @param string $scope
 * @return string
 */
function getInteractionStartSessionKey(string $scope): string
{
    return $scope === 'form' ? 'interaction_start_time' : 'interaction_start_time_' . $scope;
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
    ensureAppSession();

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
 * @param bool $timerWasMissing When true, the interaction timer was just restored after missing session state — skip logging
 * @return void
 */
function logSuspiciousAttempt(string $operation, string $reason, bool $timerWasMissing = false): void
{
    if ($timerWasMissing) {
        return;
    }

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

/**
 * Validates all security checks for a given operation context and exits on failure.
 *
 * Handles honeypot, CSRF, rate limiting, and minimum interaction time in order.
 * On success, records the rate-limit event and resets the interaction timer.
 * All error responses use the format: {'success': false, 'message': '...'}.
 *
 * @param string $context One of 'feedback', 'save', or 'submit'
 * @param array<string, mixed> $postData The POST data
 * @return void Exits immediately on any security failure
 */
function validateRequestSecurity(string $context, array $postData): void
{
    $configs = [
        'feedback' => [
            'rateLimitMax'        => RATE_LIMIT_FEEDBACK_MAX,
            'minSeconds'          => (float) MIN_INTERACTION_FEEDBACK_SECONDS,
            'interactionScope'    => 'feedback',
            'resetScope'          => 'feedback',
            'tooFastMessage'      => 'Form filled out too quickly. Please take more time.',
            'csrfHttpCode'        => 403,
            'rateLimitHttpCode'   => 429,
            'honeypotFakeSuccess' => true,
        ],
        'save' => [
            'rateLimitMax'        => RATE_LIMIT_SAVE_MAX,
            'minSeconds'          => (float) MIN_INTERACTION_SAVE_SECONDS,
            'interactionScope'    => 'form',
            'resetScope'          => 'form',
            'tooFastMessage'      => 'Please take time to review your metadata before saving.',
            'csrfHttpCode'        => 400,
            'rateLimitHttpCode'   => 400,
            'honeypotFakeSuccess' => false,
        ],
        'submit' => [
            'rateLimitMax'        => RATE_LIMIT_SUBMIT_MAX,
            'minSeconds'          => (float) MIN_INTERACTION_SUBMIT_SECONDS,
            'interactionScope'    => 'form',
            'resetScope'          => 'form',
            'tooFastMessage'      => 'Please take time to review your submission before submitting.',
            'csrfHttpCode'        => 400,
            'rateLimitHttpCode'   => 400,
            'honeypotFakeSuccess' => false,
        ],
    ];

    $cfg = $configs[$context] ?? $configs['save'];

    $flushBuffers = static function (): void {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
    };

    // Check 1: Honeypot
    if (!validateHoneypot($postData['website'] ?? '')) {
        logSuspiciousAttempt($context, 'honeypot triggered');
        $flushBuffers();
        header('Content-Type: application/json');
        if ($cfg['honeypotFakeSuccess']) {
            // Silently return fake success to not alert the bot
            echo json_encode(['success' => true, 'message' => 'Feedback successfully sent']);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid request.']);
        }
        exit;
    }

    // Check 2: CSRF Token
    if (!validateCsrfToken(getSubmittedCsrfToken($postData))) {
        logSuspiciousAttempt($context, 'invalid csrf token');
        http_response_code($cfg['csrfHttpCode']);
        $flushBuffers();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Invalid request. Please reload the page and try again.']);
        exit;
    }

    // Check 3: Rate limiting
    if (!checkSessionRateLimit($context, $cfg['rateLimitMax'], RATE_LIMIT_WINDOW_SECONDS)) {
        logSuspiciousAttempt($context, 'rate limit exceeded');
        http_response_code($cfg['rateLimitHttpCode']);
        $flushBuffers();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Too many requests. Please try again later.']);
        exit;
    }

    // Check 4: Minimum interaction time
    $timeCheck = evaluateInteractionTime($cfg['minSeconds'], $cfg['interactionScope']);
    if (!$timeCheck['isValid']) {
        logSuspiciousAttempt(
            $context,
            "insufficient time spent (effective={$timeCheck['effectiveSeconds']}s, minimum={$timeCheck['minimumSeconds']}s)",
            $timeCheck['timerWasMissing']
        );
        http_response_code(400);
        $flushBuffers();
        header('Content-Type: application/json');
        $message = $timeCheck['timerWasMissing']
            ? 'Sorry, we had an issue with your session. Please try again. The page reload is not necessary.'
            : $cfg['tooFastMessage'];
        echo json_encode(['success' => false, 'message' => $message]);
        exit;
    }

    // All checks passed — record rate limit and reset interaction timer
    recordSessionRateLimit($context, RATE_LIMIT_WINDOW_SECONDS);
    resetPageInteractionTime($cfg['resetScope']);
}
?>
