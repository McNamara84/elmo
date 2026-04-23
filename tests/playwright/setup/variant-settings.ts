import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

export type Variant = 'gem' | 'msl' | 'pure';

interface VariantConfig {
  showMslLabs: boolean;
  showMslVocabs: boolean;
  showMslLogo: boolean;
  showGGMsProperties: boolean;
  showUsedInstruments: boolean;
  showSpatialTemporalCoverage: boolean;
}

/**
 * Per-variant settings that are written into settings.php before each test run.
 * Values mirror the environment variables used by the CI multi-server setup.
 */
const VARIANT_SETTINGS: Record<Variant, VariantConfig> = {
  gem: {
    showMslLabs: false,
    showMslVocabs: false,
    showMslLogo: false,
    showGGMsProperties: true,
    showUsedInstruments: false,
    showSpatialTemporalCoverage: false,
  },
  msl: {
    showMslLabs: true,
    showMslVocabs: true,
    showMslLogo: true,
    showGGMsProperties: false,
    showUsedInstruments: false,
    showSpatialTemporalCoverage: true,
  },
  pure: {
    showMslLabs: false,
    showMslVocabs: false,
    showMslLogo: false,
    showGGMsProperties: false,
    showUsedInstruments: true,
    showSpatialTemporalCoverage: true,
  },
};

/** Path to settings.php, resolved from the project root via process.cwd(). */
const SETTINGS_PHP = path.join(process.cwd(), 'settings.php');

/**
 * Replaces `$varName = true/false;` assignments in settings.php.
 * Only touches plain boolean default assignments; filter_var() lines are
 * intentionally left untouched so env-var overrides still work in CI.
 */
function setBoolVar(content: string, varName: string, value: boolean): string {
  const phpVal = value ? 'true' : 'false';
  return content.replace(
    new RegExp(`(\\$${varName}\\s*=\\s*)(true|false)(;)`, 'g'),
    `$1${phpVal}$3`,
  );
}

/**
 * Applies the settings for the given variant to settings.php.
 * PHP re-reads the file on every request so no server restart is needed.
 */
export function applyVariantSettings(variant: Variant): void {
  let content = readFileSync(SETTINGS_PHP, 'utf-8');

  for (const [varName, value] of Object.entries(VARIANT_SETTINGS[variant])) {
    content = setBoolVar(content, varName, value);
  }

  writeFileSync(SETTINGS_PHP, content, 'utf-8');
  console.log(`\n[variant-setup] Applied ${variant.toUpperCase()} settings to settings.php`);
}
