import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Per-variant config for ELMO-GEM (Firefox).
 *
 * Usage:  npx playwright test --config=playwright.gem.config.ts
 *
 * Applies GEM settings to settings.php once (via the setup project), then
 * runs all GEM tests in parallel for fast local feedback.
 *
 * Parallelism is capped at two workers: the whole variant is served by one
 * single-threaded PHP dev server, and the save/download steps in
 * flows/elmogem-specific/icgem-roundtrip.spec.ts queue behind each other past the test timeout
 * when more workers compete for it. CI applies the same cap.
 *
 * TEST SCOPE:
 *   features, flows (excl. minimal-data-submission, contact-person-roundtrip,
 *   save-optional-formgroups), shared formgroups (excl. spatial-temporal-coverages,
 *   resource-type-ernie), formgroups/elmogem-specific, flows/elmogem-specific.
 *   Individual tests that require ERNIE or generic-only flows are excluded via grepInvert.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080/';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report/gem' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'gem-setup',
      testMatch: 'setup/gem.setup.ts',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'gem',
      dependencies: ['gem-setup'],
      outputDir: 'test-results/gem',
      use: { ...devices['Desktop Firefox'], baseURL: BASE_URL },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/*.spec.ts',
        'formgroups/*.spec.ts',
        'formgroups/elmogem-specific/**/*.spec.ts',
      ],
      testIgnore: [
        '**/spatial-temporal-coverages.spec.ts',
        '**/minimal-data-submission.spec.ts',
        '**/contact-person-roundtrip.spec.ts',
        '**/resource-type-ernie.spec.ts',
        '**/save-optional-formgroups.spec.ts',
      ],
      // Skip individual tests that are generic-only or require ERNIE without GEM context
      grepInvert: /Test Navbar Dropdown Functionality|validation-failed modal does NOT appear when all|renders static Abstract and dynamic description types|description types API returns valid data|License dropdown filters for software/,
    },
  ],
});
