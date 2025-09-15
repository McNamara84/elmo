import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, '../../js');

async function checkModule(page, file, className) {
  const url = pathToFileURL(file).href;
  return page.evaluate(async ({ url, className }) => {
    const mod = await import(url);
    return !!(mod.default && mod[className] &&
      mod.validateEmbargoDate && mod.validateTemporalCoverage && mod.validateContactPerson);
  }, { url, className });
}

test.describe('module export compatibility', () => {
  test('saveHandler provides default and named exports', async ({ page }) => {
    await page.goto('about:blank');
    const ok = await checkModule(page, path.join(baseDir, 'saveHandler.js'), 'SaveHandler');
    expect(ok).toBe(true);
  });

  test('submitHandler provides default and named exports', async ({ page }) => {
    await page.goto('about:blank');
    const ok = await checkModule(page, path.join(baseDir, 'submitHandler.js'), 'SubmitHandler');
    expect(ok).toBe(true);
  });
});