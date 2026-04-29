import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { completeMinimalDatasetForm, expectNavbarVisible, navigateToHome } from '../utils';

const BENIGN_CONSOLE_PATTERNS = [
  /favicon\.ico/,
  /third-party cookie/i,
  /API key not found/i,
  /thesauri availability/i,
  /503 \(Service Unavailable\)/,
];

async function closeNotificationModalIfPresent(page: import('@playwright/test').Page) {
  const notificationModal = page.locator('#modal-notification');

  await expect(notificationModal).toBeVisible({ timeout: 10000 }).catch(() => {});
  if (!(await notificationModal.isVisible().catch(() => false))) {
    return;
  }

  await expect(notificationModal.locator('.alert-danger')).toHaveCount(0);

  try {
    await expect(notificationModal).toBeHidden({ timeout: 6000 });
  } catch {
    await notificationModal.locator('.btn-close').first().click().catch(() => {});
    await notificationModal.locator('.btn-primary').first().click().catch(() => {});
    await expect(notificationModal).toBeHidden({ timeout: 3000 });
  }

  await page.waitForFunction(() => !document.querySelector('.modal-backdrop'), { timeout: 3000 }).catch(() => {});
}

async function clearForm(page: import('@playwright/test').Page) {
  await page.locator('#button-form-reset').click({ force: true });

  const confirmModal = page.locator('#modal-confirm');
  try {
    await expect(confirmModal).toBeVisible({ timeout: 3000 });
    await page.locator('#button-confirm-action').click();
    await expect(confirmModal).toBeHidden({ timeout: 5000 });
  } catch {
    // No confirmation modal appeared.
  }

  await expect(page.locator('input[name="title[]"]').first()).toHaveValue('', { timeout: 5000 });
}

test.describe('JSON-LD roundtrip flow', () => {
  test('can save JSON-LD, load it again, and save it once more', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() !== 'error') {
        return;
      }

      const text = msg.text();
      if (!BENIGN_CONSOLE_PATTERNS.some(pattern => pattern.test(text))) {
        consoleErrors.push(text);
      }
    });

    await navigateToHome(page);
    await expectNavbarVisible(page);
    await completeMinimalDatasetForm(page);

    const saveAsModal = page.locator('#modal-saveas');
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    await page.locator('#button-form-save-jsonld').click();
    await expect(saveAsModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#label-saveas-modal')).toContainText(/JSON-LD/i);
    await expect(page.locator('#saveas-extension')).toHaveText('.jsonld');

    await page.locator('#input-saveas-filename').fill('e2e-jsonld-roundtrip');
    await page.locator('#button-saveas-save').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/e2e-jsonld-roundtrip.*\.jsonld$/i);

    const tempDir = join(tmpdir(), 'elmo-e2e');
    mkdirSync(tempDir, { recursive: true });

    const savedJsonLdPath = join(tempDir, 'e2e-jsonld-roundtrip.jsonld');
    await download.saveAs(savedJsonLdPath);

    const firstPayload = JSON.parse(readFileSync(savedJsonLdPath, 'utf8')) as Record<string, any>;
    expect(firstPayload['@context']).toBe('https://schema.stage.datacite.org/linked-data/context/fullcontext.jsonld');
    expect(firstPayload.publicationYear.value).toBe('2025');
    expect(firstPayload.titles.title.value).toBe('A dataset');
    expect(firstPayload.creators.creator.givenName.value).toBe('Josiah');
    expect(firstPayload.creators.creator.familyName.value).toBe('Carberry');

    await closeNotificationModalIfPresent(page);
    await clearForm(page);

    await page.locator('#button-form-load').click();
    const uploadModal = page.locator('#modal-uploadxml');
    await expect(uploadModal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#input-uploadxml-file')).toHaveAttribute('accept', /jsonld/);
    await page.locator('#input-uploadxml-file').setInputFiles(savedJsonLdPath);

    const titleField = page.locator('input[name="title[]"]').first();
    await expect(titleField).toHaveValue('A dataset', { timeout: 20000 });
    await expect(page.locator('#input-resourceinformation-publicationyear')).toHaveValue('2025');
    await expect(page.locator('#input-author-orcid')).toHaveValue('0000-0002-1825-0097');
    await expect(page.locator('#input-author-firstname')).toHaveValue('Josiah');
    await expect(page.locator('#input-author-lastname')).toHaveValue('Carberry');
    await expect(page.getByRole('textbox', { name: 'Abstract*' })).toHaveValue('Necessary abstract');
    await expect(page.getByRole('textbox', { name: 'Date created*' })).toHaveValue('2025-01-01');

    if (await uploadModal.isVisible().catch(() => false)) {
      await page.evaluate(() => {
        const modalEl = document.getElementById('modal-uploadxml');
        if (!modalEl) {
          return;
        }

        const modal = (window as any).bootstrap?.Modal?.getInstance(modalEl);
        modal?.hide();
      });
      await expect(uploadModal).toBeHidden({ timeout: 5000 });
    }

    const secondDownloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('#button-form-save-jsonld').click();
    await expect(saveAsModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#saveas-extension')).toHaveText('.jsonld');
    await page.locator('#input-saveas-filename').fill('e2e-jsonld-roundtrip-resaved');
    await page.locator('#button-saveas-save').click();

    const secondDownload = await secondDownloadPromise;
    expect(secondDownload.suggestedFilename()).toMatch(/e2e-jsonld-roundtrip-resaved.*\.jsonld$/i);

    const resavedJsonLdPath = join(tempDir, 'e2e-jsonld-roundtrip-resaved.jsonld');
    await secondDownload.saveAs(resavedJsonLdPath);

    const secondPayload = JSON.parse(readFileSync(resavedJsonLdPath, 'utf8')) as Record<string, any>;
    expect(secondPayload.titles.title.value).toBe('A dataset');
    expect(secondPayload.publicationYear.value).toBe('2025');

    await closeNotificationModalIfPresent(page);
    expect(consoleErrors).toEqual([]);
  });
});