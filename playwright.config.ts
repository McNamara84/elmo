import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Multi-variant Playwright config for ELMO-GEM, ELMO-MSL, and ELMO-GENERIC.
 *
 * Browser pairings:
 *   gem     → Firefox
 *   msl     → Safari (webkit)
 *   generic → Chrome
 *
 * Each variant is a dependency pair:
 *   <variant>-setup  – writes settings.php values and reloads the browser
 *   <variant>        – runs the variant-specific test suite
 *
 * Run a single variant:   npx playwright test --project=gem
 * Run all variants:       npx playwright test
 *
 * The BASE_URL env variable overrides the default localhost address, e.g.
 *   BASE_URL=http://localhost:9000/ npx playwright test --project=msl
 *
 * See https://playwright.dev/docs/test-configuration.
 *
 * Test distribution:
 *   gem     – features, flows (excl. minimal-data-submission), formgroups shared
 *             (excl. spatial-temporal-coverages), elmogem-specific
 *   msl     – features, flows (excl. minimal-data-submission), formgroups shared,
 *             elmomsl-specific
 *   generic – features, flows (all incl. minimal-data-submission), formgroups shared
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

  // Execution order (workers: 1 enforces sequential runs):
  //   generic-setup → generic tests → gem-setup → gem tests → msl-setup → msl tests
  //
  // IMPORTANT: gem-setup and msl-setup are wired as TEARDOWNS of the preceding test
  // project (not as dependencies). Playwright's 'teardown' always runs after the
  // parent project completes – even if the parent has test failures. Using
  // 'dependencies' instead would skip the entire remaining chain whenever a single
  // test fails (e.g. a pre-existing failure in 'generic' would skip all gem+msl tests).
  projects: [
    // ── 1. ELMO-GENERIC (Chrome) ─────────────────────────────────────────────
    // Settings: standard DataCite, used instruments on, no MSL/GEM extensions.
    // Runs first; includes the full submission flow (minimal-data-submission).
    {
      name: 'generic-setup',
      testMatch: 'setup/generic.setup.ts',
      // No dependencies – this is the entry point
      use: { baseURL: BASE_URL },
    },
    {
      name: 'generic',
      dependencies: ['generic-setup'],
      // gem-setup is the teardown of 'generic': it always runs after generic
      // finishes, regardless of pass/fail, and sets settings.php for GEM.
      teardown: 'gem-setup',
      outputDir: 'test-results/generic',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/*.spec.ts',
        'formgroups/*.spec.ts',
      ],
    },

    // ── 2. ELMO-GEM (Firefox) ────────────────────────────────────────────────
    // Settings: GGMs Properties on, spatial/temporal coverage off, MSL off.
    // gem-setup is triggered as the teardown of 'generic' (not via dependencies),
    // so it runs even when generic has test failures.
    {
      name: 'gem-setup',
      testMatch: 'setup/gem.setup.ts',
      use: { baseURL: BASE_URL },
    },
    {
      name: 'gem',
      dependencies: ['gem-setup'],
      // msl-setup is the teardown of 'gem': runs after gem regardless of failures.
      teardown: 'msl-setup',
      outputDir: 'test-results/gem',
      use: { ...devices['Desktop Firefox'], baseURL: BASE_URL },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/*.spec.ts',
        'formgroups/*.spec.ts',
        'formgroups/elmogem-specific/**/*.spec.ts',
      ],
      testIgnore: [
        // Spatial/temporal coverage form group is disabled for GEM
        '**/spatial-temporal-coverages.spec.ts',
        // Submission flow requires generic DataCite settings
        '**/minimal-data-submission.spec.ts',
      ],
    },

    // ── 3. ELMO-MSL (Safari) ─────────────────────────────────────────────────
    // Settings: MSL labs/vocabs/logo on, spatial/temporal on, GGMs off.
    // msl-setup is triggered as the teardown of 'gem' (not via dependencies),
    // so it runs even when gem has test failures.
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
        // Submission flow is only applicable for the generic variant
        '**/minimal-data-submission.spec.ts',
      ],
    },
  ],
});
