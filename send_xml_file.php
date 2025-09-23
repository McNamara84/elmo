<?php

declare(strict_types=1);

/**
 * Script to save metadata and send it as XML via email.
 *
 * This script saves all form data to the database and sends the resulting
 * XML file as an email attachment along with a PDF description and additional
 * metadata via email.
 */

use PHPMailer\PHPMailer\PHPMailer;
use RuntimeException;
use Throwable;

error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__ . '/settings.php';
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
require_once __DIR__ . '/save/formgroups/save_fundingreferences.php';
require_once __DIR__ . '/includes/submit_helpers.php';
require_once __DIR__ . '/api/v2/controllers/DatasetController.php';

if (!isset($connection) || !($connection instanceof mysqli)) {
    if (!defined('ELMO_XML_SUBMISSION_SKIP_DB_CONNECT')) {
        /** @var mysqli $connection */
        $connection = connectDb();
    }
}

/** @var bool $showGGMsProperties */
$showGGMsProperties = isset($showGGMsProperties) ? (bool)$showGGMsProperties : false;
if ($showGGMsProperties) {
    require_once __DIR__ . '/save/formgroups/save_ggmsproperties.php';
}

/**
 * @var array{host:string, port:int, user:string, password:string, sender:string, secure:string, auth:bool} $smtpConfig
 */
$smtpConfig = normalizeSmtpSettings([
    'host' => $smtpHost ?? null,
    'port' => $smtpPort ?? null,
    'user' => $smtpUser ?? null,
    'password' => $smtpPassword ?? null,
    'sender' => $smtpSender ?? null,
    'secure' => $smtpSecure ?? null,
    'auth' => $smtpAuth ?? null,
]);

$xmlSubmitAddress = (string)($xmlSubmitAddress ?? '');

require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/Exception.php';
require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/SMTP.php';

/**
 * Validate and normalize a submitted data URL.
 */
function elmoValidateAndFormatDataUrl(?string $dataUrl): string
{
    if ($dataUrl === null) {
        return '';
    }

    $normalizedUrl = trim($dataUrl);

    if ($normalizedUrl === '') {
        return '';
    }

    if (preg_match('/\s/', $normalizedUrl)) {
        throw new RuntimeException('Invalid data URL provided');
    }

    if (!preg_match('~^[a-z][a-z0-9+\-.]*://~i', $normalizedUrl)) {
        $normalizedUrl = 'https://' . $normalizedUrl;
    }

    if (filter_var($normalizedUrl, FILTER_VALIDATE_URL) === false) {
        throw new RuntimeException('Invalid data URL provided');
    }

    $parts = parse_url($normalizedUrl);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host']) || $parts['host'] === '') {
        throw new RuntimeException('Invalid data URL provided');
    }

    return $normalizedUrl;
}

/**
 * Persist submission data and gather additional metadata.
 *
 * @return array{resourceId:int, urgencyWeeks:?int, dataUrl:string}
 */
function elmoPersistSubmission(\mysqli $connection, array $postData): array
{
    $resourceId = saveResourceInformationAndRights($connection, $postData);
    saveAuthors($connection, $postData, $resourceId);
    saveContactPerson($connection, $postData, $resourceId);
    saveContributorInstitutions($connection, $postData, $resourceId);
    saveContributorPersons($connection, $postData, $resourceId);
    saveDescriptions($connection, $postData, $resourceId);
    saveKeywords($connection, $postData, $resourceId);
    saveFreeKeywords($connection, $postData, $resourceId);
    saveSpatialTemporalCoverage($connection, $postData, $resourceId);
    saveRelatedWork($connection, $postData, $resourceId);
    saveFundingReferences($connection, $postData, $resourceId);

    $urgencyWeeks = isset($postData['urgency']) ? (int)$postData['urgency'] : null;
    $dataUrl = elmoValidateAndFormatDataUrl($postData['dataUrl'] ?? null);

    return [
        'resourceId' => $resourceId,
        'urgencyWeeks' => $urgencyWeeks,
        'dataUrl' => $dataUrl,
    ];
}

