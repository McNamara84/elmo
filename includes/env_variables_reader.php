<?php
// Translate the environment secret variables to the PHP used on application level.

if (!function_exists('getenv_with_warning')) {
    /**
     * Read an environment variable. Log when it is missing, and use $default when one is given.
     */
    function getenv_with_warning(string $varName, string $default = ''): string|false
    {
        $value = getenv($varName);
        if ($value === false) {
            error_log("Warning: Environment variable $varName is not set.");
            if ($default !== '') {
                error_log("Using default value: $default");
                return $default;
            }
        }
        return $value;
    }
}

// ELMO API Key
$ELMO_API_KEY = getenv_with_warning('ELMO_API_KEY');
// Google Maps API Key
$apiKeyGoogleMaps = getenv_with_warning('GOOGLE_MAPS_API_KEY');
// Google Maps Map ID (required for AdvancedMarkerElement)
$mapIdGoogleMaps = getenv_with_warning('GOOGLE_MAPS_MAP_ID');
// API Key for https://timezonedb.com/
$apiKeyTimezone = getenv_with_warning('TIMEZONE_API_KEY');

// ERNIE Integration (External Vocabulary Service)
$ernieUrl = getenv_with_warning('ERNIE_URL');
$ernieApiKey = getenv_with_warning('ERNIE_API_KEY');

// Funder PID mode: 'CFID' = Crossref Funder ID (default), 'ROR' = ROR ID
$funderPidMode = getenv_with_warning('FUNDER_PID', 'CFID');

// URL for primary data upload (shown after successful submit)
$dataUploadUrl = getenv_with_warning('DATA_UPLOAD_URL');


// SETTING FOR MSL MODE
// filter_var: the string "false" is truthy if it is later cast to bool.
$showMslMode = filter_var(getenv_with_warning('SHOW_MSL_MODE', 'false'), FILTER_VALIDATE_BOOLEAN);

// SETTINGS FOR ICGEM
$showGGMsProperties = filter_var(
    getenv_with_warning('SHOW_GGMS_PROPERTIES', 'false'),
    FILTER_VALIDATE_BOOLEAN
);
// ELMO-GEM only ($showGGMsProperties). Other variants always mail researchers.
// true: send confirmation emails to contact persons. false: do not email them.
$sendResearcherConfirmationEmail = filter_var(
    getenv_with_warning('SEND_RESEARCHER_CONFIRMATION_EMAIL', 'true'),
    FILTER_VALIDATE_BOOLEAN
);
// ELMO-GEM only ($showGGMsProperties). Upload page linked from the ICGEM registration mail.
// Empty means the mail falls back to the test database URL.
$icgemDatabaseUrl = getenv_with_warning('ICGEM_UPLOAD_URL');

// SMTP and mail addresses are set in the container environment.
$smtpHost = getenv_with_warning('SMTP_HOST', 'your_smtp_host');
$smtpPort = (int) getenv_with_warning('SMTP_PORT', '465');
$smtpUser = getenv_with_warning('SMTP_USER') ?: '';
$smtpPassword = getenv_with_warning('SMTP_PASSWORD') ?: '';
$smtpSender = getenv_with_warning('SMTP_SENDER', 'your_smtp_sender_email');
$smtpSecure = getenv_with_warning('SMTP_SECURE') ?: '';
$smtpAuth = getenv_with_warning('SMTP_AUTH') ?: '';
$feedbackAddress = getenv_with_warning('FEEDBACK_ADDRESS', 'feedback@example.com');
$xmlSubmitAddress = getenv_with_warning('XML_SUBMIT_ADDRESS', 'xmlsubmit@example.com');
$icgemSubmitAddress = getenv_with_warning('ICGEM_SUBMIT_ADDRESS', 'icgem@gfz.de');
