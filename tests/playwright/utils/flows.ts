import { expect, type Page } from '@playwright/test';
import { SELECTORS } from './constants';


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

export async function completeExtendedDatasetForm(page: Page) {
  // Start with minimal dataset form (includes author, contact person, and abstract)
  await completeMinimalDatasetForm(page);

  // Add Related Work entries
  await addRelatedWork(page, 0, 'https://doi.org/10.5880/GFZ.DMJQ.2025.007');

  // Add Free Keywords (using tagify - Enter key)
  await addFreeKeyword(page, 'seismic data');

  // Add Descriptions - Abstract already filled by completeMinimalDatasetForm
  // Fill Methods section
  await page.locator('button[data-bs-target="#collapse-methods"]').click();
  await page.locator('#input-methods').fill('Data was collected using seismic stations deployed across the region.');

  // Fill Technical Information section
  await page.locator('button[data-bs-target="#collapse-technicalinfo"]').click();
  await page.locator('#input-technicalinfo').fill('Sampling rate: 100 Hz. Data format: miniSEED.');

  // Fill Other section
  await page.locator('button[data-bs-target="#collapse-other"]').click();
  await page.locator('#input-other').fill('Additional processing applied: bandpass filtering between 0.5-25 Hz.');

  // Add Funding Reference entries
  await addFundingReference(page, 0, {
    funder: 'DFG',
    grantNumber: 'DFG-12345',
    grantName: 'Seismic Monitoring Network',
    awardUri: 'https://gepris.dfg.de/gepris/project/12345',
  });

  // Add Additional Authors
  await addAuthor(page, 1, {
    orcid: '0000-0001-2345-6789',
    lastName: 'Isaak',
    firstName: 'Johann',
    affiliation: 'University of Cambridge',
  });
}

// ============ Helper Functions ============

/**
 * Add a free keyword using tagify (Enter key to create tags)
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
 * Add a related work entry
 */
async function addRelatedWork(page: Page, index: number, identifier: string) {
  if (index > 0) {
    // Click the add button to create a new row
    await page.locator('#button-relatedwork-add').click();
    // Wait for the new related work row to be visible
    await page.locator('[related-work-row]').nth(index).waitFor({ state: 'visible' });
  }

  // Get the specific related work row
  const relatedWorkRow = page.locator('[related-work-row]').nth(index);

  // Select relation
  await relatedWorkRow.locator('[id*="input-relatedwork-relation"]').selectOption({ index: 1 });

  // Fill identifier (starts with identifier but NOT containing "type" to handle appended numbers)
  await relatedWorkRow.locator('[id^="input-relatedwork-identifier"]:not([id*="type"])').fill(identifier);

  // Select identifier type (exact match - no dynamic suffix)
  await relatedWorkRow.locator('[id*="input-relatedwork-identifiertype"]').selectOption({ index: 1 });
}

/**
 * Add a funding reference entry
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
 * Add an author entry
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

export async function completeExtendedMultipleEntries(page: Page) {
  // Start with extended dataset form
  await completeExtendedDatasetForm(page);

  // Add more related works
  await addRelatedWork(page, 1, 'https://doi.org/10.5880/GFZ.DMJQ.2025.009');

  // Add more keywords
  await addFreeKeyword(page, 'monitoring');
  await addFreeKeyword(page, 'data');

  // Add more funding references
  await addFundingReference(page, 1, {
    funder: 'EU Horizon',
    grantNumber: 'EU-2025-001',
    grantName: 'European Research Initiative',
    awardUri: 'https://cordis.europa.eu/project/id/2025001',
  });

  // Add one more author
  await addAuthor(page, 1, {
    orcid: '0000-0001-6352-9161',
    lastName: 'Mueller',
    firstName: 'Hans',
    affiliation: 'ETH Zurich',
  });
}