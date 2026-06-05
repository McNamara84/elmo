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