/**
 * Build the API URL used to fetch the generated XML document.
 */
function elmoBuildApiUrl(array $serverData, int $resourceId): string
{
    $protocol = isset($serverData['HTTPS']) && $serverData['HTTPS'] === 'on' ? 'https://' : 'http://';
    $host = $serverData['HTTP_HOST'] ?? 'localhost';
    $projectPath = isset($serverData['PHP_SELF']) ? rtrim(dirname($serverData['PHP_SELF']), '/') : '';

    return $protocol . $host . $projectPath . '/api/v2/dataset/export/' . $resourceId . '/all';
}

/**
 * Retrieve XML content via the API and fall back to on-the-fly generation if necessary.
 */
function elmoFetchXmlContent(
    DatasetController $datasetController,
    \mysqli $connection,
    int $resourceId,
    string $apiUrl
): string {
    $xmlContent = @file_get_contents($apiUrl);
    if ($xmlContent !== false) {
        error_log("Submit: Fetched XML via API: {$apiUrl}");

        return $xmlContent;
    }

    error_log("Submit: File not found via the API. URL tried: {$apiUrl}. Turning to fallback logic -- generating the file on-the-fly");

    $xmlContent = $datasetController->envelopeXmlAsString($connection, $resourceId);
    if ($xmlContent === false) {
        error_log("Submit: Failed to retrieve XML content from API and in-memory. Endpoint: {$apiUrl}");

        return '';
    }

    error_log("Submit: Successfully generated XML file in-memory for resource_id {$resourceId}.");

    return $xmlContent;
}

/**
 * Configure debugging callbacks for the mailer instance.
 */
function elmoSetupMailerDebugging(PHPMailer $mail, string &$debuggingOutput): void
{
    $mail->SMTPDebug = 2;
    $mail->Debugoutput = static function (string $str) use (&$debuggingOutput): void {
        $debuggingOutput .= $str;
        error_log($str);
    };
}

/**
 * Configure SMTP and sender information for the PHPMailer instance.
 */
function elmoConfigureMailer(PHPMailer $mail, array $smtpConfig, string $xmlSubmitAddress): void
{
    $mail->isSMTP();
    $mail->Host = $smtpConfig['host'];
    $mail->Port = $smtpConfig['port'];
    $mail->Timeout = 30;
    $mail->SMTPKeepAlive = false;

    $mail->SMTPAuth = $smtpConfig['auth'];
    if ($smtpConfig['auth']) {
        $mail->Username = $smtpConfig['user'];
        $mail->Password = $smtpConfig['password'];
    }

    if ($smtpConfig['secure'] === 'tls') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->SMTPAutoTLS = true;
    } else {
        $mail->SMTPAutoTLS = false;
    }

    $mail->CharSet = 'UTF-8';
    $mail->setFrom($smtpConfig['sender'], 'ELMO XML Submission System');
    $mail->addAddress($xmlSubmitAddress);
    $mail->addReplyTo($smtpConfig['sender'], 'ELMO System');
}

/**
 * Attach a user-provided data description to the mail if available.
 */
function elmoAttachDataDescription(PHPMailer $mail, array $filesData, int $resourceId): bool
{
    if (!isset($filesData['dataDescription']) || !is_array($filesData['dataDescription'])) {
        return false;
    }

    $uploadedFile = $filesData['dataDescription'];
    if (($uploadedFile['error'] ?? null) !== UPLOAD_ERR_OK) {
        return false;
    }

    $fileType = mime_content_type($uploadedFile['tmp_name']);
    $allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!in_array($fileType, $allowedTypes, true)) {
        throw new RuntimeException('Invalid file type. Only PDF, DOC, and DOCX files are allowed.');
    }

    if (($uploadedFile['size'] ?? 0) > 10 * 1024 * 1024) {
        throw new RuntimeException('File size exceeds maximum limit of 10MB.');
    }

    $fileExtension = strtolower(pathinfo((string)$uploadedFile['name'], PATHINFO_EXTENSION));

    $mail->addAttachment(
        $uploadedFile['tmp_name'],
        'data_description_' . $resourceId . '.' . $fileExtension
    );

    error_log('XML Submit: Added file attachment: data_description_' . $resourceId . '.' . $fileExtension);

    return true;
}

