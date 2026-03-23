/**
 * Bug reproduction tests for Issue #739:
 * "Fix Extra Empty Author Row Created During XML Import"
 *
 * When uploading an XML file containing author information, ELMO creates one
 * extra empty row beyond what is defined in the file. This test suite covers
 * multiple constellations of person/institution authors and contributors
 * to pinpoint and verify the bug across all affected formgroups.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_BASE_URL, registerStaticAssetRoutes, SELECTORS } from '../utils';

// ─── XML Templates ──────────────────────────────────────────────────────────

function wrapInDataCiteResource(creatorsBlock: string, contributorsBlock = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<resource xmlns="http://datacite.org/schema/kernel-4">
  <identifier identifierType="DOI">10.1234/test.upload</identifier>
  <publicationYear>2024</publicationYear>
  <language>en</language>
  <titles>
    <title xml:lang="en" titleType="MainTitle">Row Count Test</title>
  </titles>
  <creators>
    ${creatorsBlock}
  </creators>
  ${contributorsBlock ? `<contributors>${contributorsBlock}</contributors>` : ''}
  <descriptions>
    <description descriptionType="Abstract" xml:lang="en">Test abstract.</description>
  </descriptions>
  <resourceType resourceTypeGeneral="Dataset">Dataset</resourceType>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0">CC BY 4.0</rights>
  </rightsList>
</resource>`;
}

function personCreator(given: string, family: string, orcid?: string): string {
  return `
    <creator>
      <creatorName nameType="Personal">${family}, ${given}</creatorName>
      <givenName>${given}</givenName>
      <familyName>${family}</familyName>
      ${orcid ? `<nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org">https://orcid.org/${orcid}</nameIdentifier>` : ''}
      <affiliation>Test University</affiliation>
    </creator>`;
}

function institutionCreator(name: string): string {
  return `
    <creator>
      <creatorName nameType="Organizational">${name}</creatorName>
    </creator>`;
}

function contributorPerson(given: string, family: string, role: string): string {
  return `
    <contributor contributorType="${role}">
      <contributorName nameType="Personal">${family}, ${given}</contributorName>
      <givenName>${given}</givenName>
      <familyName>${family}</familyName>
      <affiliation>Test Institute</affiliation>
    </contributor>`;
}

function contributorOrg(name: string, role: string): string {
  return `
    <contributor contributorType="${role}">
      <contributorName>${name}</contributorName>
    </contributor>`;
}

// ─── Test XML variations ─────────────────────────────────────────────────────

const XML_1_PERSON = wrapInDataCiteResource(
  personCreator('Alice', 'Smith', '0000-0001-1111-1111')
);

const XML_2_PERSONS = wrapInDataCiteResource(
  personCreator('Alice', 'Smith', '0000-0001-1111-1111') +
  personCreator('Bob', 'Jones', '0000-0002-2222-2222')
);

const XML_3_PERSONS = wrapInDataCiteResource(
  personCreator('Alice', 'Smith') +
  personCreator('Bob', 'Jones') +
  personCreator('Charlie', 'Brown')
);

const XML_1_INSTITUTION = wrapInDataCiteResource(
  institutionCreator('ACME Research Corp')
);

const XML_2_INSTITUTIONS = wrapInDataCiteResource(
  institutionCreator('ACME Research Corp') +
  institutionCreator('Global Science Foundation')
);

const XML_MIXED_PERSON_INSTITUTION = wrapInDataCiteResource(
  personCreator('Alice', 'Smith') +
  institutionCreator('ACME Research Corp')
);

const XML_MIXED_PERSON_INSTITUTION_PERSON = wrapInDataCiteResource(
  personCreator('Alice', 'Smith') +
  institutionCreator('ACME Research Corp') +
  personCreator('Bob', 'Jones')
);

const XML_MIXED_INSTITUTION_PERSON = wrapInDataCiteResource(
  institutionCreator('ACME Research Corp') +
  personCreator('Alice', 'Smith')
);

const XML_WITH_CONTRIBUTOR_PERSONS = wrapInDataCiteResource(
  personCreator('Alice', 'Smith'),
  contributorPerson('Dave', 'Wilson', 'DataCurator') +
  contributorPerson('Eve', 'Taylor', 'Researcher')
);

const XML_WITH_3_CONTRIBUTOR_PERSONS = wrapInDataCiteResource(
  personCreator('Alice', 'Smith'),
  contributorPerson('Dave', 'Wilson', 'DataCurator') +
  contributorPerson('Eve', 'Taylor', 'Researcher') +
  contributorPerson('Frank', 'Miller', 'ProjectLeader')
);

const XML_WITH_CONTRIBUTOR_ORGS = wrapInDataCiteResource(
  personCreator('Alice', 'Smith'),
  contributorOrg('Test Lab Inc', 'Distributor') +
  contributorOrg('Data Center GmbH', 'DataManager')
);

const XML_FULL_DATACITE_EXAMPLE = wrapInDataCiteResource(
  personCreator('ExampleGivenName', 'ExampleFamilyName', '0000-0001-5727-2427') +
  institutionCreator('ExampleOrganization')
);

// ─── Mock data ───────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function loadTemplate(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

const MOCK_API_DATA: Record<string, any> = {
  'api/v2/vocabs/resourcetypes': [{ id: 1, resource_type_general: 'Dataset', description: 'Dataset' }],
  'api/v2/vocabs/languages': [{ id: 1, name: 'English', code: 'en' }],
  'api/v2/vocabs/titletypes': [{ id: 1, name: 'Main Title' }],
  'api/v2/vocabs/licenses/all': [{ rights_id: 1, text: 'CC BY 4.0', rightsIdentifier: 'CC-BY-4.0', forSoftware: '0' }],
  'api/v2/vocabs/licenses/software': [{ rights_id: 1, text: 'CC BY 4.0', rightsIdentifier: 'CC-BY-4.0', forSoftware: '0' }],
  'api/v2/vocabs/roles?type=person': [{ name: 'Data Curator' }, { name: 'Researcher' }, { name: 'Project Leader' }],
  'api/v2/vocabs/roles?type=institution': [{ name: 'Hosting Institution' }],
  'api/v2/vocabs/roles?type=both': [{ name: 'Distributor' }, { name: 'Data Manager' }],
  'api/v2/vocabs/relations': { relations: [{ id: 1, name: 'IsSupplementTo', description: 'Is supplement to' }] },
  'api/v2/vocabs/freekeywords/curated': [],
  'api/v2/validation/identifiertypes/active': { identifierTypes: [] },
  'json/funders.json': [],
  'json/msl-labs.json': [],
  'json/affiliations.json': [{ id: 'aff-1', name: 'Test University', other: [] }],
  'json/timezones.json': [{ label: 'UTC+00:00 (Africa/Abidjan)' }],
  'api/v2/vocabs/thesauri/availability': {
    science_keywords: { available: false, displayName: 'GCMD' },
    platforms: { available: false, displayName: 'Platforms' },
    instruments: { available: false, displayName: 'Instruments' },
    chronostratigraphy: { available: false, displayName: 'Chronostratigraphy' },
    gemet: { available: false, displayName: 'GEMET' },
  },
};

const TEST_TRANSLATIONS = {
  general: {
    logoTitle: 'ELMO',
    choose: 'Choose...',
    affiliation: 'Affiliation',
    roleLabel: 'Select roles',
  },
  keywords: {
    free: { placeholder: 'Enter keywords' },
    thesaurus: { label: 'Select keywords' },
  },
};

// Load HTML templates from actual formgroup files
const RESOURCE_INFORMATION_HTML = loadTemplate('formgroups/resourceInformation.html');
const RIGHTS_HTML = loadTemplate('formgroups/rights.html');
const AUTHORS_HTML = loadTemplate('formgroups/authors.html');
const AUTHOR_INSTITUTION_HTML = loadTemplate('formgroups/authorInstitution.html');
const CONTRIBUTOR_PERSONS_HTML = loadTemplate('formgroups/contributorPersons.html');
const CONTRIBUTOR_INSTITUTIONS_HTML = loadTemplate('formgroups/contributorInstitutions.html');
const DESCRIPTIONS_HTML = loadTemplate('formgroups/descriptions.html');
const FREE_KEYWORDS_HTML = loadTemplate('formgroups/freeKeywords.html');
const THESAURUS_HTML = loadTemplate('formgroups/thesaurusKeywords.html');
const ORIGINATING_LAB_HTML = loadTemplate('formgroups/originatingLaboratory.html');
const DATES_HTML = loadTemplate('formgroups/dates.html');
const RELATED_WORK_HTML = loadTemplate('formgroups/relatedwork.html');
const FUNDING_REFERENCE_HTML = loadTemplate('formgroups/fundingreference.html');
const MODALS_HTML = loadTemplate('modals.html');

function buildTestPageMarkup(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Empty Row Bug Reproduction Harness</title>
    <base href="${APP_BASE_URL}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="node_modules/@yaireo/tagify/dist/tagify.css">
  </head>
  <body>
    <form id="metadata-form">
      ${RESOURCE_INFORMATION_HTML}
      ${RIGHTS_HTML}
      ${AUTHORS_HTML}
      ${AUTHOR_INSTITUTION_HTML}
      ${CONTRIBUTOR_PERSONS_HTML}
      ${CONTRIBUTOR_INSTITUTIONS_HTML}
      ${ORIGINATING_LAB_HTML}
      ${DESCRIPTIONS_HTML}
      ${THESAURUS_HTML}
      ${FREE_KEYWORDS_HTML}
      ${DATES_HTML}
      ${RELATED_WORK_HTML}
      ${FUNDING_REFERENCE_HTML}
      <div class="d-flex justify-content-end gap-2 p-3">
        <button type="button" class="btn btn-primary" id="button-form-load">Load</button>
      </div>
      ${MODALS_HTML}
    </form>
    <script src="node_modules/jquery/dist/jquery.min.js"></script>
    <script src="node_modules/jquery-ui/dist/jquery-ui.min.js"></script>
    <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
    <script src="node_modules/@yaireo/tagify/dist/tagify.js"></script>
    <script src="js/clear.js"></script>
    <script src="js/select.js"></script>
    <script src="js/originatingLaboratories.js"></script>
    <script src="js/affiliations.js"></script>
    <script src="js/freekeywordTags.js"></script>
    <script src="js/thesauri.js"></script>
    <script src="js/roles.js"></script>
    <script src="js/upload.js"></script>
    <script src="js/mappingXmlToInputFields.js"></script>
    <script type="module" src="js/eventhandlers/functions.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/author.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/authorInstitution.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/contributor-person.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/contributor-organisation.js"></script>
  </body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setupPage(page: Page): Promise<void> {
  await registerStaticAssetRoutes(page);

  // Mock all API endpoints via page.route (matched against resolved URLs)
  for (const [urlPattern, responseData] of Object.entries(MOCK_API_DATA)) {
    await page.route(`**/${urlPattern}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData),
      });
    });
  }

  // Catch-all for validation patterns
  await page.route('**/api/v2/validation/patterns/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pattern: '.*' }),
    });
  });

  // Affiliations search
  await page.route('**/api/v2/affiliations/search**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ name: 'Test University', ror: 'https://ror.org/test', other: [] }]),
    });
  });

  // Catch-all for any other API requests
  await page.route('**/api/v2/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });

  // Thesauri catch-all
  await page.route('**/json/thesauri/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.addInitScript(({ translations }) => {
    (window as any).translations = translations;
    (window as any).ELMO_FEATURES = {
      showMslLabs: false,
      showMslVocabs: false,
      showGGMsProperties: false,
      showThesauri: false,
    };
  }, { translations: TEST_TRANSLATIONS });

  await page.route('**/test-harness', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildTestPageMarkup(),
    });
  });

  await page.goto(`${APP_BASE_URL}test-harness`);

  // Wait for jQuery and jQuery UI to be loaded
  await page.waitForFunction(() => {
    const $ = (window as any).jQuery;
    return $ && typeof $.fn.sortable === 'function';
  }, { timeout: 15000 });

  // Wait for dropdownsReady event or language select population (signals select.js init is done)
  await page.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>('#input-resourceinformation-language');
    // Either the dropdown is populated, or loadXmlToForm is available (mapping script loaded)
    return (select && select.options.length >= 2) || typeof (window as any).loadXmlToForm === 'function';
  }, { timeout: 15000 });

  // Wait for the author add button handler to be registered (ES module loaded)
  await page.waitForFunction(() => {
    const btn = document.getElementById('button-author-add');
    // Check that button exists in the DOM
    return Boolean(btn);
  }, { timeout: 10000 });

  // Allow ES module event handlers to finish registering
  await page.waitForTimeout(1000);
}

