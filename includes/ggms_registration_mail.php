<?php

/**
 * ICGEM registration mail for ELMO-GEM.
 *
 * This file is an ELMO-GEM extension: it is only used when $showGGMsProperties
 * is true. Every other ELMO version keeps sending the single submission mail in
 * endpoints/send_xml_file.php untouched.
 *
 * The DOI field decides who hears about a model submission:
 *
 *   DOI empty   GFZ Data Services receives the usual submission mail at
 *               $xmlSubmitAddress (DatasetController envelope) and reserves a
 *               DOI; ICGEM is told to wait for that DOI before uploading the
 *               model to the ICGEM database.
 *   DOI filled  Only ICGEM is notified. The model can be uploaded to the ICGEM
 *               database straight away with the DOI supplied by the author.
 *
 * The ICGEM mail is sent through the shared sendElmoMail() transport. The Data
 * Services mail keeps the existing PHPMailer block in send_xml_file.php and only
 * appends a short GEM note via buildGGMsDataServicesNote().
 */

const GGMS_ICGEM_DATABASE_URL = 'https://icgem-test.gfz.de/database';

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
 * Note appended to the usual Data Services submission mail for ELMO-GEM.
 *
 * @param string $icgemAddress Address the reserved DOI has to be reported to.
 * @return array{html: string, text: string}
 */
function buildGGMsDataServicesNote(string $icgemAddress): array
{
    $html = '<hr>
        <p>These metadata originate from ELMO-GEM, the ELMO version used to describe global
        gravity field models for ICGEM. The author(s) did not supply a DOI.</p>
        <p><strong>Once the DOI is reserved, please communicate it to '
            . htmlspecialchars($icgemAddress, ENT_QUOTES, 'UTF-8') .
        '</strong> so the model can be uploaded to the ICGEM database.</p>';

    $text = "\n\nThese metadata originate from ELMO-GEM, the ELMO version used to describe global "
        . "gravity field models for ICGEM. The author(s) did not supply a DOI.\n"
        . "Once the DOI is reserved, please communicate it to {$icgemAddress} so the model can be "
        . "uploaded to the ICGEM database.";

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
 * Build the ICGEM mail that announces a new ELMO-GEM model submission.
 *
 * Sent for every GEM submission. `dataServicesEmailSent` is the single source of
 * truth for whether GFZ Data Services was asked for a DOI, and therefore whether
 * the model can already be uploaded to the ICGEM database.
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
    $databaseUrl = GGMS_ICGEM_DATABASE_URL;

    $fields = buildGGMsRegistrationFields($context);
    $fields['GFZ Data Services email sent'] = $dataServicesEmailSent ? 'true' : 'false';
    $rendered = renderGGMsRegistrationFields($fields);

    if ($dataServicesEmailSent) {
        $outlookHtml = '<p><strong>Next step:</strong> Please wait for the DOI generated by GFZ Data
            Services before uploading the model to the ICGEM database at
            <a href="' . htmlspecialchars($databaseUrl, ENT_QUOTES, 'UTF-8') . '">'
            . htmlspecialchars($databaseUrl, ENT_QUOTES, 'UTF-8') . '</a>.</p>';
        $outlookText = 'Next step: Please wait for the DOI generated by GFZ Data Services '
            . "before uploading the model to the ICGEM database at {$databaseUrl}.";
    } else {
        $doiClause = $doi !== ''
            ? 'The author(s) already provided the DOI ' . $doi . '.'
            : 'The author(s) already provided a DOI.';
        $outlookHtml = '<p><strong>Next step:</strong> '
            . htmlspecialchars($doiClause, ENT_QUOTES, 'UTF-8')
            . ' The upload to the ICGEM database can start straight away at
            <a href="' . htmlspecialchars($databaseUrl, ENT_QUOTES, 'UTF-8') . '">'
            . htmlspecialchars($databaseUrl, ENT_QUOTES, 'UTF-8') . '</a>.</p>';
        $outlookText = "Next step: {$doiClause} The upload to the ICGEM database can start "
            . "straight away at {$databaseUrl}.";
    }

    $html = '
        <h2>New gravity field model registration from ELMO-GEM</h2>
        ' . $rendered['html'] . '
        ' . $outlookHtml . '
        <p>The ICGEM metadata file is attached.</p>
        <hr>
        <p><small>This email was generated automatically by ELMO-GEM.</small></p>
    ';

    $text = "New gravity field model registration from ELMO-GEM\n\n"
        . $rendered['text'] . "\n\n"
        . $outlookText . "\n\n"
        . "The ICGEM metadata file is attached.\n\n"
        . "This email was generated automatically by ELMO-GEM.";

    return [
        'to' => $context['icgemAddress'] ?? '',
        'subject' => "ELMO-GEM model registration (Resource ID: {$resourceId})",
        'fromName' => 'ELMO-GEM Submission System',
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
    sendElmoMail(buildGGMsIcgemMessage($context, [[
        'filename' => (string) $context['icgemFilename'],
        'content' => (string) $context['icgemXml'],
    ]]));
}
