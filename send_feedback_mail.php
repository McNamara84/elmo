<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';
include 'settings.php';

function testNetworkConnectivity() {
    global $smtpHost, $smtpPort;
    
    error_log("=== Network Connectivity Test ===");
    
    // DNS-Test
    $ip = gethostbyname($smtpHost);
    error_log("DNS Resolution: {$smtpHost} -> {$ip}");
    
    // Port-Test
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
    
    // Netzwerk-Test vor dem Versenden
    if (!testNetworkConnectivity()) {
        echo json_encode(['success' => false, 'message' => 'Network connectivity test failed. Check logs.']);
        return;
    }
    
    $mail = new PHPMailer(true);
    
    try {
        // Debug settings
        $mail->SMTPDebug = 3; // Maximales Debugging
        $mail->Debugoutput = 'error_log';
        
        // Server settings
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->Port = $smtpPort;
        $mail->Timeout = 30;
        $mail->SMTPKeepAlive = false;
        
        // Authentication
        $mail->SMTPAuth = filter_var($smtpAuth, FILTER_VALIDATE_BOOLEAN);
        if ($mail->SMTPAuth) {
            $mail->Username = $smtpUser;
            $mail->Password = $smtpPassword;
        }
        
        // Encryption
        if (strtolower($smtpSecure) === 'ssl') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } elseif (strtolower($smtpSecure) === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPAutoTLS = false;
        }
        
        $mail->CharSet = 'UTF-8';
        
        // Email settings
        $mail->setFrom($smtpSender, 'ELMO Feedback System');
        $mail->addAddress($feedbackAddress);
        $mail->isHTML(false);
        $mail->Subject = 'New Feedback for ELMO - ' . date('Y-m-d H:i:s');
        
        $mail->Body = "New feedback received:\n\n"
            . "1. Helpful functions: " . $feedbackQuestion1 . "\n\n"
            . "2. Design changes: " . $feedbackQuestion2 . "\n\n"
            . "3. Positive usability: " . $feedbackQuestion3 . "\n\n"
            . "4. Difficult functions: " . $feedbackQuestion4 . "\n\n"
            . "5. Confusing aspects: " . $feedbackQuestion5 . "\n\n"
            . "6. Missing functions: " . $feedbackQuestion6 . "\n\n"
            . "7. Improvements: " . $feedbackQuestion7 . "\n\n"
            . "Submitted: " . date('Y-m-d H:i:s');
        
        error_log("Attempting to send email via {$smtpHost}:{$smtpPort}");
        $mail->send();
        error_log("Email successfully sent!");
        
        echo json_encode(['success' => true, 'message' => 'Feedback sent successfully.']);
        
    } catch (Exception $e) {
        error_log("SMTP Error Details:");
        error_log("- Host: {$smtpHost}");
        error_log("- Port: {$smtpPort}");
        error_log("- Security: {$smtpSecure}");
        error_log("- Error: " . $mail->ErrorInfo);
        error_log("- Exception: " . $e->getMessage());
        
        echo json_encode([
            'success' => false, 
            'message' => 'Error: ' . $mail->ErrorInfo
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