<?php

// Guard for PHPUnit
if (defined('PHPUNIT_RUNNING')) {
    return;
}

/**
 * Script to save metadata and send it as XML via email
 * * This script saves all form data to the database and sends the resulting
 * XML file as an email attachment along with a PDF description and additional
 * metadata via email.
 */

// Enable error logging but suppress direct output to keep JSON responses clean
error_reporting(E_ALL);
ini_set('display_errors', 0);
session_start();

// Buffer output
ob_start();

// Include security functions FIRST (before settings.php to avoid duplicate includes)
require_once __DIR__ . '/api/security.php';

// Include required files
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/includes/save_to_db_helper.php';

// Make global variables from settings.php available
global $connection, $showGGMsProperties, $showUsedInstruments;
global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpAuth, $smtpSecure, $smtpSender;
global $xmlSubmitAddress;

error_log("send_xml_file.php: Globals set, connection: " . (isset($connection) ? 'set' : 'not set'));

// Include PHPMailer classes
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/Exception.php';
require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/SMTP.php';

error_log("send_xml_file.php: PHPMailer included");

/**
 * Test GFZ SMTP Connectivity
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
 * Validate submit security (honeypot, CSRF, rate limiting, minimum time)
 */
function validateSubmitSecurity(array $postData, $connection): void {
    $clientIp = getClientIp();
    
    // Check 1: Honeypot
    if (!validateHoneypot($postData['website'] ?? '')) {
        logSuspiciousAttempt($connection, 'submit', 'honeypot triggered', $clientIp);
        http_response_code(400);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Invalid submission detected.']);
        exit;
    }

    // Check 2: CSRF Token validation
    if (!validateCsrfToken($postData['csrf_token'] ?? '')) {
        logSuspiciousAttempt($connection, 'submit', 'invalid csrf token', $clientIp);
        http_response_code(403);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Security token validation failed.']);
        exit;
    }
    
    // Check 3: Rate limiting
    if (!checkRateLimit($connection, $clientIp, 'submit', RATE_LIMIT_SUBMIT_MAX, RATE_LIMIT_WINDOW_SECONDS)) {
        logSuspiciousAttempt($connection, 'submit', 'rate limit exceeded', $clientIp);
        http_response_code(429);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Too many submission attempts. Please try again later.']);
        exit;
    }
    
    // Check 4: Minimum time spent
    $timeCheck = evaluateInteractionTime((int) ($postData['submit_time_spent'] ?? 0), MIN_INTERACTION_SUBMIT_SECONDS);
    if (!$timeCheck['isValid']) {
        logSuspiciousAttempt(
            $connection,
            'submit',
            "insufficient time spent (effective={$timeCheck['effectiveSeconds']}s, client={$timeCheck['clientSeconds']}s, server={$timeCheck['serverSeconds']}s)",
            $clientIp
        );
        http_response_code(400);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Please take time to review your submission before submitting.']);
        exit;
    }
    
    recordRateLimit($connection, $clientIp, 'submit');
    invalidateCsrfToken();
    error_log("send_xml_file.php: Submit security validation passed");
}

/**
 * Convert weeks to priority text
 */
function getPriorityText($weeks): string {
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
*/
function createAndAttachXmlFile(PHPMailer $mail, string $xml_content, int $resource_id, array $postData): string {
    $firstAuthor = $postData['familynames'][0] ?? 'unknown';
    $mainTitle   = $postData['title'][0] ?? 'untitled';

    $abbreviateTitle = substr($mainTitle, 0, 30);

    $deUmlauts = ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'Ä' => 'Ae', 'Ö' => 'Oe', 'Ü' => 'Ue', 'ß' => 'ss'];
    $firstAuthor = str_replace(array_keys($deUmlauts), array_values($deUmlauts), $firstAuthor);
    $abbreviateTitle = str_replace(array_keys($deUmlauts), array_values($deUmlauts), $abbreviateTitle);

    setlocale(LC_ALL, 'en_US.UTF-8');
    $firstAuthor = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $firstAuthor) ?: $firstAuthor;
    $abbreviateTitle = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $abbreviateTitle) ?: $abbreviateTitle;

    $cleanAuthor = trim(preg_replace('/_+/', '_', preg_replace('/[^a-zA-Z0-9._-]/', '_', $firstAuthor)), '_') ?: 'unknown';
    $cleanTitle  = trim(preg_replace('/_+/', '_', preg_replace('/[^a-zA-Z0-9._-]/', '_', $abbreviateTitle)), '_') ?: 'untitled';

    $currentDateTime = date('Y-m-d_H-i-s');
    $xmlFilename = "metadata{$resource_id}-{$cleanAuthor}-{$cleanTitle}-{$currentDateTime}.xml";
    
    $mail->addStringAttachment($xml_content, $xmlFilename);
    error_log("XML attachment added: " . $xmlFilename);

    return $xmlFilename;
}

