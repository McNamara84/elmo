import { expect, type Page } from '@playwright/test';
import { SELECTORS } from './constants';
import exampleData from './inputDataEndToEnd.json';


/**
 * Fills in the minimal required fields for a dataset form.
 * Completes: publication year, resource type, language, title, author details (ORCID, name),
 * affiliation, contact person email, abstract, and date created.
 * @param {Page} page - The Playwright page object to interact with
 * @returns {Promise<void>}
 */
export async function completeMinimalDatasetForm(page: Page) {
  await page.getByRole('textbox', { name: 'Publication Year (YYYY)*' }).fill('2025');
  await page.getByLabel('Resource Type*').selectOption('5');
  await page.getByLabel('Language of dataset*').selectOption('1');
  await page.getByRole('textbox', { name: 'Title*' }).fill('A dataset');

  await page.locator('#input-author-orcid').fill('0000-0002-1825-0097');
  await page.getByRole('textbox', { name: 'Last Name*' }).fill('Carberry');
  await page.getByRole('textbox', { name: 'First Name*' }).fill('Josiah');

  await page
    .locator('#group-author tags')
    .getByRole('textbox')
    .fill('GFZ Helmholtz Centre for Geosciences');

  await page.getByText('ContactPerson?').click();

  const emailField = page.getByRole('textbox', { name: 'Email address*' });
  await expect(emailField).toBeVisible();
  await emailField.fill('example@gmail.com');

  await page.getByRole('textbox', { name: 'Abstract*' }).fill('Necessary abstract');
  await page.getByRole('textbox', { name: 'Date created*' }).fill('2025-01-01');
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

  // Add Descriptions - Abstract already filled by completeMinimalDatasetForm
  // Fill Methods section
  await page.locator('button[data-bs-target="#collapse-methods"]').click();
  await page.locator('#input-methods').fill(exampleData.extended.descriptions.methods);

  // Fill Technical Information section
  await page.locator('button[data-bs-target="#collapse-technicalinfo"]').click();
  await page.locator('#input-technicalinfo').fill(exampleData.extended.descriptions.technicalInfo);

  // Fill Other section
  await page.locator('button[data-bs-target="#collapse-other"]').click();
  await page.locator('#input-other').fill(exampleData.extended.descriptions.other);

  // Add Funding Reference entries
  await addFundingReference(page, 0, exampleData.extended.fundingReferences[0]);

  // Add Additional Authors
  await addAuthor(page, 1, exampleData.extended.authors[0]);
}

// ============ Helper Functions ============

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
  
  // Wait for the tag to be created
  await page.waitForTimeout(300);
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
  if (index > 0) {
    // Click the add button to create a new row
    await page.locator('#button-author-add').click();
    // Wait for the new author row to be visible
    await page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`).nth(index).waitFor({ state: 'visible' });
  }

  // Get the specific author row
  const authorRow = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`).nth(index);

  // Fill ORCID first (using wildcard for appended index)
  await authorRow.locator('[id^="input-author-orcid"]').fill(data.orcid);
  // Fill last name (clear first to handle any auto-clearing behavior)
  const lastNameField = authorRow.locator('[id^="input-author-lastname"]');
  // Special debugging for that field 
  await lastNameField.click();
  await page.waitForTimeout(300);
  await lastNameField.clear();
  await lastNameField.fill(data.lastName);
  // Fill first name
  await authorRow.locator('[id^="input-author-firstname"]').fill(data.firstName);

  // Fill affiliation using tagify within the author row
  const affiliationTagifyInput = authorRow.locator('.tagify__input');
  await affiliationTagifyInput.click();
  await affiliationTagifyInput.type(data.affiliation);
  await page.keyboard.press('Enter');
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

  // Add more related works
  await addRelatedWork(page, 1, exampleData.extendedMultiple.relatedWorks[1]);

  // Add more keywords
  await addFreeKeyword(page, 'monitoring');
  await addFreeKeyword(page, 'data');

  // Add more funding references
  await addFundingReference(page, 1, exampleData.extendedMultiple.fundingReferences[1]);

  // Add one more author
  await addAuthor(page, 1, exampleData.extendedMultiple.authors[1]);
}

export { exampleData };