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

$projectRoot = dirname(__DIR__);

// Include security functions FIRST (before settings.php to avoid duplicate includes)
require_once $projectRoot . '/api/security.php';

// Include required files
require_once $projectRoot . '/settings.php';
require_once $projectRoot . '/includes/save_to_db_helper.php';
require_once $projectRoot . '/includes/send_file_helper.php';

// ELMO GEM extension: ICGEM registration mail (only when $showGGMsProperties)
require_once $projectRoot . '/includes/ggms_registration_mail.php';

// Make global variables from settings.php available
global $connection, $showGGMsProperties, $showUsedInstruments;
global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpAuth, $smtpSecure, $smtpSender;
global $xmlSubmitAddress, $icgemSubmitAddress;

error_log("send_xml_file.php: Globals set, connection: " . (isset($connection) ? 'set' : 'not set'));

// Include PHPMailer classes
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require_once $projectRoot . '/vendor/phpmailer/phpmailer/src/Exception.php';
require_once $projectRoot . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once $projectRoot . '/vendor/phpmailer/phpmailer/src/SMTP.php';

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
            error_log("Simulating researcher confirmation email to {$fullName} <{$email}>.");
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

/**
 * Send curator and ICGEM submission emails according to the generated file plan.
 *
 * @param array{
 *   dataServicesPayload: ?string,
 *   icgemPayload: ?string,
 *   researcherConfirmationData: array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>},
 *   shouldSendDataServicesMail: bool,
 *   shouldSendIcgemMail: bool
 * } $generatedFile
 * @param array<string, mixed> $context
 * @return array{dataServicesEmailSent: bool, icgemEmailSent: bool, simulated: bool}
 */
function sendSubmissionEmails(array $generatedFile, array $context): array
{
    global $showGGMsProperties;
    global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpAuth, $smtpSecure, $smtpSender;
    global $xmlSubmitAddress, $icgemSubmitAddress;

    $resourceId = (int) $context['resourceId'];
    $postData = $context['postData'];
    $simulateEmail = (bool) $context['simulateEmail'];
    $urgencyWeeks = $context['urgencyWeeks'];
    $dataUrl = (string) $context['dataUrl'];
    $researcherConfirmationData = $generatedFile['researcherConfirmationData'];

    if ($generatedFile['shouldSendDataServicesMail'] && empty(trim((string) $generatedFile['dataServicesPayload']))) {
        throw new Exception('Generated XML payload is empty.');
    }

    if ($generatedFile['shouldSendIcgemMail'] && empty(trim((string) $generatedFile['icgemPayload']))) {
        throw new Exception('Generated ICGEM XML payload is empty.');
    }

    if ($simulateEmail) {
        error_log('XML Submit: Simulation mode enabled - skipping curator and ICGEM SMTP send');
        return [
            'dataServicesEmailSent' => false,
            'icgemEmailSent' => false,
            'simulated' => true,
        ];
    }

    if (!testGfzSmtpConnectivity()) {
        throw new Exception('GFZ SMTP Server nicht erreichbar. Siehe Logs für Details.');
    }

    $dataServicesEmailSent = false;
    if ($generatedFile['shouldSendDataServicesMail']) {
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

        if (isset($_FILES['dataDescription']) && $_FILES['dataDescription']['error'] === UPLOAD_ERR_OK) {
            $uploadedFile = $_FILES['dataDescription'];
            $fileType = mime_content_type($uploadedFile['tmp_name']);
            $allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!in_array($fileType, $allowedTypes)) {
                throw new Exception('Invalid file type. Only PDF, DOC, and DOCX files are allowed.');
            }
            if ($uploadedFile['size'] > 10 * 1024 * 1024) {
                throw new Exception('File size exceeds maximum limit of 10MB.');
            }

            $fileExtension = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));
            $mail->addAttachment($uploadedFile['tmp_name'], 'data_description_' . $resourceId . '.' . $fileExtension);
            error_log('XML Submit: Added file attachment: data_description_' . $resourceId . '.' . $fileExtension);
        }

        createAndAttachXmlFile($mail, $generatedFile['dataServicesPayload'], $resourceId, $postData);

        $emailText = generateEmailText([
            'resourceId' => $resourceId,
            'urgencyWeeks' => $urgencyWeeks,
            'dataUrl' => $dataUrl,
            'contactEmails' => array_column($researcherConfirmationData['contacts'], 'email'),
            'showGGMsProperties' => (bool) $showGGMsProperties,
            'icgemSubmitAddress' => $icgemSubmitAddress,
            'hasDataDescription' => isset($_FILES['dataDescription']) && $_FILES['dataDescription']['error'] === UPLOAD_ERR_OK,
        ]);

        $mail->isHTML(true);
        $mail->Subject = $emailText['subject'];
        $mail->Body = $emailText['html'];
        $mail->AltBody = $emailText['text'];

        error_log('XML Submit: Sende E-Mail über GFZ SMTP an ' . $xmlSubmitAddress);
        $mail->send();
        $dataServicesEmailSent = true;
        error_log('XML Submit: Curator mail sent successfully.');
    }

    $icgemEmailSent = false;
    if ($generatedFile['shouldSendIcgemMail']) {
        sendGGMsIcgemRegistrationMail([
            'resourceId' => $resourceId,
            'title' => $researcherConfirmationData['title'],
            'doi' => trim((string) ($postData['doi'] ?? '')),
            'priorityText' => getPriorityText($urgencyWeeks),
            'dataUrl' => $dataUrl,
            'contactEmails' => array_column($researcherConfirmationData['contacts'], 'email'),
            'submittedAt' => date('d.m.Y H:i:s'),
            'icgemAddress' => $icgemSubmitAddress,
            'senderAddress' => $smtpSender,
            'dataServicesEmailSent' => $dataServicesEmailSent,
            'icgemXml' => $generatedFile['icgemPayload'],
            'icgemFilename' => buildXmlAttachmentFilename($resourceId, $postData),
        ]);
        $icgemEmailSent = true;
        error_log('XML Submit: ELMO GEM ICGEM registration mail sent. Data Services mail sent: '
            . ($dataServicesEmailSent ? 'true' : 'false') . '.');
    }

    return [
        'dataServicesEmailSent' => $dataServicesEmailSent,
        'icgemEmailSent' => $icgemEmailSent,
        'simulated' => false,
    ];
}

