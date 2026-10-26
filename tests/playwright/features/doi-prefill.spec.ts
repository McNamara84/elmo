import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../utils/constants';
import {
  injectScript, injectStylesheet, injectModuleFromApp, injectClearFormDependencies, registerStaticAssetRoutes,
} from '../utils/assets';

const RESOURCE_INFO_TEMPLATE = readFileSync(
  path.join(REPO_ROOT, 'formgroups/resource-information.html'),
  'utf8'
);
const AUTHORS_TEMPLATE = readFileSync(
  path.join(REPO_ROOT, 'formgroups/authors.html'),
  'utf8'
);
const CONTRIBUTORS_TEMPLATE = readFileSync(path.join(REPO_ROOT, 'formgroups/contributors.html'), 'utf8');
// Reduced public DataCite response retrieved 2026-10-16 with affiliation=true.
const ISSUE_1282 = JSON.parse(readFileSync(
  path.join(REPO_ROOT, 'tests/fixtures/doi-prefill/issue-1282-datacite.json'), 'utf8'
));
// Public responses with retrieval dates and URLs stored in the fixtures.
const ISSUE_1300 = ['icdp', 'dqto', 'fidgeo'].map(name => ({
  name,
  attributes: JSON.parse(readFileSync(path.join(REPO_ROOT, `tests/fixtures/doi-prefill/issue-1300-${name}.json`), 'utf8')).data.attributes,
}));
const TITLE_TYPES = [
  { id: 41, name: 'Main Title' }, { id: 17, name: 'Alternative Title' },
  { id: 83, name: 'Other' }, { id: 9, name: 'Translated Title' },
];

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
      ${CONTRIBUTORS_TEMPLATE}
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
  let doiResponse: { found: boolean; attributes: Record<string, any> };
  let contactRequests: Record<string, string>[] = [];
  let browserErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    doiLookupRequestCount = 0;
    doiResponse = structuredClone(MOCK_DOI_RESPONSE);
    contactRequests = [];
    browserErrors = [];
    page.on('console', message => {
      if (message.type() === 'warning' || message.type() === 'error') {
        browserErrors.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', error => browserErrors.push(error.message));
    await registerStaticAssetRoutes(page);
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
          body: JSON.stringify(doiResponse),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ found: false }),
        });
      }
    });

    // Trap the removed endpoint: any request is a privacy regression, even if it returns data.
    await page.route('**/api/v2/doi/contacts**', async route => {
      contactRequests.push(Object.fromEntries(new URL(route.request().url()).searchParams));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'another-publication@example.org', website: 'https://example.org/private' }),
      });
    });

    // Intercept vocab API calls
    await page.route('**/api/v2/vocabs/**', async route => {
      const vocabs: Record<string, unknown> = {
        titletypes: TITLE_TYPES,
        languages: [{ id: 23, name: 'English', code: 'en' }],
        resourcetypes: [{ id: 67, resource_type_general: 'Dataset' }],
      };
      const name = new URL(route.request().url()).pathname.split('/').pop()!;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(vocabs[name] || []),
      });
    });
    await page.route('**/api/v2/validation/identifiertypes/active', route =>
      route.fulfill({ json: { identifierTypes: [] } }));

    await page.goto(TEST_ROUTE_PATH);

    // Inject dependencies
    await injectStylesheet(page, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
    await injectStylesheet(page, 'css/gfz-cd.css');
    await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');
    await injectScript(page, 'node_modules/jquery-ui/dist/jquery-ui.min.js');
    await injectScript(page, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');

    // Initialize the actual form controllers and clearing flow: a partial import
    // must not pass just because the year was set before an exception occurred.
    await page.addScriptTag({
      content: `
        window.elmo = window.elmo || {};
        window.maxTitles = 5;
      `,
    });

    await injectModuleFromApp(page, 'js/eventhandlers/formgroups/resourceInformationTitle.js');
    await injectModuleFromApp(page, 'js/eventhandlers/formgroups/authorStack.js');
    await injectModuleFromApp(page, 'js/eventhandlers/formgroups/contributorStack.js');
    await injectClearFormDependencies(page);
    await injectScript(page, 'js/services/doiLookupService.js');
    await injectScript(page, 'js/resourceTypeUtils.js');
    await injectScript(page, 'js/doiPrefill.js');
    await injectScript(page, 'js/eventhandlers/doiPrefillHandler.js');

    await page.waitForFunction(() => {
      const app = window as any;
      return app.authorStack && app.contributorStack && app.resourceInformation;
    });
    await page.evaluate(async () => { await (window as any).elmo.dropdownsReady; });
    // Observe the real import promise: a modal can already be hidden before its
    // hidden.bs.modal callback starts the asynchronous import.
    await page.evaluate(() => {
      const app = window as any;
      const applyPrefill = app.applyDoiPrefill;
      app.applyDoiPrefill = (...args: any[]) => (app.doiPrefillFinished = applyPrefill(...args));
    });
  });

  test.afterEach(() => {
    expect(browserErrors, 'The entire DOI import must complete without console warnings or errors').toEqual([]);
    expect(contactRequests, 'DOI import must not query stored contact details').toEqual([]);
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

  test('accepts a doi.org link for metadata import without reusing its DOI', async ({ page }) => {
    const sourceInput = page.locator('#input-resourceinformation-source-doi');
    await sourceInput.fill('https://doi.org/10.5880/test.2024.001');
    await page.locator('#button-resourceinformation-prefill-doi').click();

    await expect(page.locator('#modal-doi-prefill')).toBeVisible();
    await expect(sourceInput).toHaveValue('10.5880/test.2024.001');
    await expect(page.locator('#input-resourceinformation-doi')).toHaveValue('');
    expect(doiLookupRequestCount).toBe(1);
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
    // Compare settled styles rather than an intermediate CSS transition color.
    await sourceInput.evaluate(input => { input.style.transition = 'none'; });
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

  test('metadata search icon is accessible and aligns on wide and narrow screens', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    const field = page.locator('#input-resourceinformation-source-doi');
    const button = page.locator('#button-resourceinformation-prefill-doi');
    await expect(button).toHaveAccessibleName('Import metadata from an existing DOI');
    await expect(button).toHaveAttribute('title', 'Import metadata from an existing DOI');
    await expect(button).toHaveClass(/btn-outline-secondary/u);
    await expect(button.locator('.bi-search')).toHaveCount(1);
    const desktopField = await field.boundingBox();
    const desktopButton = await button.boundingBox();
    expect(desktopField && desktopButton).toBeTruthy();
    expect(Math.abs(desktopField!.y - desktopButton!.y)).toBeLessThan(2);
    expect(Math.abs(desktopField!.height - desktopButton!.height)).toBeLessThan(2);

    await page.setViewportSize({ width: 375, height: 800 });
    const mobileField = await field.boundingBox();
    const mobileButton = await button.boundingBox();
    const mobileSearch = await page.locator('.resource-doi-search').boundingBox();
    expect(mobileField && mobileButton).toBeTruthy();
    expect(mobileButton!.y).toBeGreaterThan(mobileField!.y + mobileField!.height);
    expect(mobileButton!.x + mobileButton!.width).toBeLessThanOrEqual(mobileSearch!.x + mobileSearch!.width + 1);
    expect(mobileButton!.width).toBeLessThan(60);
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
    await expect(page.locator('[data-author-affiliation-label]')).toHaveValue('GFZ Potsdam');
    await expect(page.locator('#doi-lookup-spinner')).toHaveCount(0);
  });

  for (const [titleType, label, id] of [['Other', 'Other', '83'], ['TranslatedTitle', 'Translated Title', '9']]) {
    test(`imports the published ${titleType} and the issue #1282 affiliation without a ROR ID`, async ({ page }) => {
      doiResponse = { found: true, attributes: structuredClone(ISSUE_1282.data.attributes) };
      doiResponse.attributes.titles[1].titleType = titleType;
      await page.locator('#input-resourceinformation-source-doi').fill(doiResponse.attributes.doi);
      await page.locator('#button-resourceinformation-prefill-doi').click();
      await page.locator('#button-doi-prefill-confirm').click();

      const expectedAffiliation = ISSUE_1282.data.attributes.creators[0].affiliation[0].name;
      await expect(page.locator('[data-author-affiliation-label]')).toHaveValue(expectedAffiliation);
      await expect(page.locator('select[name="titleType[]"]').nth(1)).toHaveValue(id);
      await expect(page.locator('select[name="titleType[]"]').nth(1).locator('option:checked')).toHaveText(label);
      await expect(page.locator('#doi-lookup-spinner')).toHaveCount(0);
      const payload = await page.evaluate(() => ({
        authors: JSON.parse((document.querySelector('[name="authorsPayload"]') as HTMLInputElement).value),
        resource: JSON.parse((document.querySelector('[name="resourceInformationPayload"]') as HTMLInputElement).value),
      }));
      expect(payload.authors[0].affiliations).toEqual([{ label: expectedAffiliation, rorId: '' }]);
      expect(payload.resource.titles.map((title: any) => [title.text, title.typeId])).toEqual([
        [doiResponse.attributes.titles[0].title, '41'], [doiResponse.attributes.titles[1].title, id],
      ]);
      await expect(page.locator('#input-resourceinformation-doi')).toHaveValue('');
    });
  }

  test('keeps multiple text and ROR affiliations when importing a contact role', async ({ page }) => {
    doiResponse.attributes.contributors = [{ ...doiResponse.attributes.creators[0], contributorType: 'ContactPerson' }];
    doiResponse.attributes.creators[0].affiliation = [
      'Institute, Wiesbaden, Deutschland',
      { name: 'GFZ', affiliationIdentifier: 'https://ror.org/04z8jg394' },
    ];
    await page.locator('#input-resourceinformation-source-doi').fill(doiResponse.attributes.doi);
    await page.locator('#button-resourceinformation-prefill-doi').click();
    await page.locator('#button-doi-prefill-confirm').click();
    await expect(page.locator('input[name="contacts[]"]')).toBeChecked();
    await expect(page.locator('input[name="cpEmail[]"]')).toHaveValue('');
    await expect(page.locator('[data-author-affiliation-label]')).toHaveCount(2);
    await expect(page.locator('[data-author-affiliation-label]').nth(0)).toHaveValue('Institute, Wiesbaden, Deutschland');
    await expect(page.locator('[data-author-affiliation-label]').nth(1)).toHaveValue('GFZ');
    await expect(page.locator('#doi-lookup-spinner')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).authorStack.collectPayload()[0])).toMatchObject({
      isContact: true,
      email: '',
      website: '',
      affiliations: [
        { label: 'Institute, Wiesbaden, Deutschland', rorId: '' },
        { label: 'GFZ', rorId: '04z8jg394' },
      ],
    });
  });

  async function importCurrentDoi(page: Page) {
    await page.evaluate(() => { (window as any).doiPrefillFinished = null; });
    await page.locator('#input-resourceinformation-source-doi').fill(doiResponse.attributes.doi);
    await page.locator('#button-resourceinformation-prefill-doi').click();
    await expect(page.locator('#modal-doi-prefill')).toBeVisible();
    await page.locator('#button-doi-prefill-confirm').click();
    await expect(page.locator('#modal-doi-prefill')).toBeHidden();
    await page.waitForFunction(() => Boolean((window as any).doiPrefillFinished));
    await page.evaluate(() => (window as any).doiPrefillFinished);
    await expect(page.locator('#doi-lookup-spinner')).toHaveCount(0);
  }

  for (const { name, attributes } of ISSUE_1300) {
    test(`issue #1300: displays published ${name} contacts with empty email and website`, async ({ page }) => {
      doiResponse.attributes = { ...doiResponse.attributes, ...structuredClone(attributes) };
      const expectedNames = attributes.contributors.filter((entry: any) => entry.contributorType === 'ContactPerson')
        .map((entry: any) => entry.familyName).sort();
      await importCurrentDoi(page);
      await expect(page.locator('input[name="contacts[]"]:checked')).toHaveCount(expectedNames.length);
      await expect(page.locator('[data-author-contact-badge]:visible')).toHaveCount(expectedNames.length);
      const payload = await page.evaluate(() => ({
        authors: JSON.parse((document.querySelector('[name="authorsPayload"]') as HTMLInputElement).value),
        contributors: JSON.parse((document.querySelector('[name="contributorsPayload"]') as HTMLInputElement).value),
      }));
      expect(payload.authors.filter((author: any) => author.isContact).map((author: any) => author.familyname).sort()).toEqual(expectedNames);
      expect(payload.authors.every((author: any) => author.email === '' && author.website === '')).toBe(true);
      expect(payload.contributors.some((entry: any) => entry.roles.includes('Contact Person'))).toBe(false);
      for (const checkbox of await page.locator('input[name="contacts[]"]:checked').all()) {
        const card = checkbox.locator('xpath=ancestor::*[@data-author-entry-row]');
        if (!(await card.locator('[data-author-edit-panel]').isVisible())) await card.locator('[data-author-toggle-edit]').click();
        await expect(card.locator('input[name="cpEmail[]"]')).toBeVisible();
        await expect(card.locator('input[name="cpEmail[]"]')).toHaveValue('');
        await expect(card.locator('input[name="cpOnlineResource[]"]')).toHaveValue('');
      }
    });
  }

  test('does not mark or enrich authors without a published contact role', async ({ page }) => {
    doiResponse.attributes.contributors = [];
    await importCurrentDoi(page);
    await expect(page.locator('input[name="contacts[]"]:checked')).toHaveCount(0);
    expect(contactRequests).toEqual([]);
    expect(await page.evaluate(() => (window as any).authorStack.collectPayload()[0])).toMatchObject({ isContact: false, email: '', website: '' });
  });

  test('uses ORCID to mark the correct same-named author and preserves another contributor role', async ({ page }) => {
    const creator = doiResponse.attributes.creators[0];
    const second = { ...structuredClone(creator), nameIdentifiers: [{ nameIdentifierScheme: 'ORCID', nameIdentifier: '0000-0002-0000-0002' }] };
    doiResponse.attributes.creators.push(second);
    doiResponse.attributes.contributors = [
      { ...second, contributorType: 'ContactPerson' }, { ...second, contributorType: 'DataCollector' },
    ];
    await importCurrentDoi(page);
    const payload = await page.evaluate(() => ({
      authors: (window as any).authorStack.collectPayload(), contributors: (window as any).contributorStack.collectPayload(),
    }));
    expect(payload.authors[0]).toMatchObject({ isContact: false, email: '' });
    expect(payload.authors[1]).toMatchObject({ isContact: true, email: '', website: '' });
    expect(payload.contributors[0].roles).toEqual(['Data Collector']);
  });

  test('keeps an unmatched contact contributor with empty contact fields', async ({ page }) => {
    doiResponse.attributes.contributors = [{ nameType: 'Personal', familyName: 'External', givenName: 'Contact', contributorType: 'ContactPerson' }];
    await importCurrentDoi(page);
    await expect(page.locator('input[name="contacts[]"]:checked')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).contributorStack.collectPayload()[0])).toMatchObject({
      familyname: 'External', roles: ['Contact Person'], email: '', website: '',
    });
    await expect(page.locator('[data-contributor-roles]')).toHaveText('Contact Person');
  });

  test('a second DOI import clears contact marks and manually entered details', async ({ page }) => {
    doiResponse.attributes.contributors = [{ ...doiResponse.attributes.creators[0], contributorType: 'ContactPerson' }];
    await importCurrentDoi(page);
    await expect(page.locator('input[name="contacts[]"]:checked')).toHaveCount(1);
    if (!(await page.locator('[data-author-edit-panel]').isVisible())) await page.locator('[data-author-toggle-edit]').click();
    await page.locator('input[name="cpEmail[]"]').fill('first@example.org');
    await page.locator('input[name="cpOnlineResource[]"]').fill('https://example.org/first');
    doiResponse.attributes.contributors = [];
    await importCurrentDoi(page);
    await expect(page.locator('input[name="contacts[]"]:checked')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).authorStack.collectPayload()[0])).toMatchObject({ isContact: false, email: '', website: '' });
    expect(contactRequests).toEqual([]);
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
