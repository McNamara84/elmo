import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from '../utils';
import { injectModuleScript, injectScript, injectStylesheet } from '../utils/assets';

declare const translations: any;
declare function processKeywords(xmlDoc: Document, resolver: Function): void;

const THESAURI_TEMPLATE = readFileSync(path.join(REPO_ROOT, 'formgroups/thesaurusKeywords.html'), 'utf8').replace(/<\?php[\s\S]*?\?>/g, '');
const FREEKEYWORD_TEMPLATE = readFileSync(path.join(REPO_ROOT, 'formgroups/freeKeywords.html'), 'utf8').replace(/<\?php[\s\S]*?\?>/g, '');

const MOCK_SCIENCE_KEYWORDS = {
  data: [
    {
      id: 'sk-1', text: 'Science Keywords', scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
      language: 'en',
      children: [
        {
          id: 'sk-2', text: 'EARTH SCIENCE', scheme: 'GCMD',
          schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
          language: 'en',
          children: [
            {
              id: 'sk-3', text: 'AGRICULTURE', scheme: 'GCMD',
              schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
              language: 'en',
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

const MOCK_PLATFORMS = { data: [] };
const MOCK_INSTRUMENTS = { data: [] };

const MOCK_AVAILABILITY = {
  science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
  platforms: { available: true, displayName: 'GCMD Platforms' },
  instruments: { available: true, displayName: 'GCMD Instruments' },
  chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
  gemet: { available: false, displayName: 'GEMET' },
};

/**
 * XML snippet simulating a saved file with GCMD keywords and a free keyword.
 * Includes xml:lang on some subjects and omits it on others to test defaults.
 */
const TEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <subjects>
    <subject subjectScheme="GCMD"
             schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords"
             valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/sk-3"
             xml:lang="en">Science Keywords &gt; EARTH SCIENCE &gt; AGRICULTURE</subject>
    <subject subjectScheme="GCMD"
             schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords"
             xml:lang="de">Science Keywords &gt; EARTH SCIENCE</subject>
    <subject>climate change</subject>
  </subjects>
</resource>`;

const TEST_ROUTE_PATH = '/thesauri-roundtrip-test';

const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Roundtrip Test</title></head>
  <body>
    <main class="container p-3">
      ${THESAURI_TEMPLATE}
      ${FREEKEYWORD_TEMPLATE}
      <div id="help-scienceKeywords-keyword" role="note"></div>
      <div id="help-gcmd-platforms-keyword" role="note"></div>
      <div id="help-gcmd-instruments-keyword" role="note"></div>
    </main>
  </body>
</html>`;

async function waitForThesauriInit(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const thesaurusGroup = document.getElementById('thesaurusKeywordsGroup');
    return thesaurusGroup && thesaurusGroup.children.length > 0;
  }, { timeout: 15000 });
  await page.waitForFunction(() => Boolean((document.querySelector('#input-sciencekeyword') as any)?._tagify), { timeout: 15000 });
}

async function triggerTranslationsAndWaitForThesauri(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const header = document.querySelector('[data-translate="keywords.thesaurus.name"]');
    if (header) header.textContent = 'Thesauri Keywords';
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(() => {
      document.dispatchEvent(new Event('translationsLoaded'));
    });

    try {
      await page.waitForFunction(() => {
        const thesaurusGroup = document.getElementById('thesaurusKeywordsGroup');
        return thesaurusGroup && thesaurusGroup.children.length > 0;
      }, { timeout: 5000 });
      await page.waitForFunction(() => Boolean((document.querySelector('#input-sciencekeyword') as any)?._tagify), { timeout: 5000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

test.describe('Thesaurus Keywords Roundtrip (Issue #1043)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**${TEST_ROUTE_PATH}`, async route => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: TEST_PAGE_HTML });
    });
    await page.route('**/api/v2/vocabs/thesauri/availability', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_AVAILABILITY) });
    });
    await page.route('**/api/v2/vocabs/thesauri/gcmd-science-keywords', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCIENCE_KEYWORDS) });
    });
    await page.route('**/api/v2/vocabs/thesauri/gcmd-platforms', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PLATFORMS) });
    });
    await page.route('**/api/v2/vocabs/thesauri/gcmd-instruments', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSTRUMENTS) });
    });

    await page.goto(TEST_ROUTE_PATH);

    await injectStylesheet(page, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
    await injectStylesheet(page, 'node_modules/@yaireo/tagify/dist/tagify.css');
    await injectStylesheet(page, 'node_modules/jstree/dist/themes/default/style.min.css');
    await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');
    await injectScript(page, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');
    await injectScript(page, 'node_modules/jstree/dist/jstree.min.js');
    await injectScript(page, 'node_modules/@yaireo/tagify/dist/tagify.js');

    await page.evaluate(() => {
      (window as any).ELMO_FEATURES = { showThesauri: true };
      (window as any).translations = {
        keywords: {
          thesaurus: { label: 'Thesaurus keywords', name: 'Thesauri Keywords' },
          searchPlaceholder: 'Search...',
          selectedKeywords: 'Selected Keywords',
          freeKeywords: { label: 'Free keywords' },
        },
      };
    });

    // Initialise free keyword Tagify before thesauri module
    await page.evaluate(() => {
      const freeInput = document.querySelector('#input-freekeyword') as HTMLInputElement;
      if (freeInput && !(freeInput as any)._tagify) {
        (freeInput as any)._tagify = new (window as any).Tagify(freeInput, {
          placeholder: 'Free keywords',
          editTags: false,
        });
      }
    });

    await injectModuleScript(page, 'js/thesauri.js');

    await triggerTranslationsAndWaitForThesauri(page);
  });

  test('processKeywords loads tags with all metadata fields including language', async ({ page }) => {
    // Inject the production mapping module so processKeywords is available globally
    await injectScript(page, 'js/mappingXmlToInputFields.js');

    const tagData = await page.evaluate((xmlString) => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
      const ns = 'http://datacite.org/schema/kernel-4';
      const resolver = (prefix: string) => prefix === 'ns' ? ns : null;

      // Call the production processKeywords function
      (window as any).processKeywords(xmlDoc, resolver);

      const tagifyGCMD = (document.querySelector('#input-sciencekeyword') as any)?._tagify;
      const tagifyFree = (document.querySelector('#input-freekeyword') as any)?._tagify;

      return {
        gcmd: tagifyGCMD?.value || [],
        free: tagifyFree?.value || [],
      };
    }, TEST_XML);

    // Verify GCMD tags have all required metadata
    expect(tagData.gcmd).toHaveLength(2);

    // First tag: has explicit xml:lang="en" and valueURI
    expect(tagData.gcmd[0]).toMatchObject({
      value: expect.stringContaining('AGRICULTURE'),
      scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
      id: 'https://gcmd.earthdata.nasa.gov/kms/concept/sk-3',
      language: 'en',
    });

    // Second tag: has explicit xml:lang="de", no valueURI → id should be empty string
    expect(tagData.gcmd[1]).toMatchObject({
      value: expect.stringContaining('EARTH SCIENCE'),
      scheme: 'GCMD',
      schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
      id: '',
      language: 'de',
    });

    // Free keyword: no xml:lang attribute → no language property
    expect(tagData.free).toHaveLength(1);
    expect(tagData.free[0]).toMatchObject({
      value: 'climate change',
    });
    expect(tagData.free[0]).not.toHaveProperty('language');
  });

  test('Tagify hidden input contains valid JSON for backend after loading XML keywords', async ({ page }) => {
    // Inject the production mapping module so processKeywords is available globally
    await injectScript(page, 'js/mappingXmlToInputFields.js');

    await page.evaluate((xmlString) => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
      const ns = 'http://datacite.org/schema/kernel-4';
      const resolver = (prefix: string) => prefix === 'ns' ? ns : null;

      // Call the production processKeywords function
      (window as any).processKeywords(xmlDoc, resolver);
    }, TEST_XML);

    // Read the hidden input value that FormData would send
    const gcmdInputValue = await page.locator('#input-sciencekeyword').inputValue();
    const parsed = JSON.parse(gcmdInputValue);

    expect(parsed).toHaveLength(2);
    // Every entry must have 'value' (the only required field for backend validation)
    for (const entry of parsed) {
      expect(entry.value).toBeTruthy();
    }
    // First entry should have full metadata
    expect(parsed[0].language).toBe('en');
    expect(parsed[0].id).toBeTruthy();
    expect(parsed[0].scheme).toBe('GCMD');
    expect(parsed[0].schemeURI).toBeTruthy();
  });
});
