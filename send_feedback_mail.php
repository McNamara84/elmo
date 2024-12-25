<?php
/**
 * Script for handling feedback email submission using PHPMailer
 * 
 * This script processes feedback form submissions and sends them via email
 * using SMTP authentication through PHPMailer.
 * 
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';
include 'settings.php';

/**
 * Sends a feedback email containing responses to feedback questions
 *
 * @param string $feedbackQuestion1 Response to the first feedback question
 * @param string $feedbackQuestion2 Response to the second feedback question
 * @param string $feedbackQuestion3 Response to the third feedback question
 * @param string $feedbackQuestion4 Response to the fourth feedback question
 * @param string $feedbackQuestion5 Response to the fifth feedback question
 * @param string $feedbackQuestion6 Response to the sixth feedback question
 * @param string $feedbackQuestion7 Response to the seventh feedback question
 *
 * @return void
 * @throws Exception When email sending fails
 */
function sendFeedbackMail(
    $feedbackQuestion1,
    $feedbackQuestion2,
    $feedbackQuestion3,
    $feedbackQuestion4,
    $feedbackQuestion5,
    $feedbackQuestion6,
    $feedbackQuestion7
) {
    global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpSender, $feedbackAddress;

    // Initialize PHPMailer with exception handling
    $mail = new PHPMailer(true);

    try {
        // Enable SMTP debugging
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = 'error_log';

        // Server settings
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPassword;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port = $smtpPort;
        $mail->CharSet = 'UTF-8';

        // Sender and recipient settings
        $mail->setFrom($smtpSender, 'Feedback System');
        $mail->addAddress($feedbackAddress);

        // Email content configuration
        $mail->isHTML(false);
        $mail->Subject = 'New Feedback for ELMO';

        // Construct email body
        $mail->Body =
            "Which functions of the new metadata editor do you find particularly helpful?:\n" . $feedbackQuestion1
            . "\n\nIs there a particular design or user interface change that you like?:\n" . $feedbackQuestion2
            . "\n\nWhat do you find positive about the usability of the new editor?:\n" . $feedbackQuestion3
            . "\n\nWhich functions of the new editor do you find difficult to use?:\n" . $feedbackQuestion4
            . "\n\nAre there any aspects of the user interface that you find confusing or annoying?:\n" . $feedbackQuestion5
            . "\n\nDo you miss certain functions in the new metadata editor?:\n" . $feedbackQuestion6
            . "\n\nIs there a specific improvement you would like to see?:\n" . $feedbackQuestion7;

        // Log attempt to send email
        error_log("Attempting to send email to: " . $feedbackAddress);

        // Send email
        $mail->send();

        // Log successful sending
        error_log("Email successfully sent to: " . $feedbackAddress);
        echo 'Feedback sent successfully.';

    } catch (Exception $e) {
        // Log error details
        error_log("Email sending failed. Error: " . $mail->ErrorInfo);
        error_log("SMTP Host: " . $smtpHost);
        error_log("SMTP Port: " . $smtpPort);
        error_log("SMTP User: " . $smtpUser);
        error_log("Recipient: " . $feedbackAddress);

        echo "Error sending email: {$mail->ErrorInfo}";
    }
}

/**
 * Process POST request and handle form submission
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $feedbackQuestion1 = $_POST['feedbackQuestion1'] ?? '';
    $feedbackQuestion2 = $_POST['feedbackQuestion2'] ?? '';
    $feedbackQuestion3 = $_POST['feedbackQuestion3'] ?? '';
    $feedbackQuestion4 = $_POST['feedbackQuestion4'] ?? '';
    $feedbackQuestion5 = $_POST['feedbackQuestion5'] ?? '';
    $feedbackQuestion6 = $_POST['feedbackQuestion6'] ?? '';
    $feedbackQuestion7 = $_POST['feedbackQuestion7'] ?? '';

    // Send feedback email
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
