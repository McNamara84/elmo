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
 * @param array<string, mixed> $postData POST data from form
 * @return void
 * @throws Exception if validation fails
 */
function validateSubmitSecurity(array $postData): void {
    // Check 1: Honeypot - Silent rejection
    if (!validateHoneypot($postData['website'] ?? '')) {
        logSuspiciousAttempt('submit', 'honeypot triggered');
        http_response_code(400);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Invalid submission detected.']);
        exit;
    }

    // Check 2: CSRF Token validation
    if (!validateCsrfToken(getSubmittedCsrfToken($postData))) {
        logSuspiciousAttempt('submit', 'invalid csrf token');
        http_response_code(400);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Security token validation failed.']);
        exit;
    }

    // Check 3: Rate limiting
    if (!checkSessionRateLimit('submit', RATE_LIMIT_SUBMIT_MAX, RATE_LIMIT_WINDOW_SECONDS)) {
        logSuspiciousAttempt('submit', 'rate limit exceeded');
        http_response_code(400);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Too many submission attempts. Please try again later.']);
        exit;
    }

    // Check 4: Minimum time spent (server-only)
    $timeCheck = evaluateInteractionTime(MIN_INTERACTION_SUBMIT_SECONDS);
    if (!$timeCheck['isValid']) {
        logSuspiciousAttempt(
            'submit',
            "insufficient time spent (effective={$timeCheck['effectiveSeconds']}s, minimum={$timeCheck['minimumSeconds']}s)"
        );
        http_response_code(400);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Please take time to review your submission before submitting.']);
        exit;
    }
    
    // All checks passed — record rate limit and reset interaction timer
    recordSessionRateLimit('submit', RATE_LIMIT_WINDOW_SECONDS);
    resetPageInteractionTime('form');

    error_log(sprintf("send_xml_file.php: Submit security validation passed | Time spent: %.1f seconds", $timeCheck['effectiveSeconds']));
}

/**
 * Convert weeks to priority text
 */
function getPriorityText(?int $weeks): string {
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
* @param array<string, mixed> $postData
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
 * @return array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>}
 */
