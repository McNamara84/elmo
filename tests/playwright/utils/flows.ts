import { expect, type Page } from '@playwright/test';

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
  await page.locator('#input-methods').fill('Data was collected using seismic stations deployed across the region.');

  // Fill Technical Information section
  await page.locator('#input-technicalinfo').fill('Sampling rate: 100 Hz. Data format: miniSEED.');

  // Fill Other section
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
  const keywordInput = page.locator('#input-freekeyword');
  
  // Wait for the input to be visible
  await keywordInput.waitFor({ state: 'visible' });
  
  // Scroll into view
  await keywordInput.scrollIntoViewIfNeeded();
  
  // Wait a moment for scroll to complete
  await page.waitForTimeout(200);
  
  // Use type to input the keyword (more reliable with tagify)
  await keywordInput.type(keyword, { delay: 50 });
  
  // Press Enter to create the tag
  await page.keyboard.press('Enter');
  
  // Wait for the tag to be created
  await page.waitForTimeout(50);
}

/**
 * Add a related work entry
 */
async function addRelatedWork(page: Page, index: number, identifier: string) {
  if (index > 0) {
    // Click the add button to create a new row
    await page.locator('#button-relatedwork-add').click();
    await page.waitForTimeout(300); // Wait for DOM to update
  }

  // Select relation (use index to target specific row)
  await page.locator('#input-relatedwork-relation').nth(index).selectOption({ index: 1 });

  // Fill identifier
  await page.locator('#input-relatedwork-identifier').nth(index).fill(identifier);

  // Select identifier type
  await page.locator('#input-relatedwork-identifiertype').nth(index).selectOption({ index: 1 });
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
    await page.waitForTimeout(300); // Wait for DOM to update
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
    await page.waitForTimeout(300); // Wait for DOM to update
  }

  // Fill ORCID first
  await page.locator('#input-author-orcid').nth(index).fill(data.orcid);

  // Fill first name
  await page.locator('#input-author-firstname').nth(index).fill(data.firstName);

  // Fill last name
  await page.locator('#input-author-lastname').nth(index).fill(data.lastName);

  // Fill affiliation
  await page.locator('#input-author-affiliation').nth(index).fill(data.affiliation);
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