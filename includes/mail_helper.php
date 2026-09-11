<?php

/**
 * Shared SMTP delivery helper for ELMO.
 *
 * All outgoing ELMO mails are described as a plain message array and handed to
 * sendElmoMail(). Recipient, subject, body and attachments are parameters, so
 * every caller shares one transport configuration and one failure contract.
 * Data Services submission mail text is built by generateEmailText().
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

require_once dirname(__DIR__) . '/vendor/phpmailer/phpmailer/src/Exception.php';
require_once dirname(__DIR__) . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
require_once dirname(__DIR__) . '/vendor/phpmailer/phpmailer/src/SMTP.php';

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
            throw new InvalidArgumentException("Invalid recipient address: " . ($address === '' ? '(empty)' : $address));
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
    global $smtpHost, $smtpPort, $smtpUser, $smtpPassword, $smtpAuth, $smtpSecure, $smtpSender;

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
 * Send one mail over the shared ELMO SMTP transport.
 *
 * Attachments are given either inline via `content` or as an existing file via
 * `path`; `filename` is always the name the recipient sees.
 *
 * @param array{
 *     to: string|array<mixed>,
 *     subject: string,
 *     html: string,
 *     text?: string,
 *     fromName?: string,
 *     replyTo?: array{address: string, name?: string},
 *     attachments?: array<int, array{filename: string, content?: string, path?: string}>
 * } $message Message definition.
 * @param bool $simulate When true the message is logged instead of transmitted.
 *
 * @throws InvalidArgumentException When the message definition is incomplete.
 * @throws PHPMailerException When SMTP delivery fails.
 */
function sendElmoMail(array $message, bool $simulate = false): void
{
    global $smtpSender;

    $recipients = normalizeElmoMailRecipients($message['to'] ?? []);
    $subject = trim((string) ($message['subject'] ?? ''));
    $html = (string) ($message['html'] ?? '');

    if ($subject === '' || $html === '') {
        throw new InvalidArgumentException('Mail message requires a subject and an HTML body.');
    }

    $addressList = implode(', ', array_column($recipients, 'address'));

    if ($simulate) {
        error_log("Mail (simulated): '{$subject}' to {$addressList}");
        return;
    }

    $mail = createElmoMailer();
    $mail->setFrom($smtpSender, (string) ($message['fromName'] ?? 'ELMO System'));

    foreach ($recipients as $recipient) {
        $mail->addAddress($recipient['address'], $recipient['name']);
    }

    $replyTo = trim((string) ($message['replyTo']['address'] ?? ''));
    if (filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $mail->addReplyTo($replyTo, (string) ($message['replyTo']['name'] ?? ''));
    }

    foreach ($message['attachments'] ?? [] as $attachment) {
        $filename = trim((string) ($attachment['filename'] ?? ''));
        if ($filename === '') {
            throw new InvalidArgumentException('Mail attachment requires a filename.');
        }

        if (isset($attachment['content'])) {
            $mail->addStringAttachment((string) $attachment['content'], $filename);
        } elseif (isset($attachment['path'])) {
            $mail->addAttachment((string) $attachment['path'], $filename);
        } else {
            throw new InvalidArgumentException("Mail attachment '{$filename}' has neither content nor path.");
        }

        error_log("Mail attachment added: {$filename}");
    }

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $html;
    $mail->AltBody = (string) ($message['text'] ?? strip_tags($html));

    error_log("Mail: sending '{$subject}' to {$addressList}");
    $mail->send();
    error_log("Mail: '{$subject}' sent to {$addressList}");
}

/**
 * Build the Data Services submission mail text.
 *
 * @param array{
 *   resourceId: int,
 *   urgencyWeeks: ?int,
 *   dataUrl: string,
 *   contactEmails: array<int, string>,
 *   icgemSubmitAddress: string,
 *   hasDataDescription: bool
 * } $context
 * @param array{showGGMsProperties?: bool, elmogemSendsDataServicesMail?: bool} $settings
 * @return array{subject: string, html: string, text: string, priorityText: string, shouldSendDataServicesMail: bool}
 */
function generateEmailText(array $context, array $settings = []): array
{
    if (!function_exists('resolveFileGenerationSettings')) {
        require_once __DIR__ . '/send_file_helper.php';
    }

    $resolvedSettings = resolveFileGenerationSettings(['doi' => $context['doi'] ?? ''], $settings);
    $resourceId = $context['resourceId'];
    $urgencyWeeks = $context['urgencyWeeks'];
    $dataUrl = $context['dataUrl'];
    $contactEmails = $context['contactEmails'];
    $showGGMsProperties = $resolvedSettings['showGGMsProperties'];
    $elmogemSendsDataServicesMail = $resolvedSettings['elmogemSendsDataServicesMail'];
    $icgemSubmitAddress = $context['icgemSubmitAddress'];
    $hasDataDescription = $context['hasDataDescription'];

    $urgencyText = $urgencyWeeks ? "{$urgencyWeeks} weeks" : 'not specified';
    $priorityText = getPriorityText($urgencyWeeks);

    if ($showGGMsProperties && !$elmogemSendsDataServicesMail) {
        return [
            'subject' => '',
            'html' => '',
            'text' => '',
            'priorityText' => $priorityText,
            'shouldSendDataServicesMail' => false,
        ];
    }

    $dataUrlText = $dataUrl !== '' ? $dataUrl : 'not provided';
    $contactEmailsText = !empty($contactEmails) ? implode(', ', $contactEmails) : 'not provided';
    $contactEmailsHtml = !empty($contactEmails)
        ? implode(', ', array_map(
            static fn(string $email): string => htmlspecialchars($email, ENT_QUOTES, 'UTF-8'),
            $contactEmails
        ))
        : 'not provided';

    $htmlBody = "\n        <h2>Neue Metadaten-Einreichung von ELMO</h2>\n        <p>Hallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:</p>\n        <ul>\n            <li><strong>Ressource ID in ELMO Datenbank:</strong> {$resourceId}</li>\n            <li><strong>Priorität:</strong> {$urgencyText} ({$priorityText})</li>\n            <li><strong>URL zu den Daten:</strong> " . ($dataUrl !== '' ? "<a href='{$dataUrl}'>{$dataUrl}</a>" : 'nicht angegeben') . "</li>\n            <li><strong>Contact email addresses provided by the author(s):</strong> {$contactEmailsHtml}</li>\n            <li><strong>Eingereicht am:</strong> " . date('d.m.Y H:i:s') . "</li>\n        </ul>\n        <p>Ich habe die Metadaten" . ($hasDataDescription ? ' und die Datenbeschreibung' : '') . " an diese E-Mail angehängt.</p>\n        <p>Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist <strong>{$priorityText}</strong>! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)</p>\n        <hr>\n        <p><small>Diese E-Mail wurde automatisch von ELMO generiert.</small></p>\n    ";

    $plainBody = "Neue Metadaten-Einreichung von ELMO\n\nHallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:\n\nRessource ID in ELMO Datenbank: {$resourceId}\nPriorität: {$urgencyText} ({$priorityText})\nURL zu den Daten: {$dataUrlText}\nContact email addresses provided by the author(s): {$contactEmailsText}\nEingereicht am: " . date('d.m.Y H:i:s') . "\n\nIch habe die Metadaten" . ($hasDataDescription ? ' und die Datenbeschreibung' : '') . " an diese E-Mail angehängt.\n\nUnd jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist {$priorityText}! Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)\n\nDiese E-Mail wurde automatisch von ELMO generiert.";

    if ($showGGMsProperties) {
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
        'priorityText' => $priorityText,
        'shouldSendDataServicesMail' => true,
    ];
}
