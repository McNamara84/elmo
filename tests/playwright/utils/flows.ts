import { expect, type Page } from '@playwright/test';
import { SELECTORS } from './constants';
import exampleData from './inputDataEndToEnd.json';


/**
 * Fills in the minimal required fields for a dataset form.
 * Completes: publication year, resource type, language, title, author details (ORCID, name),
 * affiliation, contact person email, abstract, and a Date Created value for stable exports.
 * @param {Page} page - The Playwright page object to interact with
 * @returns {Promise<void>}
 */
export async function completeMinimalDatasetForm(page: Page) {
  
  await page.getByRole('textbox', { name: 'Publication Year (YYYY)*' }).fill('2025');
  await page.getByLabel('Resource Type*').selectOption('5');
  await page.getByRole('textbox', { name: 'Title*' }).fill('A dataset');

  // Fill author using the robust addAuthor function
  await addAuthor(page, 0, {
    orcid: '0000-0002-1825-0097',
    lastName: 'Carberry',
    firstName: 'Josiah',
    affiliation: 'GFZ Helmholtz Centre for Geosciences',
  });

  const contactToggle = page.locator(`${SELECTORS.formGroups.authors} [data-author-contact-toggle]`).first();
  await expect(contactToggle).toBeVisible();
  await contactToggle.click();

  const emailField = page.getByRole('textbox', { name: 'Email address*' });
  await expect(emailField).toBeVisible();
  await emailField.fill('example@gmail.com');

  await page.getByRole('textbox', { name: 'Abstract*' }).fill('Necessary abstract');
  await page.locator('#input-date-created').fill('2025-01-01');
}

/**
 * Fills in an extended dataset form with additional optional fields.
 * Includes all minimal fields plus: related works, free keywords, methods description,
 * technical information, other descriptions, funding references, and additional authors.
 * @param {Page} page - The Playwright page object to interact with
 * @returns {Promise<void>}
 */
export async function completeExtendedDatasetForm(page: Page) {
  // Start with minimal dataset form (includes author, contact person, and abstract)
  await completeMinimalDatasetForm(page);

  // Add Related Work entries
  await addRelatedWork(page, 0, exampleData.extended.relatedWorks[0]);

  // Add Free Keywords (using tagify - Enter key)
  await addFreeKeyword(page, exampleData.extended.keywords[0]);

  // Add Descriptions - Abstract already filled by completeMinimalDatasetForm.
  // Description types other than Abstract are loaded dynamically from the ERNIE
  // API, so we must wait for them to appear in the DOM first.
  await page.waitForFunction(
    () => document.querySelectorAll('#accordion-description .accordion-item[data-description-slug]').length > 0,
    { timeout: 15000 },
  );

  const descriptionFields: Array<[string, string, string]> = [
    ['#collapse-description-Methods', '#input-description-Methods', exampleData.extended.descriptions.methods],
    ['#collapse-description-TechnicalInfo', '#input-description-TechnicalInfo', exampleData.extended.descriptions.technicalInfo],
    ['#collapse-description-Other', '#input-description-Other', exampleData.extended.descriptions.other],
  ];
  for (const [collapseId, inputId, value] of descriptionFields) {
    await page.locator(`[data-bs-target="${collapseId}"]`).click();
    await page.locator(collapseId).waitFor({ state: 'visible' });
    await page.fill(inputId, value);
  }

  // Add Funding Reference entries
  await addFundingReference(page, 0, exampleData.extended.fundingReferences[0]);

    // Add Contributor Institutions
  await addContributorInstitution(page, 0, exampleData.extended.contributorInstitutions[0]);

  // Add Author Institutions
  await addAuthorInstitution(page, 0, exampleData.extended.authorInstitutions[0]);

  // Add Contributor Persons
  await addContributorPerson(page, 0, exampleData.extended.contributorPersons[0]);
}

/**
 * Completes an extended dataset form with multiple entries for related works,
 * keywords, funding references, and authors.
 * Builds on the extended form and adds additional entries for testing multiple item handling.
 * @param {Page} page - The Playwright page object to interact with
 * @returns {Promise<void>}
 */
