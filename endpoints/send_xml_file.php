<?php

// Guard for PHPUnit
if (defined('PHPUNIT_RUNNING')) {
    return;
}

/**
 * Save metadata and email the resulting XML.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
session_start();
ob_start();

$projectRoot = dirname(__DIR__);

require_once $projectRoot . '/api/security.php';
require_once $projectRoot . '/settings.php';
require_once $projectRoot . '/includes/save_to_db_helper.php';
require_once $projectRoot . '/includes/SendFileHelper.php';
require_once $projectRoot . '/includes/mail_helper.php';
require_once $projectRoot . '/includes/ggms_registration_mail.php';
require_once $projectRoot . '/includes/feature_toggles.php';

global $connection, $showGGMsProperties;
global $xmlSubmitAddress, $icgemSubmitAddress;
global $SIMULATE_EMAIL;

$resource_id = null;

try {
    validateRequestSecurity('submit', $_POST);

    $dataUrl = isset($_POST['dataUrl']) ? trim((string) filter_var($_POST['dataUrl'], FILTER_SANITIZE_URL)) : '';
    if ($dataUrl !== '') {
        if (!preg_match('~^(?:f|ht)tps?://~i', $dataUrl)) {
            $dataUrl = 'https://' . $dataUrl;
        }
        if (!filter_var($dataUrl, FILTER_VALIDATE_URL)) {
            throw new RuntimeException('Invalid data URL provided');
        }
    }

    $settings = resolveFileGenerationSettings($_POST, [
        'showGGMsProperties' => (bool) $showGGMsProperties,
        'simulateEmail' => resolveFeatureToggle($SIMULATE_EMAIL ?? null, false),
        'xmlSubmitAddress' => $xmlSubmitAddress,
        'icgemSubmitAddress' => $icgemSubmitAddress,
        'urgencyWeeks' => isset($_POST['urgency']) ? intval($_POST['urgency']) : null,
        'dataUrl' => $dataUrl,
        'hasDataDescription' => isset($_FILES['dataDescription']) && $_FILES['dataDescription']['error'] === UPLOAD_ERR_OK,
    ]);

    try {
        $resource_id = saveALL($_POST);
    } catch (Throwable $e) {
        error_log('send_xml_file.php: Save operation failed: ' . $e->getMessage());
        ob_clean();
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Save operation failed: ' . $e->getMessage(),
        ]);
        return;
    }

    error_log('send_xml_file.php: All data saved successfully with Resource ID: ' . $resource_id);

    $generated = generateFile((int) $resource_id, $_POST, $settings);
    sendElmoMail($generated, generateEmailText($generated, $settings), $settings['xmlSubmitAddress'], $settings);

    if ($settings['showGGMsProperties']) {
        $generatedICGEM = generateICGEMFile((int) $resource_id, $_POST, $settings);
        sendElmoMail($generatedICGEM, generateICGEMText($generatedICGEM, $settings), $settings['icgemSubmitAddress'], $settings);
        $generated['researcherConfirmationData'] = $generatedICGEM['researcherConfirmationData'];
    }

    $researcherWarnings = [];
    try {
        $researcherSendResult = sendResearcherConfirmationEmails(
            $generated['researcherConfirmationData'],
            $settings
        );
        foreach ($researcherSendResult['failed'] as $failedContact) {
            $warningMessage = 'WARNING: The data is sent to curators, but confirmation email to '
                . $failedContact['fullName'] . ' <' . $failedContact['email'] . '> failed: '
                . $failedContact['error'];
            error_log($warningMessage);
            $researcherWarnings[] = $warningMessage;
        }
    } catch (Throwable $e) {
        $warningMessage = 'WARNING: The data is sent to curators, but researcher confirmation emails failed: '
            . $e->getMessage();
        error_log($warningMessage);
        $researcherWarnings[] = $warningMessage;
    }

    $successMessage = empty($researcherWarnings)
        ? 'Backend reports: XML submission and confirmation emails sent successfully.'
        : 'Backend reports: XML submission sent to curators successfully. Some researcher confirmation emails could not be sent.';

    ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => $successMessage,
        'resource_id' => $resource_id,
        'simulated' => (bool) $settings['simulateEmail'],
        'researcher_warnings' => $researcherWarnings,
    ]);
} catch (Throwable $e) {
    error_log('send_xml_file.php: ' . $e->getMessage());

    ob_clean();
    http_response_code(500);
    header('Content-Type: application/json');

    if ($resource_id !== null) {
        error_log(
            "FAILED XML SUBMISSION - ACTION REQUIRED\n"
            . "Resource ID: {$resource_id}\n"
            . 'Error: ' . $e->getMessage()
        );
        $curatorAddress = !empty($settings['showGGMsProperties']) ? $icgemSubmitAddress : $xmlSubmitAddress;
        echo json_encode([
            'success' => false,
            'message' => "Sorry, we encountered an error when sending the email:\n\n"
                . $e->getMessage()
                . "\n\nYour data has been saved in our system with Resource ID: {$resource_id}\n\n"
                . 'Please contact the data curation team at '
                . $curatorAddress
                . '. In your Email, make sure to reference this Resource ID.\n\n'
                . "Thank you for your understanding.\nELMO team",
            'resource_id' => $resource_id,
        ]);
        return;
    }

    echo json_encode([
        'success' => false,
        'message' => 'Unexpected submission error: ' . $e->getMessage(),
        'resource_id' => $resource_id,
    ]);
}

ob_end_flush();
