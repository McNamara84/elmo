<?php

/**
 * Shared SMTP delivery helper for ELMO.
 *
 * All outgoing ELMO mails are described as a plain message array and handed to
 * sendElmoMail(). Recipient, subject, body and attachments are parameters, so
 * every caller shares one transport configuration and one failure contract.
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