export async function completeExtendedMultipleEntries(page: Page) {
  // Start with extended dataset form
  await completeExtendedDatasetForm(page);

  // Add Related Work entries
  await addRelatedWork(page, 1, exampleData.extendedMultiple.relatedWorks[0]);
  await addRelatedWork(page, 2, exampleData.extendedMultiple.relatedWorks[1]);

  // Add Free Keywords (multiple)
  await addFreeKeyword(page, exampleData.extendedMultiple.keywords[0]); // "nowcasting"
  await addFreeKeyword(page, exampleData.extendedMultiple.keywords[1]); // "monitoring"  
  await addFreeKeyword(page, exampleData.extendedMultiple.keywords[2]); // "data"

  // Add Funding Reference entries
  await addFundingReference(page, 1, exampleData.extendedMultiple.fundingReferences[0]);
  await addFundingReference(page, 2, exampleData.extendedMultiple.fundingReferences[1]);

  // Add multiple authors (index 1 and 2 for additional authors)
  await addAuthor(page, 1, exampleData.extendedMultiple.authors[0]);
  await addAuthor(page, 2, exampleData.extendedMultiple.authors[1]);

  // Add additional form group entries at index 1
  // (index 0 entries already added by completeExtendedDatasetForm)
  await addContributorInstitution(page, 1, exampleData.extendedMultiple.contributorInstitutions[0]);
  await addAuthorInstitution(page, 1, exampleData.extendedMultiple.authorInstitutions[0]);
  await addContributorPerson(page, 1, exampleData.extendedMultiple.contributorPersons[0]);
}

// ============ Helper Functions ============

/**
 * Waits for a Bootstrap accordion collapse transition to complete.
 * Ensures the section has fully opened (has 'show' class, no 'collapsing' class).
 */
async function waitForAccordionTransition(page: Page, collapseSelector: string) {
  await page.waitForFunction(
    (selector: string) => {
      const el = document.querySelector(selector);
      return el && el.classList.contains('show') && !el.classList.contains('collapsing');
    },
    collapseSelector,
    { timeout: 5000 }
  );
}

/**
 * Adds an author institution entry with institution name and affiliation.
 * Creates a new row if index > 0, then fills in the institution details.
 * @param {Page} page - The Playwright page object to interact with
 * @param {number} index - The row index for the author institution entry (0-based)
 * @param {Object} data - The author institution data object
 * @param {string} data.institutionName - The institution name
 * @param {string} data.affiliation - The institution affiliation/ROR identifier
 * @returns {Promise<void>}
 */
async function addAuthorInstitution(
  page: Page,
  index: number,
  data: {
    institutionName: string;
    affiliation: string;
  }
) {
  while (await page.locator('[data-authorinstitution-row]').count() <= index) {
    await page.locator('#button-authorinstitution-add').click();
    await page.locator('[data-authorinstitution-row]').nth(index).waitFor({ state: 'visible', timeout: 5000 });
  }

  // Get the specific author institution row
  const institutionRow = page.locator('[data-authorinstitution-row]').nth(index);

  // Fill institution name
  await institutionRow.locator('[id^="input-authorinstitution-name"]').fill(data.institutionName);

  const affiliationEditor = institutionRow.locator('[data-author-affiliation-editor]');
  await expect(affiliationEditor).toBeVisible();
  await affiliationEditor.locator('[data-author-affiliation-input]').fill(data.affiliation);
  await affiliationEditor.locator('[data-author-affiliation-add]').click();
  await expect(affiliationEditor.locator('[data-author-affiliation-label]').first()).toHaveValue(data.affiliation);
}

/**
 * Adds a contributor person entry with ORCID, name, role, and affiliation.
 * Creates a new row if index > 0, then fills in the contributor details.
 * @param {Page} page - The Playwright page object to interact with
 * @param {number} index - The row index for the contributor person entry (0-based)
 * @param {Object} data - The contributor person data object
 * @param {string} data.orcid - The contributor's ORCID identifier
 * @param {string} data.lastName - The contributor's last name
 * @param {string} data.firstName - The contributor's first name
 * @param {string} data.role - The contributor's role (e.g., 'DataCurator', 'Editor')
 * @param {string} data.affiliation - The contributor's affiliation/institution name
 * @returns {Promise<void>}
 */
