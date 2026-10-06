import { test, expect } from '@playwright/test';

test('uploading into a form with deleted data source behaves as expected', async ({ page }) => {
  await page.goto('http://localhost:8080/');
  await page.getByRole('button', { name: 'Datenquelle entfernen' }).click();
  //assert no data-source-row are present
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
    await expect(page.locator('#input-datasource-type-1')).toHaveValue('G');
    await expect(page.locator('#input-datasource-details-1')).toHaveValue('Terrestrial');
    await expect(page.locator('#input-datasource-type-2')).toHaveValue('A');
    await expect(page.locator('#input-datasource-details-2')).toHaveValue('Direct observations from altimetry satellites');
    await expect(page.locator('#input-datasource-type-3')).toHaveValue('T');
    await expect(page.locator('#input-datasource-details-3')).toHaveValue('Bathymetry');
    await expect(page.locator('#input-datasource-type-4')).toHaveValue('M');
    await expect(page.locator('#input-datasource-details-4')).toHaveValue('Global Gravitational Model');
    await expect(page.getByRole('textbox', { name: 'Model name', exact: true })).toHaveValue('GOCO7');
    await page.getByRole('textbox', { name: 'Identifier' }).click();
    await expect(page.locator('#input-datasource-identifiertype-4')).toHaveValue('DOI'); <grav:inputDataSource type="Ground data">
      // no other data sources are added 
});