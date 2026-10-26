import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import {
  navigateToHome, REPO_ROOT, registerGoogleMapsNoopRoute, waitForHomepageReady, waitForFormInteractionReady,
} from '../utils';

// Reduced public response from 2026-10-16:
// https://api.datacite.org/dois/10.5880%2Fha-arbodat_ak25?affiliation=true
const SOURCE = JSON.parse(readFileSync(
  path.join(REPO_ROOT, 'tests/fixtures/doi-prefill/issue-1282-datacite.json'), 'utf8'
)).data.attributes;
// Baseline browser/dependency warnings reproduced on blank pages or with the
// DOI import script from 009564e2. Record them explicitly; reject other warnings.
const EXISTING_BROWSER_WARNINGS = new Set([
  'XSLTProcessor and XSLT Processing Instructions have been deprecated by all browsers. '
    + 'These features will be removed from this browser soon. '
    + 'See https://chromestatus.com/feature/4709671889534976.',
  'XSLT will be removed from this web browser soon. See https://github.com/mozilla/standards-positions/issues/1287',
  'XSLT is deprecated and will be removed in a future version of WebKit.',
  'onmozfullscreenchange is deprecated.',
  'onmozfullscreenerror is deprecated.',
  'This site appears to use a scroll-linked positioning effect. This may not work well with asynchronous panning; '
    + 'see https://firefox-source-docs.mozilla.org/performance/scroll-linked_effects.html '
    + 'for further details and to join the discussion on related tools and features!',
]);

async function importedMetadata(page: Page) {
  return page.evaluate(() => ({
    authors: (window as any).authorStack.collectPayload().map(({ entryKey, ...author }: any) => author),
    contributors: (window as any).contributorStack.collectPayload(),
    titles: (window as any).resourceInformation.collectPayload().titles.map(({ text, typeId }: any) => ({ text, typeId })),
    doi: (window as any).resourceInformation.collectPayload().doi,
  }));
}