// Initialize execution variables
$dataUrl = '';
$urgencyWeeks = null;
$resource_id = null;

// ========= EXECUTION PIPELINE =========

try {
    error_log("send_xml_file.php: Try block started");

    validateRequestSecurity('submit', $_POST);

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

    $elmogemSendsDataServicesMail = !$showGGMsProperties || trim((string) ($_POST['doi'] ?? '')) === '';

    try {
        $resource_id = saveALL($_POST);
    } catch (\Throwable $e) {
        error_log("send_xml_file.php: Save operation failed: " . $e->getMessage());
        http_response_code(500);
        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Save operation failed: ' . $e->getMessage(),
        ]);
        return;
    }

    error_log('send_xml_file.php: All data saved successfully with Resource ID: ' . $resource_id);

    $generatedFile = generateFile((int) $resource_id, $_POST, [
        'showGGMsProperties' => (bool) $showGGMsProperties,
        'elmogemSendsDataServicesMail' => $elmogemSendsDataServicesMail,
    ]);
    $researcherConfirmationData = $generatedFile['researcherConfirmationData'];

    include_once $projectRoot . '/includes/feature_toggles.php';
    $simulateEmail = resolveFeatureToggle($SIMULATE_EMAIL ?? null, false);

    try {
        $submissionSendResult = sendSubmissionEmails($generatedFile, [
            'resourceId' => (int) $resource_id,
            'postData' => $_POST,
            'simulateEmail' => $simulateEmail,
            'urgencyWeeks' => $urgencyWeeks,
            'dataUrl' => $dataUrl,
        ]);
    } catch (Throwable $e) {
        error_log('XML Submit Mail Error: ' . $e->getMessage());

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
            'message' => "Sorry, we encountered an error when sending the email:\n\n"
                . $e->getMessage()
                . "\n\nYour data has been saved in our system with Resource ID: {$resource_id}\n\n"
                . 'Please contact the data curation team at '
                . ($showGGMsProperties ? $icgemSubmitAddress : $xmlSubmitAddress)
                . '. In your Email, make sure to reference this Resource ID.\n\n'
                . "Thank you for your understanding.\nELMO team",
        ]);
        return;
    }

    $dataServicesEmailSent = $submissionSendResult['dataServicesEmailSent'];

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

} catch (\Throwable $e) {
    error_log("send_xml_file.php: Unexpected execution error: " . $e->getMessage());
    http_response_code(500);
    ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Unexpected submission error: ' . $e->getMessage(),
        'resource_id' => $resource_id,
    ]);
}

// Flush output buffers cleanly
ob_end_flush();
?>