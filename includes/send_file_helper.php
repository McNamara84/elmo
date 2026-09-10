<?php

/**
 * Create XML filename from metadata.
 *
 * @param array<string, mixed> $postData
 */
function buildXmlAttachmentFilename(int $resourceId, array $postData): string
{
    $firstAuthor = $postData['familynames'][0] ?? 'unknown';
    $mainTitle = $postData['title'][0] ?? 'untitled';

    $abbreviateTitle = substr($mainTitle, 0, 30);

    $deUmlauts = ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'Ä' => 'Ae', 'Ö' => 'Oe', 'Ü' => 'Ue', 'ß' => 'ss'];
    $firstAuthor = str_replace(array_keys($deUmlauts), array_values($deUmlauts), $firstAuthor);
    $abbreviateTitle = str_replace(array_keys($deUmlauts), array_values($deUmlauts), $abbreviateTitle);

    setlocale(LC_ALL, 'en_US.UTF-8');
    $firstAuthor = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $firstAuthor) ?: $firstAuthor;
    $abbreviateTitle = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $abbreviateTitle) ?: $abbreviateTitle;

    $cleanAuthor = trim(preg_replace('/_+/', '_', preg_replace('/[^a-zA-Z0-9._-]/', '_', $firstAuthor)), '_') ?: 'unknown';
    $cleanTitle = trim(preg_replace('/_+/', '_', preg_replace('/[^a-zA-Z0-9._-]/', '_', $abbreviateTitle)), '_') ?: 'untitled';

    $currentDateTime = date('Y-m-d_H-i-s');

    return "metadata{$resourceId}-{$cleanAuthor}-{$cleanTitle}-{$currentDateTime}.xml";
}

/**
 * Add an XML string attachment to a PHPMailer instance.
 *
 * @param \PHPMailer\PHPMailer\PHPMailer $mail
 * @param array<string, mixed> $postData
 */
function createAndAttachXmlFile($mail, string $xmlContent, int $resourceId, array $postData): string
{
    $xmlFilename = buildXmlAttachmentFilename($resourceId, $postData);

    $mail->addStringAttachment($xmlContent, $xmlFilename);
    error_log('XML attachment added: ' . $xmlFilename);

    return $xmlFilename;
}

/**
 * Resolve the shared ELMO-GEM routing toggle inputs.
 *
 * @param array<string, mixed> $postData
 * @param array{showGGMsProperties?: bool, elmogemSendsDataServicesMail?: bool} $settings
 * @return array{showGGMsProperties: bool, elmogemSendsDataServicesMail: bool}
 */
function resolveFileGenerationSettings(array $postData, array $settings = []): array
{
    $showGGMsProperties = (bool) ($settings['showGGMsProperties'] ?? false);

    return [
        'showGGMsProperties' => $showGGMsProperties,
        'elmogemSendsDataServicesMail' => (bool) ($settings['elmogemSendsDataServicesMail']
            ?? (!$showGGMsProperties || trim((string) ($postData['doi'] ?? '')) === '')),
    ];
}

/**
 * Prepare the Data Services payload required by the submit workflow.
 *
 * @param array<string, mixed> $postData
 * @param array{showGGMsProperties?: bool, elmogemSendsDataServicesMail?: bool} $settings
 * @return array{
 *   dataServicesPayload: ?string,
 *   dataServicesPayloadData: ?array{payload: string, contentType: string, extension: string, generator: string},
 *   researcherConfirmationData: array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>},
 *   shouldSendDataServicesMail: bool
 * }
 */
function generateFile(int $resourceId, array $postData, array $settings = []): array
{
    $resolvedSettings = resolveFileGenerationSettings($postData, $settings);
    $showGGMsProperties = $resolvedSettings['showGGMsProperties'];
    $elmogemSendsDataServicesMail = $resolvedSettings['elmogemSendsDataServicesMail'];

    $generated = [
        'dataServicesPayload' => null,
        'dataServicesPayloadData' => null,
        'researcherConfirmationData' => [
            'title' => '',
            'contacts' => [],
            'invalidContacts' => [],
        ],
        'shouldSendDataServicesMail' => !$showGGMsProperties || $elmogemSendsDataServicesMail,
    ];

    if ($showGGMsProperties && !$elmogemSendsDataServicesMail) {
        return $generated;
    }

    if ($generated['shouldSendDataServicesMail']) {
        $dataServicesOptions = ['postData' => $postData];
        if ($showGGMsProperties) {
            $dataServicesOptions['variant'] = 'gfz';
        }

        $payloadData = generateDatasetPayloadByResourceId($resourceId, $dataServicesOptions);
        $xmlContent = $payloadData['payload'];

        if ($payloadData['generator'] === 'dataset-xml') {
            // Only require real controller if not already defined (e.g., via mock in tests)
            // Use false to prevent autoloader from loading real class
            if (!class_exists('DatasetController', false)) {
                require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
            }
            $datasetController = new DatasetController();
            $xmlContent = $datasetController->markDataCiteEnvelopeAsSubmitted($xmlContent, date('Y-m-d'));
        }

        if ($showGGMsProperties) {
            $xmlContent = applyElmoGemAdditionsToDataciteXml($xmlContent, true, true);
        }

        $generated['dataServicesPayload'] = $xmlContent;
        $generated['dataServicesPayloadData'] = [
            'payload' => $xmlContent,
            'contentType' => $payloadData['contentType'],
            'extension' => $payloadData['extension'],
            'generator' => $payloadData['generator'],
        ];
        $generated['researcherConfirmationData'] = collectResearcherConfirmationDataFromXml($generated['dataServicesPayload']);
    }

    return $generated;
}

/**
 * Prepare the ICGEM payload for ELMO-GEM submissions.
 *
 * @param array<string, mixed> $postData
 * @param array{showGGMsProperties?: bool, elmogemSendsDataServicesMail?: bool} $settings
 * @return array{
 *   icgemPayload: ?string,
 *   icgemPayloadData: ?array{payload: string, contentType: string, extension: string, generator: string},
 *   researcherConfirmationData: array{title: string, contacts: array<int, array{fullName: string, email: string}>, invalidContacts: array<int, array{fullName: string, email: string}>},
 *   shouldSendIcgemMail: bool
 * }
 */
function generateICGEMFile(int $resourceId, array $postData, array $settings = []): array
{
    $resolvedSettings = resolveFileGenerationSettings($postData, $settings);
    $showGGMsProperties = $resolvedSettings['showGGMsProperties'];

    $generated = [
        'icgemPayload' => null,
        'icgemPayloadData' => null,
        'researcherConfirmationData' => [
            'title' => '',
            'contacts' => [],
            'invalidContacts' => [],
        ],
        'shouldSendIcgemMail' => $showGGMsProperties,
    ];

    if (!$showGGMsProperties) {
        return $generated;
    }

    $payloadData = generateDatasetPayloadByResourceId($resourceId, [
        'postData' => $postData,
        'variant' => 'icgem',
    ]);
    $xmlContent = applyElmoGemAdditionsToDataciteXml($payloadData['payload'], true, false);

    $generated['icgemPayload'] = $xmlContent;
    $generated['icgemPayloadData'] = [
        'payload' => $xmlContent,
        'contentType' => $payloadData['contentType'],
        'extension' => $payloadData['extension'],
        'generator' => $payloadData['generator'],
    ];
    $generated['researcherConfirmationData'] = collectGGMsResearcherConfirmationDataFromXml($xmlContent);

    return $generated;
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