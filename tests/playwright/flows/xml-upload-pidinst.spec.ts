import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { APP_BASE_URL, REPO_ROOT } from '../utils';
import { injectScript, injectStylesheet } from '../utils/assets';

// ─── Mock instruments returned by the PID4INST/ERNIE API ────────────────────
const MOCK_INSTRUMENTS_API = [
  {
    pid: '21.11157/0001',
    pidType: 'Handle',
    name: 'Broadband Seismometer STS-2',
    instrumentTypes: ['Seismometer', 'Broadband'],
  },
  {
    pid: '21.11157/0002',
    pidType: 'Handle',
    name: 'LaCoste-Romberg Gravimeter',
    instrumentTypes: ['Gravimeter'],
  },
  {
    pid: '10.12345/instrument-003',
    pidType: 'DOI',
    name: 'GPS Receiver Trimble NetR9',
    instrumentTypes: ['GNSS Receiver'],
  },
  {
    pid: '21.11157/9999',
    pidType: 'Handle',
    name: 'Unrelated Magnetometer',
    instrumentTypes: ['Magnetometer'],
  },
];

// ─── XML with 1 instrument ──────────────────────────────────────────────────
const XML_ONE_INSTRUMENT = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/pidinst.single</identifier>
  <publicationYear>2025</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="MainTitle">Single Instrument Test</title>
  </titles>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, Jane</creatorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-2345-6789</nameIdentifier>
      <affiliation affiliationIdentifierScheme="ROR" affiliationIdentifier="https://ror.org/04z8jg394">GFZ German Research Centre for Geosciences</affiliation>
    </creator>
  </creators>
  <descriptions>
    <description descriptionType="Abstract" xml:lang="en">Test with one instrument.</description>
  </descriptions>
  <dates>
    <date dateType="Created">2025-01-10</date>
  </dates>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0">Creative Commons Attribution 4.0</rights>
  </rightsList>
  <relatedIdentifiers>
    <relatedIdentifier relatedIdentifierType="Handle" relationType="IsCollectedBy">21.11157/0001</relatedIdentifier>
  </relatedIdentifiers>
</resource>`;

// ─── XML with 3 instruments (including one DOI-type) ────────────────────────
const XML_THREE_INSTRUMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/pidinst.triple</identifier>
  <publicationYear>2025</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="MainTitle">Three Instruments Test</title>
  </titles>
  <creators>
    <creator>
      <creatorName nameType="Personal">Smith, John</creatorName>
      <givenName>John</givenName>
      <familyName>Smith</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0002-9876-5432</nameIdentifier>
      <affiliation affiliationIdentifierScheme="ROR" affiliationIdentifier="https://ror.org/04z8jg394">GFZ German Research Centre for Geosciences</affiliation>
    </creator>
  </creators>
  <descriptions>
    <description descriptionType="Abstract" xml:lang="en">Test with three instruments.</description>
  </descriptions>
  <dates>
    <date dateType="Created">2025-03-20</date>
  </dates>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0">Creative Commons Attribution 4.0</rights>
  </rightsList>
  <relatedIdentifiers>
    <relatedIdentifier relatedIdentifierType="Handle" relationType="IsCollectedBy">21.11157/0001</relatedIdentifier>
    <relatedIdentifier relatedIdentifierType="Handle" relationType="IsCollectedBy">21.11157/0002</relatedIdentifier>
    <relatedIdentifier relatedIdentifierType="DOI" relationType="IsCollectedBy">10.12345/instrument-003</relatedIdentifier>
  </relatedIdentifiers>
</resource>`;

// ─── Templates & harness ────────────────────────────────────────────────────

