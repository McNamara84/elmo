import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../utils/constants';
import { injectScript, injectStylesheet } from '../utils/assets';

const RESOURCE_INFO_TEMPLATE = readFileSync(
  path.join(REPO_ROOT, 'formgroups/resourceInformation.html'),
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
  test.beforeEach(async ({ page }) => {
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
    await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');
    await injectScript(page, 'node_modules/jquery-ui/dist/jquery-ui.min.js');
    await injectScript(page, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');

    // Inject clearInputFields stub and DoiLookupService + doiPrefill + handler
    await page.addScriptTag({
      content: `
        window.clearInputFields = function () {};
        window.elmo = window.elmo || {};
      `,
    });

    await injectScript(page, 'js/services/doiLookupService.js');
    await injectScript(page, 'js/doiPrefill.js');
    await injectScript(page, 'js/eventhandlers/doiPrefillHandler.js');

    // Trigger DOMContentLoaded to initialize the handler
    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
  });

  test('shows prefill modal after DOI blur with valid DOI', async ({ page }) => {
    const doiInput = page.locator('#input-resourceinformation-doi');
    await doiInput.fill('10.5880/test.2024.001');
    // Trigger blur
    await doiInput.blur();

    // Wait for the modal to appear
    const modal = page.locator('#modal-doi-prefill');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Preview should contain the title
    const preview = page.locator('#doi-prefill-preview');
    await expect(preview).toContainText('E2E Test Dataset');
  });

  test('does not show modal for invalid DOI format', async ({ page }) => {
    const doiInput = page.locator('#input-resourceinformation-doi');
    await doiInput.fill('not-a-doi');
    await doiInput.blur();

    // Modal should NOT appear (wait briefly to be sure)
    await page.waitForTimeout(1000);
    const modal = page.locator('#modal-doi-prefill');
    await expect(modal).not.toBeVisible();
  });

  test('does not show modal for DOI not found in DataCite', async ({ page }) => {
    const doiInput = page.locator('#input-resourceinformation-doi');
    await doiInput.fill('10.99999/nonexistent');
    await doiInput.blur();

    await page.waitForTimeout(1500);
    const modal = page.locator('#modal-doi-prefill');
    await expect(modal).not.toBeVisible();
  });

  test('applies prefill data to form on confirm', async ({ page }) => {
    const doiInput = page.locator('#input-resourceinformation-doi');
    await doiInput.fill('10.5880/test.2024.001');
    await doiInput.blur();

    // Wait for modal
    const confirmBtn = page.locator('#button-doi-prefill-confirm');
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });

    // Click confirm
    await confirmBtn.click();

    // Wait for modal to close
    await expect(page.locator('#modal-doi-prefill')).not.toBeVisible({ timeout: 5000 });

    // Check form fields were populated
    await expect(doiInput).toHaveValue('10.5880/test.2024.001');

    const yearInput = page.locator('#input-resourceinformation-publicationyear');
    await expect(yearInput).toHaveValue('2024');

    const versionInput = page.locator('#input-resourceinformation-version');
    await expect(versionInput).toHaveValue('1.0');
    await expect(versionInput).toHaveClass(/prefill-highlight/);
  });

  test('cancel button closes modal without applying data', async ({ page }) => {
    const doiInput = page.locator('#input-resourceinformation-doi');
    await doiInput.fill('10.5880/test.2024.001');
    await doiInput.blur();

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

  test('does not re-trigger lookup for same DOI', async ({ page }) => {
    const doiInput = page.locator('#input-resourceinformation-doi');
    await doiInput.fill('10.5880/test.2024.001');
    await doiInput.blur();

    // Wait for first modal
    const modal = page.locator('#modal-doi-prefill');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Confirm to apply
    await page.locator('#button-doi-prefill-confirm').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Blur again with same DOI
    await doiInput.click();
    await doiInput.blur();

    // Modal should NOT appear again (same DOI already loaded)
    await page.waitForTimeout(1500);
    await expect(modal).not.toBeVisible();
  });
});
