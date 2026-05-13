import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Per-variant config for ELMO-GENERIC (Chrome).
 *
 * Usage:  npx playwright test --config=playwright.generic.config.ts
 *
 * Applies GENERIC settings to settings.php once (via the setup project), then
 * runs all generic tests in parallel across multiple workers for fast local feedback.
 *
 * TEST SCOPE:
 *   features, flows (all incl. minimal-data-submission), shared formgroups
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080/';

export default defineConfig({
  testDir: './tests/playwright',
  // Setup applies settings once → safe to parallelise all tests within this variant
  fullyParallel: true,
  workers: undefined, // use all available CPU cores
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report/generic' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'generic-setup',
      testMatch: 'setup/generic.setup.ts',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'generic',
      dependencies: ['generic-setup'],
      outputDir: 'test-results/generic',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/*.spec.ts',
        'formgroups/*.spec.ts',
      ],
    },
  ],
});
