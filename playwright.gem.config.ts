import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Per-variant config for ELMO-GEM (Firefox).
 *
 * Usage:  npx playwright test --config=playwright.gem.config.ts
 *
 * Applies GEM settings to settings.php once (via the setup project), then
 * runs all GEM tests in parallel across multiple workers for fast local feedback.
 *
 * TEST SCOPE:
 *   features, flows (excl. minimal-data-submission, contact-person-roundtrip,
 *   save-optional-formgroups), shared formgroups (excl. spatial-temporal-coverages,
 *   resource-type-ernie, descriptions), formgroups/elmogem-specific, flows/elmogem-specific.
 *   Individual tests that require ERNIE, a larger generic catalog, or a map
 *   container are excluded via grepInvert. GEM descriptions are covered by
 *   formgroups/elmogem-specific/elmogem-descriptions.spec.ts.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080/';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  workers: undefined, // use all available CPU cores
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
        // GEM descriptions are static on the page. These tests wait for ERNIE
        // accordion items that carry data-description-slug.
        '**/formgroups/descriptions.spec.ts',
      ],
      // Skip individual tests that are generic-only or do not match the GEM stage catalog.
      // - Navbar / validation / software license: generic-only flows
      // - License count and resource-type list: GEM exposes 4 licenses and Dataset only
      // - Map console checks: spatial coverage is off, so map.js logs
      //   "Map initialization failed" while the form itself still loads
      grepInvert: /Test Navbar Dropdown Functionality|validation-failed modal does NOT appear when all|License dropdown filters for software|License dropdown should not contain duplicate entries|Test dropdown fields functionality|no JavaScript errors on initial page load|uploads DataCite 4\.7 XML and verifies all major fields are populated|can save again after loading a previously saved XML file/,
    },
  ],
});