/**
 * Create the HTML and plain text mail bodies along with metadata summaries.
 *
 * @return array{html:string, plain:string, urgencyText:string, priorityText:string, dataUrlText:string}
 */
function elmoCreateMailBodies(int $resourceId, ?int $urgencyWeeks, string $dataUrl, bool $hasDescriptionAttachment): array
{
    $urgencyText = $urgencyWeeks ? $urgencyWeeks . ' weeks' : 'not specified';
    $priorityText = getPriorityText($urgencyWeeks);
    $dataUrlText = $dataUrl !== '' ? $dataUrl : 'not provided';

    $htmlDataUrl = $dataUrl !== '' ? "<a href='{$dataUrl}'>{$dataUrl}</a>" : 'nicht angegeben';
    $descriptionText = $hasDescriptionAttachment ? ' und die Datenbeschreibung' : '';

    $htmlBody = "
        <h2>Neue Metadaten-Einreichung von ELMO</h2>
        <p>Hallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:</p>
        <ul>
            <li><strong>Ressource ID in ELMO Datenbank:</strong> {$resourceId}</li>
            <li><strong>Priorität:</strong> {$urgencyText} ({$priorityText})</li>
            <li><strong>URL zu den Daten:</strong> {$htmlDataUrl}</li>
            <li><strong>Eingereicht am:</strong> " . date('d.m.Y H:i:s') . "</li>
        </ul>
        <p>Ich habe die Metadaten{$descriptionText} an diese E-Mail angehängt.</p>
        <p>Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist <strong>{$priorityText}</strong>! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)</p>
        <hr>
        <p><small>Diese E-Mail wurde automatisch von ELMO generiert.</small></p>
        ";

    $plainBody = "
        Neue Metadaten-Einreichung von ELMO

        Hallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:

        Ressource ID in ELMO Datenbank: {$resourceId}
        Priorität: {$urgencyText} ({$priorityText})
        URL zu den Daten: {$dataUrlText}
        Eingereicht am: " . date('d.m.Y H:i:s') . "

        Ich habe die Metadaten{$descriptionText} an diese E-Mail angehängt.

        Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist {$priorityText}! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)

        Diese E-Mail wurde automatisch von ELMO generiert.
        ";

    return [
        'html' => $htmlBody,
        'plain' => $plainBody,
        'urgencyText' => $urgencyText,
        'priorityText' => $priorityText,
        'dataUrlText' => $dataUrlText,
    ];
}

/**
 * Send a JSON response while cleaning up the output buffer.
 */
function elmoSendJsonResponse(array $payload, int $statusCode = 200): void
{
    ob_clean();
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($payload);
}

/**
 * Handle exceptions during submission by persisting a backup and returning an error response.
 */
