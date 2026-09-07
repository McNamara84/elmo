import { test, expect } from '@playwright/test';
import { navigateToHome, waitForFormInteractionReady } from '../../utils';

const PLATFORMS_MOCK = [
  {
    id: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
    text: 'Platforms',
    children: [
      {
        id: 'https://gcmd.earthdata.nasa.gov/kms/concept/space-based-mock',
        text: 'Space-based Platforms',
        children: [
          {
            id: 'https://gcmd.earthdata.nasa.gov/kms/concept/earth-obs-mock',
            text: 'Earth Observation Satellites',
            children: [
              { id: 'mock-goce', text: 'GOCE' },
              { id: 'mock-gfo1', text: 'GFO-1' },
              { id: 'mock-geosat', text: 'GEOSAT' },
            ],
          },
        ],
      },
    ],
  },
];

const MODEL_TYPES_MOCK = [
  { id: 1, name: 'Static', description: 'Static model' },
  { id: 2, name: 'Temporal', description: 'Temporal model' },
  { id: 3, name: 'Topographic', description: 'Topographic model' },
  { id: 4, name: 'Simulated', description: 'Simulated model' },
];

const MATH_REPS_MOCK = [
  { id: 1, name: 'Spherical harmonics', description: 'Spherical harmonics' },
  { id: 2, name: 'Ellipsoidal harmonics', description: 'Ellipsoidal harmonics' },
];

const FILE_FORMATS_MOCK = [
  { id: 1, name: 'icgem1.0', description: 'icgem1.0 format' },
  { id: 2, name: 'icgem2.0', description: 'icgem2.0 format' },
];

