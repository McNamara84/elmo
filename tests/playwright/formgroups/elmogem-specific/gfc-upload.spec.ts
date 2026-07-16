import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { navigateToHome } from '../../utils';

const GFC_EXAMPLES_DIR = path.join(__dirname, 'gfc-files-examples');
const OUTPUT_DATA_REFERENCE_DIR = path.join(__dirname, '../../flows/outputDataReference');

const WGS72_GFC = path.join(GFC_EXAMPLES_DIR, 'WGS72.gfc');
const EHFM_GFC = path.join(GFC_EXAMPLES_DIR, 'EHFM_Earth_7200.gfc');
const DV_ELL_GFC = path.join(GFC_EXAMPLES_DIR, 'dV_ELL_Earth2014_5480_plusGRS80.gfc');
const MINIMAL_XML = path.join(OUTPUT_DATA_REFERENCE_DIR, 'minimal.xml');
const MINIMAL_JSON = path.join(OUTPUT_DATA_REFERENCE_DIR, 'minimal.json');

const GFC_EXTENSION_ERROR =
  'The uploaded file should have a .gfc extension!. Change the file extension or copy-paste the text in the free text fields.';

async function openGfcUploadModal(page: import('@playwright/test').Page) {
  await page.locator('#button-ggms-gfc-upload').click();
  await expect(page.locator('#modal-ggms-gfc-upload')).toBeVisible();
}

async function fillMetadataFromGfc(page: import('@playwright/test').Page) {
  await page.locator('#button-ggms-gfc-fill-metadata').click();
  await expect(page.locator('#modal-ggms-gfc-upload')).toBeHidden();
}

async function expectGfcExtensionError(page: import('@playwright/test').Page) {
  await expect(page.locator('#modal-ggms-gfc-upload')).toBeVisible();
  await expect(page.locator('#ggms-gfc-upload-status')).toBeVisible();
  await expect(page.locator('#ggms-gfc-upload-status')).toContainText(GFC_EXTENSION_ERROR);
}

async function dropFileOnGfcZone(
  page: import('@playwright/test').Page,
  filePath: string,
  fileName: string,
  mimeType: string,
) {
  const fileBytes = Array.from(fs.readFileSync(filePath));

  await page.evaluate(
    ({ selector, name, type, bytes }) => {
      const dropZone = document.querySelector(selector);
      if (!dropZone) {
        throw new Error(`Drop zone not found: ${selector}`);
      }
      const file = new File([new Uint8Array(bytes)], name, { type });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
    },
    {
      selector: '#panel-ggms-gfc-dropfile',
      name: fileName,
      type: mimeType,
      bytes: fileBytes,
    },
  );
}