/**
 * Extract title and unique researcher contacts from XML.
 *
 * @param string $xml_content Raw XML content.
 * @return array{title: string, contacts: array<int, array{fullName: string, email: string}>}
 */
function collectResearcherConfirmationDataFromXml(string $xml_content): array
{
    $title = '';
    $contacts = [];
    $seen = [];

    // Stop early if XML is empty.
    if (empty(trim($xml_content))) {
        error_log("Researcher confirmation: XML content is empty.");
        return [
            'title' => $title,
            'contacts' => $contacts,
        ];
    }

    try {
        // Parse XML content.
        $xml = new SimpleXMLElement($xml_content);

        // Read dataset title.
        $titleNodes = $xml->xpath('//*[local-name()="title"]');
        if (!empty($titleNodes)) {
            $title = trim((string) $titleNodes[0]);
        }

        // Read all point of contact entries.
        $pointOfContactNodes = $xml->xpath('//*[local-name()="pointOfContact"]');

        foreach ($pointOfContactNodes ?: [] as $pointOfContactNode) {
                $nameNodes = $pointOfContactNode->xpath('.//*[local-name()="individualName"]//*[local-name()="CharacterString"]');
                $emailNodes = $pointOfContactNode->xpath('.//*[local-name()="electronicMailAddress"]//*[local-name()="CharacterString"]');

                $fullName = '';
                $email = '';

                // Extract raw name.
                if (!empty($nameNodes)) {
                    $fullName = trim((string) $nameNodes[0]);
                }

                // Extract raw email.
                if (!empty($emailNodes)) {
                    $email = trim((string) $emailNodes[0]);
                }

                // Fallback name.
                if ($fullName === '') {
                    $fullName = 'researcher';
                }

                // Convert "Last, First" to "First Last".
                if (strpos($fullName, ',') !== false) {
                    $nameParts = array_map('trim', explode(',', $fullName, 2));
                    $familyName = $nameParts[0];
                    $givenName = $nameParts[1] ?? '';
                    $fullName = trim($givenName . ' ' . $familyName);
                }

                // Skip invalid email addresses.
                if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    continue;
                }

                // Skip duplicate contacts.
                $key = mb_strtolower($fullName) . '|' . mb_strtolower($email);
                if (isset($seen[$key])) {
                    continue;
                }

                $seen[$key] = true;
                $contacts[] = [
                    'fullName' => $fullName,
                    'email' => $email,
                ];
            }

        error_log('Researcher confirmation: Extracted ' . count($contacts) . ' contact(s) from XML.');
    } catch (Exception $e) {
        // Log XML parsing errors.
        error_log("Researcher confirmation: Failed to parse XML. " . $e->getMessage());
    }

    return [
        'title' => $title,
        'contacts' => $contacts,
    ];
}

/**
 * Send confirmation emails to all researcher contacts.
 */