async function addContributorPerson(
  page: Page,
  index: number,
  data: {
    orcid: string;
    lastName: string;
    firstName: string;
    role: string;
    affiliation: string;
  }
) {
  if (index > 0) {
    // Click the add button to create a new row
    await page.locator('#button-contributor-addperson').click();
    // Wait for the new contributor person row to be visible
    await page.locator('[contributor-person-row]').nth(index).waitFor({ state: 'visible' });
  }

  // Get the specific contributor person row
  const contributorRow = page.locator('[contributor-person-row]').nth(index);

  // Fill ORCID
  await contributorRow.locator('[id^="input-contributor-orcid"]').fill(data.orcid);

  // Fill last name
  await contributorRow.locator('[id^="input-contributor-lastname"]').fill(data.lastName);

  // Fill first name
  await contributorRow.locator('[id^="input-contributor-firstname"]').fill(data.firstName);

  // Fill role using tagify
  // The title for this field is Role(s) 
  const roleTagifyInput = contributorRow.locator('.tagify__input[title="Role(s)"]');
  await roleTagifyInput.click();
  await expect(roleTagifyInput).toBeFocused();
  await roleTagifyInput.type(data.role);
  await page.keyboard.press('Enter');

  // Fill affiliation using tagify
  // While for this field the title for this field is Affiliation. Without (s) 
  const affiliationTagifyInput = contributorRow.locator('.tagify__input[title^="Affiliation"]');
  await affiliationTagifyInput.click();
  await affiliationTagifyInput.type(data.affiliation);
  await page.keyboard.press('Enter');
}

/**
 * Adds a contributor institution entry with organization name, role, and affiliation.
 * Creates a new row if index > 0, then fills in the contributor institution details.
 * @param {Page} page - The Playwright page object to interact with
 * @param {number} index - The row index for the contributor institution entry (0-based)
 * @param {Object} data - The contributor institution data object
 * @param {string} data.organizationName - The organization name
 * @param {string} data.role - The organization's role (e.g., 'Sponsor', 'HostingInstitution')
 * @param {string} data.affiliation - The organization affiliation/ROR identifier
 * @returns {Promise<void>}
 */
async function addContributorInstitution(
  page: Page,
  index: number,
  data: {
    organizationName: string;
    role: string;
    affiliation: string;
  }
) {
  if (index > 0) {
    // Click the add button to create a new row
    await page.locator('#button-contributor-addorganisation').click();
    // Wait for the new contributor institution row to be visible
    await page.locator('[contributors-row]').nth(index).waitFor({ state: 'visible' });
  }

  // Get the specific contributor institution row
  const institutionRow = page.locator('[contributors-row]').nth(index);

  // Fill organization name
  await institutionRow.locator('[id^="input-contributor-name"]').fill(data.organizationName);

  // Fill the role into tha tagify field 
  const roleTagifyInput = institutionRow.locator('.tagify__input[title="Role(s)"]');
  await roleTagifyInput.click();
  await roleTagifyInput.type(data.role);
  await page.keyboard.press('Enter');

  // Fill the affiliation into the tagify field 
  const affiliationTagifyInput = institutionRow.locator('.tagify__input[title="Affiliation"]');
  await affiliationTagifyInput.click();
  await affiliationTagifyInput.type(data.affiliation);
  await page.keyboard.press('Enter');
}

/**
 * Adds a free keyword tag using tagify input.
 * Clicks the keyword input field, types the keyword, and presses Enter to create the tag.
 * @param {Page} page - The Playwright page object to interact with
 * @param {string} keyword - The keyword text to add
 * @returns {Promise<void>}
 */
async function addFreeKeyword(page: Page, keyword: string) {

  const tagInput = page.locator(`${SELECTORS.formGroups.freeKeywords} .tagify__input`);
  await tagInput.click();
  await tagInput.type(keyword);  
  // Press Enter to create the tag
  await page.keyboard.press('Enter');

  // Wait for the tag to appear in the DOM using exact title match
  const tagElement = page.getByTitle(keyword, { exact: true });
  await tagElement.waitFor({ state: 'visible', timeout: 5000 });
  
  // Wait for the keyword to be added to the tagify instance's value array with exact match
  await page.waitForFunction(
    (kw) => { //callback
      const input = document.querySelector('input[name="freekeywords[]"]') as any;
      return input?._tagify?.value?.some((tag: any) => tag.value === kw);
    },
    keyword,  //argument to the callback
    { timeout: 5000 }//options
  );
}

