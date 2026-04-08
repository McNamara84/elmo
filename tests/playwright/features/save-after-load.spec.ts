import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { navigateToHome, expectNavbarVisible } from '../utils/navigation';
import { completeMinimalDatasetForm } from '../utils/flows';

/** Console errors that are expected and can be ignored in the E2E environment. */
const BENIGN_CONSOLE_PATTERNS = [
  /favicon\.ico/,
  /Failed to load resource/,
  /third-party cookie/i,
  /API key not found/i,
  /thesauri availability/i,
];

test.describe('Save after Load – Issue #1043', () => {
  test('can save again after loading a previously saved XML file', async ({ page }) => {
    // Collect unexpected console errors for assertion at end of test
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!BENIGN_CONSOLE_PATTERNS.some(p => p.test(text))) {
          consoleErrors.push(text);
        }
      }
    });

    await navigateToHome(page);
    await expectNavbarVisible(page);

    // 1. Fill minimal required fields
    await completeMinimalDatasetForm(page);

    // 2. Save the form
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('#button-form-save').click();

    const saveAsModal = page.locator('#modal-saveas');
    await expect(saveAsModal).toBeVisible({ timeout: 10000 });
    await page.locator('#input-saveas-filename').fill('e2e-roundtrip-test');
    await page.locator('#button-saveas-save').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('e2e-roundtrip-test');
    const xmlPath = await download.path();
    expect(xmlPath).toBeTruthy();

    // Dismiss notification modal by waiting for auto-hide (success) or clicking close (error)
    const notificationModal = page.locator('#modal-notification');
    // Wait for notification to show (it should already be visible)
    await expect(notificationModal).toBeVisible({ timeout: 5000 });
    // Check whether it's a success or error
    const hasSuccess = await notificationModal.locator('.alert-success').count() > 0;
    if (!hasSuccess) {
      const errorText = await notificationModal.locator('.alert').textContent().catch(() => '');
      console.log('First save notification (non-success):', errorText);
    }
    // Wait for auto-hide or force close
    try {
      await expect(notificationModal).toBeHidden({ timeout: 6000 });
    } catch {
      await notificationModal.locator('.btn-close').first().click().catch(() => {});
      await notificationModal.locator('.btn-primary').first().click().catch(() => {});
      await expect(notificationModal).toBeHidden({ timeout: 3000 });
    }
    await page.waitForFunction(() => !document.querySelector('.modal-backdrop'), { timeout: 3000 }).catch(() => {});

    // 3. Clear the form
    await page.locator('#button-form-reset').click({ force: true });

    const confirmModal = page.locator('#modal-confirm');
    try {
      await expect(confirmModal).toBeVisible({ timeout: 3000 });
      await page.locator('#button-confirm-action').click();
      await expect(confirmModal).toBeHidden({ timeout: 5000 });
    } catch {
      // No confirmation appeared
    }

    await expect(page.locator('input[name="title[]"]').first()).toHaveValue('', { timeout: 5000 });

    // 4. Load the saved XML file
    // Save the download to a stable path with .xml extension
    const tempDir = join(tmpdir(), 'elmo-e2e');
    mkdirSync(tempDir, { recursive: true });
    const savedXmlPath = join(tempDir, 'e2e-roundtrip-test.xml');
    await download.saveAs(savedXmlPath);

    await page.locator('#button-form-load').click();
    const uploadModal = page.locator('#modal-uploadxml');
    await expect(uploadModal).toBeVisible({ timeout: 5000 });
    await page.locator('#input-uploadxml-file').setInputFiles(savedXmlPath);

    // Wait for form to be populated (loadXmlToForm is async)
    await expect(page.locator('input[name="title[]"]').first()).not.toHaveValue('', { timeout: 20000 });

    // Close upload modal via Bootstrap's API if still open
    if (await uploadModal.isVisible().catch(() => false)) {
      await page.evaluate(() => {
        const modalEl = document.getElementById('modal-uploadxml');
        if (modalEl) {
          const bsModal = (window as any).bootstrap?.Modal?.getInstance(modalEl);
          if (bsModal) {
            bsModal.hide();
          }
        }
      });
      await expect(uploadModal).toBeHidden({ timeout: 5000 });
    }

    // 5. Make a small change
    const titleField = page.locator('input[name="title[]"]').first();
    const currentTitle = await titleField.inputValue();
    await titleField.fill(currentTitle + ' (edited)');

    // 6. Save again – the critical step that failed before the fix
    const secondDownloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('#button-form-save').click();
    await expect(saveAsModal).toBeVisible({ timeout: 10000 });
    await page.locator('#input-saveas-filename').fill('e2e-roundtrip-resaved');
    await page.locator('#button-saveas-save').click();

    const secondDownload = await secondDownloadPromise;
    expect(secondDownload.suggestedFilename()).toContain('e2e-roundtrip-resaved');

    // Verify the second save succeeded
    await expect(notificationModal).toBeVisible({ timeout: 10000 });
    await expect(notificationModal.locator('.alert-danger')).toHaveCount(0);
    await expect(notificationModal.locator('.alert-success')).toHaveCount(1);

    // No unexpected JS errors during the entire flow
    expect(consoleErrors).toEqual([]);
  });
});
