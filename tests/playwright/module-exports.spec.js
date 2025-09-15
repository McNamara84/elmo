import { test, expect } from '@playwright/test';

const basePath = '/workspace/ELMO-Enhanced-Laboratory-Metadata-Optimizer/js/';

async function checkModule(page, file, className) {
  return await page.evaluate(async ({ path, className }) => {
    const mod = await import(`file://${path}`);
    return !!(mod.default && mod[className] &&
      mod.validateEmbargoDate && mod.validateTemporalCoverage && mod.validateContactPerson);
  }, { path: file, className });
}

test.describe('module export compatibility', () => {
  test('saveHandler provides default and named exports', async ({ page }) => {
    await page.goto('about:blank');
    const ok = await checkModule(page, basePath + 'saveHandler.js', 'SaveHandler');
    expect(ok).toBe(true);
  });

  test('submitHandler provides default and named exports', async ({ page }) => {
    await page.goto('about:blank');
    const ok = await checkModule(page, basePath + 'submitHandler.js', 'SubmitHandler');
    expect(ok).toBe(true);
  });
});