function sendResearcherConfirmationEmails(array $researcherConfirmationData, bool $simulateEmail = false): void {
    global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpAuth, $smtpSecure, $smtpSender;
    
    $title = trim((string) ($researcherConfirmationData['title'] ?? ''));
    $contacts = $researcherConfirmationData['contacts'] ?? [];

    if (empty($contacts)) {
        error_log('Researcher confirmation: No contacts found.');
        return;
    }

    $processedCount = 0;

    foreach ($contacts as $contact) {
        $fullName = trim((string) ($contact['fullName'] ?? 'researcher'));
        $email = trim((string) ($contact['email'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_log("Researcher confirmation: Invalid email for {$fullName}.");
            continue;
        }

        if ($simulateEmail) {
            $processedCount++;
            continue;
        }

        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host = $smtpHost;
            $mail->Port = $smtpPort;
            $mail->Timeout = 30;
            $mail->SMTPKeepAlive = false;

            $mail->SMTPAuth = filter_var($smtpAuth, FILTER_VALIDATE_BOOLEAN);
            if ($mail->SMTPAuth) {
                $mail->Username = $smtpUser;
                $mail->Password = $smtpPassword;
            }

            if (strtolower($smtpSecure) === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                $mail->SMTPAutoTLS = true;
            } else {
                $mail->SMTPAutoTLS = false;
            }

            $mail->CharSet = 'UTF-8';
            $mail->setFrom($smtpSender, 'ELMO System');
            $mail->addAddress($email, $fullName);
            
            $mail->Subject = 'Confirmation of your data submission to ELMO';
            $mail->isHTML(true);
            
            $mail->Body = '
                <p>Dear ' . htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8') . ',</p>
                <p>Thank you for your data submission to ELMO.</p>
                <p>Your data entry' . ($title !== '' ? ' titled "<strong>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</strong>"' : '') . ' has been received successfully.</p>
                <p>The data curators will now review your submission. If further information is needed, they will contact you.</p>
                <p>Best regards<br>ELMO</p>
            ';

            $mail->AltBody = "Dear {$fullName},\n\nThank you for your data submission to ELMO.\nYour data entry" . ($title !== '' ? " titled \"{$title}\"" : '') . " has been received successfully.\nThe data curators will now review your submission.\n\nBest regards\nELMO";

            $mail->send();
            $processedCount++;
        } catch (Exception $e) {
            error_log("Researcher confirmation: Failed to send email to {$fullName} <{$email}>. " . $e->getMessage());
        }
    }

    error_log('Researcher confirmation: ' . ($simulateEmail ? 'Simulated' : 'Sent') . ' ' . $processedCount . ' confirmation email(s).');
}

// Initialize execution variables
$dataUrl = '';
$urgencyWeeks = null;
$resource_id = false;

// ========= EXECUTION PIPELINE =========

