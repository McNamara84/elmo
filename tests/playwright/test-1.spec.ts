import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:8080/');
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByLabel('Submission not possible').getByText('Close').click();
});