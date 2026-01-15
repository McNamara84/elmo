<?php
/**
 * Script for handling feedback email submission using PHPMailer with GFZ SMTP
 * 
 * Security measures implemented:
 * - Rate limiting: Max 3 submissions per IP per hour
 * - Honeypot field: Hidden field that bots tend to fill
 * - CSRF token: Validates request origin
 * - Minimum time: Rejects submissions under 5 seconds
 */
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';
include __DIR__ . '/settings.php';

// Start session for CSRF validation
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Rate limiting configuration
define('RATE_LIMIT_MAX_REQUESTS', 3);
define('RATE_LIMIT_WINDOW_SECONDS', 3600); // 1 hour
define('MIN_TIME_SECONDS', 5); // Minimum time to fill form

/**
 * Sends a JSON error response and exits.
 *
 * @param string $message The error message
 * @param int $httpCode The HTTP status code
 * @return void
 */
function sendErrorResponse(string $message, int $httpCode = 429): void
{
    http_response_code($httpCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

/**
 * Checks if the honeypot field was filled (indicating a bot).
 *
 * @return bool True if honeypot was triggered (is a bot)
 */
function isHoneypotTriggered(): bool
{
    return !empty($_POST['website']);
}

/**
 * Validates the CSRF token from the request.
 *
 * @return bool True if token is valid
 */
function isValidCsrfToken(): bool
{
    $submittedToken = $_POST['csrf_token'] ?? '';
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    $tokenTime = $_SESSION['csrf_token_time'] ?? 0;
    
    // Token must exist and match
    if (empty($submittedToken) || empty($sessionToken)) {
        return false;
    }
    
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
 * Checks if the form was filled too quickly (indicating a bot).
 *
 * @return bool True if time spent is valid (not a bot)
 */
function isValidTimeSpent(): bool
{
    $timeSpent = intval($_POST['feedback_time_spent'] ?? 0);
    return $timeSpent >= MIN_TIME_SECONDS;
}

/**
 * Checks rate limiting for the given IP address.
 *
 * @param mysqli $connection Database connection
 * @param string $ipAddress The client IP address
 * @return bool True if within rate limit, false if exceeded
 */
function checkRateLimit($connection, string $ipAddress): bool
{
    // Clean up old entries first (older than 24 hours)
    $cleanupSql = "DELETE FROM Feedback_Rate_Limit WHERE submitted_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)";
    mysqli_query($connection, $cleanupSql);
    
    // Count recent submissions from this IP
    $stmt = $connection->prepare(
        "SELECT COUNT(*) as count FROM Feedback_Rate_Limit 
         WHERE ip_address = ? AND submitted_at > DATE_SUB(NOW(), INTERVAL ? SECOND)"
    );
    $window = RATE_LIMIT_WINDOW_SECONDS;
    $stmt->bind_param("si", $ipAddress, $window);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    return ($row['count'] ?? 0) < RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Records a feedback submission for rate limiting.
 *
 * @param mysqli $connection Database connection
 * @param string $ipAddress The client IP address
 * @return void
 */
function recordSubmission($connection, string $ipAddress): void
{
    $stmt = $connection->prepare(
        "INSERT INTO Feedback_Rate_Limit (ip_address, submitted_at) VALUES (?, NOW())"
    );
    $stmt->bind_param("s", $ipAddress);
    $stmt->execute();
    $stmt->close();
}

/**
 * Gets the client IP address, considering proxies.
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

function testGfzSmtpConnectivity(): bool {
    global $smtpHost, $smtpPort;
    
    error_log("=== GFZ SMTP Connectivity Test ===");
    
    // DNS test
    $ip = gethostbyname($smtpHost);
    error_log("DNS Resolution: {$smtpHost} -> {$ip}");
    
    // Port test
    $connection = @fsockopen($smtpHost, $smtpPort, $errno, $errstr, 10);
    if ($connection) {
        error_log("Port {$smtpPort} on {$smtpHost} is OPEN");
        fclose($connection);
        return true;
    } else {
        error_log("Port {$smtpPort} on {$smtpHost} is CLOSED or FILTERED. Error: {$errno} - {$errstr}");
        return false;
    }
}

function sendFeedbackMail(
    string $feedbackQuestion1,
    string $feedbackQuestion2,
    string $feedbackQuestion3,
    string $feedbackQuestion4,
    string $feedbackQuestion5,
    string $feedbackQuestion6,
    string $feedbackQuestion7
): void {
    global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpSender, $feedbackAddress, $smtpSecure, $smtpAuth, $showMslLabs, $showGGMsProperties;
    
    // Determine ELMO version
    if ($showMslLabs) {
        $elmoVersion = 'MSL';
    } elseif ($showGGMsProperties) {
        $elmoVersion = 'ELMOGEM';
    } else {
        $elmoVersion = 'generic';
    }
    // Testing log 
    error_log("ELMO Version for Feedback: {$elmoVersion}");
    // Network test before sending
    if (!testGfzSmtpConnectivity()) {
        echo json_encode(['success' => false, 'message' => 'GFZ SMTP Server nicht erreichbar. Siehe Logs für Details.']);
        return;
    }
    
    $mail = new PHPMailer(true);
    
    try {
        // Debug settings (for troubleshooting)
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = 'error_log';
        
        // Server settings for GFZ SMTP
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->Port = $smtpPort;
        $mail->Timeout = 30;
        $mail->SMTPKeepAlive = false;
        
        // Authentication for GFZ
        $mail->SMTPAuth = filter_var($smtpAuth, FILTER_VALIDATE_BOOLEAN);
        if ($mail->SMTPAuth) {
            $mail->Username = $smtpUser;
            $mail->Password = $smtpPassword;
        }
        
        // STARTTLS for GFZ
        if (strtolower($smtpSecure) === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->SMTPAutoTLS = true;
        } else {
            $mail->SMTPAutoTLS = false;
        }
        
        $mail->CharSet = 'UTF-8';
        
        // Email settings
        $mail->setFrom($smtpSender, 'ELMO Feedback System');
        $mail->addAddress($feedbackAddress);
        $mail->addReplyTo($smtpSender, 'ELMO System');
        
        $mail->isHTML(false);
        $mail->Subject = 'Neues ELMO Feedback - ' . date('d.m.Y H:i:s') . ' [' . $elmoVersion . ']';

        // Email body in German
        $mail->Body = "Neues Feedback über ELMO erhalten:\n\n"
            . "ELMO-Version: {$elmoVersion}\n"
            . "---\n\n"
            . "1. Welche Funktionen des neuen Metadaten-Editors finden Sie besonders hilfreich?\n"
            . $feedbackQuestion1 . "\n\n"
            . "2. Gibt es eine bestimmte Design- oder Benutzeroberflächen-Änderung, die Ihnen gefällt?\n"
            . $feedbackQuestion2 . "\n\n"
            . "3. Was finden Sie positiv an der Benutzerfreundlichkeit des neuen Editors?\n"
            . $feedbackQuestion3 . "\n\n"
            . "4. Welche Funktionen des neuen Editors finden Sie schwer zu bedienen?\n"
            . $feedbackQuestion4 . "\n\n"
            . "5. Gibt es Aspekte der Benutzeroberfläche, die Sie verwirrend oder störend finden?\n"
            . $feedbackQuestion5 . "\n\n"
            . "6. Vermissen Sie bestimmte Funktionen im neuen Metadaten-Editor?\n"
            . $feedbackQuestion6 . "\n\n"
            . "7. Gibt es eine spezielle Verbesserung, die Sie gerne sehen würden?\n"
            . $feedbackQuestion7 . "\n\n"
            . "---\n"
            . "Eingereicht am: " . date('d.m.Y H:i:s') . "\n"
            . "Von: " . ($_SERVER['HTTP_HOST'] ?? 'ELMO System') . "\n"
            . "IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'Unbekannt');
        
        error_log("Sende E-Mail über GFZ SMTP ({$smtpHost}:{$smtpPort}) an {$feedbackAddress}");
        $mail->send();
        error_log("E-Mail erfolgreich über GFZ SMTP versendet!");
        
        echo json_encode([
            'success' => true, 
            'message' => 'Feedback erfolgreich gesendet!'
        ]);
        
    } catch (Exception $e) {
        error_log("GFZ SMTP Fehler:");
        error_log("- Host: {$smtpHost}");
        error_log("- Port: {$smtpPort}");
        error_log("- User: {$smtpUser}");
        error_log("- Security: {$smtpSecure}");
        error_log("- PHPMailer Error: " . $mail->ErrorInfo);
        error_log("- Exception: " . $e->getMessage());
        
        // Fallback: save feedback to file
        $logFile = '/var/www/html/feedback_backup.txt';
        $logEntry = "[" . date('Y-m-d H:i:s') . "] BACKUP FEEDBACK\n";
        $logEntry .= "An: " . $feedbackAddress . "\n";
        $logEntry .= "Fehler: " . $mail->ErrorInfo . "\n";
        $logEntry .= "Inhalt:\n" . $mail->Body . "\n";
        $logEntry .= str_repeat("=", 80) . "\n\n";
        
        file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
        
        echo json_encode([
            'success' => false, 
            'message' => 'Fehler beim E-Mail-Versand: ' . $mail->ErrorInfo . '. Feedback wurde gesichert.'
        ]);
    }
}

// Process POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    
    // Get database connection from settings.php
    global $connection;
    
    $clientIp = getClientIp();
    
    // Security Check 1: Honeypot
    if (isHoneypotTriggered()) {
        // Silently reject but return fake success to not alert the bot
        error_log("Feedback blocked: Honeypot triggered from IP {$clientIp}");
        echo json_encode(['success' => true, 'message' => 'Feedback erfolgreich gesendet!']);
        exit;
    }
    
    // Security Check 2: CSRF Token
    if (!isValidCsrfToken()) {
        error_log("Feedback blocked: Invalid CSRF token from IP {$clientIp}");
        sendErrorResponse('Ungültige Anfrage. Bitte laden Sie die Seite neu und versuchen Sie es erneut.', 403);
    }
    
    // Security Check 3: Minimum time spent
    if (!isValidTimeSpent()) {
        error_log("Feedback blocked: Too fast submission from IP {$clientIp} (time: " . ($_POST['feedback_time_spent'] ?? 0) . "s)");
        sendErrorResponse('Formular zu schnell ausgefüllt. Bitte nehmen Sie sich etwas mehr Zeit.', 429);
    }
    
    // Security Check 4: Rate limiting
    if (!checkRateLimit($connection, $clientIp)) {
        error_log("Feedback blocked: Rate limit exceeded for IP {$clientIp}");
        sendErrorResponse('Sie haben zu viele Anfragen gesendet. Bitte versuchen Sie es in einer Stunde erneut.', 429);
    }
    
    // All security checks passed - record this submission
    recordSubmission($connection, $clientIp);
    
    // Invalidate the used CSRF token
    unset($_SESSION['csrf_token']);
    unset($_SESSION['csrf_token_time']);
    
    $feedbackQuestion1 = $_POST['feedbackQuestion1'] ?? '';
    $feedbackQuestion2 = $_POST['feedbackQuestion2'] ?? '';
    $feedbackQuestion3 = $_POST['feedbackQuestion3'] ?? '';
    $feedbackQuestion4 = $_POST['feedbackQuestion4'] ?? '';
    $feedbackQuestion5 = $_POST['feedbackQuestion5'] ?? '';
    $feedbackQuestion6 = $_POST['feedbackQuestion6'] ?? '';
    $feedbackQuestion7 = $_POST['feedbackQuestion7'] ?? '';
    
    sendFeedbackMail(
        $feedbackQuestion1,
        $feedbackQuestion2,
        $feedbackQuestion3,
        $feedbackQuestion4,
        $feedbackQuestion5,
        $feedbackQuestion6,
        $feedbackQuestion7
    );
}
?>
