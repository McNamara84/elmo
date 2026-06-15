import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

async function expectAuthorAffiliations(row, expectedNames: string[]) {
  const chips = row.locator('[data-author-affiliation-chip]');
  await expect(chips).toHaveCount(expectedNames.length);
  for (const [index, expectedName] of expectedNames.entries()) {
    await expect(chips.nth(index).locator('[data-author-affiliation-label]')).toHaveValue(expectedName);
  }
}

async function addFirstAuthor(page) {
  await page.locator('#button-author-add').click();
  const authorRow = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`).first();
  await expect(authorRow).toBeVisible();
  return authorRow;
}

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
    },
    educations: {
      'affiliation-group': [
        {
          summaries: [
            {
              'education-summary': {
                organization: {
                  name: 'Yale University',
                  'disambiguated-organization': {
                    'disambiguation-source': 'ROR',
                    'disambiguated-organization-identifier': '05rrcem69'
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

const mockOrcidRecordWithEndedAffiliations = {
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
                'end-date': { year: { value: '1965' } }
              }
            }
          ]
        }
      ]
    },
    educations: {
      'affiliation-group': [
        {
          summaries: [
            {
              'education-summary': {
                organization: {
                  name: 'Yale University',
                  'disambiguated-organization': {
                    'disambiguation-source': 'ROR',
                    'disambiguated-organization-identifier': '05rrcem69'
                  }
                },
                'end-date': { year: { value: '1937' } }
              }
            }
          ]
        }
      ]
    }
  }
};

test.describe('Author(s) form group', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('populates author details and affiliations from a valid ORCID', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockOrcidRecord)
      });
    });

    const authorRow = await addFirstAuthor(page);
    await authorRow.locator('input[name="orcids[]"]').fill('0000-0002-1825-0097');
    await authorRow.locator('input[name="familynames[]"]').click();

    await expect(authorRow.locator('input[name="familynames[]"]')).toHaveValue('Carberry');
    await expect(authorRow.locator('input[name="givennames[]"]')).toHaveValue('Josiah');

    await expectAuthorAffiliations(authorRow, ['Brown University', 'Yale University']);
    await expect(authorRow.locator('input[name="authorPersonRorIds[]"]')).toHaveValue('05p8bnz29,05rrcem69');
  });

  test('filters ended affiliations from ORCID preload', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockOrcidRecordWithEndedAffiliations)
      });
    });

    const authorRow = await addFirstAuthor(page);
    await authorRow.locator('input[name="orcids[]"]').fill('0000-0002-1825-0097');
    await authorRow.locator('input[name="familynames[]"]').click();

    await expect(authorRow.locator('input[name="familynames[]"]')).toHaveValue('Carberry');
    await expect(authorRow.locator('input[name="givennames[]"]')).toHaveValue('Josiah');

    await expectAuthorAffiliations(authorRow, []);
    await expect(authorRow.locator('input[name="authorPersonRorIds[]"]')).toHaveValue('');
  });

  test('shows contact person fields when toggled and clears them when disabled', async ({ page }) => {
    const authorRow = await addFirstAuthor(page);
    const contactToggleLabel = authorRow.locator('[data-author-contact-toggle]');
    const emailInput = authorRow.locator('input[name="cpEmail[]"]');
    const websiteInput = authorRow.locator('input[name="cpOnlineResource[]"]');

    await expect(emailInput).toBeHidden();
    await expect(websiteInput).toBeHidden();

    await contactToggleLabel.click();

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(websiteInput).toBeVisible({ timeout: 10000 });

    await emailInput.fill('contact@example.com');
    await websiteInput.fill('https://example.com/profile');

    await contactToggleLabel.click();

    await expect(emailInput).toBeHidden();
    await expect(websiteInput).toBeHidden();
    await expect(emailInput).toHaveValue('');
    await expect(websiteInput).toHaveValue('');
  });

  test('allows managing multiple authors independently', async ({ page }) => {
    const addAuthorButton = page.locator('#button-author-add');

    await addAuthorButton.click();
    await addAuthorButton.click();

    const authorRows = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`);
    await expect(authorRows).toHaveCount(2);

    const firstRow = authorRows.nth(0);
    const secondRow = authorRows.nth(1);

    await expect(firstRow.locator('input[name="orcids[]"]')).toHaveValue('');
    await expect(secondRow.locator('input[name="orcids[]"]')).toHaveValue('');
    await expect(secondRow.locator('.removeButton')).toBeVisible();

    const secondRowToggle = secondRow.locator('label.btn[for^="checkbox-author-contactperson"]');
    const secondRowEmail = secondRow.locator("input[id^='input-contactperson-email']");

    await expect(secondRowEmail).toBeHidden();
    await secondRowToggle.click();
    await expect(secondRowEmail).toBeVisible();

    await secondRow.locator('input[name="familynames[]"]').fill('Miller');
    await secondRow.locator('input[name="givennames[]"]').fill('Ava');

    await secondRow.locator('.removeButton').click();
    await expect(authorRows).toHaveCount(1);
    await expect(firstRow.locator('input[name="familynames[]"]')).toHaveValue('');
    await expect(firstRow.locator('input[name="givennames[]"]')).toHaveValue('');
  });

  test('does not trigger an ORCID lookup for invalid identifiers', async ({ page }) => {
    let requestTriggered = false;
    await page.route('**/pub.orcid.org/v3.0/**', route => {
      requestTriggered = true;
      return route.fulfill({ status: 200, body: '{}' });
    });

    const authorRow = await addFirstAuthor(page);
    const lastName = authorRow.locator('input[name="familynames[]"]');
    const firstName = authorRow.locator('input[name="givennames[]"]');

    await lastName.fill('Existing');
    await firstName.fill('Author');

    await authorRow.locator('input[name="orcids[]"]').fill('1234');
    await firstName.click();

    expect(requestTriggered).toBe(false);
    await expect(lastName).toHaveValue('Existing');
    await expect(firstName).toHaveValue('Author');
  });

  test('accepts valid international author last names', async ({ page }) => {
    const authorRow = await addFirstAuthor(page);
    const lastName = authorRow.locator('input[name="familynames[]"]');

    let isValid: boolean;

    // Arabic name with spaces
    await lastName.fill('محمد علي');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(true);

    // German name with umlaut
    await lastName.fill('Rüdiger');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(true);

    // Russian name (Cyrillic)
    await lastName.fill('Александр ');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(true);

    // Greek name
    await lastName.fill('Παπαδόπουλος');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(true);

    // Turkish name with hyphen
    await lastName.fill('Çalışkan-Şahin');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(true);

    // Chinese name
    await lastName.fill('王小明');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(true);

    // English name with apostrophe and hyphen
    await lastName.fill("O'Connor-Smith");
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(true);
  });


  test('rejects author last names with digits or forbidden symbols', async ({ page }) => {
    const authorRow = await addFirstAuthor(page);
    const lastName = authorRow.locator('input[name="familynames[]"]');

    let isValid: boolean;

    await lastName.fill('Ali123');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(false);

    await lastName.fill('Ali$');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(false);

    await lastName.fill('Ali?=§&');
    isValid = await lastName.evaluate(el => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(false);
  });

});