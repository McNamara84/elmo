import { test, expect } from '@playwright/test';
test.describe('ORCID API for first and last name retrieval', () => {

  test('test', async ({ page }) => {
    await page.goto('');
    await page.locator('#input-author-orcid').fill('0000-0002-1825-0097');
    await page.getByRole('textbox', { name: 'First Name*' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('textbox', { name: 'First Name*' })).toHaveValue('Josiah');
    await expect(page.getByRole('textbox', { name: 'Last Name*' })).toHaveValue('Carberry');
  });
});