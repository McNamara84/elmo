import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:8080/' },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/*.spec.ts',
        'formgroups/*.spec.ts',
      ],
    },
    {
      name: 'firefox-gem',
      use: { ...devices['Desktop Firefox'], baseURL: 'http://localhost:8080/' },
      testMatch: [
        'formgroups/elmogem-specific/**/*.spec.ts',
        'features/elmo-performance.spec.ts',
      ],
    },
    {
      name: 'firefox-igsn',
      use: { ...devices['Desktop Firefox'], baseURL: 'http://localhost:8080/' },
      testMatch: [
        'formgroups/elmoisgn-specific/**/*.spec.ts',
        'features/elmo-performance.spec.ts',
      ],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], baseURL: 'http://localhost:8080/' },
      testMatch: [
        'formgroups/elmomsl-specific/**/*.spec.ts',
        'features/elmo-performance.spec.ts',
      ],
    },
  ],
});
