<?php
/**
 * Feature Toggle Resolution for ELMO
 * 
 * Feature toggles are PHP boolean variables that should be defined in settings.php.
 * If a toggle is not defined, the default value specified here will be used.
 * 
 * Available toggles (define in settings.php):
 *   $showMslMode          - MSL edition: logo, laboratory, keywords, default free keywords (default: false)
 *   $showContactInstitution - Allow an institution to be a contact (default: false)
 *   $showCoverage         - Show Spatial/Temporal Coverage section (default: true)
 *   $showFeedbackLink     - Show feedback button in footer (default: false)
 *   $showGGMsProperties   - Show ICGEM/GGMs specific fields (default: false)
 * 
 * Example in settings.php:
 *   $showMslMode = true;
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

/**
 * Values the browser may read. Pass flags after environment, settings, and variant overrides.
 * Anything omitted here stays on the server, including repository contact details and credentials.
 *
 * @param array<string, mixed> $resolved
 * @return array{
 *   showThesauri: bool,
 *   showMslMode: bool,
 *   showContactInstitution: bool,
 *   showGGMsProperties: bool,
 *   showUsedInstruments: bool,
 *   hiddenThesauri: list<string>,
 *   funderPidMode: string,
 *   dataUploadUrl: string,
 *   xmlSubmitAddress: string
 * }
 */
function JSVariables(array $resolved): array
{
    $bool = static function (string $key, bool $default) use ($resolved): bool {
        $value = $resolved[$key] ?? null;
        if (is_bool($value)) {
            return $value;
        }
        if (is_string($value) || is_int($value)) {
            $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($parsed !== null) {
                return $parsed;
            }
        }
        return $default;
    };

    $text = static function (string $key, string $default) use ($resolved): string {
        $value = $resolved[$key] ?? null;
        return is_string($value) ? $value : $default;
    };

    $hidden = $resolved['hiddenThesauri'] ?? [];
    $hiddenKeys = [];
    if (is_array($hidden)) {
        foreach ($hidden as $key) {
            if (is_string($key) && $key !== '') {
                $hiddenKeys[] = $key;
            }
        }
    }

    return [
        'showThesauri' => $bool('showThesauri', true),
        'showMslMode' => $bool('showMslMode', false),
        'showContactInstitution' => $bool('showContactInstitution', false),
        'showGGMsProperties' => $bool('showGGMsProperties', false),
        'showUsedInstruments' => $bool('showUsedInstruments', true),
        'hiddenThesauri' => array_values(array_unique($hiddenKeys)),
        'funderPidMode' => $text('funderPidMode', 'CFID'),
        'dataUploadUrl' => $text('dataUploadUrl', ''),
        'xmlSubmitAddress' => $text('xmlSubmitAddress', 'datapub@gfz.de'),
    ];
}

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
            // PID4INST is not part of the ELMO GEM edition.
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