/**
 * Adds a related work entry with relation, identifier, and identifier type.
 * Creates a new row if index > 0, then fills in the related work details.
 * @param {Page} page - The Playwright page object to interact with
 * @param {number} index - The row index for the related work entry (0-based)
 * @param {Object} data - The related work data object
 * @param {string} data.identifier - The identifier value (e.g., DOI, URL)
 * @param {string} data.type - The identifier type label (e.g., 'DOI', 'URL')
 * @param {string} data.relation - The relation type label (e.g., 'cites', 'references')
 * @returns {Promise<void>}
 */
async function addRelatedWork(
  page: Page,
  index: number,
  data: { identifier: string; type: string; relation: string }
) {
  if (index > 0) {
    // Click the add button to create a new row
    await page.locator('#button-relatedwork-add').click();
    // Wait for the new related work row to be visible
    await page.locator('[related-work-row]').nth(index).waitFor({ state: 'visible' });
  }

  // Get the specific related work row
  const relatedWorkRow = page.locator('[related-work-row]').nth(index);

  // Select relation
  await relatedWorkRow
    .locator('[id*="input-relatedwork-relation"]')
    .selectOption({ label: data.relation });

  // Fill identifier
  await relatedWorkRow
    .locator('[id^="input-relatedwork-identifier"]:not([id*="type"])')
    .fill(data.identifier);

  // Auto-detect or use provided type and select it
  const identifierType = data.type;
  await relatedWorkRow
    .locator('[id*="input-relatedwork-identifiertype"]')
    .selectOption({ label: identifierType });
}

/**
 * Adds a funding reference entry with funder, grant number, name, and award URI.
 * Creates a new row if index > 0, then fills in the funding reference details.
 * @param {Page} page - The Playwright page object to interact with
 * @param {number} index - The row index for the funding reference entry (0-based)
 * @param {Object} data - The funding reference data object
 * @param {string} data.funder - The funder name
 * @param {string} data.grantNumber - The grant number or identifier
 * @param {string} data.grantName - The grant title or name
 * @param {string} data.awardUri - The URI/URL of the award or grant
 * @returns {Promise<void>} = "This function returns a Promise that resolves to nothing."
 */
async function addFundingReference(
  page: Page,
  index: number,
  data: {
    funder: string;
    grantNumber: string;
    grantName: string;
    awardUri: string;
  }
) {
  if (index > 0) {
    // Click the add button to create a new row
    await page.locator('#button-fundingreference-add').click();
    // Wait for the new funding reference row to be visible
    await page.locator('#input-funder').nth(index).waitFor({ state: 'visible' });
  }

  // Fill funder
  await page.locator('#input-funder').nth(index).fill(data.funder);

  // Fill grant number
  await page.locator('#input-grantnumber').nth(index).fill(data.grantNumber);

  // Fill grant name
  await page.locator('#input-grantname').nth(index).fill(data.grantName);

  // Fill award URI
  await page.locator('#input-awarduri').nth(index).fill(data.awardUri);
}

/**
 * Adds an author entry with ORCID, name, and affiliation.
 * Creates a new row if index > 0, then fills in the author details.
 * Affiliation is added as a tagify tag (requires Enter key press).
 * @param {Page} page - The Playwright page object to interact with
 * @param {number} index - The row index for the author entry (0-based)
 * @param {Object} data - The author data object
 * @param {string} data.orcid - The author's ORCID identifier
 * @param {string} data.lastName - The author's last name
 * @param {string} data.firstName - The author's first name
 * @param {string} data.affiliation - The author's affiliation/institution name
 * @returns {Promise<void>} - "This function returns a Promise that resolves to nothing."
 */
