import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { registerStaticAssetRoutes, REPO_ROOT } from '../utils';

const fixturePath = '__save_notification_fixture__';
const modals = readFileSync(path.join(REPO_ROOT, 'modals.html'), 'utf8');
const notificationMarkup = modals.slice(modals.indexOf('<!-- Notification Modal -->'), modals.indexOf('<!-- Restore Draft Modal -->'));
const saveMarkup = modals.slice(modals.indexOf('<!-- Save As Modal -->'), modals.indexOf('<!-- Submit Modal -->'));

test.beforeEach(async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:8080/';
  await registerStaticAssetRoutes(page);
  await page.route(`**/${fixturePath}`, route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="en"><head>
      <meta charset="utf-8"><base href="${baseURL}">
      <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
    </head><body>
      <form id="form-mde"></form>
      <button id="start-save" type="button">Save as XML</button>
      ${notificationMarkup}${saveMarkup}
      <script src="node_modules/jquery/dist/jquery.min.js"></script>
      <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
      <script type="module">
        import SaveHandler from './js/saveHandler.js';
        window.translations = { alerts: { processingHeading: 'Preparing', preparingDownload: 'Preparing download' } };
        window.saveHandler = new SaveHandler('form-mde', 'modal-saveas', 'modal-notification');
        document.querySelector('#start-save').onclick = () => window.saveHandler.handleSave();
        document.querySelector('#modal-saveas').addEventListener('shown.bs.modal', () => { window.saveDialogReady = true; });
      </script>
    </body></html>`,
  }));
  await page.goto(new URL(fixturePath, baseURL).href);
  await page.waitForFunction(() => Boolean((window as any).saveHandler));
  await page.locator('#start-save').click();
  await page.waitForFunction(() => (window as any).saveDialogReady);
});

for (const result of ['success', 'danger']) {
  test(`keeps the ${result} notification visible when saving finishes during dialog transitions`, async ({ page }) => {
    // Resolve the save as soon as Save As has closed. With real Bootstrap
    // transitions, a notification dismissed by that event is still closing.
    await page.evaluate(result => {
      const handler = (window as any).saveHandler;
      handler.saveAndDownload = async () => {
        handler.showNotification('info', 'Saving', 'Saving metadata');
        await new Promise<void>(resolve => {
          document.querySelector('#modal-saveas')!.addEventListener('hidden.bs.modal', () => resolve(), { once: true });
        });
        handler.showNotification(result, 'Save result', 'Finished saving');
      };
    }, result);
    await page.locator('#button-saveas-save').click();
    const notification = page.locator('#modal-notification');
    await expect(notification.locator(`.alert-${result}`)).toHaveText('Finished saving');
    await expect(notification).toHaveClass(/\bshow\b/);
    await notification.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(notification).toBeHidden();
    await expect(page.locator('#modal-saveas')).toBeHidden();

    // Completing a save must also restore cancellation for the next attempt.
    await page.locator('#start-save').click();
    await page.locator('#modal-saveas').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(notification).toBeHidden();
  });
}

test('cancelling Save As still dismisses the preparatory notification', async ({ page }) => {
  await page.locator('#modal-saveas').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#modal-saveas')).toBeHidden();
  await expect(page.locator('#modal-notification')).toBeHidden();
});
