<?php

/**
 * ICGEM registration mail for ELMO GEM.
 *
 * This file is an ELMO GEM extension: it is only used when $showGGMsProperties
 * is true. Every other ELMO version keeps sending the single submission mail in
 * endpoints/send_xml_file.php untouched.
 *
 * The DOI field decides who hears about a model submission:
 *
 *   DOI empty   GFZ Data Services receives the usual submission mail at
 *               $xmlSubmitAddress (DatasetController envelope) and reserves a
 *               DOI; ICGEM is told that the model ID follows once the primary
 *               data has arrived.
 *   DOI filled  Only ICGEM is notified. The model is published with that DOI, so
 *               no new DOI and no new model ID are created.
 *
 * The ICGEM mail is sent through the shared sendElmoMail() transport. The Data
 * Services mail keeps the existing PHPMailer block in send_xml_file.php and only
 * appends a short GEM note via buildGGMsDataServicesNote().
 */

require_once __DIR__ . '/mail_helper.php';

/**
 * Turn a "Last, First" name into "First Last" for use in a salutation.
 */
function formatGGMsContactName(string $rawName): string
{
    $fullName = trim($rawName);

    if ($fullName === '') {
        return 'researcher';
    }

    if (strpos($fullName, ',') !== false) {
        $nameParts = array_map('trim', explode(',', $fullName, 2));
        $fullName = trim(($nameParts[1] ?? '') . ' ' . $nameParts[0]);
    }

    return $fullName !== '' ? $fullName : 'researcher';
}

/**
 * Extract title and researcher contacts from an ICGEM envelope.
 *
 * The ICGEM schema keeps contact emails in grav:contact/grav:address, not in an
 * ISO pointOfContact block, so the standard ELMO extraction finds nothing here.
 * Names come from the embedded DataCite ContactPerson contributors, which are
 * written in the same order as the addresses.
 *
 * @param string $xmlContent Raw ICGEM envelope XML.
 * @return array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>}
 */
function collectGGMsResearcherConfirmationDataFromXml(string $xmlContent): array
{
    $title = '';
    $contacts = [];
    $invalidContacts = [];
    $seen = [];

    if (trim($xmlContent) === '') {
        error_log('ELMO GEM confirmation: ICGEM XML content is empty.');
        return ['title' => $title, 'contacts' => $contacts, 'invalidContacts' => $invalidContacts];
    }

    try {
        $xml = new SimpleXMLElement($xmlContent);

        $titleNodes = $xml->xpath('//*[local-name()="titles"]/*[local-name()="title"]');
        if (!empty($titleNodes)) {
            $title = trim((string) $titleNodes[0]);
        }

        $names = [];
        $contactPersonNodes = $xml->xpath(
            '//*[local-name()="contributor"][@contributorType="ContactPerson"]/*[local-name()="contributorName"]'
        );
        foreach ($contactPersonNodes ?: [] as $contactPersonNode) {
            $names[] = formatGGMsContactName((string) $contactPersonNode);
        }

        $addressNodes = $xml->xpath('//*[local-name()="contact"]/*[local-name()="address"]');

        foreach ($addressNodes ?: [] as $index => $addressNode) {
            $email = trim((string) $addressNode);
            $fullName = $names[$index] ?? 'researcher';

            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $invalidContacts[] = [
                    'fullName' => $fullName,
                    'email' => $email === '' ? '(empty)' : $email,
                ];
                continue;
            }

            $key = mb_strtolower($fullName) . '|' . mb_strtolower($email);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $contacts[] = ['fullName' => $fullName, 'email' => $email];
        }

        error_log('ELMO GEM confirmation: Extracted ' . count($contacts) . ' contact(s) from ICGEM XML.');
    } catch (Exception $e) {
        error_log('ELMO GEM confirmation: Failed to parse ICGEM XML. ' . $e->getMessage());
    }

    return ['title' => $title, 'contacts' => $contacts, 'invalidContacts' => $invalidContacts];
}

/**
 * Validate the optional data description upload and turn it into an attachment.
 *
 * @param array<string, mixed>|null $uploadedFile Entry from $_FILES.
 * @return array{filename: string, path: string}|null Null when nothing was uploaded.
 *
 * @throws Exception When the upload is not an accepted document or too large.
 */
function buildGGMsDocumentAttachment(?array $uploadedFile, int $resourceId): ?array
{
    if ($uploadedFile === null || ($uploadedFile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return null;
    }

    $allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!in_array(mime_content_type($uploadedFile['tmp_name']), $allowedTypes, true)) {
        throw new Exception('Invalid file type. Only PDF, DOC, and DOCX files are allowed.');
    }

    if ($uploadedFile['size'] > 10 * 1024 * 1024) {
        throw new Exception('File size exceeds maximum limit of 10MB.');
    }

    $fileExtension = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));

    return [
        'filename' => "data_description_{$resourceId}.{$fileExtension}",
        'path' => $uploadedFile['tmp_name'],
    ];
}

/**
 * Note appended to the usual Data Services submission mail for ELMO GEM.
 *
 * @param string $icgemAddress Address the reserved DOI has to be reported to.
 * @return array{html: string, text: string}
 */