async function uploadXml(page: Page, xmlContent: string): Promise<void> {
  await page.getByRole('button', { name: /Load/i }).click();
  const modal = page.locator('div#modal-uploadxml');
  await expect(modal).toBeVisible({ timeout: 5000 });

  await page.setInputFiles('#input-uploadxml-file', {
    name: 'test-upload.xml',
    mimeType: 'text/xml',
    buffer: Buffer.from(xmlContent, 'utf-8'),
  });

  // Wait for the title field to be populated (signals XML processing is done)
  await expect(page.locator('#input-resourceinformation-title')).toHaveValue('Row Count Test', {
    timeout: 15000,
  });

  // Close the modal
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
}

function getPersonAuthorRows(page: Page) {
  return page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`);
}

function getInstitutionAuthorRows(page: Page) {
  return page.locator(`${SELECTORS.formGroups.authorInstitution} [data-authorinstitution-row]`);
}

function getContributorPersonRows(page: Page) {
  return page.locator(`${SELECTORS.formGroups.contributorPersons} [contributor-person-row]`);
}

function getContributorOrgRows(page: Page) {
  return page.locator(`${SELECTORS.formGroups.contributorInstitutions} [contributors-row]`);
}

/** Check that a person author row has expected values and is not empty */
async function expectPersonAuthorRow(page: Page, index: number, expected: { given: string; family: string }) {
  const rows = getPersonAuthorRows(page);
  const row = rows.nth(index);
  await expect(row.locator('input[name="familynames[]"]')).toHaveValue(expected.family);
  await expect(row.locator('input[name="givennames[]"]')).toHaveValue(expected.given);
}

/** Check that a person author row is empty (bug symptom) */
async function isRowEmpty(row: ReturnType<typeof page.locator>): Promise<boolean> {
  const familyName = await row.locator('input[name="familynames[]"]').inputValue();
  const givenName = await row.locator('input[name="givennames[]"]').inputValue();
  return familyName.trim() === '' && givenName.trim() === '';
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

test.describe('Issue #739: No extra empty rows after XML upload', () => {

  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  // ── Author Person rows ────────────────────────────────────────────────

  test.describe('Author Persons', () => {

    test('1 person author → exactly 1 row, no empty rows', async ({ page }) => {
      await uploadXml(page, XML_1_PERSON);

      const rows = getPersonAuthorRows(page);
      await expect(rows).toHaveCount(1);
      await expectPersonAuthorRow(page, 0, { given: 'Alice', family: 'Smith' });
    });

    test('2 person authors → exactly 2 rows, no empty rows', async ({ page }) => {
      await uploadXml(page, XML_2_PERSONS);

      const rows = getPersonAuthorRows(page);
      await expect(rows).toHaveCount(2);
      await expectPersonAuthorRow(page, 0, { given: 'Alice', family: 'Smith' });
      await expectPersonAuthorRow(page, 1, { given: 'Bob', family: 'Jones' });

      // Verify no row is empty
      for (let i = 0; i < 2; i++) {
        expect(await isRowEmpty(rows.nth(i))).toBe(false);
      }
    });

    test('3 person authors → exactly 3 rows, no empty rows', async ({ page }) => {
      await uploadXml(page, XML_3_PERSONS);

      const rows = getPersonAuthorRows(page);
      await expect(rows).toHaveCount(3);
      await expectPersonAuthorRow(page, 0, { given: 'Alice', family: 'Smith' });
      await expectPersonAuthorRow(page, 1, { given: 'Bob', family: 'Jones' });
      await expectPersonAuthorRow(page, 2, { given: 'Charlie', family: 'Brown' });

      for (let i = 0; i < 3; i++) {
        expect(await isRowEmpty(rows.nth(i))).toBe(false);
      }
    });
  });

  // ── Author Institution rows ───────────────────────────────────────────

  test.describe('Author Institutions', () => {

    test('1 institution author → exactly 1 institution row, no empty rows', async ({ page }) => {
      await uploadXml(page, XML_1_INSTITUTION);

      const instRows = getInstitutionAuthorRows(page);
      await expect(instRows).toHaveCount(1);
      await expect(instRows.nth(0).locator('input[name="authorinstitutionName[]"]')).toHaveValue('ACME Research Corp');

      // Person rows should remain at 1 (the default empty row) since no person creators
      const personRows = getPersonAuthorRows(page);
      await expect(personRows).toHaveCount(1);
      expect(await isRowEmpty(personRows.nth(0))).toBe(true);
    });

    test('2 institution authors → exactly 2 institution rows, no empty rows', async ({ page }) => {
      await uploadXml(page, XML_2_INSTITUTIONS);

      const instRows = getInstitutionAuthorRows(page);
      await expect(instRows).toHaveCount(2);
      await expect(instRows.nth(0).locator('input[name="authorinstitutionName[]"]')).toHaveValue('ACME Research Corp');
      await expect(instRows.nth(1).locator('input[name="authorinstitutionName[]"]')).toHaveValue('Global Science Foundation');
    });
  });

  // ── Mixed Person + Institution creators ───────────────────────────────

  test.describe('Mixed Person and Institution creators', () => {

    test('1 person + 1 institution → 1 person row + 1 institution row, no extra rows', async ({ page }) => {
      await uploadXml(page, XML_MIXED_PERSON_INSTITUTION);

      const personRows = getPersonAuthorRows(page);
      await expect(personRows).toHaveCount(1);
      await expectPersonAuthorRow(page, 0, { given: 'Alice', family: 'Smith' });

      const instRows = getInstitutionAuthorRows(page);
      await expect(instRows).toHaveCount(1);
      await expect(instRows.nth(0).locator('input[name="authorinstitutionName[]"]')).toHaveValue('ACME Research Corp');
    });

    test('Person, Institution, Person → 2 person rows + 1 institution row, correct data in each', async ({ page }) => {
      await uploadXml(page, XML_MIXED_PERSON_INSTITUTION_PERSON);

      const personRows = getPersonAuthorRows(page);
      await expect(personRows).toHaveCount(2);
      await expectPersonAuthorRow(page, 0, { given: 'Alice', family: 'Smith' });
      await expectPersonAuthorRow(page, 1, { given: 'Bob', family: 'Jones' });

      // No empty person rows
      for (let i = 0; i < 2; i++) {
        expect(await isRowEmpty(personRows.nth(i))).toBe(false);
      }

      const instRows = getInstitutionAuthorRows(page);
      await expect(instRows).toHaveCount(1);
      await expect(instRows.nth(0).locator('input[name="authorinstitutionName[]"]')).toHaveValue('ACME Research Corp');
    });

    test('Institution, Person → 1 person row + 1 institution row, correct data', async ({ page }) => {
      await uploadXml(page, XML_MIXED_INSTITUTION_PERSON);

      const personRows = getPersonAuthorRows(page);
      await expect(personRows).toHaveCount(1);
      await expectPersonAuthorRow(page, 0, { given: 'Alice', family: 'Smith' });

      const instRows = getInstitutionAuthorRows(page);
      await expect(instRows).toHaveCount(1);
      await expect(instRows.nth(0).locator('input[name="authorinstitutionName[]"]')).toHaveValue('ACME Research Corp');
    });

    test('DataCite Full Example pattern (1 person + 1 org) → no extra empty rows', async ({ page }) => {
      await uploadXml(page, XML_FULL_DATACITE_EXAMPLE);

      const personRows = getPersonAuthorRows(page);
      await expect(personRows).toHaveCount(1);
      await expectPersonAuthorRow(page, 0, { given: 'ExampleGivenName', family: 'ExampleFamilyName' });

      const instRows = getInstitutionAuthorRows(page);
      await expect(instRows).toHaveCount(1);
      await expect(instRows.nth(0).locator('input[name="authorinstitutionName[]"]')).toHaveValue('ExampleOrganization');
    });
  });

  // ── Contributor Person rows ───────────────────────────────────────────

  test.describe('Contributor Persons', () => {

    test('2 contributor persons → exactly 2 rows, no empty rows', async ({ page }) => {
      await uploadXml(page, XML_WITH_CONTRIBUTOR_PERSONS);

      const rows = getContributorPersonRows(page);
      await expect(rows).toHaveCount(2);

      await expect(rows.nth(0).locator('input[name="cbPersonLastname[]"]')).toHaveValue('Wilson');
      await expect(rows.nth(0).locator('input[name="cbPersonFirstname[]"]')).toHaveValue('Dave');

      await expect(rows.nth(1).locator('input[name="cbPersonLastname[]"]')).toHaveValue('Taylor');
      await expect(rows.nth(1).locator('input[name="cbPersonFirstname[]"]')).toHaveValue('Eve');

      // No empty rows
      for (let i = 0; i < 2; i++) {
        const lastName = await rows.nth(i).locator('input[name="cbPersonLastname[]"]').inputValue();
        expect(lastName.trim()).not.toBe('');
      }
    });

    test('3 contributor persons → exactly 3 rows, no empty rows', async ({ page }) => {
      await uploadXml(page, XML_WITH_3_CONTRIBUTOR_PERSONS);

      const rows = getContributorPersonRows(page);
      await expect(rows).toHaveCount(3);

      await expect(rows.nth(0).locator('input[name="cbPersonLastname[]"]')).toHaveValue('Wilson');
      await expect(rows.nth(1).locator('input[name="cbPersonLastname[]"]')).toHaveValue('Taylor');
      await expect(rows.nth(2).locator('input[name="cbPersonLastname[]"]')).toHaveValue('Miller');
    });
  });

  // ── Contributor Organisation rows ─────────────────────────────────────

  test.describe('Contributor Organisations', () => {

    test('2 contributor orgs → exactly 2 rows, no empty rows', async ({ page }) => {
      await uploadXml(page, XML_WITH_CONTRIBUTOR_ORGS);

      const rows = getContributorOrgRows(page);
      await expect(rows).toHaveCount(2);

      await expect(rows.nth(0).locator('input[name="cbOrganisationName[]"]')).toHaveValue('Test Lab Inc');
      await expect(rows.nth(1).locator('input[name="cbOrganisationName[]"]')).toHaveValue('Data Center GmbH');
    });
  });

  // ── Default behavior (no upload) ──────────────────────────────────────

  test.describe('Default empty row behavior', () => {

    test('new form has exactly 1 empty person author row by default', async ({ page }) => {
      const rows = getPersonAuthorRows(page);
      await expect(rows).toHaveCount(1);
      expect(await isRowEmpty(rows.nth(0))).toBe(true);
    });

    test('new form has exactly 1 empty institution author row by default', async ({ page }) => {
      const rows = getInstitutionAuthorRows(page);
      await expect(rows).toHaveCount(1);
      const name = await rows.nth(0).locator('input[name="authorinstitutionName[]"]').inputValue();
      expect(name.trim()).toBe('');
    });

    test('new form has exactly 1 empty contributor person row by default', async ({ page }) => {
      const rows = getContributorPersonRows(page);
      await expect(rows).toHaveCount(1);
      const lastName = await rows.nth(0).locator('input[name="cbPersonLastname[]"]').inputValue();
      expect(lastName.trim()).toBe('');
    });

    test('new form has exactly 1 empty contributor org row by default', async ({ page }) => {
      const rows = getContributorOrgRows(page);
      await expect(rows).toHaveCount(1);
      const name = await rows.nth(0).locator('input[name="cbOrganisationName[]"]').inputValue();
      expect(name.trim()).toBe('');
    });
  });
});
