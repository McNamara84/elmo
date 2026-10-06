import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Per-variant config for ELMO-MSL (Safari).
 *
 * Usage:  npx playwright test --config=playwright.msl.config.ts
 *
 * Applies MSL settings to settings.php once (via the setup project), then
 * runs all MSL tests in parallel across multiple workers for fast local feedback.
 *
 * TEST SCOPE:
 *   features, flows (excl. minimal-data-submission), shared formgroups, elmomsl-specific
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080/';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  workers: undefined,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report/msl' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'msl-setup',
      testMatch: 'setup/msl.setup.ts',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'msl',
      dependencies: ['msl-setup'],
      outputDir: 'test-results/msl',
      use: { ...devices['Desktop Safari'], baseURL: BASE_URL },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/*.spec.ts',
        'formgroups/*.spec.ts',
        'formgroups/elmomsl-specific/**/*.spec.ts',
      ],
      testIgnore: [
        '**/minimal-data-submission.spec.ts',
        '**/elmogem-specific/**',
      ],
    },
  ],
});