function buildGGMsDataServicesNote(string $icgemAddress): array
{
    $html = '<hr>
        <p>These metadata originate from ElmoGen, the ELMO version used to describe global
        gravity field models for ICGEM. The author(s) did not supply a DOI.</p>
        <p><strong>Once the DOI is reserved, please communicate it to '
            . htmlspecialchars($icgemAddress, ENT_QUOTES, 'UTF-8') .
        '</strong> so the model can be registered in the ICGEM database.</p>';

    $text = "\n\nThese metadata originate from ElmoGen, the ELMO version used to describe global "
        . "gravity field models for ICGEM. The author(s) did not supply a DOI.\n"
        . "Once the DOI is reserved, please communicate it to {$icgemAddress} so the model can be "
        . "registered in the ICGEM database.";

    return ['html' => $html, 'text' => $text];
}

/**
 * Render a label/value map as an HTML list and as plain text lines.
 *
 * @param array<string, string> $fields Labels mapped to plain values.
 * @return array{html: string, text: string}
 */
function renderGGMsRegistrationFields(array $fields): array
{
    $htmlItems = [];
    $textLines = [];

    foreach ($fields as $label => $value) {
        $htmlItems[] = '<li><strong>' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . ':</strong> '
            . htmlspecialchars($value, ENT_QUOTES, 'UTF-8') . '</li>';
        $textLines[] = $label . ': ' . $value;
    }

    return [
        'html' => '<ul>' . implode('', $htmlItems) . '</ul>',
        'text' => implode("\n", $textLines),
    ];
}

/**
 * Collect the submission facts the ICGEM mail reports.
 *
 * @param array<string, mixed> $context Submission context.
 * @return array<string, string>
 */
function buildGGMsRegistrationFields(array $context): array
{
    $contactEmails = $context['contactEmails'] ?? [];

    return [
        'ELMO Resource ID' => (string) ($context['resourceId'] ?? ''),
        'Model title' => ($context['title'] ?? '') !== '' ? (string) $context['title'] : 'not provided',
        'DOI' => ($context['doi'] ?? '') !== '' ? (string) $context['doi'] : 'not provided',
        'Priority' => (string) ($context['priorityText'] ?? 'undefined'),
        'URL to primary data' => ($context['dataUrl'] ?? '') !== '' ? (string) $context['dataUrl'] : 'not provided',
        'Contact addresses provided by the author(s)' => !empty($contactEmails)
            ? implode(', ', $contactEmails)
            : 'not provided',
        'Submitted at' => (string) ($context['submittedAt'] ?? ''),
    ];
}

/**
 * Build the ICGEM mail that registers the model.
 *
 * Sent for every GEM submission. `dataServicesEmailSent` is the single source of
 * truth for whether GFZ Data Services was asked for a DOI.
 *
 * @param array<string, mixed> $context Submission context.
 * @param array<int, array{filename: string, content?: string, path?: string}> $attachments
 * @return array<string, mixed> Message definition for sendElmoMail().
 */
function buildGGMsIcgemMessage(array $context, array $attachments): array
{
    $resourceId = (string) ($context['resourceId'] ?? '');
    $doi = (string) ($context['doi'] ?? '');
    $dataServicesEmailSent = (bool) ($context['dataServicesEmailSent'] ?? false);

    $fields = buildGGMsRegistrationFields($context);
    $fields['GFZ Data Services email sent'] = $dataServicesEmailSent ? 'true' : 'false';
    $rendered = renderGGMsRegistrationFields($fields);

    if ($dataServicesEmailSent) {
        $outlookHtml = '<p>A DOI has been requested from GFZ Data Services. The model ID will be
            generated once the primary data has been received.</p>';
        $outlookText = 'A DOI has been requested from GFZ Data Services. '
            . 'The model ID will be generated once the primary data has been received.';
    } else {
        $doiText = $doi !== '' ? "the existing DOI {$doi}" : 'the existing DOI supplied by the author(s)';
        $outlookHtml = '<p>The model is published with ' . htmlspecialchars($doiText, ENT_QUOTES, 'UTF-8')
            . '. No new DOI and no new model ID are generated.</p>';
        $outlookText = "The model is published with {$doiText}. No new DOI and no new model ID are generated.";
    }

    $html = '
        <h2>New gravity field model registration from ElmoGen</h2>
        ' . $rendered['html'] . '
        ' . $outlookHtml . '
        <p>The ICGEM metadata file is attached.</p>
        <hr>
        <p><small>This email was generated automatically by ELMO.</small></p>
    ';

    $text = "New gravity field model registration from ElmoGen\n\n"
        . $rendered['text'] . "\n\n"
        . $outlookText . "\n\n"
        . "The ICGEM metadata file is attached.\n\n"
        . "This email was generated automatically by ELMO.";

    return [
        'to' => $context['icgemAddress'] ?? '',
        'subject' => "ElmoGen model registration (Resource ID: {$resourceId})",
        'fromName' => 'ELMO GEM Submission System',
        'replyTo' => ['address' => (string) ($context['senderAddress'] ?? ''), 'name' => 'ELMO System'],
        'html' => $html,
        'text' => $text,
        'attachments' => $attachments,
    ];
}

/**
 * Send the ICGEM registration mail for one ELMO GEM submission.
 *
 * @param array<string, mixed> $context Submission context. Expects at least
 *        `resourceId`, `icgemAddress`, `icgemXml`, `icgemFilename` and
 *        `dataServicesEmailSent`.
 *
 * @throws Exception When the mail could not be delivered.
 */
function sendGGMsIcgemRegistrationMail(array $context): void
{
    $attachments = [];

    if (!empty($context['documentAttachment'])) {
        $attachments[] = $context['documentAttachment'];
    }

    $attachments[] = [
        'filename' => (string) $context['icgemFilename'],
        'content' => (string) $context['icgemXml'],
    ];

    sendElmoMail(buildGGMsIcgemMessage($context, $attachments));
}
