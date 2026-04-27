import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * DEFAULT config — runs all 4 variants sequentially on a single container.
 *
 *   npx playwright test                         ← all variants
 *   npx playwright test --project=gem           ← only GEM (still requires prior setup)
 *
 * For fast parallel single-variant runs use the dedicated configs:
 *   npx playwright test --config=playwright.generic.config.ts
 *   npx playwright test --config=playwright.gem.config.ts
 *   npx playwright test --config=playwright.msl.config.ts
 *   npx playwright test --config=playwright.igsn.config.ts
 *
 * Browser pairings:
 *   generic → Chrome   |   gem → Firefox   |   msl → Safari   |   igsn → Chrome
 *
 * See https://playwright.dev/docs/test-configuration.
 *
 * Test distribution:
 *   generic – features, flows (all incl. minimal-data-submission), shared formgroups
 *   gem     – features, flows (excl. minimal-data-submission), shared formgroups
 *             (excl. spatial-temporal-coverages), elmogem-specific
 *   msl     – features, flows (excl. minimal-data-submission), shared formgroups,
 *             elmomsl-specific
 *   igsn    – features, flows (excl. minimal-data-submission), shared formgroups
 *             (excl. spatial/temporal, free-keywords, related-work, thesauri),
 *             elmoisgn-specific
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080/';

export default defineConfig({
  testDir: './tests/playwright',
  // Sequential execution is required: only one variant's settings.php can be
  // active at a time on the single container.
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
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
  //   generic-setup → generic → gem-setup → gem → igsn-setup → igsn → msl-setup → msl
  //
  // KEY DESIGN: each setup depends on the PREVIOUS setup (not its test project).
  // This means a failure inside a test project does NOT skip the next variant's setup.
  // Declaration order with workers:1 ensures test projects drain before the next setup runs.
  projects: [
    // ── 1. ELMO-GENERIC (Chrome) ─────────────────────────────────────────────
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

    // ── 2. ELMO-GEM (Firefox) ────────────────────────────────────────────────
    // gem-setup depends on generic-setup (same topo-level as generic).
    // Declaration order drains all generic tests first.
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
        '**/spatial-temporal-coverages.spec.ts',
        '**/minimal-data-submission.spec.ts',
      ],
    },

    // ── 3. ELMO-IGSN (Chrome) ────────────────────────────────────────────────
    // igsn-setup depends on gem-setup → runs after all gem tests complete.
    {
      name: 'igsn-setup',
      testMatch: 'setup/igsn.setup.ts',
      dependencies: ['gem-setup'],
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
        '**/spatial-temporal-coverages.spec.ts',
        '**/free-keywords.spec.ts',
        '**/related-work.spec.ts',
        '**/thesauri-keywords.spec.ts',
        '**/thesauri-keywords-roundtrip.spec.ts',
        '**/minimal-data-submission.spec.ts',
      ],
    },

    // ── 4. ELMO-MSL (Safari) ─────────────────────────────────────────────────
    // msl-setup depends on igsn-setup → runs after all igsn tests complete.
    {
      name: 'msl-setup',
      testMatch: 'setup/msl.setup.ts',
      dependencies: ['igsn-setup'],
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
      ],
    },
  ],
});
