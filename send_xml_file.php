<?php


// Guard for PHPUnit
if (defined('PHPUNIT_RUNNING')) {
    return;
}


/**
 * Script to save metadata and send it as XML via email
 * 
 * This script saves all form data to the database and sends the resulting
 * XML file as an email attachment along with a PDF description and additional
 * metadata via email.
 */

// Enable error logging but suppress direct output to keep JSON responses clean
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Buffer output
ob_start();

error_log("send_xml_file.php: Script started");

// Include required files
require_once __DIR__ . '/settings.php';

error_log("send_xml_file.php: settings.php included");

// Make global variables from settings.php available
global $connection, $showGGMsProperties, $showUsedInstruments;
global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpAuth, $smtpSecure, $smtpSender;
global $xmlSubmitAddress;

error_log("send_xml_file.php: Globals set, connection: " . (isset($connection) ? 'set' : 'not set'));

require_once __DIR__ . '/save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/save/formgroups/save_authors.php';
require_once __DIR__ . '/save/formgroups/save_contactperson.php';
require_once __DIR__ . '/save/formgroups/save_freekeywords.php';
require_once __DIR__ . '/save/formgroups/save_contributorpersons.php';
require_once __DIR__ . '/save/formgroups/save_contributorinstitutions.php';
require_once __DIR__ . '/save/formgroups/save_descriptions.php';
require_once __DIR__ . '/save/formgroups/save_thesauruskeywords.php';
require_once __DIR__ . '/save/formgroups/save_spatialtemporalcoverage.php';
require_once __DIR__ . '/save/formgroups/save_relatedwork.php';
require_once __DIR__ . '/save/formgroups/save_usedinstruments.php';
require_once __DIR__ . '/save/formgroups/save_fundingreferences.php';

if ($showGGMsProperties) {
    require_once __DIR__ . '/save/formgroups/save_ggmsproperties.php';
}

error_log("send_xml_file.php: Save functions included");

// Include PHPMailer classes
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/Exception.php';
require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/SMTP.php';

error_log("send_xml_file.php: PHPMailer included");

/**
 * Test GFZ SMTP connectivity
 */
function testGfzSmtpConnectivity(): bool {
    global $smtpHost, $smtpPort;
    
    error_log("=== GFZ SMTP Connectivity Test (XML Submit) ===");
    
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
/**
* Create XML filename from metadata and add as PHPMailer string attachment.
*
* @param PHPMailer $mail
* @param string    $xml_content
* @param int       $resource_id
*
 * @param array{
 *   familynames?: array<int, string>,
 *   title?: array<int, string>
 * } $postData
 *
* @return string   The final XML filename
*/
function createAndAttachXmlFile(PHPMailer $mail, string $xml_content, int $resource_id, array $postData): string
{
    $firstAuthor = $postData['familynames'][0] ?? 'unknown';
    $mainTitle   = $postData['title'][0] ?? 'untitled';

    // Abbreviate title
    $abbreviateTitle = substr($mainTitle, 0, 30);

    // Replace German umlauts FIRST
    $deUmlauts = ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'Ä' => 'Ae', 'Ö' => 'Oe', 'Ü' => 'Ue', 'ß' => 'ss'];
    $firstAuthor = str_replace(array_keys($deUmlauts), array_values($deUmlauts), $firstAuthor);
    $abbreviateTitle = str_replace(array_keys($deUmlauts), array_values($deUmlauts), $abbreviateTitle);

    // Set locale for iconv
    setlocale(LC_ALL, 'en_US.UTF-8');

    // Transliteration with iconv
    $firstAuthor = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $firstAuthor) ?: $firstAuthor;
    $abbreviateTitle = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $abbreviateTitle) ?: $abbreviateTitle;

    $cleanAuthor = trim(preg_replace('/_+/', '_', preg_replace('/[^a-zA-Z0-9._-]/', '_', $firstAuthor)), '_') ?: 'unknown';
    $cleanTitle  = trim(preg_replace('/_+/', '_', preg_replace('/[^a-zA-Z0-9._-]/', '_', $abbreviateTitle)), '_') ?: 'untitled';

    $currentDateTime = date('Y-m-d_H-i-s');
    // Assemble filename
    $xmlFilename = "metadata{$resource_id}-{$cleanAuthor}-{$cleanTitle}-{$currentDateTime}.xml";
    error_log("Final XML filename: " . $xmlFilename);

    $mail->addStringAttachment($xml_content, $xmlFilename);
    error_log("XML attachment added: " . $xmlFilename);

    return $xmlFilename;
}