test.describe('ELMO-GEM save', () => {

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v2/vocabs/thesauri/gcmd-platforms', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PLATFORMS_MOCK),
      });
    });
    await page.route('**/api/v2/vocabs/modeltypes', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MODEL_TYPES_MOCK),
      });
    });
    await page.route('**/api/v2/vocabs/mathreps', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MATH_REPS_MOCK),
      });
    });
    await page.route('**/api/v2/vocabs/icgemformats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FILE_FORMATS_MOCK),
      });
    });
  });

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
    await page.getByRole('button', { name: 'Save as XML' }).click();
    await expect(page.getByRole('heading', { name: 'Save as XML' })).toBeVisible();
    
    await page.getByRole('textbox', { name: 'Filename' }).click();
    await page.getByRole('textbox', { name: 'Filename' }).dblclick();
    await page.getByRole('textbox', { name: 'Filename' }).fill('test_save_with_incoplete_info');
    const downloadPromise = page.waitForEvent('download');
    await waitForFormInteractionReady(page, 'save');
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
    await page.getByRole('textbox', { name: 'Choose the satellite' }).first().click();
    await page.getByRole('textbox', { name: 'Choose the satellite' }).first().fill('goce');
    await page.getByRole('option', { name: 'Space-based Platforms > Earth' }).first().waitFor({ state: 'visible' });
    await page.getByRole('option', { name: 'Space-based Platforms > Earth' }).first().click();
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
    await page.getByRole('button', { name: 'Save as XML' }).click();
    
    await page.getByRole('textbox', { name: 'Filename' }).fill('test_datase_with_data_sources');
    const downloadPromise = page.waitForEvent('download');
    await waitForFormInteractionReady(page, 'save');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xml');
    const path = await download.path();
    expect(path).not.toBeNull();
  });

  test('saves sparse form data as XML and triggers download', async ({ page }) => {
    await navigateToHome(page);
    await page.getByLabel('Type', { exact: true }).selectOption('A');
    await page.locator('#input-datasource-description').click();
    await page.locator('#input-datasource-description').fill('descrA');
    await page.getByLabel('File format').selectOption('icgem2.0');
    await page.getByLabel('Model Type *').selectOption('Static');
    await page.getByRole('checkbox', { name: 'Time-variable coefficients' }).check();
    await page.locator('#button-datasource-add').click();
    await page.getByLabel('Type*', { exact: true }).selectOption('M');
    await page.locator('#input-datasource-identifier-1').dblclick();
    await page.locator('#input-datasource-identifier-1').fill('identifier');
    await page.locator('#input-datasource-identifiertype1').selectOption('');
    await page.getByLabel('Errors *').selectOption('calibrated');
    await page.getByRole('button', { name: 'Other' }).click();
    await page.getByRole('textbox', { name: 'Other' }).click();
    await page.getByRole('textbox', { name: 'Other' }).fill('description_other');
    await page.locator('.input-group.input-margin-top-bottom > .tagify').first().click();
    await page.getByTitle('Free Keyword').fill('metagem');
    await page.getByRole('textbox', { name: 'Funder' }).click();
    await page.getByRole('textbox', { name: 'Funder' }).fill('funder1');
    await page.locator('#input-relatedwork-identifiertype').selectOption('DOI');
    await page.getByRole('textbox', { name: 'First Name', exact: true }).click();
    await page.getByRole('textbox', { name: 'First Name', exact: true }).fill('sasha');
    await page.locator('#group-contributororganisation').getByTitle('Role(s)').click();
    await page.getByRole('option', { name: 'Rights Holder' }).first().click();
    await page.getByRole('button', { name: 'Save as XML' }).click();
    
    await page.getByRole('textbox', { name: 'Filename' }).fill('test_data_sparse');
    const downloadPromise = page.waitForEvent('download');
    await waitForFormInteractionReady(page, 'save');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xml');
    const path = await download.path();
    expect(path).not.toBeNull();
  });

  test('saves model with satellite and isostasy terrain data sources as XML and triggers download', async ({ page }) => {
    await navigateToHome(page);
    // Elevation/Terrain (Isostasy) is only available for Topographic models.
    await page.getByLabel('Model Type *').selectOption('Topographic');
    await page.locator('#button-datasource-add').click();
    await page.locator('#input-datasource-description').click();
    await page.locator('#input-datasource-description').fill('descrS');
    await page.getByRole('textbox', { name: 'Choose the satellite' }).first().click();
    await page.getByRole('textbox', { name: 'Choose the satellite' }).first().fill('gfo-1');
    await page.getByRole('option', { name: 'Space-based Platforms > Earth' }).first().waitFor({ state: 'visible' });
    await page.getByRole('option', { name: 'Space-based Platforms > Earth' }).first().click();
    await page.locator('#button-datasource-add').click();
    await page.getByRole('textbox', { name: 'Choose the satellite' }).nth(1).click();
    await page.getByRole('textbox', { name: 'Choose the satellite' }).nth(1).fill('geosat');
    await page.getByRole('option', { name: 'Space-based Platforms > Earth' }).first().waitFor({ state: 'visible' });
    await page.getByRole('option', { name: 'Space-based Platforms > Earth' }).first().click();
    await page.locator('#button-datasource-add').click();
    await page.locator('#input-datasource-type-2').selectOption('T');
    await page.locator('#input-datasource-details-2').selectOption('Isostasy');
    await page.getByRole('spinbutton', { name: 'Compensation depth (in meters)' }).click();
    await page.getByRole('spinbutton', { name: 'Compensation depth (in meters)' }).fill('1234');
    await page.locator('#button-datasource-add').click();
    await page.locator('#input-datasource-type-3').selectOption('T');
    await page.locator('#input-datasource-details-3').selectOption('Isostasy');
    await page.locator('#input-datasource-description-3').click();
    await page.locator('#input-datasource-description-3').fill('only description');
    await page.getByRole('textbox', { name: 'Radius (in km) *' }).click();
    await page.getByRole('textbox', { name: 'Radius (in km) *' }).fill('1234');
    await page.getByRole('button', { name: 'Save as XML' }).click();
    
    await page.getByRole('textbox', { name: 'Filename' }).fill('test_data_isostasy');
    const downloadPromise = page.waitForEvent('download');
    await waitForFormInteractionReady(page, 'save');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xml');
    const path = await download.path();
    expect(path).not.toBeNull();
  });

});
