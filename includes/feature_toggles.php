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
 *   $showContributorPersons   - Show Contributor Persons section (default: true)
 *   $showContributorInstitutions - Show Contributor Institutions section (default: true)
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