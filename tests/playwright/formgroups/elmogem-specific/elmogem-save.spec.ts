import { test, expect } from '@playwright/test';
import { navigateToHome } from '../../utils';

test.describe('ELMO-GEM save', () => {

  test('saves incomplete model as XML and triggers download', async ({ page }) => {
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
    expect(download.suggestedFilename()).toContain('.xml');
    const path = await download.path();
    expect(path).not.toBeNull();
  });

  test('saves model with data sources as XML and triggers download', async ({ page }) => {
    await navigateToHome(page);
    await page.getByLabel('Mathematical representation *').selectOption('Ellipsoidal harmonics');
    await page.getByLabel('Model Type *').selectOption('Temporal');
    await page.getByRole('textbox', { name: 'End date' }).fill('2000-11-15');
    await page.getByLabel('Open-search-modal').click();
    await page.getByRole('textbox', { name: 'Search for keywords' }).click();
    await page.getByRole('textbox', { name: 'Search for keywords' }).fill('goce');
    await page.getByRole('treeitem', { name: 'GOCE' }).click();
    await page.locator('#modal-platforms-datasource').getByText('OK', { exact: true }).click();
    await page.locator('#button-datasource-add').click();
    await page.getByLabel('Type*', { exact: true }).selectOption('G');
    await page.locator('#button-datasource-add').click();
    await page.locator('#input-datasource-type-2').selectOption('M');
    await page.getByRole('textbox', { name: 'Model name', exact: true }).click();
    await page.getByRole('textbox', { name: 'Model name', exact: true }).fill('Model1');
    await page.getByRole('textbox', { name: 'Value' }).click();
    await page.getByRole('textbox', { name: 'Value' }).fill('123e2');
    await page.getByRole('textbox', { name: 'Reference ellipsoid:' }).click();
    await page.getByRole('textbox', { name: 'Reference ellipsoid:' }).fill('12345');
    await page.getByRole('textbox', { name: 'Earth gravity constant *' }).click();
    await page.getByRole('textbox', { name: 'Earth gravity constant *' }).fill('123456');
    await page.getByRole('button', { name: 'Save as' }).click();
    await page.getByRole('textbox', { name: 'Filename' }).fill('test_datase_with_data_sources');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xml');
    const path = await download.path();
    expect(path).not.toBeNull();
  });

});