try {
    error_log("send_xml_file.php: Try block started");
    
    // Step 0: Security Validation
    try {
        validateSubmitSecurity($_POST, $connection);
    } catch (Exception $e) {
        error_log("send_xml_file.php: Security validation exception: " . $e->getMessage());
        http_response_code(403);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Security validation failed.']);
        exit;
    }

    // Capture and clean post values
    $urgencyWeeks = isset($_POST['urgency']) ? intval($_POST['urgency']) : null;
    $dataUrl = isset($_POST['dataUrl']) ? filter_var($_POST['dataUrl'], FILTER_SANITIZE_URL) : '';

    if ($dataUrl) {
        $dataUrl = trim($dataUrl);
        if (!preg_match("~^(?:f|ht)tps?://~i", $dataUrl)) {
            $dataUrl = "https://" . $dataUrl;
        }
        if (!filter_var($dataUrl, FILTER_VALIDATE_URL)) {
            throw new Exception("Invalid data URL provided");
        }
    }
    
    // Step 1: Save transaction structures
    try {
        $resource_id = saveALL($_POST);
    } catch (Exception $e) {
        error_log("send_xml_file.php: Save operation failed: " . $e->getMessage());
        http_response_code(500);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Save operation failed.']);
        return;    
    }

    error_log("send_xml_file.php: All data saved successfully with Resource ID: " . $resource_id);

    // Step 2: Generate Payload File Structure
    $payloadData = generateDatasetPayloadByResourceId($resource_id);
    $xml_content = $payloadData['payload'];
    error_log("send_xml_file.php: XML content payload generated successfully");

    // Feature toggles for simulation path
    include_once __DIR__ . '/includes/feature_toggles.php';
    $simulateEmail = resolveFeatureToggle($SIMULATE_EMAIL ?? null, false);

    if ($simulateEmail) {
        error_log('XML Submit: Simulation mode enabled - skipping SMTP send');
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'message' => 'SIMULATED: Email sending was skipped.',
            'resource_id' => $resource_id,
            'simulated' => true
        ]);
        return;
    }
    
    // Step 3: Production Live System Email Delivery
    try {
        if (!testGfzSmtpConnectivity()) {
            throw new Exception("GFZ SMTP Server nicht erreichbar. Siehe Logs für Details.");
        }

        // --- PIPELINE PART A: DISPATCH TO CURATORS ---
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->Port = $smtpPort;
        $mail->Timeout = 30;
        $mail->SMTPKeepAlive = false;

        $mail->SMTPAuth = filter_var($smtpAuth, FILTER_VALIDATE_BOOLEAN);
        if ($mail->SMTPAuth) {
            $mail->Username = $smtpUser;
            $mail->Password = $smtpPassword;
        }

        if (strtolower($smtpSecure) === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->SMTPAutoTLS = true;
        } else {
            $mail->SMTPAutoTLS = false;
        }

        $mail->CharSet = 'UTF-8';
        $mail->setFrom($smtpSender, 'ELMO XML Submission System');
        $mail->addAddress($xmlSubmitAddress);
        $mail->addReplyTo($smtpSender, 'ELMO System');

        // Append optional document description files (PDF/DOC/DOCX)
        if (isset($_FILES['dataDescription']) && $_FILES['dataDescription']['error'] === UPLOAD_ERR_OK) {
            $uploadedFile = $_FILES['dataDescription'];
            $fileType = mime_content_type($uploadedFile['tmp_name']);
            $allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            
            if (!in_array($fileType, $allowedTypes)) {
                throw new Exception("Invalid file type. Only PDF, DOC, and DOCX files are allowed.");
            }
            if ($uploadedFile['size'] > 10 * 1024 * 1024) {
                throw new Exception("File size exceeds maximum limit of 10MB.");
            }
            
            $fileExtension = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));
            $mail->addAttachment($uploadedFile['tmp_name'], "data_description_" . $resource_id . "." . $fileExtension);
            error_log("XML Submit: Added file attachment: data_description_" . $resource_id . "." . $fileExtension);
        }

        // Perform payload file renaming assignment and attachment compilation
        $xmlFilename = createAndAttachXmlFile($mail, $xml_content, $resource_id, $_POST);

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
            <p>Ich habe die Metadaten" . (isset($_FILES['dataDescription']) ? " und die Datenbeschreibung" : "") . " an diese E-Mail angehängt.</p>
            <p>Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist <strong>{$priorityText}</strong>! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)</p>
            <hr>
            <p><small>Diese E-Mail wurde automatisch von ELMO generiert.</small></p>
        ";

        $plainBody = "Neue Metadaten-Einreichung von ELMO\n\nHallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:\n\nRessource ID in ELMO Datenbank: {$resource_id}\nPriorität: {$urgencyText} ({$priorityText})\nURL zu den Daten: {$dataUrlText}\nEingereicht am: " . date('d.m.Y H:i:s') . "\n\nIch habe die Metadaten" . (isset($_FILES['dataDescription']) ? " und die Datenbeschreibung" : "") . " an diese E-Mail angehängt.\n\nUnd jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist {$priorityText}! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)\n\nDiese E-Mail wurde automatisch von ELMO generiert.";

        $mail->isHTML(true);
        $mail->Subject = "Neue ELMO Metadaten-Einreichung (ID: {$resource_id}, Priorität: {$priorityText})";
        $mail->Body = $htmlBody;
        $mail->AltBody = $plainBody;

        error_log("XML Submit: Sende E-Mail über GFZ SMTP an {$xmlSubmitAddress}");
        $mail->send();
        error_log("XML Submit: Curator mail sent successfully.");

        // --- PIPELINE PART B: DISPATCH TO RESEARCHERS ---
        $researcherConfirmationData = collectResearcherConfirmationDataFromXml($xml_content);
        sendResearcherConfirmationEmails($researcherConfirmationData, $simulateEmail);

        // All paths cleared cleanly
        error_log("send_xml_file.php: Processing complete. Outputting success JSON.");
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'message' => 'Backend reports: XML submission and confirmation emails sent successfully.',
            'resource_id' => $resource_id,
            'simulated' => false
        ]);

    } catch (Exception $e) {
        error_log("XML Submit Mailer Error: " . $e->getMessage());
        
        // Failover recovery block logging
        if ($resource_id !== false) {
            $urgencyText = $urgencyWeeks ?? 'not set';
            $dataUrlText = $dataUrl ?: 'not provided';
            error_log("💁 FAILED XML SUBMISSION - ACTION REQUIRED \n" .
                      "==================================================\n" .
                      "📄 Resource ID: {$resource_id}\n" .
                      "⏰ Urgency: {$urgencyText}\n" .
                      "🔗 Data URL: {$dataUrlText}\n" .
                      "🚨 Error on submission: " . $e->getMessage() . "\n" .
                      "==================================================");
        }
        
        ob_clean();
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

} catch (Exception $e) {
    error_log("send_xml_file.php: Unexpected execution error: " . $e->getMessage());
    http_response_code(500);
    ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Unexpected submission error.',
        'resource_id' => $resource_id !== false ? $resource_id : null,
    ]);
}

// Flush output buffers cleanly
ob_end_flush();
?>