function elmoHandleSubmissionException(
    Throwable $exception,
    ?int $resourceId,
    ?int $urgencyWeeks,
    string $dataUrl,
    string $debuggingOutput
): void {
    error_log('XML Submit Error: ' . $exception->getMessage());

    if ($resourceId !== null) {
        $backupFile = '/var/www/html/xml_submit_backup.txt';
        $backupEntry = '[' . date('Y-m-d H:i:s') . "] BACKUP XML SUBMISSION\n";
        $backupEntry .= 'Resource ID: ' . $resourceId . "\n";
        $backupEntry .= 'Error: ' . $exception->getMessage() . "\n";
        $backupEntry .= 'Urgency: ' . ($urgencyWeeks ?? 'not set') . "\n";
        $backupEntry .= 'Data URL: ' . ($dataUrl !== '' ? $dataUrl : 'not provided') . "\n";
        $backupEntry .= str_repeat('=', 80) . "\n\n";

        file_put_contents($backupFile, $backupEntry, FILE_APPEND | LOCK_EX);
        error_log('XML Submit: Backup saved to ' . $backupFile);
    }

    elmoSendJsonResponse([
        'success' => false,
        'message' => 'Fehler: ' . $exception->getMessage(),
        'debug' => $debuggingOutput,
    ], 500);
}

/**
 * Handle the submission workflow and send the XML payload via email.
 */
function elmoHandleXmlSubmission(
    \mysqli $connection,
    array $smtpConfig,
    string $xmlSubmitAddress,
    ?PHPMailer $mailer = null,
    ?array $postData = null,
    ?array $filesData = null,
    ?array $serverData = null
): void
{
    $resourceId = null;
    $urgencyWeeks = null;
    $dataUrl = '';
    $debuggingOutput = '';

    ob_start();

    try {
        $postData = $postData ?? $_POST;
        $filesData = $filesData ?? $_FILES;
        $serverData = $serverData ?? $_SERVER;

        $submissionData = elmoPersistSubmission($connection, $postData);
        $resourceId = $submissionData['resourceId'];
        $urgencyWeeks = $submissionData['urgencyWeeks'];
        $dataUrl = $submissionData['dataUrl'];

        $datasetController = new DatasetController();
        $apiUrl = elmoBuildApiUrl($serverData, $resourceId);
        $xmlContent = elmoFetchXmlContent($datasetController, $connection, $resourceId, $apiUrl);

        if (!testGfzSmtpConnectivity($smtpConfig['host'], $smtpConfig['port'])) {
            throw new RuntimeException('GFZ SMTP Server nicht erreichbar. Siehe Logs für Details.');
        }

        if ($xmlContent === '') {
            throw new RuntimeException('XML content could not be generated.');
        }

        $mail = $mailer ?? new PHPMailer(true);
        elmoSetupMailerDebugging($mail, $debuggingOutput);
        elmoConfigureMailer($mail, $smtpConfig, $xmlSubmitAddress);

        $hasDescriptionAttachment = elmoAttachDataDescription($mail, $filesData, $resourceId);

        $mail->addStringAttachment($xmlContent, 'metadata_' . $resourceId . '.xml');
        error_log('XML Submit: Added XML attachment: metadata_' . $resourceId . '.xml');

        $mailBodies = elmoCreateMailBodies($resourceId, $urgencyWeeks, $dataUrl, $hasDescriptionAttachment);

        $mail->isHTML(true);
        $mail->Subject = 'Neue ELMO Metadaten-Einreichung (ID: ' . $resourceId . ', Priorität: ' . $mailBodies['priorityText'] . ')';
        $mail->Body = $mailBodies['html'];
        $mail->AltBody = $mailBodies['plain'];

        error_log('XML Submit: Sende E-Mail über GFZ SMTP an ' . $xmlSubmitAddress);
        $mail->send();
        error_log('XML Submit: E-Mail erfolgreich über GFZ SMTP versendet!');

        elmoSendJsonResponse([
            'success' => true,
            'message' => 'Metadaten gespeichert und E-Mail erfolgreich versendet!',
            'resource_id' => $resourceId,
        ]);
    } catch (Throwable $e) {
        elmoHandleSubmissionException($e, $resourceId, $urgencyWeeks, $dataUrl, $debuggingOutput);
    } finally {
        ob_end_flush();
    }
}

if (!defined('ELMO_XML_SUBMISSION_SKIP_EXECUTION')) {
    elmoHandleXmlSubmission($connection, $smtpConfig, $xmlSubmitAddress);
}
