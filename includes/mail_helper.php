<?php

/**
 * Shared SMTP delivery helper for ELMO.
 *
 * Submit mails are sent with sendElmoMail($generated, $text, $to, $settings).
 * Data Services text is generateEmailText(); ICGEM text is generateICGEMText().
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

require_once dirname(__DIR__) . '/vendor/phpmailer/phpmailer/src/Exception.php';
require_once dirname(__DIR__) . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once dirname(__DIR__) . '/vendor/phpmailer/phpmailer/src/SMTP.php';

if (!function_exists('resolveFileGenerationSettings')) {
    require_once __DIR__ . '/send_file_helper.php';
}

/**
 * Convert weeks to priority text.
 */
function getPriorityText(?int $weeks): string
{
    switch ($weeks) {
        case 2:
            return 'high';
        case 4:
            return 'normal';
        case 6:
            return 'low';
        default:
            return 'undefined';
    }
}

/**
 * Test GFZ SMTP connectivity.
 */
function testGfzSmtpConnectivity(): bool
{
    global $smtpHost, $smtpPort;

    error_log('=== GFZ SMTP Connectivity Test (XML Submit) ===');

    $ip = gethostbyname($smtpHost);
    error_log("DNS Resolution: {$smtpHost} -> {$ip}");

    $connection = @fsockopen($smtpHost, $smtpPort, $errno, $errstr, 10);
    if ($connection) {
        error_log("Port {$smtpPort} on {$smtpHost} is OPEN");
        fclose($connection);
        return true;
    }

    error_log("Port {$smtpPort} on {$smtpHost} is CLOSED or FILTERED. Error: {$errno} - {$errstr}");
    return false;
}

/**
 * Normalize a recipient definition into a list of address/name pairs.
 *
 * @param string|array<mixed> $recipients Single address, address/name pair, or a list of either.
 * @return array<int, array{address: string, name: string}>
 *
 * @throws InvalidArgumentException When no usable address is present.
 */
function normalizeElmoMailRecipients($recipients): array
{
    if (is_string($recipients)) {
        $recipients = [['address' => $recipients]];
    } elseif (isset($recipients['address'])) {
        $recipients = [$recipients];
    }

    if (!is_array($recipients) || $recipients === []) {
        throw new InvalidArgumentException('Mail message requires at least one recipient.');
    }

    $normalized = [];
    foreach ($recipients as $recipient) {
        $entry = is_string($recipient) ? ['address' => $recipient] : $recipient;
        $address = trim((string) ($entry['address'] ?? ''));

        if (!filter_var($address, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid recipient address: ' . ($address === '' ? '(empty)' : $address));
        }

        $normalized[] = [
            'address' => $address,
            'name' => trim((string) ($entry['name'] ?? '')),
        ];
    }

    return $normalized;
}

/**
 * Create a PHPMailer instance configured with the ELMO SMTP settings.
 *
 * @throws PHPMailerException When PHPMailer rejects the sender address.
 */
function createElmoMailer(): PHPMailer
{
    global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpAuth, $smtpSecure;

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

    if (strtolower((string) $smtpSecure) === 'tls') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->SMTPAutoTLS = true;
    } else {
        $mail->SMTPAutoTLS = false;
    }

    $mail->CharSet = 'UTF-8';

    return $mail;
}

/**
 * Send one submit mail: XML payload plus optional extra attachments.
 *
 * Skips when there is no HTML body (this track is unused). Throws when a body
 * is present but the XML payload is missing, or when SMTP delivery fails.
 *
 * @param array<string, mixed> $generated
 * @param array{subject?: string, html?: string, text?: string, fromName?: string} $text
 * @param array<string, mixed> $settings
 *
 * @throws RuntimeException When the payload is empty or delivery fails.
 */
