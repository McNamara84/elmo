import { test as setup, expect } from '@playwright/test';
import { applyVariantSettings } from './variant-settings';

/**
 * ELMO-MSL setup:
 *   - MSL Labs, MSL vocabularies, MSL logo ON
 *   - Spatial/temporal coverage ON
 *   - All general form groups ON (this project runs the full test suite)
 *
 * Runs automatically before the 'msl' project via project dependencies.
 */
setup('configure ELMO-MSL variant', async ({ page, baseURL }) => {
  applyVariantSettings('msl');

  // A full page navigation is required: PHP re-reads settings.php on every
  // request, so the browser must load a fresh page to pick up the new values.
  await page.goto(baseURL!);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/ELMO/i);

  // ── Variant verification ──────────────────────────────────────────────────
  // MSL Originating Laboratory form group must be present in the DOM (showMslLabs=true)
  const mslElement = await page.locator('#group-originatinglaboratory').count();
  if (mslElement === 0) {
    throw new Error('[VARIANT VERIFICATION FAILED] MSL: #group-originatinglaboratory should be present, but not found. Settings not applied correctly.');
  }
  // GGMs Properties form group must NOT be in the DOM (showGGMsProperties=false)
  const ggmsElement = await page.locator('#group-ggmspropertiesessential').count();
  if (ggmsElement > 0) {
    throw new Error('[VARIANT VERIFICATION FAILED] MSL: #group-ggmspropertiesessential should NOT be present, but found ' + ggmsElement + ' element(s). Settings not applied correctly.');
  }
  console.log('[variant-setup] ✓ MSL variant verified: MSL Laboratory present, GGMs Properties absent');
});