async function addAuthor(
  page: Page,
  index: number,
  data: {
    orcid: string;
    lastName: string;
    firstName: string;
    affiliation: string;
  }
) {
  while (await page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`).count() <= index) {
    await page.locator('#button-author-add').click();
    await page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`).nth(index).waitFor({ state: 'visible', timeout: 5000 });
  }

  const authorRow = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`).nth(index);

  // Set ORCID via evaluate() to avoid triggering the blur-based ORCID lookup.
  // The lookup would asynchronously populate name/affiliation fields via the ORCID API,
  // racing with our explicit fill() calls below and causing doubled values.
  const orcidField = authorRow.locator('[id^="input-author-orcid"]');
  await orcidField.waitFor({ state: 'visible', timeout: 5000 });
  await orcidField.evaluate((el: HTMLInputElement, val: string) => {
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, data.orcid);

  const lastNameField = authorRow.locator('[id^="input-author-lastname"]');
  await lastNameField.waitFor({ state: 'visible', timeout: 5000 });
  await lastNameField.fill(data.lastName);
  await expect(lastNameField).toHaveValue(data.lastName);

  const firstNameField = authorRow.locator('[id^="input-author-firstname"]');
  await firstNameField.waitFor({ state: 'visible', timeout: 5000 });
  await firstNameField.fill(data.firstName);
  await expect(firstNameField).toHaveValue(data.firstName);

  const affiliationEditor = authorRow.locator('[data-author-affiliation-editor]');
  await expect(affiliationEditor).toBeVisible();
  await affiliationEditor.locator('[data-author-affiliation-input]').fill(data.affiliation);
  await affiliationEditor.locator('[data-author-affiliation-add]').click();
  await expect(affiliationEditor.locator('[data-author-affiliation-label]').first()).toHaveValue(data.affiliation);
}
export { exampleData };

/**
 * Fills all GGMs/ICGEM-specific fields with representative test values.
 *
 * Unlike the roundtrip fixtures, which each describe one coherent model, this
 * walks through every mutually exclusive branch — all three model types, both
 * math representations, whole-body *and* separate crust/mantle density — so
 * that inactive branches are left holding stale values. That is the state
 * clearInputFields() has to survive, and no single reference XML can express it.
 *
 * Field coverage itself is owned by tests/playwright/flows/icgem-roundtrip.spec.ts.
 */
export async function fillGEM(page: Page) {
  const DS_ROW = '#group-datasources .row[data-source-row]';

  // Wait for dynamically-loaded selects to be populated from the API
  await page.waitForFunction(
    () => ((document.querySelector('#input-model-type') as HTMLSelectElement | null)?.options.length ?? 0) > 1,
    { timeout: 10_000 },
  );

  // ── Definition ────────────────────────────────────────────────────────────
  await page.locator('#input-celestial-body').selectOption('Moon of the Earth');
  await page.locator('#input-model-name').fill('TEST_CLEAR_MODEL');

  await page.waitForFunction(
    () => ((document.querySelector('#input-mathematical-representation') as HTMLSelectElement | null)?.options.length ?? 0) > 1,
    { timeout: 10_000 },
  );
  await page.locator('#input-mathematical-representation').selectOption({ index: 1 });

  await page.waitForFunction(
    () => ((document.querySelector('#input-file-format') as HTMLSelectElement | null)?.options.length ?? 0) > 1,
    { timeout: 10_000 },
  );
  await page.locator('#input-file-format').selectOption({ index: 1 });

  // ── Characteristics (spherical first) ─────────────────────────────────────
  await page.locator('#input-tide-system').selectOption('Zero-tide');
  await page.locator('#input-degree').fill('300');
  await page.locator('#input-errors').selectOption('calibrated');
  await page.locator('#input-error-handling-approach').fill('Calibration approach text');
  await page.locator('#input-earth-gravity-constant').fill('3.986004415e14');

  // Radius is visible for Spherical harmonics (index 1 with standard mocks / API order)
  const radiusVisible = await page.locator('#input-radius').isVisible().catch(() => false);
  if (radiusVisible) {
    await page.locator('#input-radius').fill('6378.1363');
  }

  // Exercise ellipsoidal reference-system fields, then restore spherical
  await page.locator('#input-mathematical-representation').selectOption({ label: 'Ellipsoidal harmonics' });
  await page.locator('#input-mathematical-representation').dispatchEvent('change');
  await expect(page.locator('.visibility-ellipsoidal').first()).toBeVisible({ timeout: 5_000 });
  await page.locator('#input-semimajor-axis').fill('6378.137');
  await page.locator('#input-second-variable').selectOption('flattening');
  await page.locator('#input-second-variable-value').fill('0.00335281');
  await page.locator('#input-mathematical-representation').selectOption({ label: 'Spherical harmonics' });
  await page.locator('#input-mathematical-representation').dispatchEvent('change');

  // ── Model Type: Static ────────────────────────────────────────────────────
  await page.locator('#input-model-type').selectOption('Static');
  await expect(page.locator('.visibility-modeltype-static')).toBeVisible();
  await page.locator('#checkbox-time-variable').check();
  await expect(page.locator('#time-variable-description-container')).toBeVisible({ timeout: 5_000 });
  await page.locator('#input-static-description').fill('Static time-variable description');

  // ── Model Type: Temporal ──────────────────────────────────────────────────
  await page.locator('#input-model-type').selectOption('Temporal');
  await expect(page.locator('.visibility-modeltype-temporal')).toBeVisible();
  await page.locator('#input-temporal-start').fill('2002-04-01');
  await page.locator('#input-temporal-end').fill('2023-06-30');
  await page.locator('#select-temporal-frequency-predef').selectOption('monthly');
  await page.locator('#input-temporal-institution').fill('GFZ');
  await page.locator('#input-release-number').fill('RL07');

  // ── Model Type: Topographic ───────────────────────────────────────────────
  await page.locator('#input-model-type').selectOption('Topographic');
  await expect(page.locator('.visibility-modeltype-topographic')).toBeVisible();
  await page.locator('#select-topo-layerapproach').selectOption('single-layer');
  await page.locator('#select-topo-domain').selectOption('spatial');
  await page.locator('#select-topo-approximation').selectOption('spherical');
  await page.locator('#select-topo-density').selectOption('constant');
  await page.locator('#input-topo-density-details').fill('2670 kg/m3');

  await page.locator('#checkbox-separate-density').check();
  await expect(page.locator('#separate-density-container')).toBeVisible({ timeout: 5_000 });
  await page.locator('#select-topo-density-crust').selectOption('constant');
  await page.locator('#input-topo-density-details-crust').fill('2700 crust');
  await page.locator('#select-topo-density-mantle').selectOption('density-model');
  await page.locator('#input-topo-density-details-mantle').fill('PREM mantle');

  // ── Data Sources – add a second row as type Model so dName[] is visible ───
  await page.locator('#button-datasource-add').click();
  await expect(page.locator(DS_ROW)).toHaveCount(2, { timeout: 5_000 });

  const secondRow = page.locator(DS_ROW).nth(1);
  // Must select type M (Model) first: only M shows visibility-datasources-identifier
  await secondRow.locator('select[name="datasource_type[]"]').selectOption('M');
  await secondRow.locator('textarea[name="datasource_description[]"]').fill('Second source description');
  await secondRow.locator('input[name="dName[]"]').fill('GRACE-FO');

  // ── Descriptions (all GGM description panels) ─────────────────────────────
  // The panels share a `data-bs-parent`, so only one is open at a time; opening
  // the next collapses the previous one but keeps the value already typed.
  const descriptionPanels: Array<[string, string]> = [
    ['abstract', 'Test abstract for clear test'],
    ['general-model-description', 'General model description'],
    ['input-data', 'Input data description'],
    ['processing-procedures', 'Processing procedures'],
    ['specific-features', 'Specific features'],
    ['other', 'Other description'],
  ];

  for (const [slug, value] of descriptionPanels) {
    const textarea = page.locator(`#input-${slug}`);

    // Bootstrap drops toggle clicks that arrive while the previous panel is
    // still animating closed, so wait for the accordion to settle and retry.
    if (!(await textarea.isVisible().catch(() => false))) {
      await expect(async () => {
        if (await textarea.isVisible()) return;
        await page.locator('#accordion-description .collapsing').first()
          .waitFor({ state: 'detached', timeout: 5_000 });
        await page.locator(`button[data-bs-target="#collapse-${slug}"]`).click();
        await expect(textarea).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
    }

    await textarea.fill(value);
  }
}

/**
 * Simulates the Submit handler behavior for submit-only required fields.
 * This mirrors the real UI logic where `.js-required-on-submit` becomes `required`
 * only during Submit, not during Save.
 */
export async function simulateSubmitValidation(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('.js-required-on-submit').forEach(el => {
      el.setAttribute('required', 'required');
    });
  });
}