function collectResearcherConfirmationDataFromXml(string $xml_content): array
{
    $title = '';
    $contacts = [];
    $invalidContacts = [];
    $seen = [];

    // Stop early if XML is empty.
    if (empty(trim($xml_content))) {
        error_log("Researcher confirmation: XML content is empty.");
        return [
            'title' => $title,
            'contacts' => $contacts,
            'invalidContacts' => $invalidContacts,
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
                    $invalidContacts[] = [
                        'fullName' => $fullName,
                        'email' => $email === '' ? '(empty)' : $email,
                    ];
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
        'invalidContacts' => $invalidContacts,
    ];
}

/**
 * Send confirmation emails to all researcher contacts.
 *
 * @param array{title?: string, contacts?: array<int, array{fullName?: string, email?: string}>} $researcherConfirmationData
 * @return array{sent: int, failed: array<int, array{fullName: string, email: string, error: string}>}
 */
function sendResearcherConfirmationEmails(array $researcherConfirmationData, bool $simulateEmail = false): array {
    global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpAuth, $smtpSecure, $smtpSender;

    $title = trim((string) ($researcherConfirmationData['title'] ?? ''));
    $contacts = $researcherConfirmationData['contacts'] ?? [];

    if (empty($contacts)) {
        error_log('Researcher confirmation: No contacts found.');
        return ['sent' => 0, 'failed' => []];
    }

    $processedCount = 0;
    $failed = [];

    foreach ($contacts as $contact) {
        $fullName = trim((string) ($contact['fullName'] ?? 'researcher'));
        $email = trim((string) ($contact['email'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_log("Researcher confirmation: Invalid email for {$fullName}.");
            $failed[] = [
                'fullName' => $fullName,
                'email' => $email === '' ? '(empty)' : $email,
                'error' => 'invalid email address',
            ];
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
            $failed[] = [
                'fullName' => $fullName,
                'email' => $email,
                'error' => $e->getMessage(),
            ];
        }
    }

    error_log('Researcher confirmation: ' . ($simulateEmail ? 'Simulated' : 'Sent') . ' ' . $processedCount . ' confirmation email(s).');

    return ['sent' => $processedCount, 'failed' => $failed];
}

// Initialize execution variables
$dataUrl = '';
$urgencyWeeks = null;
$resource_id = null;

// ========= EXECUTION PIPELINE =========

try {
    error_log("send_xml_file.php: Try block started");

    // Step 0: Security Validation
    try {
        validateSubmitSecurity($_POST);
    } catch (\Exception $e) {
        logSuspiciousAttempt('submit', 'validation exception: ' . $e->getMessage());
        http_response_code(400);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Security validation failed.']);
        exit;
    } finally {
        resetPageInteractionTime('form'); // reset timing interaction to limit the next submission. 
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
    $payloadData = generateDatasetPayloadByResourceId($resource_id, ['postData' => $_POST]);
    $xml_content = $payloadData['payload'];
    error_log("send_xml_file.php: XML content payload generated successfully");

    if ($payloadData['generator'] === 'dataset-xml') {
        try {
            require_once __DIR__ . '/api/v2/controllers/DatasetController.php';
            $datasetController = new DatasetController();
            $xml_content = $datasetController->markDataCiteEnvelopeAsSubmitted($xml_content, date('Y-m-d'));
            error_log("Submit: Marked DataCite XML with dateType=Submitted.");
        } catch (Exception $e) {
            error_log("Submit: Failed to add Submitted date to XML content: " . $e->getMessage());
        }
    }

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
    $researcherConfirmationData = [
        'title' => '',
        'contacts' => [],
        'invalidContacts' => [],
    ];

    // --- PREP: payload readiness and SMTP connectivity ---
    try {
        if (!testGfzSmtpConnectivity()) {
            throw new Exception("GFZ SMTP Server nicht erreichbar. Siehe Logs für Details.");
        }

        if (empty(trim($xml_content))) {
            throw new Exception("Generated XML payload is empty.");
        }

        $researcherConfirmationData = collectResearcherConfirmationDataFromXml($xml_content);
    } catch (Exception $e) {
        error_log("XML Submit Prep Error: " . $e->getMessage());

        $urgencyText = $urgencyWeeks ?? 'not set';
        $dataUrlText = $dataUrl ?: 'not provided';
        error_log("💁 FAILED XML SUBMISSION - ACTION REQUIRED \n" .
                  "==================================================\n" .
                  "📄 Resource ID: {$resource_id}\n" .
                  "⏰ Urgency: {$urgencyText}\n" .
                  "🔗 Data URL: {$dataUrlText}\n" .
                  "🚨 Error on submission: " . $e->getMessage() . "\n" .
                  "==================================================");

        ob_clean();
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => "Sorry, we encountered an error when preparing the email:\n\n" .
                         $e->getMessage() . "\n\n" .
                         "Your data has been saved in our system with Resource ID: {$resource_id}\n\n" .
                         "Please contact the data curation team at {$xmlSubmitAddress}. In your Email, make sure to reference this Resource ID.\n\n" .
                         "Thank you for your understanding.\n" .
                         "ELMO team"
        ]);
        return;
    }

    // --- PIPELINE PART A: DISPATCH TO CURATORS ---
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

        $contactEmails = array_map(
            static fn(array $contact): string => $contact['email'],
            $researcherConfirmationData['contacts']
        );
        $contactEmailsText = !empty($contactEmails)
            ? implode(', ', $contactEmails)
            : 'not provided';
        $contactEmailsHtml = !empty($contactEmails)
            ? implode(', ', array_map(
                static fn(string $email): string => htmlspecialchars($email, ENT_QUOTES, 'UTF-8'),
                $contactEmails
            ))
            : 'not provided';

        $htmlBody = "
            <h2>Neue Metadaten-Einreichung von ELMO</h2>
            <p>Hallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:</p>
            <ul>
                <li><strong>Ressource ID in ELMO Datenbank:</strong> {$resource_id}</li>
                <li><strong>Priorität:</strong> {$urgencyText} ({$priorityText})</li>
                <li><strong>URL zu den Daten:</strong> " . ($dataUrl ? "<a href='{$dataUrl}'>{$dataUrl}</a>" : "nicht angegeben") . "</li>
                <li><strong>Contact email addresses provided by the author(s):</strong> {$contactEmailsHtml}</li>
                <li><strong>Eingereicht am:</strong> " . date('d.m.Y H:i:s') . "</li>
            </ul>
            <p>Ich habe die Metadaten" . (isset($_FILES['dataDescription']) ? " und die Datenbeschreibung" : "") . " an diese E-Mail angehängt.</p>
            <p>Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist <strong>{$priorityText}</strong>! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)</p>
            <hr>
            <p><small>Diese E-Mail wurde automatisch von ELMO generiert.</small></p>
        ";

        $plainBody = "Neue Metadaten-Einreichung von ELMO\n\nHallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:\n\nRessource ID in ELMO Datenbank: {$resource_id}\nPriorität: {$urgencyText} ({$priorityText})\nURL zu den Daten: {$dataUrlText}\nContact email addresses provided by the author(s): {$contactEmailsText}\nEingereicht am: " . date('d.m.Y H:i:s') . "\n\nIch habe die Metadaten" . (isset($_FILES['dataDescription']) ? " und die Datenbeschreibung" : "") . " an diese E-Mail angehängt.\n\nUnd jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist {$priorityText}! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)\n\nDiese E-Mail wurde automatisch von ELMO generiert.";

        $mail->isHTML(true);
        $mail->Subject = "Neue ELMO Metadaten-Einreichung (ID: {$resource_id}, Priorität: {$priorityText})";
        $mail->Body = $htmlBody;
        $mail->AltBody = $plainBody;

        error_log("XML Submit: Sende E-Mail über GFZ SMTP an {$xmlSubmitAddress}");
        $mail->send();
        error_log("XML Submit: Curator mail sent successfully.");
    } catch (Exception $e) {
        error_log("XML Submit Curator Mail Error: " . $e->getMessage());

        // Failover recovery block logging
        $urgencyText = $urgencyWeeks ?? 'not set';
        $dataUrlText = $dataUrl ?: 'not provided';
        error_log("💁 FAILED XML SUBMISSION - ACTION REQUIRED \n" .
                  "==================================================\n" .
                  "📄 Resource ID: {$resource_id}\n" .
                  "⏰ Urgency: {$urgencyText}\n" .
                  "🔗 Data URL: {$dataUrlText}\n" .
                  "🚨 Error on submission: " . $e->getMessage() . "\n" .
                  "==================================================");

        ob_clean();
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => "Sorry, we encountered an error when sending the email:\n\n" .
                         $e->getMessage() . "\n\n" .
                         "Your data has been saved in our system with Resource ID: {$resource_id}\n\n" .
                         "Please contact the data curation team at {$xmlSubmitAddress}. In your Email, make sure to reference this Resource ID.\n\n" .
                         "Thank you for your understanding.\n" .
                         "ELMO team"
        ]);
        return;
    }

    // --- PIPELINE PART B: DISPATCH TO RESEARCHERS ---
    $researcherWarnings = [];

    if (!empty($researcherConfirmationData['invalidContacts'])) {
        $invalidAddresses = array_map(
            static fn(array $contact): string => $contact['fullName'] . ' <' . $contact['email'] . '>',
            $researcherConfirmationData['invalidContacts']
        );
        $warningMessage = 'WARNING: The data is sent to curators, but the contact adresses: '
            . implode(', ', $invalidAddresses)
            . ' were invalid!';
        error_log($warningMessage);
        $researcherWarnings[] = $warningMessage;
    }

    try {
        $researcherSendResult = sendResearcherConfirmationEmails($researcherConfirmationData, $simulateEmail);

        foreach ($researcherSendResult['failed'] as $failedContact) {
            $warningMessage = 'WARNING: The data is sent to curators, but confirmation email to '
                . $failedContact['fullName'] . ' <' . $failedContact['email'] . '> failed: '
                . $failedContact['error'];
            error_log($warningMessage);
            $researcherWarnings[] = $warningMessage;
        }
    } catch (Exception $e) {
        $warningMessage = 'WARNING: The data is sent to curators, but researcher confirmation emails failed: '
            . $e->getMessage();
        error_log($warningMessage);
        $researcherWarnings[] = $warningMessage;
    }

    $successMessage = empty($researcherWarnings)
        ? 'Backend reports: XML submission and confirmation emails sent successfully.'
        : 'Backend reports: XML submission sent to curators successfully. Some researcher confirmation emails could not be sent.';

    // All paths cleared cleanly
    error_log("send_xml_file.php: Processing complete. Outputting success JSON.");
    ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => $successMessage,
        'resource_id' => $resource_id,
        'simulated' => false,
        'researcher_warnings' => $researcherWarnings,
    ]);

} catch (Exception $e) {
    error_log("send_xml_file.php: Unexpected execution error: " . $e->getMessage());
    http_response_code(500);
    ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Unexpected submission error.',
        'resource_id' => $resource_id,
    ]);
}

// Flush output buffers cleanly
ob_end_flush();
?>