import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Per-variant config for ELMO-IGSN (Chrome).
 *
 * Usage:  npx playwright test --config=playwright.igsn.config.ts
 *
 * Applies IGSN settings to settings.php once (via the setup project), then
 * runs all IGSN tests in parallel across multiple workers for fast local feedback.
 *
 * TEST SCOPE:
 *   Same as generic: features, flows (excl. minimal-data-submission), shared
 *   formgroups — plus elmoisgn-specific formgroups.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080/';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  workers: undefined,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report/igsn' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'igsn-setup',
      testMatch: 'setup/igsn.setup.ts',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'igsn',
      dependencies: ['igsn-setup'],
      outputDir: 'test-results/igsn',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/*.spec.ts',
        'formgroups/*.spec.ts',
        'formgroups/elmoisgn-specific/**/*.spec.ts',
      ],
      testIgnore: [
        '**/minimal-data-submission.spec.ts',
      ],
    },
  ],
});