function sendElmoMail(array $generated, array $text, string $to, array $settings): void
{
    global $smtpSender;

    $html = trim((string) ($text['html'] ?? ''));
    if ($html === '') {
        return;
    }

    $payload = $generated['payload'] ?? null;
    $filename = trim((string) ($generated['filename'] ?? ''));
    $simulate = (bool) ($settings['simulateEmail'] ?? false);

    try {
        if ($payload === null || trim((string) $payload) === '') {
            throw new RuntimeException('Generated XML payload is empty.');
        }

        $subject = trim((string) ($text['subject'] ?? ''));
        if ($subject === '') {
            throw new InvalidArgumentException('Mail message requires a subject.');
        }

        $recipients = normalizeElmoMailRecipients($to);
        $addressList = implode(', ', array_column($recipients, 'address'));

        $attachments = $generated['attachments'] ?? [];
        if ($filename !== '') {
            $attachments[] = [
                'filename' => $filename,
                'content' => (string) $payload,
            ];
        }

        if ($simulate) {
            error_log("Mail SIMULATED: '{$subject}' to {$addressList} if you see this in production, check the SIMULATE_EMAIL setting variable.");
            error_log("sendElmoMail: Payload (SIMULATION):\n" . $payload);
            return;
        }

        if (!testGfzSmtpConnectivity()) {
            throw new RuntimeException('GFZ SMTP Server nicht erreichbar. Siehe Logs für Details.');
        }

        $mail = createElmoMailer();
        $mail->setFrom($smtpSender, (string) ($text['fromName'] ?? 'ELMO System'));

        foreach ($recipients as $recipient) {
            $mail->addAddress($recipient['address'], $recipient['name']);
        }

        $replyTo = trim((string) $smtpSender);
        if (filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
            $mail->addReplyTo($replyTo, 'ELMO System');
        }

        foreach ($attachments as $attachment) {
            $attachmentName = trim((string) ($attachment['filename'] ?? ''));
            if ($attachmentName === '') {
                throw new InvalidArgumentException('Mail attachment requires a filename.');
            }

            if (isset($attachment['content'])) {
                $mail->addStringAttachment((string) $attachment['content'], $attachmentName);
            } elseif (isset($attachment['path'])) {
                $mail->addAttachment((string) $attachment['path'], $attachmentName);
            } else {
                throw new InvalidArgumentException("Mail attachment '{$attachmentName}' has neither content nor path.");
            }

            error_log("Mail attachment added: {$attachmentName}");
        }

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $html;
        $mail->AltBody = (string) ($text['text'] ?? strip_tags($html));

        error_log("Mail: sending '{$subject}' to {$addressList}");
        $mail->send();
        error_log("Mail: '{$subject}' sent to {$addressList}");
    } catch (Throwable $e) {
        throw new RuntimeException('sendElmoMail: ' . $e->getMessage(), 0, $e);
    }
}

/**
 * Build the Data Services submission mail text.
 *
 * @param array<string, mixed> $generated
 * @param array<string, mixed> $settings
 * @return array{subject: string, html: string, text: string, fromName: string}
 */
function generateEmailText(array $generated, array $settings = []): array
{
    $settings = resolveFileGenerationSettings(['doi' => $settings['doi'] ?? ''], $settings);

    $empty = [
        'subject' => '',
        'html' => '',
        'text' => '',
        'fromName' => 'ELMO XML Submission System',
    ];

    if (!$settings['elmogemSendsDataServicesMail']) {
        return $empty;
    }

    $resourceId = $generated['resourceId'] ?? '';
    $urgencyWeeks = $settings['urgencyWeeks'] ?? null;
    $dataUrl = (string) ($settings['dataUrl'] ?? '');
    $contactEmails = array_column($generated['researcherConfirmationData']['contacts'] ?? [], 'email');
    $icgemSubmitAddress = (string) ($settings['icgemSubmitAddress'] ?? '');
    $hasDataDescription = ($generated['attachments'] ?? []) !== []
        || (bool) ($settings['hasDataDescription'] ?? false);

    $urgencyText = $urgencyWeeks ? "{$urgencyWeeks} weeks" : 'not specified';
    $priorityText = getPriorityText($urgencyWeeks !== null ? (int) $urgencyWeeks : null);

    $dataUrlText = $dataUrl !== '' ? $dataUrl : 'not provided';
    $contactEmailsText = !empty($contactEmails) ? implode(', ', $contactEmails) : 'not provided';
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
            <li><strong>Ressource ID in ELMO Datenbank:</strong> {$resourceId}</li>
            <li><strong>Priorität:</strong> {$urgencyText} ({$priorityText})</li>
            <li><strong>URL zu den Daten:</strong> " . ($dataUrl !== '' ? "<a href='{$dataUrl}'>{$dataUrl}</a>" : 'nicht angegeben') . "</li>
            <li><strong>Contact email addresses provided by the author(s):</strong> {$contactEmailsHtml}</li>
            <li><strong>Eingereicht am:</strong> " . date('d.m.Y H:i:s') . "</li>
        </ul>
        <p>Ich habe die Metadaten" . ($hasDataDescription ? ' und die Datenbeschreibung' : '') . " an diese E-Mail angehängt.</p>
        <p>Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist <strong>{$priorityText}</strong>! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)</p>
        <hr>
        <p><small>Diese E-Mail wurde automatisch von ELMO generiert.</small></p>
    ";

    $plainBody = "Neue Metadaten-Einreichung von ELMO\n\nHallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:\n\nRessource ID in ELMO Datenbank: {$resourceId}\nPriorität: {$urgencyText} ({$priorityText})\nURL zu den Daten: {$dataUrlText}\nContact email addresses provided by the author(s): {$contactEmailsText}\nEingereicht am: " . date('d.m.Y H:i:s') . "\n\nIch habe die Metadaten" . ($hasDataDescription ? ' und die Datenbeschreibung' : '') . " an diese E-Mail angehängt.\n\nUnd jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist {$priorityText}! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)\n\nDiese E-Mail wurde automatisch von ELMO generiert.";

    if ($settings['showGGMsProperties']) {
        if (!function_exists('buildGGMsDataServicesNote')) {
            require_once __DIR__ . '/ggms_registration_mail.php';
        }
        $gemNote = buildGGMsDataServicesNote($icgemSubmitAddress);
        $htmlBody .= $gemNote['html'];
        $plainBody .= $gemNote['text'];
    }

    return [
        'subject' => "Neue ELMO Metadaten-Einreichung (ID: {$resourceId}, Priorität: {$priorityText})",
        'html' => $htmlBody,
        'text' => $plainBody,
        'fromName' => 'ELMO XML Submission System',
    ];
}