test.describe('DOI prefill XML roundtrip, issues #1282 and #1300', () => {
  test('does not expose stored contact details by ORCID or name', async ({ request }) => {
    const queries: Record<string, string>[] = [
      { orcid: '0000-0003-2450-824X' },
      { familyname: 'Kreuz', givenname: 'Angela' },
      {},
    ];
    for (const params of queries) {
      const response = await request.get('/api/v2/doi/contacts', { params });
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not Found' });
    }
  });

  for (const [titleType, titleLabel] of [['Other', 'Other'], ['TranslatedTitle', 'Translated Title']]) {
    test(`preserves DataCite ${titleType} and an affiliation without ROR through save and reload`, async ({ page }) => {
      test.slow();
      const attributes = structuredClone(SOURCE);
      attributes.titles[1].titleType = titleType;
      // Add a second role for the author/contact without changing the published fixture.
      attributes.contributors.push({ ...structuredClone(attributes.creators[0]), contributorType: 'DataCollector' });
      const browserErrors: string[] = [];
      page.on('console', message => {
        if (message.type() === 'warning' || message.type() === 'error') {
          // Firefox includes the source URL and line in its native warnings.
          const text = message.text().match(/^\[JavaScript Warning: "(.+)" \{file: /)?.[1] || message.text();
          if (message.type() === 'warning' && EXISTING_BROWSER_WARNINGS.has(text)) {
            test.info().annotations.push({ type: 'existing-browser-warning', description: message.text() });
            return;
          }
          browserErrors.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', error => browserErrors.push(error.message));
      await registerGoogleMapsNoopRoute(page);
      // Use the installer catalog: an external ERNIE instance may disable Other.
      // IDs match scripts/install.php so the real save/export path still resolves them.
      await page.route('**/api/v2/vocabs/titletypes', route => route.fulfill({ json: [
        { id: 1, name: 'Alternative Title' }, { id: 2, name: 'Main Title' },
        { id: 3, name: 'Other' }, { id: 4, name: 'Subtitle' }, { id: 5, name: 'Translated Title' },
      ] }));
      await page.route('**/api/v2/vocabs/thesauri/availability', route => route.fulfill({ json: {} }));
      await page.route('**/api/v2/doi/lookup/**', route =>
        route.fulfill({ json: { found: true, attributes } }));

      await navigateToHome(page);
      await waitForHomepageReady(page);
      // Arrange previous input to exercise the real clearing flow on import.
      await page.evaluate(() => {
        (window as any).authorStack.setAuthors([{
          type: 'person', familyname: 'Previous author', affiliations: [{ label: 'Previous affiliation', rorId: '' }],
        }]);
        (document.querySelector('input[name="title[]"]') as HTMLInputElement).value = 'Previous title';
      });
      await page.locator('#input-resourceinformation-source-doi').fill(attributes.doi);
      await page.locator('#button-resourceinformation-prefill-doi').click();
      await expect(page.locator('#modal-doi-prefill')).toBeVisible();
      await page.locator('#button-doi-prefill-confirm').click();

      const label = attributes.creators[0].affiliation[0].name;
      await expect(page.locator('[data-author-affiliation-label]')).toHaveValue(label);
      await expect(page.locator('input[name="contacts[]"]')).toBeChecked();
      await expect(page.locator('input[name="cpEmail[]"]')).toHaveValue('');
      await expect(page.locator('select[name="titleType[]"]').nth(1).locator('option:checked')).toHaveText(titleLabel);
      await expect(page.locator('#doi-lookup-spinner')).toHaveCount(0);
      await expect(page.locator('#input-resourceinformation-source-doi')).toHaveValue(attributes.doi);
      await expect(page.locator('#input-resourceinformation-doi')).toHaveValue('');

      // Supply only missing required values, preserving all imported fields.
      if (!(await page.locator('[data-author-edit-panel]').isVisible())) await page.locator('[data-author-toggle-edit]').click();
      await page.locator('input[name="cpEmail[]"]').fill('contact@example.org');
      await page.locator('#input-resourceinformation-language').selectOption({ label: 'English' });
      await page.locator('#input-abstract').fill('Synthetic abstract for the DOI import roundtrip.');
      await page.locator('#input-date-created').fill('2026-10-16');
      const beforeSave = await importedMetadata(page);
      expect(beforeSave.authors).toHaveLength(1);
      expect(beforeSave.authors[0]).toMatchObject({
        familyname: 'Kreuz', givenname: 'Angela', orcid: '0000-0003-2450-824X',
        affiliations: [{ label, rorId: '' }], isContact: true,
      });

      await page.locator('#button-form-save').click();
      await expect(page.locator('#modal-saveas')).toBeVisible();
      await page.locator('#input-saveas-filename').fill('issue-1282-doi-import');
      await waitForFormInteractionReady(page, 'save');
      const responsePromise = page.waitForResponse(response =>
        response.url().includes('/save/save_data.php') && response.request().method() === 'POST');
      const downloadPromise = page.waitForEvent('download');
      await page.locator('#button-saveas-save').click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      // Check the actual exported file. Reading a fetch response with an
      // attachment header through browser devtools can yield an empty body.
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const xml = Buffer.concat(chunks).toString('utf8');
      await test.info().attach('saved-metadata.xml', { body: xml, contentType: 'application/xml' });
      const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true }).parse(xml);
      const resource = parsed.resource || parsed.envelope?.resource;
      expect(resource, `Expected a DataCite resource in the downloaded XML: ${xml.slice(0, 1000)}`).toBeTruthy();
      expect(resource.titles.title[1]).toMatchObject({ '#text': attributes.titles[1].title, titleType });
      const creator = Array.isArray(resource.creators.creator) ? resource.creators.creator[0] : resource.creators.creator;
      expect(creator.affiliation).toBe(label);
      const exportedContributors = [resource.contributors.contributor].flat();
      expect(exportedContributors.filter((entry: any) => entry.contributorType === 'ContactPerson')).toHaveLength(1);
      expect(exportedContributors.some((entry: any) => entry.contributorType === 'DataCollector')).toBe(true);
      expect(typeof resource.identifier === 'string' ? resource.identifier : resource.identifier?.['#text'] || '').toBe('');

      await expect(page.locator('#modal-notification')).toBeHidden({ timeout: 15000 });
      await page.locator('#button-form-reset').click();
      await expect(page.locator('#modal-confirm')).toBeVisible();
      await page.locator('#button-confirm-action').click();
      await expect(page.locator('input[name="title[]"]').first()).toHaveValue('');
      await expect(page.locator('[data-author-card]')).toHaveCount(0);

      await page.locator('#button-form-load').click();
      await expect(page.locator('#modal-uploadxml')).toBeVisible();
      await page.locator('#input-uploadxml-file').setInputFiles({
        name: 'issue-1282.xml', mimeType: 'application/xml', buffer: Buffer.from(xml),
      });
      await expect.poll(() => importedMetadata(page), { timeout: 20000 }).toEqual(beforeSave);
      await expect(page.locator('[data-author-affiliation-label]')).toHaveValue(label);
      await expect(page.locator('select[name="titleType[]"]').nth(1).locator('option:checked')).toHaveText(titleLabel);
      expect(browserErrors).toEqual([]);
    });
  }
});
