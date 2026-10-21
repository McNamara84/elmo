import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';

async function commitSave(page: import('@playwright/test').Page, filename: string) {
  const saveBtn = page.locator('#button-form-save');
  const saveModal = page.locator('#modal-saveas');
  await saveBtn.scrollIntoViewIfNeeded();
  // Visibility precedes the end of Bootstrap's opening transition; hide() is ignored until shown.
  await Promise.all([
    saveModal.evaluate(element => new Promise<void>(resolve => {
      element.addEventListener('shown.bs.modal', () => resolve(), {once: true});
    })),
    saveBtn.click(),
  ]);

  await expect(saveModal).toBeVisible();

  const filenameField = page.locator('#input-saveas-filename');
  await filenameField.fill(filename);

  const csrfField = page.locator('#input-csrf-token');

  // Responses arrive before the download and success notification finish updating the UI.
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('csrf_token.php') && response.ok()
    ),
    page.waitForResponse((response) =>
      response.url().includes('save_data.php') && response.request().method() === 'POST'
    ),
    page.waitForEvent('download'),
    page.locator('#button-saveas-save').click(),
  ]);

  await expect(csrfField).not.toHaveValue('');
  await expect(saveModal).toBeHidden();
  const notification = page.locator('#modal-notification');
  await expect(notification.locator('.alert')).toHaveClass(/alert-success/);
  await notification.evaluate(element => (window as any).bootstrap.Modal.getInstance(element)?.hide());
  await expect(notification).toBeHidden();
}

test.describe('CSRF token on demand', () => {
  test.beforeEach(async ({page}) => {
    // Draft persistence is independent of the real session-token endpoint checked here.
    await page.route('**/api/v2/drafts**', route => route.fulfill({status: 204, body: ''}));
  });

  test('save populates the CSRF field after commit', async ({ page }) => {
    await page.route(SAVE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from('saved'),
      });
    });

    await navigateToHome(page);

    const csrfField = page.locator('#input-csrf-token');
    await expect(csrfField).toHaveValue('');

    await commitSave(page, 'dataset_playwright_on_demand');

    const tokenAfterSave = await csrfField.inputValue();
    expect(tokenAfterSave.length).toBeGreaterThanOrEqual(32);

    await page.unroute(SAVE_ENDPOINT);
  });

  test('same session reuses the token on a second save', async ({ page }) => {
    await page.route(SAVE_ENDPOINT, async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from('saved'),
      });
    });

    await navigateToHome(page);
    // Keep the dialog visible before its opening animation finishes to reproduce the CI race.
    await page.addStyleTag({content: '#modal-saveas.fade .modal-dialog { transition-delay: 1s !important; }'});

    await commitSave(page, 'dataset_playwright_first');
    const firstToken = await page.locator('#input-csrf-token').inputValue();

    await commitSave(page, 'dataset_playwright_second');
    const secondToken = await page.locator('#input-csrf-token').inputValue();

    expect(firstToken.length).toBeGreaterThanOrEqual(32);
    expect(secondToken).toBe(firstToken);

    await page.unroute(SAVE_ENDPOINT);
  });
});
