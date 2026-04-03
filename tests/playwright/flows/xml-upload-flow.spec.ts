import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { APP_BASE_URL, REPO_ROOT } from '../utils';
import { injectScript, injectStylesheet } from '../utils/assets';

const SAMPLE_XML_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/elmo.test</identifier>
  <publicationYear>2024</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="MainTitle">ELMO Upload Flow</title>
  </titles>
  <creators>
    <creator>
      <creatorName nameType="Personal">Doe, Jane</creatorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-2345-6789</nameIdentifier>
      <affiliation affiliationIdentifierScheme="ROR" affiliationIdentifier="https://ror.org/04abcd123">GFZ German Research Centre for Geosciences</affiliation>
    </creator>
  </creators>
  <contributors>
    <contributor contributorType="ContactPerson">
      <contributorName nameType="Personal">Doe, Jane</contributorName>
      <givenName>Jane</givenName>
      <familyName>Doe</familyName>
      <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/0000-0001-2345-6789</nameIdentifier>
      <affiliation>GFZ German Research Centre for Geosciences</affiliation>
    </contributor>
    <contributor contributorType="HostingInstitution">
      <contributorName>Sample Lab</contributorName>
      <nameIdentifier nameIdentifierScheme="labid">lab-123</nameIdentifier>
    </contributor>
  </contributors>
  <descriptions>
    <description descriptionType="Abstract" xml:lang="en">An uploaded dataset.</description>
  </descriptions>
  <subjects>
    <subject subjectScheme="Free Keywords" schemeURI="https://example.org/keywords/free">open science</subject>
  </subjects>
  <dates>
    <date dateType="Created">2024-01-15</date>
  </dates>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0">Creative Commons Attribution 4.0</rights>
  </rightsList>
  <fundingReferences>
    <fundingReference>
      <funderName>Ford Foundation</funderName>
      <funderIdentifier funderIdentifierType="Crossref Funder ID">100000016</funderIdentifier>
      <awardNumber awardURI="https://example.org/grants/GBMF3859.11">GBMF3859.11</awardNumber>
      <awardTitle>Grants database</awardTitle>
    </fundingReference>
  </fundingReferences>
  <relatedIdentifiers>
  <relatedIdentifier relatedIdentifierType="DOI" relationType="IsSupplementTo">10.5555/example</relatedIdentifier>
  </relatedIdentifiers>
</resource>`;

function loadTemplate(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

const RESOURCE_INFORMATION_HTML = loadTemplate('formgroups/resourceInformation.html');
const RIGHTS_HTML = loadTemplate('formgroups/rights.html');
const AUTHORS_HTML = loadTemplate('formgroups/authors.html');
const AUTHOR_INSTITUTION_HTML = loadTemplate('formgroups/authorInstitution.html');
const ORIGINATING_LAB_HTML = loadTemplate('formgroups/originatingLaboratory.html');
const DESCRIPTIONS_HTML = loadTemplate('formgroups/descriptions.html');
const THESAURUS_HTML = loadTemplate('formgroups/thesaurusKeywords.html');
const MSL_KEYWORDS_HTML = loadTemplate('formgroups/mslKeywords.html');
const FREE_KEYWORDS_HTML = loadTemplate('formgroups/freeKeywords.html');
const DATES_HTML = loadTemplate('formgroups/dates.html');
const RELATED_WORK_HTML = loadTemplate('formgroups/relatedwork.html');
const FUNDING_REFERENCE_HTML = loadTemplate('formgroups/fundingreference.html');
const MODALS_HTML = loadTemplate('modals.html');

const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <base href="${APP_BASE_URL}" />
    <title>XML Upload Flow Harness</title>
  </head>
  <body>
    ${RESOURCE_INFORMATION_HTML}
    ${RIGHTS_HTML}
    ${AUTHORS_HTML}
    ${AUTHOR_INSTITUTION_HTML}
    ${ORIGINATING_LAB_HTML}
    ${DESCRIPTIONS_HTML}
    ${THESAURUS_HTML}
    ${MSL_KEYWORDS_HTML}
    ${FREE_KEYWORDS_HTML}
    ${DATES_HTML}
    ${RELATED_WORK_HTML}
    ${FUNDING_REFERENCE_HTML}
    <div class="d-flex justify-content-end gap-2 p-3">
      <button type="button" class="btn btn-primary" id="button-form-load">Load</button>
    </div>
    ${MODALS_HTML}
  </body>
</html>`;

