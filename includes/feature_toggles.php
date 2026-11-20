<?php
/**
 * Feature Toggle Resolution for ELMO
 * 
 * Feature toggles are PHP boolean variables that should be defined in settings.php.
 * If a toggle is not defined, the default value specified here will be used.
 * 
 * Available toggles (define in settings.php):
 *   $showMslLabs          - Show MSL laboratory selection (default: true)
 *   $showMslVocabs        - Show MSL vocabulary keywords (default: false)
 *   $showContactInstitution - Allow an institution to be a contact (default: false)
 *   $showCoverage         - Show Spatial/Temporal Coverage section (default: true)
 *   $showFeedbackLink     - Show feedback button in footer (default: false)
 *   $showUsedInstruments  - Show Used Instruments / PID4INST selection (default: false)
 *   $showGGMsProperties   - Show ICGEM/GGMs specific fields (default: false)
 * 
 * Example in settings.php:
 *   $showMslLabs = true;
 *   $showFeedbackLink = true;
 * 
 * @see sample_settings.php for all available configuration options
 */

/**
 * Resolve the effective value for a feature toggle by falling back to a default
 * when the provided value is null.
 */
function resolveFeatureToggle(?bool $value, bool $default): bool
{
    return $value ?? $default;
}

// Translate the environment secret variables to the PHP used on application level.
// ELMO API Key
$ELMO_API_KEY = getenv('ELMO_API_KEY');
// Google Maps API Key
$apiKeyGoogleMaps = getenv('GOOGLE_MAPS_API_KEY');
// Google Maps Map ID (required for AdvancedMarkerElement)
$mapIdGoogleMaps = getenv('GOOGLE_MAPS_MAP_ID');
// API Key for https://timezonedb.com/
$apiKeyTimezone = getenv('TIMEZONE_API_KEY');

// ERNIE Integration (External Vocabulary Service)
$ernieUrl = getenv('ERNIE_URL');
$ernieApiKey = getenv('ERNIE_API_KEY');
// Cache TTL for all ERNIE data in seconds (default: 6 hours)

// Funder PID mode: 'CFID' = Crossref Funder ID (default), 'ROR' = ROR ID
$funderPidMode = getenv('FUNDER_PID') ?: 'CFID';

// URL for primary data upload (shown after successful submit)
$dataUploadUrl = getenv('DATA_UPLOAD_URL');


/**
 * Apply cross-feature overrides for specific ELMO GEM variant
 *
 * The override map is intentionally defined here so PHP rendering and JS
 * feature exposure can derive from one source of truth.
 */
function applyELMOGEMFeatureOverrides(array $features): array
{
    $variantOverrideMap = [
        'showGGMsProperties' => [
            // PID4INST is not part of the current ELMOGEM variant.
            'showUsedInstruments' => false,
            // Hide thesauri that are not relevant for ELMOGEM workflows.
            'thesauriHiddenKeys' => ['chronostratigraphy', 'gemet'],
        ],
    ];

    foreach ($variantOverrideMap as $variantFlag => $overrides) {
        if (($features[$variantFlag] ?? false) !== true) {
            continue;
        }

        foreach ($overrides as $key => $value) {
            if ($key === 'thesauriHiddenKeys') {
                $existing = $features[$key] ?? [];
                $existing = is_array($existing) ? $existing : [];
                $incoming = is_array($value) ? $value : [];
                $features[$key] = array_values(array_unique(array_merge($existing, $incoming)));
                continue;
            }

            $features[$key] = $value;
        }
    }

    if (!isset($features['thesauriHiddenKeys']) || !is_array($features['thesauriHiddenKeys'])) {
        $features['thesauriHiddenKeys'] = [];
    }

    return $features;
}
