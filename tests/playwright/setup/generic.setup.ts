import { test as setup, expect } from '@playwright/test';
import { applyVariantSettings } from './variant-settings';

/**
 * ELMO-GENERIC setup:
 *   - Standard DataCite form groups only
 *   - Used Instruments (PID4INST) ON
 *   - All MSL-specific form groups OFF
 *   - GGMs Properties OFF
 *
 * Runs automatically before the 'generic' project via project dependencies.
 */
setup('configure ELMO-GENERIC variant', async ({ page, baseURL }) => {
  applyVariantSettings('generic');

  // A full page navigation is required: PHP re-reads settings.php on every
  // request, so the browser must load a fresh page to pick up the new values.
  await page.goto(baseURL!);
  await expect(page).toHaveTitle(/ELMO/i);

  // ── Variant verification ──────────────────────────────────────────────────
  // GGMs Properties form group must NOT be in the DOM (showGGMsProperties=false)
  await expect(page.locator('#group-ggmspropertiesessential')).not.toBeAttached();
  // MSL Originating Laboratory form group must NOT be in the DOM (showMslLabs=false)
  await expect(page.locator('#group-originatinglaboratory')).not.toBeAttached();
});