// ─── Mixed-creator XML for Issue #739 regression tests ──────────────────────

const XML_MIXED_PERSON_INSTITUTION_PERSON = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/elmo.mixed</identifier>
  <publicationYear>2024</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="MainTitle">Mixed Creator Test</title>
  </titles>
  <creators>
    <creator>
      <creatorName nameType="Personal">Smith, Alice</creatorName>
      <givenName>Alice</givenName>
      <familyName>Smith</familyName>
      <affiliation>Test University</affiliation>
    </creator>
    <creator>
      <creatorName nameType="Organizational">ACME Research Corp</creatorName>
    </creator>
    <creator>
      <creatorName nameType="Personal">Jones, Bob</creatorName>
      <givenName>Bob</givenName>
      <familyName>Jones</familyName>
      <affiliation>Test University</affiliation>
    </creator>
  </creators>
  <descriptions>
    <description descriptionType="Abstract" xml:lang="en">Test abstract.</description>
  </descriptions>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0">CC BY 4.0</rights>
  </rightsList>
</resource>`;

const XML_MIXED_INSTITUTION_PERSON = `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/elmo.mixed2</identifier>
  <publicationYear>2024</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="MainTitle">Institution First Test</title>
  </titles>
  <creators>
    <creator>
      <creatorName nameType="Organizational">ACME Research Corp</creatorName>
    </creator>
    <creator>
      <creatorName nameType="Personal">Smith, Alice</creatorName>
      <givenName>Alice</givenName>
      <familyName>Smith</familyName>
      <affiliation>Test University</affiliation>
    </creator>
  </creators>
  <descriptions>
    <description descriptionType="Abstract" xml:lang="en">Test abstract.</description>
  </descriptions>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0">CC BY 4.0</rights>
  </rightsList>
