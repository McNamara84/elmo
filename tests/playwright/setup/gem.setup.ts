import { test as setup, expect } from '@playwright/test';
import { applyVariantSettings } from './variant-settings';

/**
 * ELMO-GEM setup:
 *   - GGMs Properties form group ON
 *   - Spatial/temporal coverage OFF
 *   - All MSL-specific form groups OFF
 *
 * Runs automatically before the 'gem' project via project dependencies.
 */
setup('configure ELMO-GEM variant', async ({ page, baseURL }) => {
  applyVariantSettings('gem');

  // A full page navigation is required: PHP re-reads settings.php on every
  // request, so the browser must load a fresh page to pick up the new values.
  await page.goto(baseURL!);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/ELMO/i);

  // ── Variant verification ──────────────────────────────────────────────────
  // GGMs Properties form group must be present in the DOM (showGGMsProperties=true)
  const ggmsElement = await page.locator('#group-ggmspropertiesessential').count();
  if (ggmsElement === 0) {
    throw new Error('[VARIANT VERIFICATION FAILED] GEM: #group-ggmspropertiesessential should be present, but not found. Settings not applied correctly.');
  }
  // MSL Originating Laboratory form group must NOT be in the DOM (showMslLabs=false)
  const mslElement = await page.locator('#group-originatinglaboratory').count();
  if (mslElement > 0) {
    throw new Error('[VARIANT VERIFICATION FAILED] GEM: #group-originatinglaboratory should NOT be present, but found ' + mslElement + ' element(s). Settings not applied correctly.');
  }
  console.log('[variant-setup] ✓ GEM variant verified: GGMs Properties present, MSL Laboratory absent');
});
