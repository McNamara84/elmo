import { defineConfig } from '@playwright/test';

/** Real HTTP submission tests against a dedicated ELMO and local ERNIE fixture. */
export default defineConfig({
  testDir: './tests/integration',
  testMatch: 'ernie-licenses.spec.ts',
  outputDir: 'test-results/licenses',
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: 'list',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:8095/' },
});
