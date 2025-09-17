<?php
/**
 * Script for handling feedback email submission using PHPMailer with GFZ SMTP
 */
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';
include 'helper_functions.php';

function testGfzSmtpConnectivity() {
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
    $feedbackQuestion1,
    $feedbackQuestion2,
    $feedbackQuestion3,
    $feedbackQuestion4,
    $feedbackQuestion5,
    $feedbackQuestion6,
    $feedbackQuestion7
) {
    global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpSender, $feedbackAddress, $smtpSecure, $smtpAuth;
    
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
        $mail->Subject = 'Neues ELMO Feedback - ' . date('d.m.Y H:i:s');
        
        // Email body in German
        $mail->Body = "Neues Feedback über ELMO erhalten:\n\n"
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
