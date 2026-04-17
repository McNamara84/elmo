import { test, expect } from '@playwright/test';
import { navigateToHome } from '../../utils';

test('test', async ({ page }) => {
  await navigateToHome(page);
  await page.getByLabel('Model Type *').selectOption('Temporal');
  await page.getByLabel('File format').selectOption('icgem2.0');
  await page.getByRole('textbox', { name: 'Model name *' }).click();
  await page.getByRole('textbox', { name: 'Model name *' }).fill('test_model_name');
  await page.getByLabel('Release frequency / temporal').selectOption('monthly');
  await page.getByRole('textbox', { name: 'Release number' }).click();
  await page.getByRole('textbox', { name: 'Release number' }).fill('3.1');
  await page.getByRole('spinbutton', { name: 'Degree *' }).click();
  await page.getByRole('spinbutton', { name: 'Degree *' }).fill('100');
  await page.getByLabel('Errors *').selectOption('calibrated');
  await page.getByRole('button', { name: 'Processing procedures' }).click();
  await page.getByRole('textbox', { name: 'Processing procedures' }).click();
  await page.getByRole('textbox', { name: 'Processing procedures' }).fill('test processing procedures');
  await page.getByRole('button', { name: 'Save as' }).click();
  await expect(page.getByRole('heading', { name: 'Save as XML' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Filename' }).click();
  await page.getByRole('textbox', { name: 'Filename' }).dblclick();
  await page.getByRole('textbox', { name: 'Filename' }).fill('test_save_with_incoplete_info');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = await downloadPromise;
  // Assert the suggested filename
  expect(download.suggestedFilename()).toContain('.xml');

  // Save and verify the file exists
  const path = await download.path();
  expect(path).not.toBeNull();
});