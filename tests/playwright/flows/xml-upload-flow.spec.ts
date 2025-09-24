import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { APP_BASE_URL, REPO_ROOT } from '../utils';

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
    id: 'lab-123',
    name: 'Sample Lab',
    affiliation: 'GFZ German Research Centre for Geosciences',
    rorid: 'https://ror.org/04abcd123',
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

async function mockVocabularyRequests(page: Page) {
  await page.route('**/api/v2/vocabs/resourcetypes', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RESOURCE_TYPES),
    });
  });

  await page.route('**/api/v2/vocabs/languages', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LANGUAGES),
    });
  });

  await page.route('**/api/v2/vocabs/titletypes', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TITLE_TYPES),
    });
  });

  await page.route('**/api/v2/vocabs/licenses/all', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LICENSES),
    });
  });

  await page.route('**/api/v2/vocabs/licenses/software', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LICENSES),
    });
  });

  await page.route('**/api/v2/vocabs/roles?type=person', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ROLES.person),
    });
  });

  await page.route('**/api/v2/vocabs/roles?type=institution', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ROLES.institution),
    });
  });

  await page.route('**/api/v2/vocabs/roles?type=both', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ROLES.both),
    });
  });

  await page.route('**/api/v2/vocabs/relations', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RELATIONS),
    });
  });

  await page.route('**/api/v2/vocabs/freekeywords/curated', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_FREE_KEYWORDS),
    });
  });
}

async function mockValidationAndReferenceData(page: Page) {
  await page.route('**/api/v2/validation/identifiertypes/active', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_IDENTIFIER_TYPES),
    });
  });

  await page.route('**/api/v2/validation/patterns/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pattern: '.*' }),
    });
  });

  await page.route('**/json/funders.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_FUNDERS),
    });
  });

  await page.route('**/json/msl-labs.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LABS),
    });
  });

  await page.route('**/json/affiliations.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'aff-1',
          name: 'GFZ German Research Centre for Geosciences',
          other: ['GFZ'],
        },
      ]),
    });
  });

  await page.route('**/json/thesauri/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_THESAURI_TREE }),
    });
  });
}

async function waitForEditorReady(page: Page) {
  await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15000 });

  await page.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>('#input-resourceinformation-language');
    return Boolean(select && select.options.length > 2);
  });

  await page.waitForFunction(() => {
    const tagify = (document.querySelector('#input-freekeyword') as any)?._tagify;
    return Boolean(tagify);
  });

  await page.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>('select[name="laboratoryName[]"]');
    return Boolean(select && Array.from(select.options).some(option => option.value === 'Sample Lab'));
  });
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

  const status = page.locator('#xml-upload-status');
  await expect(status).toHaveClass(/alert-success/);
  await expect(status).toContainText('XML file successfully loaded');
}

test.describe('XML Upload Mapping Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockVocabularyRequests(page);
    await mockValidationAndReferenceData(page);

    await page.addInitScript(({ translations }) => {
      (window as any).translations = translations;
    }, { translations: TEST_TRANSLATIONS });

    await page.goto('about:blank');
    await page.setContent(TEST_PAGE_HTML);

    await page.addStyleTag({ path: path.join(REPO_ROOT, 'node_modules/bootstrap/dist/css/bootstrap.min.css') });
    await page.addStyleTag({ path: path.join(REPO_ROOT, 'node_modules/jquery-ui/dist/themes/base/jquery-ui.min.css') });
    await page.addStyleTag({ path: path.join(REPO_ROOT, 'node_modules/@yaireo/tagify/dist/tagify.css') });

    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/jquery/dist/jquery.min.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/jquery-ui/dist/jquery-ui.min.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/@yaireo/tagify/dist/tagify.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/jstree/dist/jstree.min.js') });

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
      await page.addScriptTag({ path: path.join(REPO_ROOT, script) });
    }

    await page.evaluate(() => {
      document.dispatchEvent(new Event('DOMContentLoaded'));
      window.dispatchEvent(new Event('load'));
      document.dispatchEvent(new Event('translationsLoaded'));
    });

    await page.evaluate(() => {
      const selectors = ['#input-sciencekeyword', '#input-Platforms', '#input-Instruments', '#input-mslkeyword'];
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
        return input?.tagify ? input.tagify.value.map((tag: any) => tag.value) : [];
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
});