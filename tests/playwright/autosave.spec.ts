import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const autosaveModuleSource = readFileSync(resolve(__dirname, '../../js/services/autosaveService.js'), 'utf-8');

test.describe('Autosave experience', () => {
  test('persists form changes and updates accessible status', async ({ page }, testInfo) => {
    const postPayloads: Array<Record<string, unknown>> = [];
    const putPayloads: Array<Record<string, unknown>> = [];
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:8080/';
    const normalizedBase = new URL(baseURL, 'http://localhost:8080/');
    const baseHref = normalizedBase.href.endsWith('/') ? normalizedBase.href : `${normalizedBase.href}/`;
    const fixtureHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <base href="${baseHref}">
    <title>Autosave Fixture</title>
  </head>
  <body>
    <main>
      <form id="form-mde">
        <label for="title-input">Title*</label>
        <input id="title-input" name="title" aria-describedby="title-help" />
        <p id="title-help">Provide a concise, descriptive dataset title.</p>
      </form>
      <div class="autosave-status" id="autosave-status" role="status" aria-live="polite" aria-atomic="true">
        <span class="visually-hidden">Autosave status:</span>
        <span class="autosave-status__indicator" aria-hidden="true"></span>
        <span id="autosave-status-text">Autosave ready.</span>
      </div>
    </main>
    <script type="module">
      import AutosaveService from './js/services/autosaveService.js';

      const service = new AutosaveService('form-mde', {
        statusElementId: 'autosave-status',
        statusTextId: 'autosave-status-text',
        throttleMs: 300
      });

      service.start();
      window.__autosaveService = service;
    </script>
  </body>
</html>`;

    await page.route('**/__autosave_fixture__', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: fixtureHtml
      });
    });

    await page.route('**/js/services/autosaveService.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: autosaveModuleSource
      });
    });

    await page.route('**/api/v2/drafts/session/latest', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/api/v2/drafts', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON?.();
        if (body) {
          postPayloads.push(body);
        }

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'draft-playwright', updatedAt: '2024-02-02T12:00:00Z' })
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/api/v2/drafts/draft-playwright', async (route) => {
      const request = route.request();
      if (request.method() === 'PUT') {
        const body = request.postDataJSON?.();
        if (body) {
          putPayloads.push(body);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'draft-playwright', updatedAt: '2024-02-02T12:05:00Z' })
        });
        return;
      }

      await route.fulfill({ status: 405, body: '' });
    });

    await page.goto('__autosave_fixture__');

    const statusRegion = page.getByRole('status');
    await expect(statusRegion).toContainText('Autosave ready.');

    const titleInput = page.getByRole('textbox', { name: 'Title*' });
    await titleInput.fill('Playwright autosave draft');

    await expect(statusRegion).toContainText('Autosave scheduled.');
    await expect(statusRegion).toContainText('Draft saved');

    expect(postPayloads).toHaveLength(1);
    expect(postPayloads[0]).toHaveProperty('payload');

    const storedDraftId = await page.evaluate(() => window.localStorage.getItem('elmo.autosave.draftId'));
    expect(storedDraftId).toBe('draft-playwright');

    await titleInput.fill('Playwright autosave draft updated');
    await expect(statusRegion).toContainText('Draft saved');

    expect(putPayloads).toHaveLength(1);
    expect(putPayloads[0]).toHaveProperty('payload');
  });
});