function loadTemplate(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

const RESOURCE_INFORMATION_HTML = loadTemplate('formgroups/resourceInformation.html');
const RIGHTS_HTML = loadTemplate('formgroups/rights.html');
const AUTHORS_HTML = loadTemplate('formgroups/authors.html');
const DESCRIPTIONS_HTML = loadTemplate('formgroups/descriptions.html');
const DATES_HTML = loadTemplate('formgroups/dates.html');
const USED_INSTRUMENTS_HTML = loadTemplate('formgroups/usedInstruments.html');
const MODALS_HTML = loadTemplate('modals.html');

const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <base href="${APP_BASE_URL}" />
    <title>PIDINST Upload Test Harness</title>
  </head>
  <body>
    ${RESOURCE_INFORMATION_HTML}
    ${RIGHTS_HTML}
    ${AUTHORS_HTML}
    ${DESCRIPTIONS_HTML}
    ${DATES_HTML}
    ${USED_INSTRUMENTS_HTML}
    <div class="d-flex justify-content-end gap-2 p-3">
      <button type="button" class="btn btn-primary" id="button-form-load">Load</button>
    </div>
    ${MODALS_HTML}
  </body>
</html>`;

const TEST_TRANSLATIONS = {
  general: {
    logoTitle: 'ELMO',
    choose: 'Choose...',
    affiliation: 'Affiliation',
  },
  usedInstruments: {
    title: 'Used Instruments',
    placeholder: 'Search and select instruments...',
    loading: 'Loading instrument list...',
    unavailable: 'Instrument list currently unavailable.',
    selected: 'selected instruments',
  },
};

const MOCK_RESOURCE_TYPES = [
  { id: 1, resource_type_general: 'Dataset', description: 'Dataset resource' },
];

const MOCK_LANGUAGES = [
  { id: 1, name: 'English', code: 'en' },
];

const MOCK_TITLE_TYPES = [
  { id: 1, name: 'Main Title' },
];

const MOCK_LICENSES = [
  {
    rights_id: 1,
    text: 'Creative Commons Attribution 4.0 International',
    rightsIdentifier: 'CC-BY-4.0',
    forSoftware: '0',
  },
];

const MOCK_API_DATA: Record<string, any> = {
  'json/timezones.json': [{ label: 'UTC+00:00 (Africa/Abidjan)' }],
  'json/affiliations.json': [{
    id: 'aff-1',
    name: 'GFZ German Research Centre for Geosciences',
    other: ['GFZ'],
  }],
  'json/funders.json': [],
  'json/msl-labs.json': [],
  'api/v2/vocabs/resourcetypes': MOCK_RESOURCE_TYPES,
  'api/v2/vocabs/languages': MOCK_LANGUAGES,
  'api/v2/vocabs/titletypes': MOCK_TITLE_TYPES,
  'api/v2/vocabs/licenses/all': MOCK_LICENSES,
  'api/v2/vocabs/licenses/software': MOCK_LICENSES,
  'api/v2/vocabs/relations': { relations: [] },
  'api/v2/vocabs/pid4inst/instruments': MOCK_INSTRUMENTS_API,
  'api/v2/validation/identifiertypes/active': { identifierTypes: [] },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForEditorReady(page: Page) {
  await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const sel = document.querySelector<HTMLSelectElement>('#input-resourceinformation-language');
    return sel != null && sel.options.length > 1;
  }, { timeout: 30_000 });
}

async function uploadXml(page: Page, xmlContent: string, fileName: string) {
  await page.getByRole('button', { name: /Load/i }).click();
  const modal = page.locator('div#modal-uploadxml');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  await page.setInputFiles('#input-uploadxml-file', {
    name: fileName,
    mimeType: 'text/xml',
    buffer: Buffer.from(xmlContent, 'utf-8'),
  });

  // Wait for title to be populated (indicates XML processing is done)
  await page.waitForFunction(
    () => {
      const input = document.querySelector<HTMLInputElement>('#input-resourceinformation-title');
      return input != null && input.value.length > 0;
    },
    { timeout: 20_000 },
  );
}

/**
 * Returns the current Tagify tag values for the Used Instruments field,
 * together with their PID and pidType metadata.
 */
async function getInstrumentTags(page: Page) {
  return page.evaluate(() => {
    const input = document.querySelector('#input-usedinstruments') as any;
    if (!input?._tagify) return [];
    return (input._tagify.value || []).map((tag: any) => ({
      value: tag.value,
      pid: tag.pid,
      pidType: tag.pidType,
    }));
  });
}

/**
 * Returns the hidden input values for instrument PIDs and PID types.
 */
async function getHiddenInstrumentInputs(page: Page) {
  return page.evaluate(() => {
    const container = document.getElementById('usedinstruments-hidden-inputs');
    if (!container) return { pids: [], pidTypes: [] };
    const pidInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[name="instrumentPid[]"]'));
    const pidTypeInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[name="instrumentPidType[]"]'));
    return {
      pids: pidInputs.map(i => i.value),
      pidTypes: pidTypeInputs.map(i => i.value),
    };
  });
}

// ─── Test suite ─────────────────────────────────────────────────────────────

test.describe('XML Upload with PIDINST Instruments', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ translations }) => {
      (window as any).translations = translations;
      (window as any).ELMO_FEATURES = {
        showUsedInstruments: true,
        showMslLabs: false,
        showMslVocabs: false,
        showGGMsProperties: false,
        showThesauri: false,
      };
    }, { translations: TEST_TRANSLATIONS });

    await page.goto('about:blank');
    await page.setContent(TEST_PAGE_HTML);

    // Mock fetch() for about:blank pages (page.route doesn't work there)
    await page.evaluate((data) => {
      const mockDataMap = new Map(Object.entries(data.mockData));
      (window as any).__unmockedFetchUrls = [] as string[];

      (window as any).__originalFetch = window.fetch;
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input.toString();

        for (const [pattern, responseData] of mockDataMap.entries()) {
          if (url.includes(pattern)) {
            return Promise.resolve(new Response(JSON.stringify(responseData), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }));
          }
        }

        if (url.includes('api/v2/validation/patterns/')) {
          return Promise.resolve(new Response(JSON.stringify({ pattern: '.*' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }

        // Fail fast: record unmocked URL and return 404 so missing mocks surface immediately
        (window as any).__unmockedFetchUrls.push(url);
        return Promise.resolve(new Response(JSON.stringify({ error: 'Unmocked fetch URL: ' + url }), {
          status: 404,
          statusText: 'Not Found (unmocked)',
          headers: { 'Content-Type': 'application/json' },
        }));
      };
    }, { mockData: MOCK_API_DATA });

    // Inject stylesheets
    await injectStylesheet(page, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
    await injectStylesheet(page, 'node_modules/@yaireo/tagify/dist/tagify.css');

    // Inject JS dependencies
    await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');

    // Patch jQuery $.ajax to return mock data
    await page.evaluate((data) => {
      const mockDataMap = new Map(Object.entries(data.mockData));
      const $ = (window as any).jQuery;
      (window as any).__unmockedAjaxUrls = [] as string[];

      if ($ && $.ajax) {
        $.ajax = function (urlOrSettings: any, settings?: any) {
          let url: string;
          let opts: any;
          if (typeof urlOrSettings === 'string') {
            url = urlOrSettings;
            opts = settings || {};
          } else {
            url = urlOrSettings?.url || '';
            opts = urlOrSettings || {};
          }

          for (const [pattern, responseData] of mockDataMap.entries()) {
            if (url.includes(pattern)) {
              const deferred = $.Deferred();
              setTimeout(() => {
                if (opts.success) opts.success(responseData, 'success', {});
                if (opts.complete) opts.complete({}, 'success');
                deferred.resolve(responseData);
              }, 0);
              return deferred.promise();
            }
          }

          // Fail fast: record unmocked URL and return a deterministic error
          (window as any).__unmockedAjaxUrls.push(url);
          const deferred = $.Deferred();
          setTimeout(() => {
            if (opts.error) opts.error({ status: 404, statusText: 'Not Found (unmocked)' }, 'error', 'Unmocked $.ajax URL: ' + url);
            if (opts.complete) opts.complete({ status: 404 }, 'error');
            deferred.reject({ status: 404, statusText: 'Not Found (unmocked)' }, 'error', 'Unmocked $.ajax URL: ' + url);
          }, 0);
          return deferred.promise();
        };
      }
    }, { mockData: MOCK_API_DATA });

    await injectScript(page, 'node_modules/@yaireo/tagify/dist/tagify.js');
    await injectScript(page, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');

    // Modal hide tracking
    await page.evaluate(() => {
      const $ = (window as any).jQuery;
      if ($?.fn?.modal) {
        const originalModal = $.fn.modal;
        (window as any).__modalHideCalls = 0;
        $.fn.modal = function (action: any, ...args: any[]) {
          if (action === 'hide') {
            (window as any).__modalHideCalls = ((window as any).__modalHideCalls || 0) + 1;
          }
          return originalModal.call(this, action, ...args);
        };
      }
    });

    // Inject app scripts
    const appScripts = [
      'js/clear.js',
      'js/select.js',
      'js/affiliations.js',
      'js/usedInstruments.js',
      'js/upload.js',
      'js/mappingXmlToInputFields.js',
    ];

    for (const script of appScripts) {
      await injectScript(page, script);
    }

    // Fire initialization events
    await page.evaluate(() => {
      document.dispatchEvent(new Event('DOMContentLoaded'));
      window.dispatchEvent(new Event('load'));
      document.dispatchEvent(new Event('translationsLoaded'));
    });

    // Wait for Used Instruments module to be available
    await page.waitForFunction(
      () => !!(window as any).usedInstrumentsModule,
      null,
      { timeout: 10_000 },
    );

    await waitForEditorReady(page);
  });

  test.afterEach(async ({ page }) => {
    // Verify no unmocked URLs were requested during the test
    const unmockedFetch = await page.evaluate(() => (window as any).__unmockedFetchUrls || []);
    expect(unmockedFetch, 'Unmocked fetch URLs were requested').toEqual([]);

    const unmockedAjax = await page.evaluate(() => (window as any).__unmockedAjaxUrls || []);
    expect(unmockedAjax, 'Unmocked $.ajax URLs were requested').toEqual([]);
  });

  test('loads XML with 1 instrument and shows it persistently in Used Instruments', async ({ page }) => {
    await uploadXml(page, XML_ONE_INSTRUMENT, 'single-instrument.xml');

    // Wait for title to verify XML was loaded
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue('Single Instrument Test');

    // Wait for the instrument tag to appear (PID-only tags are added immediately)
    await expect.poll(
      async () => (await getInstrumentTags(page)).length,
      { timeout: 15_000, message: 'Expected 1 instrument tag to appear' },
    ).toBe(1);

    // Wait for the background API upgrade to replace PID-only display with real name
    await expect.poll(
      async () => {
        const t = await getInstrumentTags(page);
        return t[0]?.value ?? '';
      },
      { timeout: 15_000, intervals: [200], message: 'Expected tag to upgrade to API name' },
    ).toContain('Broadband Seismometer STS-2');

    // Verify the tag has correct PID data
    const tags = await getInstrumentTags(page);
    expect(tags[0].pid).toBe('21.11157/0001');
    expect(tags[0].pidType).toBe('Handle');

    // Verify hidden inputs are set correctly for form submission
    const hidden = await getHiddenInstrumentInputs(page);
    expect(hidden.pids).toEqual(['21.11157/0001']);
    expect(hidden.pidTypes).toEqual(['Handle']);

    // STABILITY CHECK: Verify tag count remains stable (no race condition removing tags)
    let stableCount = 0;
    await expect.poll(
      async () => {
        const currentTags = await getInstrumentTags(page);
        if (currentTags.length === 1) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        return stableCount;
      },
      { timeout: 5_000, intervals: [200], message: 'Tag count should remain stable at 1' },
    ).toBeGreaterThanOrEqual(3);

    const tagsAfterWait = await getInstrumentTags(page);
    expect(tagsAfterWait).toHaveLength(1);
    expect(tagsAfterWait[0].pid).toBe('21.11157/0001');

    const hiddenAfterWait = await getHiddenInstrumentInputs(page);
    expect(hiddenAfterWait.pids).toEqual(['21.11157/0001']);
  });

  test('loads XML with 3 instruments and shows all persistently in Used Instruments', async ({ page }) => {
    await uploadXml(page, XML_THREE_INSTRUMENTS, 'three-instruments.xml');

    // Wait for title to verify XML was loaded
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue('Three Instruments Test');

    // Wait for all 3 instrument tags to appear (PID-only tags are added immediately)
    await expect.poll(
      async () => (await getInstrumentTags(page)).length,
      { timeout: 15_000, message: 'Expected 3 instrument tags to appear' },
    ).toBe(3);

    // Wait for background API upgrade to replace PID-only display with real names
    await expect.poll(
      async () => {
        const t = await getInstrumentTags(page);
        return t.every((tag: any) => tag.value !== tag.pid);
      },
      { timeout: 15_000, intervals: [200], message: 'Expected all tags to upgrade to API names' },
    ).toBe(true);

    const tags = await getInstrumentTags(page);

    // Sort by PID for deterministic assertions
    const sorted = [...tags].sort((a, b) => a.pid.localeCompare(b.pid));

    // DOI instrument
    expect(sorted[0].pid).toBe('10.12345/instrument-003');
    expect(sorted[0].pidType).toBe('DOI');
    expect(sorted[0].value).toContain('GPS Receiver Trimble NetR9');

    // Handle instrument 1
    expect(sorted[1].pid).toBe('21.11157/0001');
    expect(sorted[1].pidType).toBe('Handle');
    expect(sorted[1].value).toContain('Broadband Seismometer STS-2');

    // Handle instrument 2
    expect(sorted[2].pid).toBe('21.11157/0002');
    expect(sorted[2].pidType).toBe('Handle');
    expect(sorted[2].value).toContain('LaCoste-Romberg Gravimeter');

    // Verify hidden inputs for all 3
    const hidden = await getHiddenInstrumentInputs(page);
    expect(hidden.pids).toHaveLength(3);
    expect(hidden.pidTypes).toHaveLength(3);

    // All PIDs from the XML should be present
    expect(hidden.pids).toContain('21.11157/0001');
    expect(hidden.pids).toContain('21.11157/0002');
    expect(hidden.pids).toContain('10.12345/instrument-003');

    // PID types should match
    const pidIndex003 = hidden.pids.indexOf('10.12345/instrument-003');
    expect(hidden.pidTypes[pidIndex003]).toBe('DOI');

    const pidIndex0001 = hidden.pids.indexOf('21.11157/0001');
    expect(hidden.pidTypes[pidIndex0001]).toBe('Handle');

    // STABILITY CHECK: Verify tag count remains stable (no race condition removing tags)
    let stableCount = 0;
    await expect.poll(
      async () => {
        const currentTags = await getInstrumentTags(page);
        if (currentTags.length === 3) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        return stableCount;
      },
      { timeout: 5_000, intervals: [200], message: 'Tag count should remain stable at 3' },
    ).toBeGreaterThanOrEqual(3);

    const tagsAfterWait = await getInstrumentTags(page);
    expect(tagsAfterWait).toHaveLength(3);

    const hiddenAfterWait = await getHiddenInstrumentInputs(page);
    expect(hiddenAfterWait.pids).toHaveLength(3);
  });
});
