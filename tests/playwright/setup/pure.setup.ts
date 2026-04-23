import { test as setup, expect } from '@playwright/test';
import { applyVariantSettings } from './variant-settings';

/**
 * ELMO-PURE setup:
 *   - Standard DataCite form groups only
 *   - Used Instruments (PID4INST) ON
 *   - All MSL-specific form groups OFF
 *   - GGMs Properties OFF
 *
 * Runs automatically before the 'pure' project via project dependencies.
 */
setup('configure ELMO-PURE variant', async ({ page, baseURL }) => {
  applyVariantSettings('pure');

  // Navigate to reload the app so the browser picks up the new settings.
  // PHP re-reads settings.php on every request, so no server restart is needed.
  await page.goto(baseURL!);
  await expect(page).toHaveTitle(/ELMO/i);
});
