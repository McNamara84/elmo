import './playwright-require.cjs';
import { defineConfig, devices } from '@playwright/test';

// 🌟 NEU: globalSetup aktivieren
// Damit wird vor allen Tests deine PHP-Session initialisiert
// (playwright-global-setup.js liegt im Projekt-Root)
export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',

  // 🌟 NEU: globalSetup hinzufügen
  globalSetup: require.resolve('./playwright-global-setup.js'),

  use: {
    // Unterschiedliche BaseURLs lokal vs. CI
    baseURL: process.env.CI ? 'http://127.0.0.1:8000/' : 'http://localhost:8080/',

    // 🌟 NEU: gespeicherten Session-State (von globalSetup) laden
    storageState: 'playwright/.auth/session-storage.json',

    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/session-storage.json' },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: 'playwright/.auth/session-storage.json' },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: 'playwright/.auth/session-storage.json' },
    },
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge', storageState: 'playwright/.auth/session-storage.json' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: 'playwright/.auth/session-storage.json' },
    },
  ],
});
