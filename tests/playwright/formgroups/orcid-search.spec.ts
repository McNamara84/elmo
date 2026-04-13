import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

const mockExpandedSearchResults = {
  'expanded-result': [
    {
      'orcid-id': '0000-0002-1825-0097',
      'given-names': 'Josiah',
      'family-names': 'Carberry',
      'institution-name': ['Brown University']
    },
    {
      'orcid-id': '0000-0001-5000-0007',
      'given-names': 'John',
      'family-names': 'Carberry',
      'institution-name': ['MIT', 'Harvard University']
    }
  ]
};

const mockOrcidRecord = {
  person: {
    name: {
      'family-name': { value: 'Carberry' },
      'given-names': { value: 'Josiah' }
    }
  },
  'activities-summary': {
    employments: {
      'affiliation-group': [
        {
          summaries: [
            {
              'employment-summary': {
                organization: {
                  name: 'Brown University',
                  'disambiguated-organization': {
                    'disambiguation-source': 'ROR',
                    'disambiguated-organization-identifier': 'https://ror.org/05p8bnz29'
                  }
                },
                'end-date': null
              }
            }
          ]
        }
      ]
    }
  }
};

test.describe('ORCID Search Modal', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('opens ORCID search modal from author search button', async ({ page }) => {
    const searchBtn = page.locator(`${SELECTORS.formGroups.authors} .orcid-search-btn`).first();
    await searchBtn.click();

    const modal = page.locator('#modal-orcid-search');
    await expect(modal).toBeVisible();
    await expect(page.locator('#input-orcid-search-firstname')).toBeVisible();
    await expect(page.locator('#input-orcid-search-lastname')).toBeVisible();
    await expect(page.locator('#button-orcid-search-execute')).toBeVisible();
  });

  test('shows validation message when searching with empty fields', async ({ page }) => {
    const searchBtn = page.locator(`${SELECTORS.formGroups.authors} .orcid-search-btn`).first();
    await searchBtn.click();

    const modal = page.locator('#modal-orcid-search');
    await expect(modal).toBeVisible();

    await page.locator('#button-orcid-search-execute').click();

    const alert = page.locator('#orcid-search-alert');
    await expect(alert).toBeVisible();
  });

  test('searches by name and displays results for authors', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/expanded-search/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockExpandedSearchResults)
      });
    });

    const searchBtn = page.locator(`${SELECTORS.formGroups.authors} .orcid-search-btn`).first();
    await searchBtn.click();

    await page.locator('#input-orcid-search-lastname').fill('Carberry');
    await page.locator('#button-orcid-search-execute').click();

    const resultsBody = page.locator('#orcid-search-results-body');
    await expect(resultsBody.locator('tr')).toHaveCount(2);

    await expect(resultsBody.locator('tr').nth(0)).toContainText('Carberry');
    await expect(resultsBody.locator('tr').nth(0)).toContainText('Josiah');
    await expect(resultsBody.locator('tr').nth(0)).toContainText('Brown University');

    await expect(resultsBody.locator('tr').nth(1)).toContainText('MIT, Harvard University');
  });

  test('selecting a result fills author form fields', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/expanded-search/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockExpandedSearchResults)
      });
    });

    await page.route('**/pub.orcid.org/v3.0/0000-0002-1825-0097/record', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockOrcidRecord)
      });
    });

    const searchBtn = page.locator(`${SELECTORS.formGroups.authors} .orcid-search-btn`).first();
    await searchBtn.click();

    await page.locator('#input-orcid-search-lastname').fill('Carberry');
    await page.locator('#button-orcid-search-execute').click();

    const acceptBtn = page.locator('.orcid-search-accept-btn').first();
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Modal should close
    await expect(page.locator('#modal-orcid-search')).toBeHidden();

    // Author fields should be filled
    const authorRow = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`).first();
    await expect(authorRow.locator('input[name="orcids[]"]')).toHaveValue('0000-0002-1825-0097');
    await expect(authorRow.locator('input[name="familynames[]"]')).toHaveValue('Carberry');
    await expect(authorRow.locator('input[name="givennames[]"]')).toHaveValue('Josiah');

    // Affiliations
    const affiliationTags = authorRow.locator('tag');
    await expect(affiliationTags).toHaveCount(1);
    await expect(affiliationTags.nth(0)).toContainText('Brown University');
    await expect(page.locator('#input-author-rorid')).toHaveValue('https://ror.org/05p8bnz29');
  });

  test('Enter key triggers search in modal', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/expanded-search/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 'expanded-result': [] })
      });
    });

    const searchBtn = page.locator(`${SELECTORS.formGroups.authors} .orcid-search-btn`).first();
    await searchBtn.click();

    await page.locator('#input-orcid-search-lastname').fill('NonexistentName');
    await page.locator('#input-orcid-search-lastname').press('Enter');

    // Should show no results
    await expect(page.locator('#orcid-search-no-results')).toBeVisible();
  });

  test('shows error alert on API failure', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/expanded-search/**', async route => {
      await route.fulfill({ status: 503 });
    });

    const searchBtn = page.locator(`${SELECTORS.formGroups.authors} .orcid-search-btn`).first();
    await searchBtn.click();

    await page.locator('#input-orcid-search-lastname').fill('Carberry');
    await page.locator('#button-orcid-search-execute').click();

    const alert = page.locator('#orcid-search-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass(/alert-danger/);
  });

  test('modal resets when reopened', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/expanded-search/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockExpandedSearchResults)
      });
    });

    // First: open, search, see results
    const searchBtn = page.locator(`${SELECTORS.formGroups.authors} .orcid-search-btn`).first();
    await searchBtn.click();
    await page.locator('#input-orcid-search-lastname').fill('Carberry');
    await page.locator('#button-orcid-search-execute').click();
    await expect(page.locator('#orcid-search-results-body tr')).toHaveCount(2);

    // Close modal
    await page.locator('#modal-orcid-search .btn-close').click();
    await expect(page.locator('#modal-orcid-search')).toBeHidden();

    // Reopen
    await searchBtn.click();
    await expect(page.locator('#modal-orcid-search')).toBeVisible();

    // Fields should be cleared
    await expect(page.locator('#input-orcid-search-firstname')).toHaveValue('');
    await expect(page.locator('#input-orcid-search-lastname')).toHaveValue('');
    await expect(page.locator('#orcid-search-results')).toHaveClass(/d-none/);
    await expect(page.locator('#orcid-search-results-body')).toBeEmpty();
  });

  test('works correctly with second added author row', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/expanded-search/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockExpandedSearchResults)
      });
    });

    await page.route('**/pub.orcid.org/v3.0/0000-0002-1825-0097/record', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockOrcidRecord)
      });
    });

    // Add a second author row
    await page.locator('#button-author-add').click();
    const authorRows = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`);
    await expect(authorRows).toHaveCount(2);

    // Click search button on the second row
    const secondRowSearchBtn = authorRows.nth(1).locator('.orcid-search-btn');
    await secondRowSearchBtn.click();

    await page.locator('#input-orcid-search-lastname').fill('Carberry');
    await page.locator('#button-orcid-search-execute').click();
    await expect(page.locator('#orcid-search-results-body tr')).toHaveCount(2);

    await page.locator('.orcid-search-accept-btn').first().click();
    await expect(page.locator('#modal-orcid-search')).toBeHidden();

    // Second row should have the data, first row should be untouched
    await expect(authorRows.nth(1).locator('input[name="orcids[]"]')).toHaveValue('0000-0002-1825-0097');
    await expect(authorRows.nth(1).locator('input[name="familynames[]"]')).toHaveValue('Carberry');
    await expect(authorRows.nth(0).locator('input[name="orcids[]"]')).toHaveValue('');
    await expect(authorRows.nth(0).locator('input[name="familynames[]"]')).toHaveValue('');
  });
});