test.describe('GFC model file upload – GGMs Properties', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator('#button-ggms-gfc-upload')).toBeVisible();
  });

  test('shows upload button and opens modal with file drop zone and text field', async ({ page }) => {
    await expect(page.locator('#button-ggms-gfc-upload')).toHaveText("Don't type - upload the model file");

    await openGfcUploadModal(page);

    await expect(page.locator('#input-ggms-gfc-file')).toBeVisible();
    await expect(page.locator('#panel-ggms-gfc-dropfile')).toBeVisible();
    await expect(page.locator('#textarea-ggms-gfc-header-text')).toBeVisible();
    await expect(page.locator('#button-ggms-gfc-fill-metadata')).toHaveText('Fill in metadata');
  });

  test('populates fields from WGS72.gfc file upload', async ({ page }) => {
    await openGfcUploadModal(page);
    await page.locator('#input-ggms-gfc-file').setInputFiles(WGS72_GFC);
    await fillMetadataFromGfc(page);

    await expect(page.locator('#input-degree')).toHaveValue('28');
    await expect(page.locator('#input-errors')).toHaveValue('no');
    await expect(page.locator('#input-radius')).toHaveValue('0.6378135E+07');
    await expect(page.locator('#input-earth-gravity-constant')).toHaveValue('0.3986005E+15');
  });

  test('populates fields from EHFM_Earth_7200.gfc file upload', async ({ page }) => {
    await openGfcUploadModal(page);
    await page.locator('#input-ggms-gfc-file').setInputFiles(EHFM_GFC);
    await fillMetadataFromGfc(page);

    await expect(page.locator('#input-degree')).toHaveValue('7300');
    await expect(page.locator('#input-errors')).toHaveValue('no');
    await expect(page.locator('#input-radius')).toHaveValue('6.378137000E+06');
    await expect(page.locator('#input-earth-gravity-constant')).toHaveValue('3.986004418E+14');
  });

  test('populates fields from dV_ELL_Earth2014_5480_plusGRS80.gfc including tide system', async ({ page }) => {
    await openGfcUploadModal(page);
    await page.locator('#input-ggms-gfc-file').setInputFiles(DV_ELL_GFC);
    await fillMetadataFromGfc(page);

    await expect(page.locator('#input-degree')).toHaveValue('5480');
    await expect(page.locator('#input-tide-system')).toHaveValue('Tide-free');
    await expect(page.locator('#input-radius')).toHaveValue('0.63781370000D+07');
    await expect(page.locator('#input-earth-gravity-constant')).toHaveValue('0.39860050000D+15');
    await expect(page.locator('#input-errors')).toHaveValue('');
  });

  test('free text field overwrites values parsed from file', async ({ page }) => {
    await openGfcUploadModal(page);
    await page.locator('#input-ggms-gfc-file').setInputFiles(WGS72_GFC);
    await page.locator('#textarea-ggms-gfc-header-text').fill(
      'max_degree 99\nerrors formal\nearth_gravity_constant 1.0E+14'
    );
    await fillMetadataFromGfc(page);

    await expect(page.locator('#input-degree')).toHaveValue('99');
    await expect(page.locator('#input-errors')).toHaveValue('formal');
    await expect(page.locator('#input-earth-gravity-constant')).toHaveValue('1.0E+14');
    await expect(page.locator('#input-radius')).toHaveValue('0.6378135E+07');
  });

  test('populates fields from pasted header text only', async ({ page }) => {
    await openGfcUploadModal(page);
    await page.locator('#textarea-ggms-gfc-header-text').fill(
      'modelname TestModel\nmax_degree 7200\ntide_system tide-free\nerrors no\nradius 6.378137000E+06\nearth_gravity_constant 3.986004418E+14'
    );
    await fillMetadataFromGfc(page);

    await expect(page.locator('#input-degree')).toHaveValue('7200');
    await expect(page.locator('#input-tide-system')).toHaveValue('Tide-free');
    await expect(page.locator('#input-errors')).toHaveValue('no');
    await expect(page.locator('#input-radius')).toHaveValue('6.378137000E+06');
    await expect(page.locator('#input-earth-gravity-constant')).toHaveValue('3.986004418E+14');
  });

  test('shows error when neither file nor text is provided', async ({ page }) => {
    await openGfcUploadModal(page);
    await page.locator('#button-ggms-gfc-fill-metadata').click();

    await expect(page.locator('#modal-ggms-gfc-upload')).toBeVisible();
    await expect(page.locator('#ggms-gfc-upload-status')).toBeVisible();
    await expect(page.locator('#ggms-gfc-upload-status')).toContainText('Please upload a GFC file or paste header text.');
  });

  test.describe('non-.gfc file extension validation', () => {
    test('shows error when uploading minimal.xml via file input', async ({ page }) => {
      await openGfcUploadModal(page);
      await page.locator('#input-ggms-gfc-file').setInputFiles(MINIMAL_XML);
      await page.locator('#button-ggms-gfc-fill-metadata').click();
      await expectGfcExtensionError(page);
    });

    test('shows error when uploading minimal.json via file input', async ({ page }) => {
      await openGfcUploadModal(page);
      await page.locator('#input-ggms-gfc-file').setInputFiles(MINIMAL_JSON);
      await page.locator('#button-ggms-gfc-fill-metadata').click();
      await expectGfcExtensionError(page);
    });

    test('shows error when dropping minimal.xml on the drop zone', async ({ page }) => {
      await openGfcUploadModal(page);
      await dropFileOnGfcZone(page, MINIMAL_XML, 'minimal.xml', 'application/xml');
      await expectGfcExtensionError(page);
    });

    test('shows error when dropping minimal.json on the drop zone', async ({ page }) => {
      await openGfcUploadModal(page);
      await dropFileOnGfcZone(page, MINIMAL_JSON, 'minimal.json', 'application/json');
      await expectGfcExtensionError(page);
    });
  });
});
