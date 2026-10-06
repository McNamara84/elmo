import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../utils/constants';
import { injectScript, injectStylesheet } from '../utils/assets';

const RESOURCE_INFO_TEMPLATE = readFileSync(
  path.join(REPO_ROOT, 'formgroups/resource-information.html'),
  'utf8'
);
const AUTHORS_TEMPLATE = readFileSync(
  path.join(REPO_ROOT, 'formgroups/authors.html'),
  'utf8'
);

const TEST_ROUTE_PATH = '/doi-prefill-test';

/** Minimal page that embeds the DOI field and an author row */
const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <base href="/" />
    <title>DOI Prefill Test</title>
  </head>
  <body>
    <main class="container p-3">
      ${RESOURCE_INFO_TEMPLATE}
      ${AUTHORS_TEMPLATE}
      <div id="modal-doi-prefill" class="modal fade" tabindex="-1"
           aria-labelledby="modal-doi-prefill-label" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modal-doi-prefill-label">Pre-fill from DOI</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p>The following metadata was found for this DOI.</p>
              <div id="doi-prefill-preview" class="doi-prefill-preview mt-2"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" id="button-doi-prefill-cancel"
                data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="button-doi-prefill-confirm">Apply</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>`;

/** Simulated DataCite response for a known DOI */
const MOCK_DOI_RESPONSE = {
  found: true,
  attributes: {
    doi: '10.5880/test.2024.001',
    titles: [{ title: 'E2E Test Dataset' }],
    creators: [
      {
        givenName: 'Alice',
        familyName: 'Tester',
        nameType: 'Personal',
        nameIdentifiers: [
          { nameIdentifier: 'https://orcid.org/0000-0001-0000-0001', nameIdentifierScheme: 'ORCID' },
        ],
        affiliation: [{ name: 'GFZ Potsdam', affiliationIdentifier: 'https://ror.org/04z8jg394' }],
      },
    ],
    contributors: [],
    publicationYear: 2024,
    types: { resourceTypeGeneral: 'Dataset' },
    language: 'en',
    version: '1.0',
    descriptions: [{ descriptionType: 'Abstract', description: 'E2E test abstract' }],
    dates: [{ dateType: 'Created', date: '2024-03-15' }],
    geoLocations: [],
    subjects: [{ subject: 'Test Keyword' }],
    fundingReferences: [],
    relatedIdentifiers: [],
    rightsList: [{ rightsIdentifier: 'CC-BY-4.0', rights: 'Creative Commons Attribution 4.0' }],
    formats: [],
    sizes: [],
  },
};

test.describe('DOI Prefill Feature', () => {
  let doiLookupRequestCount = 0;

  test.beforeEach(async ({ page }) => {
    doiLookupRequestCount = 0;
    // Serve our test page
    await page.route(`**${TEST_ROUTE_PATH}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: TEST_PAGE_HTML,
      });
    });

    // Intercept DOI lookup API calls with mock data
    await page.route('**/api/v2/doi/lookup/**', async route => {
      doiLookupRequestCount += 1;
      const url = route.request().url();
      if (url.includes('10.5880')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_DOI_RESPONSE),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ found: false }),
        });
      }
    });

    // Intercept contact lookup API
    await page.route('**/api/v2/doi/contacts**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: null, website: null }),
      });
    });

    // Intercept vocab API calls
    await page.route('**/api/v2/vocabs/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(TEST_ROUTE_PATH);

    // Inject dependencies
    await injectStylesheet(page, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
    await injectStylesheet(page, 'css/gfz-cd.css');
    await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');
    await injectScript(page, 'node_modules/jquery-ui/dist/jquery-ui.min.js');
    await injectScript(page, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');

    // Inject clearInputFields stub and DoiLookupService + doiPrefill + handler
    await page.addScriptTag({
      content: `
        window.loadClearInputFields = function () {
          return Promise.resolve(function () {});
        };
        window.elmo = window.elmo || {};
      `,
    });

    await injectScript(page, 'js/services/doiLookupService.js');
    await injectScript(page, 'js/resourceTypeUtils.js');
    await injectScript(page, 'js/doiPrefill.js');
    await injectScript(page, 'js/eventhandlers/doiPrefillHandler.js');

    // Trigger DOMContentLoaded to initialize the handler
    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
  });

  test('shows prefill modal after explicit DOI lookup', async ({ page }) => {
    const sourceInput = page.locator('#input-resourceinformation-source-doi');
    await sourceInput.fill('10.5880/test.2024.001');
    await page.locator('#button-resourceinformation-prefill-doi').click();

    // Wait for the modal to appear
    const modal = page.locator('#modal-doi-prefill');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Preview should contain the title
    const preview = page.locator('#doi-prefill-preview');
    await expect(preview).toContainText('E2E Test Dataset');
  });

  test('does not show modal for invalid DOI format', async ({ page }) => {
    await page.locator('#input-resourceinformation-source-doi').fill('not-a-doi');
    await page.locator('#button-resourceinformation-prefill-doi').click();

    const modal = page.locator('#modal-doi-prefill');
    await expect(modal).not.toBeVisible();
    expect(doiLookupRequestCount).toBe(0);
  });

  test('empty metadata search keeps a neutral appearance after submit validation', async ({ page }) => {
    const sourceInput = page.locator('#input-resourceinformation-source-doi');
    const neutral = await sourceInput.evaluate(input => getComputedStyle(input).borderTopColor);
    await page.locator('form').evaluate(form => form.classList.add('was-validated'));
    await page.locator('#button-resourceinformation-prefill-doi').click();

    const state = await sourceInput.evaluate(input => ({
      border: getComputedStyle(input).borderTopColor,
      background: getComputedStyle(input).backgroundImage,
      invalid: input.getAttribute('aria-invalid')
    }));
    expect(state).toEqual({ border: neutral, background: 'none', invalid: 'false' });
    await expect(page.locator('#source-doi-status')).toBeEmpty();

    await sourceInput.fill('invalid');
    await page.locator('#button-resourceinformation-prefill-doi').click();
    await expect(page.locator('#source-doi-status')).toContainText('valid DOI');
    await sourceInput.clear();
    await expect(page.locator('#source-doi-status')).toBeEmpty();
  });

  test('metadata search button aligns with the field and stacks on narrow screens', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    const field = page.locator('#input-resourceinformation-source-doi');
    const button = page.locator('#button-resourceinformation-prefill-doi');
    const desktopField = await field.boundingBox();
    const desktopButton = await button.boundingBox();
    expect(desktopField && desktopButton).toBeTruthy();
    expect(Math.abs(desktopField!.y - desktopButton!.y)).toBeLessThan(2);
    expect(Math.abs(desktopField!.height - desktopButton!.height)).toBeLessThan(2);

    await page.setViewportSize({ width: 375, height: 800 });
    const mobileField = await field.boundingBox();
    const mobileButton = await button.boundingBox();
    expect(mobileField && mobileButton).toBeTruthy();
    expect(mobileButton!.y).toBeGreaterThan(mobileField!.y + mobileField!.height);
  });

  test('submission DOI edit and help controls sit next to each other', async ({ page }) => {
    const edit = await page.locator('#button-resourceinformation-edit-doi').boundingBox();
    const help = await page.locator('.resource-doi-help').boundingBox();
    expect(edit && help).toBeTruthy();
    expect(help!.x).toBeGreaterThanOrEqual(edit!.x + edit!.width - 2);
    expect(Math.abs(help!.y - edit!.y)).toBeLessThan(2);
    expect(Math.abs(help!.height - edit!.height)).toBeLessThan(2);
  });

  test('external submission DOI stays visible and blocked without console warnings', async ({ page }) => {
    const consoleIssues: string[] = [];
    page.on('console', message => {
      if (message.type() === 'warning' || message.type() === 'error') consoleIssues.push(message.text());
    });
    page.on('pageerror', error => consoleIssues.push(error.message));
    const submissionDoi = page.locator('#input-resourceinformation-doi');
    await submissionDoi.evaluate((input: HTMLInputElement) => { input.readOnly = false; });
    await submissionDoi.fill('10.1234/external');
    await submissionDoi.blur();

    await expect(submissionDoi).toHaveValue('10.1234/external');
    await expect(page.locator('#submission-doi-status')).toContainText('10.5880');
    expect(await page.evaluate(() => (window as any).resourceInformationDoiValidation())).toBe(false);
    expect(await page.evaluate(() => (window as any).resourceInformationDoiValidation())).toBe(false);
    expect(consoleIssues).toEqual([]);
  });

  test('does not show modal for DOI not found in DataCite', async ({ page }) => {
    await page.locator('#input-resourceinformation-source-doi').fill('10.99999/nonexistent');
    const lookupResponse = page.waitForResponse(response =>
      response.url().includes('/api/v2/doi/lookup/')
    );
    await page.locator('#button-resourceinformation-prefill-doi').click();

    await lookupResponse;
    await expect(page.locator('#doi-lookup-spinner')).toHaveCount(0);
    const modal = page.locator('#modal-doi-prefill');
    await expect(modal).not.toBeVisible();
    expect(doiLookupRequestCount).toBe(1);
  });

  test('applies prefill data to form on confirm', async ({ page }) => {
    const sourceInput = page.locator('#input-resourceinformation-source-doi');
    const submissionDoi = page.locator('#input-resourceinformation-doi');
    await sourceInput.fill('10.5880/test.2024.001');
    await page.locator('#button-resourceinformation-prefill-doi').click();

    // Wait for modal
    const confirmBtn = page.locator('#button-doi-prefill-confirm');
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });

    // Click confirm and wait for prefill to finish (modal closes after apply starts)
    await confirmBtn.click();
    await expect(page.locator('#input-resourceinformation-publicationyear')).toHaveValue('2024', { timeout: 15000 });
    await expect(page.locator('#modal-doi-prefill')).toBeHidden({ timeout: 10000 });

    // Check form fields were populated
    await expect(sourceInput).toHaveValue('10.5880/test.2024.001');
    await expect(submissionDoi).toHaveValue('');
    await expect(submissionDoi).toHaveAttribute('readonly');

    const yearInput = page.locator('#input-resourceinformation-publicationyear');
    await expect(yearInput).toHaveValue('2024');

    const versionInput = page.locator('#input-resourceinformation-version');
    await expect(versionInput).toHaveValue('1.0');
    await expect(versionInput).toHaveClass(/prefill-highlight/);
  });

  test('cancel button closes modal without applying data', async ({ page }) => {
    await page.locator('#input-resourceinformation-source-doi').fill('10.5880/test.2024.001');
    await page.locator('#button-resourceinformation-prefill-doi').click();

    const cancelBtn = page.locator('#button-doi-prefill-cancel');
    await expect(cancelBtn).toBeVisible({ timeout: 10000 });

    // Clear DOI field first to verify it stays empty after cancel
    await page.evaluate(() => {
      (document.getElementById('input-resourceinformation-publicationyear') as HTMLInputElement).value = '';
    });

    await cancelBtn.click();

    // Modal should close
    await expect(page.locator('#modal-doi-prefill')).not.toBeVisible({ timeout: 5000 });

    // Year field should still be empty (data not applied)
    const yearInput = page.locator('#input-resourceinformation-publicationyear');
    await expect(yearInput).toHaveValue('');
  });

  test('does not look up the source DOI on blur', async ({ page }) => {
    const sourceInput = page.locator('#input-resourceinformation-source-doi');
    await sourceInput.fill('10.5880/test.2024.001');
    await sourceInput.blur();
    expect(doiLookupRequestCount).toBe(0);
    await page.locator('#button-resourceinformation-prefill-doi').click();

    // Wait for first modal
    const modal = page.locator('#modal-doi-prefill');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Confirm to apply
    await page.locator('#button-doi-prefill-confirm').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Blur again with the same source DOI; lookup still requires the button.
    await sourceInput.click();
    await sourceInput.blur();

    // The duplicate guard runs synchronously before any request can be issued.
    await expect(modal).not.toBeVisible();
    expect(doiLookupRequestCount).toBe(1);
  });
});