/**
 * Build the ICGEM registration mail text.
 *
 * @param array<string, mixed> $generated
 * @param array<string, mixed> $settings
 * @return array{subject: string, html: string, text: string, fromName: string}
 */
function generateICGEMText(array $generated, array $settings = []): array
{
    if (!function_exists('buildGGMsIcgemMessage')) {
        require_once __DIR__ . '/ggms_registration_mail.php';
    }

    $settings = resolveFileGenerationSettings(['doi' => $settings['doi'] ?? ''], $settings);
    $contacts = $generated['researcherConfirmationData']['contacts'] ?? [];

    $message = buildGGMsIcgemMessage([
        'resourceId' => $generated['resourceId'] ?? '',
        'title' => $generated['researcherConfirmationData']['title'] ?? '',
        'doi' => $settings['doi'] ?? '',
        'priorityText' => getPriorityText(isset($settings['urgencyWeeks']) ? (int) $settings['urgencyWeeks'] : null),
        'dataUrl' => (string) ($settings['dataUrl'] ?? ''),
        'contactEmails' => array_column($contacts, 'email'),
        'submittedAt' => date('d.m.Y H:i:s'),
        'icgemAddress' => $settings['icgemSubmitAddress'] ?? '',
        'elmogemSendsDataServicesMail' => (bool) $settings['elmogemSendsDataServicesMail'],
    ], []);

    return [
        'subject' => (string) $message['subject'],
        'html' => (string) $message['html'],
        'text' => (string) $message['text'],
        'fromName' => (string) ($message['fromName'] ?? 'ELMO-GEM Submission System'),
    ];
}

/**
 * Send confirmation emails to all researcher contacts.
 *
 * Failures are collected as warnings; they do not fail the submit.
 *
 * @param array{title?: string, contacts?: array<int, array{fullName?: string, email?: string}>} $researcherConfirmationData
 * @param array<string, mixed> $settings
 * @return array{sent: int, failed: array<int, array{fullName: string, email: string, error: string}>}
 */
function sendResearcherConfirmationEmails(array $researcherConfirmationData, array $settings = []): array
{
    $simulateEmail = (bool) ($settings['simulateEmail'] ?? false);
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
        $mail = createElmoMailer();
        global $smtpSender;

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_log("Researcher confirmation: Invalid email for {$fullName}.");
            $failed[] = [
                'fullName' => $fullName,
                'email' => $email === '' ? '(empty)' : $email,
                'error' => 'invalid email address',
            ];
            continue;
        }

        // Email simulation path
        if ($simulateEmail) {
            error_log("Simulating researcher confirmation email to {$fullName} <{$email}>.");
            $processedCount++;
            continue;
        }

        try {
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
        } catch (Throwable $e) {
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
