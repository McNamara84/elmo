import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  completeMinimalDatasetForm,
  expectNavbarVisible,
  navigateToHome,
  registerGoogleMapsNoopRoute,
  waitForFormInteractionReady,
} from '../utils';

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

async function saveJsonLd(page: import('@playwright/test').Page, filename: string) {
  const saveAsModal = page.locator('#modal-saveas');
  let capturedBody = '';
  let capturedStatus = 0;

  await page.route('**/save/save_data.php', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const response = await route.fetch();
    capturedStatus = response.status();
    const body = await response.body();
    capturedBody = body.toString('utf8');
    await route.fulfill({ response, body });
  });

  await page.locator('#button-form-save-jsonld').click();
  await expect(saveAsModal).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#label-saveas-modal')).toContainText(/JSON-LD/i);
  await expect(page.locator('#saveas-extension')).toHaveText('.jsonld');
  await page.locator('#input-saveas-filename').fill(filename);
  await waitForFormInteractionReady(page, 'save');
  await page.locator('#button-saveas-save').click();

  await page.waitForResponse(
    response => response.url().includes('/save/save_data.php') && response.request().method() === 'POST',
    { timeout: 30000 }
  );

  await page.unroute('**/save/save_data.php');

  expect(capturedStatus).toBe(200);
  return capturedBody;
}

test.describe('JSON-LD roundtrip flow', () => {
  test('can save JSON-LD, load it again, and save it once more', async ({ page }) => {
    await registerGoogleMapsNoopRoute(page);
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

    const tempDir = join(tmpdir(), 'elmo-e2e');
    mkdirSync(tempDir, { recursive: true });

    const savedJsonLdPath = join(tempDir, 'e2e-jsonld-roundtrip.jsonld');
    const firstSaveBody = await saveJsonLd(page, 'e2e-jsonld-roundtrip');
    const firstPayload = JSON.parse(firstSaveBody) as Record<string, any>;
    await import('node:fs').then(({ writeFileSync }) => writeFileSync(savedJsonLdPath, firstSaveBody, 'utf8'));

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
    await expect(page.locator('input[name="orcids[]"]').first()).toHaveValue('0000-0002-1825-0097');
    await expect(page.locator('input[name="givennames[]"]').first()).toHaveValue('Josiah');
    await expect(page.locator('input[name="familynames[]"]').first()).toHaveValue('Carberry');
    await expect(page.getByRole('textbox', { name: 'Abstract*' })).toHaveValue('Necessary abstract');
    await expect(page.locator('#input-date-created')).toHaveValue('2025-01-01');
    await expect(page.locator('#input-uploadxml-file')).toBeEnabled();

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


    const resavedJsonLdPath = join(tempDir, 'e2e-jsonld-roundtrip-resaved.jsonld');
    const secondSaveBody = await saveJsonLd(page, 'e2e-jsonld-roundtrip-resaved');
    await import('node:fs').then(({ writeFileSync }) => writeFileSync(resavedJsonLdPath, secondSaveBody, 'utf8'));

    const secondPayload = JSON.parse(secondSaveBody) as Record<string, any>;
    expect(secondPayload.titles.title.value).toBe('A dataset');
    expect(secondPayload.publicationYear.value).toBe('2025');

    await closeNotificationModalIfPresent(page);
    expect(consoleErrors).toEqual([]);
  });
});
