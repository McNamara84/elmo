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
  await expect(page).toHaveTitle(/ELMO/i);

  // ── Variant verification ──────────────────────────────────────────────────
  // GGMs Properties form group must be present in the DOM (showGGMsProperties=true)
  await expect(page.locator('#group-ggmspropertiesessential')).toBeAttached();
  // MSL Originating Laboratory form group must NOT be in the DOM (showMslLabs=false)
  await expect(page.locator('#group-originatinglaboratory')).not.toBeAttached();
});
