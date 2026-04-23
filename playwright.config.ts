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

  // Execution order (workers: 1 + declaration order enforces sequencing):
  //   generic-setup → generic tests → gem-setup → gem tests → msl-setup → msl tests
  //
  // KEY DESIGN: setup projects depend on the PREVIOUS VARIANT'S SETUP (not its tests).
  // Both `generic` and `gem-setup` depend on `generic-setup`, making them the same
  // topological level. Playwright resolves same-level projects in declaration order,
  // so all `generic` test files complete before `gem-setup` starts — but a failure
  // inside `generic` does NOT skip `gem-setup` (it doesn't depend on `generic`).
  // The same pattern repeats for msl-setup depending on gem-setup, not gem.
  projects: [
    // ── 1. ELMO-GENERIC (Chrome) ─────────────────────────────────────────────
    // Settings: standard DataCite, used instruments on, no MSL/GEM extensions.
    // Runs first; includes the full submission flow (minimal-data-submission).
    {
      name: 'generic-setup',
      testMatch: 'setup/generic.setup.ts',
      // No dependencies – this is the entry point.
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

    // ── 2. ELMO-GEM (Firefox) ────────────────────────────────────────────────
    // Settings: GGMs Properties on, spatial/temporal coverage off, MSL off.
    // gem-setup depends on generic-setup (same level as generic). Declaration
    // order guarantees all generic tests run first. Failures in generic do NOT
    // skip gem-setup because gem-setup has no direct dependency on generic.
    {
      name: 'gem-setup',
      testMatch: 'setup/gem.setup.ts',
      dependencies: ['generic-setup'],
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
        // Spatial/temporal coverage form group is disabled for GEM
        '**/spatial-temporal-coverages.spec.ts',
        // Submission flow requires generic DataCite settings
        '**/minimal-data-submission.spec.ts',
      ],
    },

    // ── 3. ELMO-MSL (Safari) ─────────────────────────────────────────────────
    // Settings: MSL labs/vocabs/logo on, spatial/temporal on, GGMs off.
    // msl-setup depends on gem-setup (same level as gem). Declaration order
    // guarantees all gem tests run first. Failures in gem do NOT skip msl-setup.
    {
      name: 'msl-setup',
      testMatch: 'setup/msl.setup.ts',
      dependencies: ['gem-setup'],
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