</resource>`;

const TEST_TRANSLATIONS = {
  general: {
    logoTitle: 'ELMO',
    choose: 'Choose...',
    affiliation: 'Affiliation',
    roleLabel: 'Select roles',
  },
  keywords: {
    free: { placeholder: 'Please enter keywords and separate them by a comma.' },
    thesaurus: { label: 'Select keywords' },
  },
};

const MOCK_RESOURCE_TYPES = [
  { id: 1, resource_type_general: 'Dataset', description: 'Dataset resource' },
  { id: 2, resource_type_general: 'Software', description: 'Software resource' },
];

const MOCK_LANGUAGES = [
  { id: 1, name: 'English', code: 'en' },
  { id: 2, name: 'German', code: 'de' },
];

const MOCK_TITLE_TYPES = [
  { id: 1, name: 'Main Title' },
  { id: 2, name: 'Alternative Title' },
];

const MOCK_LICENSES = [
  {
    rights_id: 1,
    text: 'Creative Commons Attribution 4.0 International',
    rightsIdentifier: 'CC-BY-4.0',
    forSoftware: '0',
  },
];

const MOCK_ROLES = {
  person: [{ name: 'Contact Person' }],
  institution: [{ name: 'Hosting Institution' }],
  both: [{ name: 'Distributor' }],
};

const MOCK_RELATIONS = {
  relations: [
    { id: 1, name: 'IsSupplementTo', description: 'Is supplement to' },
  ],
};

const MOCK_IDENTIFIER_TYPES = {
  identifierTypes: [
    {
      name: 'DOI',
      description: 'Digital Object Identifier',
      pattern: '^10\\..+',
    },
    {
      name: 'URL',
      description: 'Uniform Resource Locator',
      pattern: '^https?://.+',
    },
  ],
};

const MOCK_FUNDERS = [
  { name: 'Ford Foundation', crossRefId: '100000016' },
];

const MOCK_LABS = [
  {
    identifier: 'lab-123',
    name: 'Sample Lab',
    affiliation_name: 'GFZ German Research Centre for Geosciences',
    affiliation_ror: 'https://ror.org/04abcd123',
  },
];

const MOCK_FREE_KEYWORDS = [
  { free_keyword: 'open science' },
  { free_keyword: 'data sharing' },
];

const MOCK_THESAURI_TREE = [
  {
    id: 'root-node',
    text: 'Earth Science',
    scheme: 'GCMD',
    schemeURI: 'https://example.org/keywords/gcmd',
    language: 'en',
    children: [
      {
        id: 'child-node',
        text: 'Geology',
        scheme: 'GCMD',
        schemeURI: 'https://example.org/keywords/gcmd',
        language: 'en',
      },
    ],
  },
];

const MOCK_TIMEZONES = [
  { label: 'UTC+00:00 (Africa/Abidjan)' },
  { label: 'UTC+01:00 (Europe/Berlin)' },
  { label: 'UTC-05:00 (America/New_York)' },
];

/**
 * Central mock data configuration for all API endpoints.
 * This is used by the browser-level fetch/ajax mocking in beforeEach.
 * Note: page.route() does NOT work for about:blank pages, so we mock
 * fetch() and $.ajax() directly in the browser context instead.
 */
const MOCK_API_DATA: Record<string, any> = {
  'json/timezones.json': [
    { label: 'UTC+00:00 (Africa/Abidjan)' },
    { label: 'UTC+01:00 (Europe/Berlin)' },
    { label: 'UTC-05:00 (America/New_York)' },
  ],
  'api/v2/vocabs/resourcetypes': MOCK_RESOURCE_TYPES,
  'api/v2/vocabs/languages': MOCK_LANGUAGES,
  'api/v2/vocabs/titletypes': MOCK_TITLE_TYPES,
  'api/v2/vocabs/licenses/all': MOCK_LICENSES,
  'api/v2/vocabs/licenses/software': MOCK_LICENSES,
  'api/v2/vocabs/roles?type=person': MOCK_ROLES.person,
  'api/v2/vocabs/roles?type=institution': MOCK_ROLES.institution,
  'api/v2/vocabs/roles?type=both': MOCK_ROLES.both,
  'api/v2/vocabs/relations': MOCK_RELATIONS,
  'api/v2/vocabs/freekeywords/curated': MOCK_FREE_KEYWORDS,
  'api/v2/validation/identifiertypes/active': MOCK_IDENTIFIER_TYPES,
  'json/funders.json': MOCK_FUNDERS,
  'json/msl-labs.json': MOCK_LABS,
  'json/affiliations.json': [{
    id: 'aff-1',
    name: 'GFZ German Research Centre for Geosciences',
    other: ['GFZ'],
  }],
  'api/v2/vocabs/thesauri/availability': {
    science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
    platforms: { available: true, displayName: 'GCMD Platforms' },
    instruments: { available: true, displayName: 'GCMD Instruments' },
    chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
    gemet: { available: false, displayName: 'GEMET' },
  },
  'api/v2/vocabs/thesauri/gcmd-science-keywords': { data: [] },
  'api/v2/vocabs/thesauri/gcmd-platforms': { data: [] },
  'api/v2/vocabs/thesauri/gcmd-instruments': { data: [] },
};

async function waitForEditorReady(page: Page) {
  await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15000 });

  // Wait for language dropdown to be populated
  await page.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>('#input-resourceinformation-language');
    return Boolean(select && select.options.length > 2);
  }, { timeout: 30000 });

  await page.waitForFunction(() => {
    const tagify = (document.querySelector('#input-freekeyword') as any)?._tagify;
    return Boolean(tagify);
  }, { timeout: 15000 });

  // Labs are mocked and enabled via ELMO_FEATURES
}

async function uploadSampleXml(page: Page) {
  await page.getByRole('button', { name: /Load/i }).click();
  const modal = page.locator('div#modal-uploadxml');
  await expect(modal).toBeVisible();

  await page.setInputFiles('#input-uploadxml-file', {
    name: 'sample-upload.xml',
    mimeType: 'text/xml',
    buffer: Buffer.from(SAMPLE_XML_CONTENT, 'utf-8'),
  });

  await expect(page.locator('#input-resourceinformation-title')).toHaveValue('ELMO Upload Flow', {
    timeout: 15000,
  });

  await expect
    .poll(async () => page.evaluate(() => (window as any).__modalHideCalls || 0))
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    const modalElement = document.getElementById('modal-uploadxml');
    if (modalElement) {
      modalElement.classList.remove('show');
      modalElement.setAttribute('aria-hidden', 'true');
      (modalElement as HTMLElement).style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop').forEach(node => node.remove());
  });

  // Verify success toast is shown with file name
  const toast = page.locator('#toast-upload-feedback');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveClass(/show/);
  await expect(toast).toHaveClass(/text-bg-success/);
  const toastMessage = page.locator('#toast-upload-feedback-message');
  await expect(toastMessage).toContainText('sample-upload.xml');
  await expect(toastMessage).toContainText('successfully loaded');
}

test.describe('XML Upload Mapping Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Note: page.route() does NOT work for about:blank pages, so we mock
    // fetch() and $.ajax() directly in the browser context below.

    await page.addInitScript(({ translations }) => {
      (window as any).translations = translations;
      // Enable MSL Labs feature for test
      (window as any).ELMO_FEATURES = {
        showMslLabs: true,
        showMslVocabs: false,
        showGGMsProperties: false,
        showThesauri: true
      };
    }, { translations: TEST_TRANSLATIONS });

    await page.goto('about:blank');
    await page.setContent(TEST_PAGE_HTML);

    // Inject mock fetch that returns data directly instead of making network requests
    // Uses the central MOCK_API_DATA configuration defined above
    await page.evaluate((data) => {
      const mockDataMap = new Map(Object.entries(data.mockData));
      
      // Mock fetch to return data directly
      (window as any).__originalFetch = window.fetch;
      (window as any).__fetchCalls = [];
      window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input.toString();
        (window as any).__fetchCalls.push({ url, resolved: url });
        
        // Check if we have mock data for this URL
        for (const [pattern, responseData] of mockDataMap.entries()) {
          if (url.includes(pattern)) {
            return Promise.resolve(new Response(JSON.stringify(responseData), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
        }
        
        // For validation patterns, return a generic pattern
        if (url.includes('api/v2/validation/patterns/')) {
          return Promise.resolve(new Response(JSON.stringify({ pattern: '.*' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        
        // For thesauri, return mock tree data
        if (url.includes('json/thesauri/')) {
          return Promise.resolve(new Response(JSON.stringify({ data: data.mockThesauri }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        
        // For affiliations search, return mock data
        if (url.includes('api/v2/affiliations/search')) {
          return Promise.resolve(new Response(JSON.stringify([{
            name: 'GFZ German Research Centre for Geosciences',
            ror: 'https://ror.org/04z8jg394',
            other: ['GFZ', 'Helmholtz Centre Potsdam'],
          }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        
        // Fallback: return empty array for unknown URLs
        console.warn('Unmocked fetch URL:', url);
        return Promise.resolve(new Response('[]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      };
    }, { mockData: MOCK_API_DATA, mockThesauri: MOCK_THESAURI_TREE });

    await injectStylesheet(page, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
    await injectStylesheet(page, 'node_modules/jquery-ui/dist/themes/base/jquery-ui.min.css');
    await injectStylesheet(page, 'node_modules/@yaireo/tagify/dist/tagify.css');

    await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');
    
    // Patch jQuery $.ajax and $.getJSON to return mock data directly
    await page.evaluate((data) => {
      const mockDataMap = new Map(Object.entries(data.mockData));
      const $ = (window as any).jQuery;
      
      if ($ && $.ajax) {
        const originalAjax = $.ajax;
        $.ajax = function(urlOrSettings: any, settings?: any) {
          // Handle both $.ajax(url, settings) and $.ajax(settings) signatures
          let url: string;
          let opts: any;
          if (typeof urlOrSettings === 'string') {
            url = urlOrSettings;
            opts = settings || {};
          } else {
            url = urlOrSettings?.url || '';
            opts = urlOrSettings || {};
          }
          
          // Check if we have mock data for this URL
          for (const [pattern, responseData] of mockDataMap.entries()) {
            if (url.includes(pattern)) {
              // Create a deferred object that mimics jQuery's $.ajax return value
              const deferred = $.Deferred();
              setTimeout(() => {
                if (opts.success) opts.success(responseData, 'success', {});
                if (opts.complete) opts.complete({}, 'success');
                deferred.resolve(responseData);
              }, 0);
              return deferred.promise();
            }
          }
          
          // Fallback to original ajax for unhandled URLs
          return originalAjax.call(this, urlOrSettings, settings);
        };
        
        // Also patch $.getJSON
        const originalGetJSON = $.getJSON;
        $.getJSON = function(url: string, ...args: any[]) {
          // Check if we have mock data for this URL
          for (const [pattern, responseData] of mockDataMap.entries()) {
            if (url.includes(pattern)) {
              const deferred = $.Deferred();
              setTimeout(() => {
                // Check if second argument is a callback
                const callback = typeof args[0] === 'function' ? args[0] : args[1];
                if (callback) callback(responseData);
                deferred.resolve(responseData);
              }, 0);
              return deferred.promise();
            }
          }
          return originalGetJSON.call(this, url, ...args);
        };
      }
    }, { mockData: MOCK_API_DATA, mockThesauri: MOCK_THESAURI_TREE });
    
    await injectScript(page, 'node_modules/jquery-ui/dist/jquery-ui.min.js');
    await injectScript(page, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');
    await injectScript(page, 'node_modules/@yaireo/tagify/dist/tagify.js');
    await injectScript(page, 'node_modules/jstree/dist/jstree.min.js');

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

    // Register simplified click handlers for add-row buttons since ES modules
    // cannot load on about:blank pages. These mimic the core cloning logic from
    // js/eventhandlers/formgroups/author.js and authorInstitution.js.
    await page.evaluate(() => {
      const $ = (window as any).jQuery;
      $('#button-author-add').click(function () {
        const $container = $('div[data-creator-row]').parent();
        const $first = $('div[data-creator-row]').first();
        const $clone = $first.clone(false);
        $clone.find('input, select, textarea').val('').removeAttr('required');
        $clone.find('.tagify').remove();
        $clone.find('.is-invalid, .is-valid').removeClass('is-invalid is-valid');
        $container.append($clone);
      });
      $('#button-authorinstitution-add').click(function () {
        const $container = $('div[data-authorinstitution-row]').parent();
        const $first = $('div[data-authorinstitution-row]').first();
        const $clone = $first.clone(false);
        $clone.find('input, select, textarea').val('').removeAttr('required');
        $clone.find('.tagify').remove();
        $clone.find('.is-invalid, .is-valid').removeClass('is-invalid is-valid');
        $container.append($clone);
      });
    });

    const appScripts = [
      'js/clear.js',
      'js/select.js',
      'js/originatingLaboratories.js',
      'js/affiliations.js',
      'js/freekeywordTags.js',
      'js/thesauri.js',
      'js/roles.js',
      'js/upload.js',
      'js/mappingXmlToInputFields.js',
    ];

    for (const script of appScripts) {
      await injectScript(page, script);
    }

    await page.evaluate(() => {
      document.dispatchEvent(new Event('DOMContentLoaded'));
      window.dispatchEvent(new Event('load'));
      document.dispatchEvent(new Event('translationsLoaded'));
    });

    await page.evaluate(() => {
      // Initialize Tagify for keyword input fields that need it for the test
      // Note: #input-freekeyword is included because waitForEditorReady() checks for it
      const selectors = ['#input-sciencekeyword', '#input-platforms', '#input-instruments', '#input-mslkeyword', '#input-freekeyword'];
      selectors.forEach((selector) => {
        const element = document.querySelector(selector) as any;
        if (element && !element._tagify && (window as any).Tagify) {
          element._tagify = new (window as any).Tagify(element, {
            whitelist: [],
            enforceWhitelist: false,
            dropdown: { enabled: 0 },
          });
        }
      });
    });

    await waitForEditorReady(page);
  });

  test('maps uploaded XML content into the metadata editor form', async ({ page }) => {
    await uploadSampleXml(page);

    await expect(page.locator('#input-resourceinformation-doi')).toHaveValue('10.1234/elmo.test');
    await expect(page.locator('#input-resourceinformation-publicationyear')).toHaveValue('2024');
    await expect(page.locator('#input-resourceinformation-resourcetype')).toHaveValue('1');
    await expect(page.locator('#input-resourceinformation-language')).toHaveValue('1');
    await expect(page.locator('#input-resourceinformation-title')).toHaveValue('ELMO Upload Flow');

    await expect(page.locator('#input-rights-license')).toHaveValue('1');

    const familyName = page.locator('input[name="familynames[]"]').first();
    const givenName = page.locator('input[name="givennames[]"]').first();
    const orcid = page.locator('input[name="orcids[]"]').first();

    await expect(familyName).toHaveValue('Doe');
    await expect(givenName).toHaveValue('Jane');
    await expect(orcid).toHaveValue('0000-0001-2345-6789');

    await expect
      .poll(async () => page.evaluate(() => {
        const input = document.querySelector('input[name="personAffiliation[]"]') as any;
        return input?._tagify ? input._tagify.value.map((tag: any) => tag.value) : [];
      }))
      .toEqual(['GFZ German Research Centre for Geosciences']);

    await expect
      .poll(async () => page.evaluate(() => {
        const input = document.querySelector('#input-freekeyword') as any;
        return input?._tagify ? input._tagify.value.map((tag: any) => tag.value) : [];
      }))
      .toContain('open science');

    await expect(page.locator('#input-abstract')).toHaveValue('An uploaded dataset.');
    await expect(page.locator('input[name="dateCreated"]').first()).toHaveValue('2024-01-15');

    await expect(page.locator('input[name="funder[]"]').first()).toHaveValue('Ford Foundation');
    await expect(page.locator('input[name="funderId[]"]').first()).toHaveValue('100000016');
    await expect(page.locator('input[name="grantNummer[]"]').first()).toHaveValue('GBMF3859.11');
    await expect(page.locator('input[name="grantName[]"]').first()).toHaveValue('Grants database');

    const labSelect = page.locator('select[name="laboratoryName[]"]').first();
    await expect(labSelect).toHaveValue('Sample Lab');
    await expect(page.locator('input[name="LabId[]"]').first()).toHaveValue('lab-123');

    await expect(page.locator('input[name="rIdentifier[]"]').first()).toHaveValue('10.5555/example');
    await expect(page.locator('select[name="rIdentifierType[]"]').first()).toHaveValue('DOI');
    const selectedRelation = await page.locator('select[name="relation[]"]').first().evaluate((element: HTMLSelectElement) => {
      return element.options[element.selectedIndex]?.text;
    });
    expect(selectedRelation).toBe('IsSupplementTo');
  });

  // ── Issue #739 regression: mixed person/institution creators ───────

  test('Person, Institution, Person → 2 person rows, 1 institution row, no extra empty rows (Issue #739)', async ({ page }) => {
    await page.getByRole('button', { name: /Load/i }).click();
    const modal = page.locator('div#modal-uploadxml');
    await expect(modal).toBeVisible();

    await page.setInputFiles('#input-uploadxml-file', {
      name: 'mixed-creators.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(XML_MIXED_PERSON_INSTITUTION_PERSON, 'utf-8'),
    });

    await expect(page.locator('#input-resourceinformation-title')).toHaveValue('Mixed Creator Test', { timeout: 15000 });

    const personRows = page.locator('#group-author [data-creator-row]');
    await expect(personRows).toHaveCount(2);
    await expect(personRows.nth(0).locator('input[name="familynames[]"]')).toHaveValue('Smith');
    await expect(personRows.nth(0).locator('input[name="givennames[]"]')).toHaveValue('Alice');
    await expect(personRows.nth(1).locator('input[name="familynames[]"]')).toHaveValue('Jones');
    await expect(personRows.nth(1).locator('input[name="givennames[]"]')).toHaveValue('Bob');

    // No empty person rows
    for (let i = 0; i < 2; i++) {
      const family = await personRows.nth(i).locator('input[name="familynames[]"]').inputValue();
      expect(family.trim()).not.toBe('');
    }

    const instRows = page.locator('#group-authorinstitution [data-authorinstitution-row]');
    await expect(instRows).toHaveCount(1);
    await expect(instRows.nth(0).locator('input[name="authorinstitutionName[]"]')).toHaveValue('ACME Research Corp');
  });

  test('Institution, Person → 1 person row, 1 institution row, no extra empty rows (Issue #739)', async ({ page }) => {
    await page.getByRole('button', { name: /Load/i }).click();
    const modal = page.locator('div#modal-uploadxml');
    await expect(modal).toBeVisible();

    await page.setInputFiles('#input-uploadxml-file', {
      name: 'inst-first.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from(XML_MIXED_INSTITUTION_PERSON, 'utf-8'),
    });

    await expect(page.locator('#input-resourceinformation-title')).toHaveValue('Institution First Test', { timeout: 15000 });

    const personRows = page.locator('#group-author [data-creator-row]');
    await expect(personRows).toHaveCount(1);
    await expect(personRows.nth(0).locator('input[name="familynames[]"]')).toHaveValue('Smith');
    await expect(personRows.nth(0).locator('input[name="givennames[]"]')).toHaveValue('Alice');

    const instRows = page.locator('#group-authorinstitution [data-authorinstitution-row]');
    await expect(instRows).toHaveCount(1);
    await expect(instRows.nth(0).locator('input[name="authorinstitutionName[]"]')).toHaveValue('ACME Research Corp');
  });
});