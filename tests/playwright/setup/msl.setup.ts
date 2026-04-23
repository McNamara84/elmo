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
  await expect(page).toHaveTitle(/ELMO/i);

  // ── Variant verification ──────────────────────────────────────────────────
  // MSL Originating Laboratory form group must be present in the DOM (showMslLabs=true)
  await expect(page.locator('#group-originatinglaboratory')).toBeAttached();
  // GGMs Properties form group must NOT be in the DOM (showGGMsProperties=false)
  await expect(page.locator('#group-ggmspropertiesessential')).not.toBeAttached();
});
