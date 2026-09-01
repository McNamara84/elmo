import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { navigateToHome, openLanguageMenu } from '../../utils';
import { getTranslations, getCurrentLanguage } from '../../utils/translations';

const GFC_EXAMPLES_DIR = path.join(__dirname, 'gfc-files-examples');
const OUTPUT_DATA_REFERENCE_DIR = path.join(__dirname, '../../flows/outputDataReference');

const WGS72_GFC = path.join(GFC_EXAMPLES_DIR, 'WGS72.gfc');
const EHFM_GFC = path.join(GFC_EXAMPLES_DIR, 'EHFM_Earth_7200.gfc');
const DV_ELL_GFC = path.join(GFC_EXAMPLES_DIR, 'dV_ELL_Earth2014_5480_plusGRS80.gfc');
const MINIMAL_XML = path.join(OUTPUT_DATA_REFERENCE_DIR, 'minimal.xml');
const MINIMAL_JSON = path.join(OUTPUT_DATA_REFERENCE_DIR, 'minimal.json');

const enGfcUpload = (getTranslations('en') as { modals: { gfcUpload: Record<string, string> } }).modals.gfcUpload;
const deGfcUpload = (getTranslations('de') as { modals: { gfcUpload: Record<string, string> } }).modals.gfcUpload;


async function getGfcUploadMessage(
  page: import('@playwright/test').Page,
  key: string,
): Promise<string> {
  const language = await getCurrentLanguage(page);
  const gfcUploadTranslations = (
    getTranslations(language) as { modals: { gfcUpload: Record<string, string> } }
  ).modals.gfcUpload;

  return gfcUploadTranslations[key];
}

async function openGfcUploadModal(page: import('@playwright/test').Page) {
  await page.locator('#button-ggms-gfc-upload').click();
  await expect(page.locator('#modal-ggms-gfc-upload')).toBeVisible();
}

async function setGfcInputFile(page: import('@playwright/test').Page, filePath: string) {
  const fileInput = page.locator('#input-ggms-gfc-file');
  await fileInput.setInputFiles(filePath);
  await fileInput.dispatchEvent('change');
}

async function fillMetadataFromGfc(page: import('@playwright/test').Page) {
  await page.locator('#button-ggms-gfc-fill-metadata').click();
  await expect(page.locator('#modal-ggms-gfc-upload')).toBeHidden();
}

async function expectGfcExtensionError(page: import('@playwright/test').Page) {
  const expectedMessage = await getGfcUploadMessage(page, 'errorNoInput');
  await expect(page.locator('#modal-ggms-gfc-upload')).toBeVisible();
  await expect(page.locator('#ggms-gfc-upload-status')).toBeVisible();
  await expect(page.locator('#ggms-gfc-upload-status')).toContainText(expectedMessage);
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
      const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });
      dropZone.dispatchEvent(dropEvent);
    },
    {
      selector: '#panel-ggms-gfc-dropfile',
      name: fileName,
      type: mimeType,
      bytes: fileBytes,
    },
  );

  await expect(page.locator('#ggms-gfc-upload-status')).toBeVisible({ timeout: 5000 });
}

test.describe('GFC model file upload – GGMs Properties', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator('#button-ggms-gfc-upload')).toBeVisible();
  });

  test('shows upload button and opens modal with file drop zone and text field', async ({ page }) => {
    await expect(page.locator('#button-ggms-gfc-upload')).toHaveText(enGfcUpload.uploadButton);

    await openGfcUploadModal(page);

    await expect(page.locator('#input-ggms-gfc-file')).toBeAttached();
    await expect(page.locator('#panel-ggms-gfc-dropfile')).toBeVisible();
    await expect(page.locator('#panel-ggms-gfc-dropfile')).toContainText(enGfcUpload.dropZone);
    await expect(page.locator('#panel-ggms-gfc-dropfile')).toContainText(enGfcUpload.selectFile);
    await expect(page.locator('#textarea-ggms-gfc-header-text')).toBeVisible();
    await expect(page.locator('#button-ggms-gfc-fill-metadata')).toHaveText(enGfcUpload.fillMetadata);
    await expect(page.locator('#modal-ggms-gfc-upload')).not.toContainText('Durchsuchen');
  });

  test('shows German modal text when editor language is German', async ({ page }) => {
    const languageMenu = await openLanguageMenu(page);
    await languageMenu.locator('[data-bs-language-value="de"]').click();

    await openGfcUploadModal(page);

    await expect(page.locator('#modal-ggms-gfc-upload-label')).toHaveText(deGfcUpload.modalTitle);
    await expect(page.locator('#panel-ggms-gfc-dropfile')).toContainText(deGfcUpload.dropZone);
    await expect(page.locator('#panel-ggms-gfc-dropfile')).toContainText(deGfcUpload.selectFile);
    await expect(page.locator('#button-ggms-gfc-fill-metadata')).toHaveText(deGfcUpload.fillMetadata);
    await expect(page.locator('#modal-ggms-gfc-upload')).not.toContainText('Durchsuchen');
  });

  test('populates fields from WGS72.gfc file upload', async ({ page }) => {
    await openGfcUploadModal(page);
    await setGfcInputFile(page, WGS72_GFC);
    await fillMetadataFromGfc(page);

    await expect(page.locator('#input-degree')).toHaveValue('28');
    await expect(page.locator('#input-errors')).toHaveValue('no');
    await expect(page.locator('#input-radius')).toHaveValue('0.6378135E+07');
    await expect(page.locator('#input-earth-gravity-constant')).toHaveValue('0.3986005E+15');
  });

  test('populates fields from EHFM_Earth_7200.gfc file upload', async ({ page }) => {
    await openGfcUploadModal(page);
    await setGfcInputFile(page, EHFM_GFC);
    await fillMetadataFromGfc(page);

    await expect(page.locator('#input-degree')).toHaveValue('7300');
    await expect(page.locator('#input-errors')).toHaveValue('no');
    await expect(page.locator('#input-radius')).toHaveValue('6.378137000E+06');
    await expect(page.locator('#input-earth-gravity-constant')).toHaveValue('3.986004418E+14');
  });

  test('populates fields from dV_ELL_Earth2014_5480_plusGRS80.gfc including tide system', async ({ page }) => {
    await openGfcUploadModal(page);
    await setGfcInputFile(page, DV_ELL_GFC);
    await fillMetadataFromGfc(page);

    await expect(page.locator('#input-degree')).toHaveValue('5480');
    await expect(page.locator('#input-tide-system')).toHaveValue('Tide-free');
    await expect(page.locator('#input-radius')).toHaveValue('0.63781370000D+07');
    await expect(page.locator('#input-earth-gravity-constant')).toHaveValue('0.39860050000D+15');
    await expect(page.locator('#input-errors')).toHaveValue('');
  });

  test('free text field overwrites values parsed from file', async ({ page }) => {
    await openGfcUploadModal(page);
    await setGfcInputFile(page, WGS72_GFC);
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
    await expect(page.locator('#ggms-gfc-upload-status')).toContainText(enGfcUpload.errorNoInput);
  });

  test.describe('non-.gfc file extension validation', () => {
    test('shows error when uploading minimal.xml via file input', async ({ page }) => {
      await openGfcUploadModal(page);
      await setGfcInputFile(page, MINIMAL_XML);
      await expectGfcExtensionError(page);
    });

    test('shows error when uploading minimal.json via file input', async ({ page }) => {
      await openGfcUploadModal(page);
      await setGfcInputFile(page, MINIMAL_JSON);
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
