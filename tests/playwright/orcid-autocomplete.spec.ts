import { test, expect } from '@playwright/test';
test.describe('ORCID API autocomplete tests', () => {

  test('test first and last name retrieval', async ({ page }) => {
    await page.goto('');
    await page.locator('#input-author-orcid').fill('0000-0002-1825-0097');
    await page.getByRole('textbox', { name: 'First Name*' }).click();
    await page.waitForTimeout(100); // wait for 0.1 seconds 
    await expect(page.getByRole('textbox', { name: 'First Name*' })).toHaveValue('Josiah');
    await expect(page.getByRole('textbox', { name: 'Last Name*' })).toHaveValue('Carberry');
  });
  test('test affiliations retrieval', async ({ page }) => {
  await page.goto('');
  await page.locator('#input-author-orcid').fill('0000-0001-5140-8602');
  await page.getByRole('textbox', { name: 'First Name*' }).click();
  await page.waitForTimeout(100); // wait for 0.1 seconds 
  await expect(page.locator('tag')).toContainText('Helmholtz Centre Potsdam - GFZ German Research Centre for Geosciences');
  });
});