$resource_id = false; // Initialize to false (matches saveResourceInformationAndRights return type)

try {
    error_log("send_xml_file.php: Try block started");
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
    if ($showUsedInstruments ?? false) {
        saveUsedInstruments($connection, $_POST, $resource_id);
    }
    saveFundingReferences($connection, $_POST, $resource_id);

    error_log("send_xml_file.php: All data saved successfully");

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

    // Include the dataset controller to generate the file
    try {
        require_once __DIR__ . '/api/v2/controllers/DatasetController.php';
        $datasetController = new DatasetController();
    } catch (Exception $e) {
        error_log("Error accessing DatasetController: function getResourceAsXml is not available. Exception: " . $e->getMessage());
    }

    // Get XML content from API    
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://';
    $base_url = $protocol . $_SERVER['HTTP_HOST'];
    $project_path = rtrim(dirname($_SERVER['PHP_SELF']), '/');
    $url = $base_url . $project_path . "/api/v2/dataset/export/" . $resource_id . "/all";

    // Try to fetch via HTTP first
    $xml_content = @file_get_contents($url);
    if ($xml_content !== false) {
        error_log("Submit: Fetched XML via API: $url");
    } else {
        error_log("Submit: File not found via the API. URL tried: $url. Turning to fallback logic -- generating the file on-the-fly");
        try {
            // The controller is already included, so we can use it.
            $datasetController = new DatasetController();
            // Generate XML directly in-memory
            $xml_content = $datasetController->envelopeXmlAsString($connection, $resource_id);
            // check for errors
            if (empty($xml_content)) {
                error_log("Submit: Failed to retrieve XML content from API and in-memory. Endpoint: $url");     
            } else {
                error_log("Submit: Successfully generated XML file in-memory for resource_id $resource_id.");
            }
        } catch (Exception $e) {
            error_log("Submit: Error generating XML in-memory: " . $e->getMessage());
            $xml_content = ''; // Set empty to continue
        }
    }

    error_log("send_xml_file.php: XML content ready");

// Add simulation flag for development 
// (set SIMULATE_EMAIL=true in env to skip the actual email sending)
include_once __DIR__ . '/includes/feature_toggles.php';
$simulateEmail = resolveFeatureToggle($SIMULATE_EMAIL ?? null, false);
error_log("send_xml_file.php: simulateEmail = " . ($simulateEmail ? 'true' : 'false'));

// Test SMTP connectivity and send email (skip if simulating)
if (!$simulateEmail) {
    // Test SMTP connectivity before sending
    if (!testGfzSmtpConnectivity()) {
        throw new Exception("GFZ SMTP Server nicht erreichbar. Siehe Logs für Details.");
    }

    // Send email with XML attachment
    $mail = new PHPMailer(true);

    // Server settings for GFZ SMTP
    $mail->isSMTP();
    $mail->Host = $smtpHost; // Direct hostname for GFZ
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

    // Recipients
    $mail->setFrom($smtpSender, 'ELMO XML Submission System');
    $mail->addAddress($xmlSubmitAddress);
    $mail->addReplyTo($smtpSender, 'ELMO System');

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
        
        error_log("XML Submit: Added file attachment: data_description_" . $resource_id . "." . $fileExtension);
    }

    $xmlFilename = createAndAttachXmlFile($mail, $xml_content, $resource_id, $_POST);

    // Prepare email content
    $urgencyText = $urgencyWeeks ? "$urgencyWeeks weeks" : "not specified";
    $priorityText = getPriorityText($urgencyWeeks);
    $dataUrlText = $dataUrl ? $dataUrl : "not provided";

    $htmlBody = "
    <h2>Neue Metadaten-Einreichung von ELMO</h2>
    <p>Hallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:</p>
    <ul>
        <li><strong>Ressource ID in ELMO Datenbank:</strong> {$resource_id}</li>
        <li><strong>Priorität:</strong> {$urgencyText} ({$priorityText})</li>
        <li><strong>URL zu den Daten:</strong> " . ($dataUrl ? "<a href='{$dataUrl}'>{$dataUrl}</a>" : "nicht angegeben") . "</li>
        <li><strong>Eingereicht am:</strong> " . date('d.m.Y H:i:s') . "</li>
    </ul>
    <p>Ich habe die Metadaten" .
        (isset($_FILES['dataDescription']) ? " und die Datenbeschreibung" : "") .
        " an diese E-Mail angehängt.</p>
    <p>Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist <strong>{$priorityText}</strong>! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)</p>
    <hr>
    <p><small>Diese E-Mail wurde automatisch von ELMO generiert.</small></p>
