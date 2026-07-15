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
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/ELMO/i);

  // ── Variant verification ──────────────────────────────────────────────────
  // GGMs Properties form group must NOT be in the DOM (showGGMsProperties=false)
  // Note: Use waitForSelector with timeout=0 to verify absence (no timeout error)
  const ggmsElement = await page.locator('#group-ggmspropertiesessential').count();
  if (ggmsElement > 0) {
    throw new Error('[VARIANT VERIFICATION FAILED] GENERIC: #group-ggmspropertiesessential should NOT be present, but found ' + ggmsElement + ' element(s). Settings not applied correctly.');
  }
  const mslElement = await page.locator('#group-originatinglaboratory').count();
  if (mslElement > 0) {
    throw new Error('[VARIANT VERIFICATION FAILED] GENERIC: #group-originatinglaboratory should NOT be present, but found ' + mslElement + ' element(s). Settings not applied correctly.');
  }
  console.log('[variant-setup] ✓ GENERIC variant verified: correct form groups present');
});
