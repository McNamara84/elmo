import { test as setup, expect } from '@playwright/test';
import { applyVariantSettings } from './variant-settings';

/**
 * ELMO-IGSN setup:
 *   - Same settings as GENERIC variant
 *   - Used Instruments (PID4INST) ON
 *   - Free Keywords ON
 *   - Spatial/temporal coverage ON
 *   - Related Work ON
 *   - Thesauri ON
 *   - MSL and GEM extensions OFF
 *
 * Runs automatically before the 'igsn' project via project dependencies.
 */
setup('configure ELMO-IGSN variant', async ({ page, baseURL }) => {
  applyVariantSettings('igsn');

  // A full page navigation is required: PHP re-reads settings.php on every
  // request, so the browser must load a fresh page to pick up the new values.
  await page.goto(baseURL!);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveTitle(/ELMO/i);

  // ── Variant verification ──────────────────────────────────────────────────
  // GGMs Properties must NOT be in the DOM (showGGMsProperties=false)
  const ggmsEl = await page.locator('#group-ggmspropertiesessential').count();
  if (ggmsEl > 0) {
    throw new Error('[VARIANT VERIFICATION FAILED] IGSN: #group-ggmspropertiesessential should NOT be present, but found ' + ggmsEl + ' element(s). Settings not applied correctly.');
  }
  // MSL Originating Laboratory must NOT be in the DOM (showMslLabs=false)
  const mslEl = await page.locator('#group-originatinglaboratory').count();
  if (mslEl > 0) {
    throw new Error('[VARIANT VERIFICATION FAILED] IGSN: #group-originatinglaboratory should NOT be present, but found ' + mslEl + ' element(s). Settings not applied correctly.');
  }
  console.log('[variant-setup] ✓ IGSN variant verified: GGMs and MSL absent');
});
