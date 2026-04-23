import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Multi-variant Playwright config for ELMO-GEM, ELMO-MSL, and ELMO-PURE.
 *
 * Each variant is a pair of projects:
 *   <variant>-setup  – writes the correct settings.php values before tests run
 *   <variant>        – runs the variant-specific test suite
 *
 * Run a single variant:   npx playwright test --project=gem
 * Run all variants:       npx playwright test
 *
 * The BASE_URL env variable overrides the default localhost address, e.g.
 *   BASE_URL=http://localhost:9000/ npx playwright test --project=msl
 *
 * See https://playwright.dev/docs/test-configuration.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080/';

export default defineConfig({
  testDir: './tests/playwright',
  // Sequential execution is required: only one variant's settings.php can be
  // active at a time on the single container.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── ELMO-GEM ────────────────────────────────────────────────────────────
    // Settings: GGMs Properties on, spatial/temporal coverage off, MSL off
    {
      name: 'gem-setup',
      testMatch: 'setup/gem.setup.ts',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'gem',
      dependencies: ['gem-setup'],
      outputDir: 'test-results/gem',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
      testMatch: [
        'formgroups/*.spec.ts',
        'formgroups/elmogem-specific/**/*.spec.ts',
      ],
      // Spatial/temporal coverage form group is disabled for GEM
      testIgnore: ['**/spatial-temporal-coverages.spec.ts'],
    },

    // ── ELMO-MSL ────────────────────────────────────────────────────────────
    // Settings: MSL labs/vocabs/logo on, all general form groups on
    // This variant runs the full test suite (features + flows + formgroups)
    {
      name: 'msl-setup',
      testMatch: 'setup/msl.setup.ts',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'msl',
      dependencies: ['msl-setup'],
      outputDir: 'test-results/msl',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/*.spec.ts',
        'formgroups/*.spec.ts',
        'formgroups/elmomsl-specific/**/*.spec.ts',
      ],
    },

    // ── ELMO-PURE ───────────────────────────────────────────────────────────
    // Settings: standard DataCite form groups only, no MSL, no GEM extensions
    {
      name: 'pure-setup',
      testMatch: 'setup/pure.setup.ts',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'pure',
      dependencies: ['pure-setup'],
      outputDir: 'test-results/pure',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
      // MSL-specific tests (elmomsl-specific/) are not matched here
      testMatch: ['formgroups/*.spec.ts'],
    },
  ],
});
