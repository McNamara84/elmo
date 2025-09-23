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
    /** @var mysqli $connection */
    $connection = connectDb();
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
 * Handle the submission workflow and send the XML payload via email.
 */
function elmoHandleXmlSubmission(\mysqli $connection, array $smtpConfig, string $xmlSubmitAddress): void
{
    $resourceId = null;
    $urgencyWeeks = null;
    $dataUrl = '';
    $debuggingOutput = '';

    ob_start();

    try {
        $resourceId = saveResourceInformationAndRights($connection, $_POST);
        saveAuthors($connection, $_POST, $resourceId);
        saveContactPerson($connection, $_POST, $resourceId);
        saveContributorInstitutions($connection, $_POST, $resourceId);
        saveContributorPersons($connection, $_POST, $resourceId);
        saveDescriptions($connection, $_POST, $resourceId);
        saveKeywords($connection, $_POST, $resourceId);
        saveFreeKeywords($connection, $_POST, $resourceId);
        saveSpatialTemporalCoverage($connection, $_POST, $resourceId);
        saveRelatedWork($connection, $_POST, $resourceId);
        saveFundingReferences($connection, $_POST, $resourceId);

        $urgencyWeeks = isset($_POST['urgency']) ? (int)$_POST['urgency'] : null;
        $dataUrl = isset($_POST['dataUrl']) ? (string)filter_var($_POST['dataUrl'], FILTER_SANITIZE_URL) : '';

        if ($dataUrl !== '') {
            $dataUrl = trim($dataUrl);
            if (!preg_match('~^(?:f|ht)tps?://~i', $dataUrl)) {
                $dataUrl = 'https://' . $dataUrl;
            }
            if (!filter_var($dataUrl, FILTER_VALIDATE_URL)) {
                throw new RuntimeException('Invalid data URL provided');
            }
        }

        $datasetController = new DatasetController();

        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://';
        $baseUrl = $protocol . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $projectPath = isset($_SERVER['PHP_SELF']) ? rtrim(dirname($_SERVER['PHP_SELF']), '/') : '';
        $url = $baseUrl . $projectPath . '/api/v2/dataset/export/' . $resourceId . '/all';

        $xmlContent = @file_get_contents($url);
        if ($xmlContent !== false) {
            error_log("Submit: Fetched XML via API: {$url}");
        } else {
            error_log("Submit: File not found via the API. URL tried: {$url}. Turning to fallback logic -- generating the file on-the-fly");
            $xmlContent = $datasetController->envelopeXmlAsString($connection, $resourceId);
            if ($xmlContent === false) {
                error_log("Submit: Failed to retrieve XML content from API and in-memory. Endpoint: {$url}");
                $xmlContent = '';
            } else {
                error_log("Submit: Successfully generated XML file in-memory for resource_id {$resourceId}.");
            }
        }

        if (!testGfzSmtpConnectivity($smtpConfig['host'], $smtpConfig['port'])) {
            throw new RuntimeException('GFZ SMTP Server nicht erreichbar. Siehe Logs für Details.');
        }

        $mail = new PHPMailer(true);
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = static function (string $str) use (&$debuggingOutput): void {
            $debuggingOutput .= $str;
            error_log($str);
        };

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

        if (isset($_FILES['dataDescription']) && is_array($_FILES['dataDescription']) && ($_FILES['dataDescription']['error'] ?? null) === UPLOAD_ERR_OK) {
            $uploadedFile = $_FILES['dataDescription'];
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
        }

        if ($xmlContent === '') {
            throw new RuntimeException('XML content could not be generated.');
        }

        $mail->addStringAttachment($xmlContent, 'metadata_' . $resourceId . '.xml');
        error_log('XML Submit: Added XML attachment: metadata_' . $resourceId . '.xml');

        $urgencyText = $urgencyWeeks ? $urgencyWeeks . ' weeks' : 'not specified';
        $priorityText = getPriorityText($urgencyWeeks);
        $dataUrlText = $dataUrl !== '' ? $dataUrl : 'not provided';

        $htmlBody = "
        <h2>Neue Metadaten-Einreichung von ELMO</h2>
        <p>Hallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:</p>
        <ul>
            <li><strong>Ressource ID in ELMO Datenbank:</strong> {$resourceId}</li>
            <li><strong>Priorität:</strong> {$urgencyText} ({$priorityText})</li>
            <li><strong>URL zu den Daten:</strong> " . ($dataUrl !== '' ? "<a href='{$dataUrl}'>{$dataUrl}</a>" : 'nicht angegeben') . "</li>
            <li><strong>Eingereicht am:</strong> " . date('d.m.Y H:i:s') . "</li>
        </ul>
        <p>Ich habe die Metadaten" .
            (isset($_FILES['dataDescription']) ? ' und die Datenbeschreibung' : '') .
            " an diese E-Mail angehängt.</p>
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

        Ich habe die Metadaten" .
            (isset($_FILES['dataDescription']) ? ' und die Datenbeschreibung' : '') .
            " an diese E-Mail angehängt.

        Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist {$priorityText}! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)

        Diese E-Mail wurde automatisch von ELMO generiert.
        ";

        $mail->isHTML(true);
        $mail->Subject = 'Neue ELMO Metadaten-Einreichung (ID: ' . $resourceId . ', Priorität: ' . $priorityText . ')';
        $mail->Body = $htmlBody;
        $mail->AltBody = $plainBody;

        error_log('XML Submit: Sende E-Mail über GFZ SMTP an ' . $xmlSubmitAddress);
        $mail->send();
        error_log('XML Submit: E-Mail erfolgreich über GFZ SMTP versendet!');

        ob_clean();
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'message' => 'Metadaten gespeichert und E-Mail erfolgreich versendet!',
            'resource_id' => $resourceId,
        ]);
    } catch (Throwable $e) {
        error_log('XML Submit Error: ' . $e->getMessage());

        if ($resourceId !== null) {
            $backupFile = '/var/www/html/xml_submit_backup.txt';
            $backupEntry = '[' . date('Y-m-d H:i:s') . "] BACKUP XML SUBMISSION\n";
            $backupEntry .= 'Resource ID: ' . $resourceId . "\n";
            $backupEntry .= 'Error: ' . $e->getMessage() . "\n";
            $backupEntry .= 'Urgency: ' . ($urgencyWeeks ?? 'not set') . "\n";
            $backupEntry .= 'Data URL: ' . ($dataUrl !== '' ? $dataUrl : 'not provided') . "\n";
            $backupEntry .= str_repeat('=', 80) . "\n\n";

            file_put_contents($backupFile, $backupEntry, FILE_APPEND | LOCK_EX);
            error_log('XML Submit: Backup saved to ' . $backupFile);
        }

        ob_clean();
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Fehler: ' . $e->getMessage(),
            'debug' => $debuggingOutput,
        ]);
    } finally {
        ob_end_flush();
    }
}

if (!defined('ELMO_XML_SUBMISSION_SKIP_EXECUTION')) {
    elmoHandleXmlSubmission($connection, $smtpConfig, $xmlSubmitAddress);
}
