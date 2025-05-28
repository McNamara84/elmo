<?php
/**
 * Script to save dataset metadata and send it as XML via email
 * 
 * This script saves all form data to the database and sends the resulting
 * XML file as an email attachment along with a PDF description and additional
 * metadata via email.
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Buffer output
ob_start();

// Include required files
require_once './settings.php';
require_once 'save/formgroups/save_resourceinformation_and_rights.php';
require_once 'save/formgroups/save_authors.php';
require_once 'save/formgroups/save_contactperson.php';
require_once 'save/formgroups/save_freekeywords.php';
require_once 'save/formgroups/save_contributorpersons.php';
require_once 'save/formgroups/save_contributorinstitutions.php';
require_once 'save/formgroups/save_descriptions.php';
require_once 'save/formgroups/save_thesauruskeywords.php';
require_once 'save/formgroups/save_spatialtemporalcoverage.php';
require_once 'save/formgroups/save_relatedwork.php';
require_once 'save/formgroups/save_fundingreferences.php';
if showGGMsProperties {
    require_once 'save/formgroups/save_ggmsproperties.php';
}

// Include PHPMailer classes
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require_once 'vendor/phpmailer/phpmailer/src/Exception.php';
require_once 'vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once 'vendor/phpmailer/phpmailer/src/SMTP.php';

/**
 * Convert weeks to priority text
 * @param int|null $weeks Number of weeks
 * @return string Priority text
 */
function getPriorityText($weeks)
{
    switch ($weeks) {
        case 2:
            return "high";
        case 4:
            return "normal";
        case 6:
            return "low";
        default:
            return "undefined";
    }
}

try {
    // Save all form components
    $resource_id = saveResourceInformationAndRights($connection, $_POST);
    saveAuthors($connection, $_POST, $resource_id);
    saveContactPerson($connection, $_POST, $resource_id);
    saveContributorInstitutions($connection, $_POST, $resource_id);
    saveContributorPersons($connection, $_POST, $resource_id);
    saveDescriptions($connection, $_POST, $resource_id);
    saveKeywords($connection, $_POST, $resource_id);
    saveFreeKeywords($connection, $_POST, $resource_id);
    saveSpatialTemporalCoverage($connection, $_POST, $resource_id);
    saveRelatedWork($connection, $_POST, $resource_id);
    saveFundingReferences($connection, $_POST, $resource_id);

    // Get additional submission data from modal
    $urgencyWeeks = isset($_POST['urgency']) ? intval($_POST['urgency']) : null;
    $dataUrl = isset($_POST['dataUrl']) ? filter_var($_POST['dataUrl'], FILTER_SANITIZE_URL) : '';

    // Validate and format URL if provided
    if ($dataUrl) {
        // Trim whitespace
        $dataUrl = trim($dataUrl);

        // Add https:// if no protocol is specified
        if (!preg_match("~^(?:f|ht)tps?://~i", $dataUrl)) {
            $dataUrl = "https://" . $dataUrl;
        }

        // Validate the complete URL
        if (!filter_var($dataUrl, FILTER_VALIDATE_URL)) {
            throw new Exception("Invalid data URL provided");
        }
    }

    // Get XML content from API
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://';
    $base_url = $protocol . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']);
    $url = $base_url . "/api/v2/dataset/export/" . $resource_id . "/all";

    // Get XML content with error handling
    $xml_content = file_get_contents($url);

    if ($xml_content === FALSE) {
        throw new Exception("Failed to retrieve XML content from API");
    }

    // Send email with XML attachment
    $mail = new PHPMailer(true);

    // Capture SMTP debugging output
    $debugging_output = '';
    $mail->Debugoutput = function ($str, $level) use (&$debugging_output) {
        $debugging_output .= "$str\n";
    };

    // Server settings
    $mail->SMTPDebug = 2; // Enable verbose debug output
    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->SMTPAuth = true;
    $mail->Username = $smtpUser;
    $mail->Password = $smtpPassword;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port = $smtpPort;
    $mail->CharSet = 'UTF-8';

    // Recipients
    $mail->setFrom($smtpSender);
    $mail->addAddress($xmlSubmitAddress);

    // Handle file upload if provided
    $pdfAttachment = null;
    if (isset($_FILES['dataDescription']) && $_FILES['dataDescription']['error'] === UPLOAD_ERR_OK) {
        $uploadedFile = $_FILES['dataDescription'];

        // Validate file type
        $fileType = mime_content_type($uploadedFile['tmp_name']);
        $allowedTypes = [
            'application/pdf',                                                        // PDF
            'application/msword',                                                     // DOC
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
        ];

        if (!in_array($fileType, $allowedTypes)) {
            throw new Exception("Invalid file type. Only PDF, DOC, and DOCX files are allowed.");
        }

        // Validate file size
        if ($uploadedFile['size'] > 10 * 1024 * 1024) {
            throw new Exception("File size exceeds maximum limit of 10MB.");
        }

        // Get file extension from original filename
        $fileExtension = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));

        // Add file as attachment
        $mail->addAttachment(
            $uploadedFile['tmp_name'],
            "data_description_" . $resource_id . "." . $fileExtension
        );
    }

    // Add XML attachment
    $mail->addStringAttachment($xml_content, "dataset_" . $resource_id . ".xml");

    // Prepare email content
    $urgencyText = $urgencyWeeks ? "$urgencyWeeks weeks" : "not specified";
    $priorityText = getPriorityText($urgencyWeeks);
    $dataUrlText = $dataUrl ? $dataUrl : "not provided";

    $htmlBody = "
    <h2>New Dataset from ELMO</h2>
    <p>Hi! I'm ELMO and a new dataset has been submitted with the following details:</p>
    <ul>
        <li><strong>Dataset ID in ELMO database:</strong> {$resource_id}</li>
        <li><strong>Priority:</strong> {$urgencyText}</li>
        <li><strong>URL to data:</strong> " . ($dataUrl ? "<a href='{$dataUrl}'>{$dataUrl}</a>" : "not provided") . "</li>
    </ul>
    <p>I have attached the metadata" .
        (isset($_FILES['dataDescription']) ? " and data description" : "") .
        " to this email.</p>
    <p>And now let's get to work! The urgency of this data set is {$priorityText}! But I've already done most of the work for you ;-)</p>
";

    $plainBody = "
    New Dataset from ELMO
    
    Hi! I'm ELMO and a new dataset has been submitted with the following details:
    
    Dataset ID in ELMO database: {$resource_id}
    Priority: {$urgencyText}
    URL to data: {$dataUrlText}
    
    I have attached the metadata" .
        (isset($_FILES['dataDescription']) ? " and data description PDF" : "") .
        " to this email.
    And now let's get to work! The urgency of this data set is {$priorityText}! But I've already done most of the work for you ;-)
";

    // Set email content
    $mail->isHTML(true);
    $mail->Subject = "New Dataset from ELMO (ELMO ID: {$resource_id})";
    $mail->Body = $htmlBody;
    $mail->AltBody = $plainBody;

    // Send email
    if (!$mail->send()) {
        throw new Exception("Email could not be sent: " . $mail->ErrorInfo);
    }

    // Clear any output buffers
    ob_clean();

    // Return success response
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'Dataset saved and email sent successfully'
    ]);

} catch (Exception $e) {
    // Clear any output buffers
    ob_clean();

    // Return error response
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage(),
        'debug' => isset($debugging_output) ? $debugging_output : ''
    ]);
}

// End output buffering
ob_end_flush();