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

  // Navigate to reload the app so the browser picks up the new settings.
  // PHP re-reads settings.php on every request, so no server restart is needed.
  await page.goto(baseURL!);
  await expect(page).toHaveTitle(/ELMO/i);
});
