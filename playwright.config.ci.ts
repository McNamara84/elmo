import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 45000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }]
  ],
  use: {
    trace: 'on-first-retry',
    video: 'off',
    screenshot: 'only-on-failure',
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], video: 'off', baseURL: 'http://localhost:8000/' },
      testMatch: [
        'features/**/*.spec.ts',
        'flows/**/!(icgem-roundtrip).spec.ts',
        'formgroups/*.spec.ts',
      ],
      testIgnore: [
        '**/elmogem-specific/**',
      ],
    },
    {
      name: 'firefox-gem',
      use: { ...devices['Desktop Firefox'], baseURL: 'http://localhost:8001/' },
      testMatch: [
        'formgroups/elmogem-specific/**/*.spec.ts',
        'flows/elmogem-specific/**/*.spec.ts',
        'features/elmo-performance.spec.ts',
      ],
    },
    {
      name: 'firefox-igsn',
      use: { ...devices['Desktop Firefox'], baseURL: 'http://localhost:8002/' },
      testMatch: [
        'formgroups/elmoisgn-specific/**/*.spec.ts',
        'features/elmo-performance.spec.ts',
      ],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], baseURL: 'http://localhost:8003/' },
      testMatch: [
        'formgroups/elmomsl-specific/**/*.spec.ts',
        'features/elmo-performance.spec.ts',
      ],
    },
  ],
});