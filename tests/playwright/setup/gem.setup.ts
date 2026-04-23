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

  // Navigate to reload the app so the browser picks up the new settings.
  // PHP re-reads settings.php on every request, so no server restart is needed.
  await page.goto(baseURL!);
  await expect(page).toHaveTitle(/ELMO/i);
});