";

    $plainBody = "
    Neue Metadaten-Einreichung von ELMO
    
    Hallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:
    
    Ressource ID in ELMO Datenbank: {$resource_id}
    Priorität: {$urgencyText} ({$priorityText})
    URL zu den Daten: {$dataUrlText}
    Eingereicht am: " . date('d.m.Y H:i:s') . "
    
    Ich habe die Metadaten" .
        (isset($_FILES['dataDescription']) ? " und die Datenbeschreibung" : "") .
        " an diese E-Mail angehängt.
        
    Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist {$priorityText}! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)
    
    Diese E-Mail wurde automatisch von ELMO generiert.
";

    // Set email content
    $mail->isHTML(true);
    $mail->Subject = "Neue ELMO Metadaten-Einreichung (ID: {$resource_id}, Priorität: {$priorityText})";
    $mail->Body = $htmlBody;
    $mail->AltBody = $plainBody;

    // Send email
    error_log("XML Submit: Sende E-Mail über GFZ SMTP an {$xmlSubmitAddress}");
    $mail->send();
    error_log("XML Submit: E-Mail erfolgreich über GFZ SMTP versendet!");
} else {
    error_log("Warning: the email was not sent! You are strongly assuming you are in development right now! SIMULATE_EMAIL was set true - skipping SMTP and PHPMailer.");
}

    error_log("send_xml_file.php: About to return success");

    // Clear any output buffers
    ob_clean();

    // Return success response
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'Backend reports: XML submission email sent successfully.',
        'resource_id' => $resource_id
    ]);

} catch (Exception $e) {
    error_log("XML Submit Error: " . $e->getMessage());
    
    // Backup: Log submission details if email fails
    if ($resource_id !== false) {
        $urgencyText = $urgencyWeeks ?? 'not set';
        $dataUrlText = $dataUrl ?: 'not provided';
        $logMessage = "💁 FAILED XML SUBMISSION - ACTION REQUIRED \n" .
                      "👀 Note: You can only see this message if front-end and back-end validation allowed the submission \n" .
                      "==================================================\n" .
                      "📄 Resource ID: {$resource_id}\n" .
                      "⏰ Urgency: {$urgencyText}\n" .
                      "🔗 Data URL: {$dataUrlText}\n" .
                      "🚨 Error on submission: " . $e->getMessage() . "\n" .
                      "==================================================";
        error_log($logMessage);
    }
    
    // Clear any output buffers
    ob_clean();
    
    // Return error response
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => "Sorry, we encountered an error when sending the email:\n\n" . 
                     $e->getMessage() . "\n\n" .
                     "Your data has been saved in our system with Resource ID: " . ($resource_id !== false ? $resource_id : 'N/A') . "\n\n" .
                     "Please contact the data curation team at {$xmlSubmitAddress}. In your Email, make sure to reference this Resource ID.\n\n" .
                     "Thank you for your understanding.\n" .
                     "ELMO team"
    ]);
}

// End output buffering
ob_end_flush();
?>
