<?php
/**
 * Script for handling feedback email submission using PHPMailer
 */
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';
include 'settings.php';

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
    
    $mail = new PHPMailer(true);
    
    try {
        // Enable SMTP debugging (for Troubleshooting)
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = 'error_log';
        
        // Server settings
        $mail->isSMTP();
        $mail->Host = $smtpHost; // Hostname for Gmail
        $mail->Port = $smtpPort;
        
        // Authentication
        $useAuth = filter_var($smtpAuth, FILTER_VALIDATE_BOOLEAN);
        $mail->SMTPAuth = $useAuth;
        
        if ($useAuth) {
            $mail->Username = $smtpUser;
            $mail->Password = $smtpPassword;
        }
        
        // Encryption
        if (!empty($smtpSecure)) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // Für Gmail
        }
        
        // Timeout settings
        $mail->Timeout = 30;
        $mail->SMTPKeepAlive = false;
        $mail->CharSet = 'UTF-8';
        
        // Sender and recipient
        $mail->setFrom($smtpSender, 'ELMO Feedback System');
        $mail->addAddress($feedbackAddress);
        $mail->addReplyTo($smtpSender, 'ELMO System');
        
        // Email content
        $mail->isHTML(false);
        $mail->Subject = 'New Feedback for ELMO - ' . date('Y-m-d H:i:s');
        
        $mail->Body = "New feedback received from ELMO:\n\n"
            . "1. Which functions do you find particularly helpful?:\n" . $feedbackQuestion1 . "\n\n"
            . "2. Design/UI changes you like?:\n" . $feedbackQuestion2 . "\n\n"
            . "3. Positive usability aspects?:\n" . $feedbackQuestion3 . "\n\n"
            . "4. Functions difficult to use?:\n" . $feedbackQuestion4 . "\n\n"
            . "5. Confusing UI aspects?:\n" . $feedbackQuestion5 . "\n\n"
            . "6. Missing functions?:\n" . $feedbackQuestion6 . "\n\n"
            . "7. Specific improvements?:\n" . $feedbackQuestion7 . "\n\n"
            . "Submitted: " . date('Y-m-d H:i:s T') . "\n"
            . "From: " . ($_SERVER['HTTP_HOST'] ?? 'ELMO System');
        
        // Send email
        error_log("Attempting to send email via Gmail to: " . $feedbackAddress);
        $mail->send();
        error_log("Email successfully sent to: " . $feedbackAddress);
        
        echo json_encode(['success' => true, 'message' => 'Feedback sent successfully.']);
        
    } catch (Exception $e) {
        error_log("Gmail SMTP Error: " . $mail->ErrorInfo);
        error_log("Exception: " . $e->getMessage());
        error_log("SMTP Settings - Host: {$smtpHost}, Port: {$smtpPort}, User: {$smtpUser}");
        
        echo json_encode([
            'success' => false, 
            'message' => 'Error sending email: ' . $mail->ErrorInfo
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