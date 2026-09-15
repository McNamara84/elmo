import { test, expect, type Locator, type Page } from '@playwright/test';
import { disableHelp, enableHelp, navigateToHome, SELECTORS } from '../utils';

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

const PERSON_HELP_SECTION_IDS = [
  'help-author-orcid',
  'help-contactperson-email',
  'help-contactperson-website',
] as const;

function authorCard(page: Page) {
  return page.locator(`${SELECTORS.formGroups.authors} [data-author-entry-row]`).first();
}

async function switchAuthorType(page: Page, type: 'person' | 'institution') {
  await authorCard(page).locator(`[data-author-type-option="${type}"]`).click();
  await expect(authorCard(page)).toHaveAttribute('data-author-entry-type', type);
  return authorCard(page);
}

async function setContactPerson(row: Locator, enabled: boolean) {
  const emailInput = row.locator('input[name="cpEmail[]"]');
  const isVisible = await emailInput.isVisible();
  if (isVisible === enabled) {
    return;
  }

  await row.locator('[data-author-contact-toggle]').click();
  if (enabled) {
    await expect(emailInput).toBeVisible();
  } else {
    await expect(emailInput).toBeHidden();
  }
}

async function expectAffiliationHelp(row: Locator, visible: boolean) {
  const icon = row.locator('[data-author-affiliation-help]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute('data-help-section-id', 'help-contributorinstitutions-affiliation');
  await expect(icon).toHaveClass(/help-icon-author-affiliation/);
  if (visible) {
    await expect(icon).toBeVisible();
  } else {
    await expect(icon).toBeHidden();
  }
}

async function expectPersonHelpIcons(row: Locator, visible: boolean) {
  await setContactPerson(row, true);
  for (const helpSectionId of PERSON_HELP_SECTION_IDS) {
    const icon = row.locator(`[data-help-section-id="${helpSectionId}"]`);
    await expect(icon).toHaveCount(1);
    if (visible) {
      await expect(icon).toBeVisible();
    } else {
      await expect(icon).toBeHidden();
    }
  }
  await expectAffiliationHelp(row, visible);
  // Contact person counts as content and locks the type switcher.
  await setContactPerson(row, false);
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
    const contactCheckbox = authorRow.locator('input[name="contacts[]"]');
    const emailInput = authorRow.locator('input[name="cpEmail[]"]');
    const websiteInput = authorRow.locator('input[name="cpOnlineResource[]"]');

    await expect(emailInput).toBeHidden();
    await expect(websiteInput).toBeHidden();

    await contactCheckbox.evaluate((element: HTMLInputElement) => {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(websiteInput).toBeVisible({ timeout: 10000 });

    await emailInput.fill('contact@example.com');
    await websiteInput.fill('https://example.com/profile');

    await contactCheckbox.evaluate((element: HTMLInputElement) => {
      element.checked = false;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });

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

  test('keeps author help icons in sync when toggling help and switching person/institution', async ({ page }) => {
    await addFirstAuthor(page);

    await test.step('Help Off hides person help icons', async () => {
      await expectPersonHelpIcons(authorCard(page), true);
      await disableHelp(page);
      await expectPersonHelpIcons(authorCard(page), false);
    });

    await test.step('Help Off stays off after switching to institution', async () => {
      const institutionRow = await switchAuthorType(page, 'institution');
      await expectAffiliationHelp(institutionRow, false);
    });

    await test.step('Help On shows institution help icons', async () => {
      await enableHelp(page);
      await expectAffiliationHelp(authorCard(page), true);
    });

    await test.step('Help On stays on after switching to person', async () => {
      const personRow = await switchAuthorType(page, 'person');
      await expectPersonHelpIcons(personRow, true);
    });

    await test.step('Help Off then On again follows the current author type', async () => {
      await disableHelp(page);
      await expectPersonHelpIcons(authorCard(page), false);

      const institutionRow = await switchAuthorType(page, 'institution');
      await expectAffiliationHelp(institutionRow, false);

      await enableHelp(page);
      await expectAffiliationHelp(authorCard(page), true);

      await disableHelp(page);
      await expectAffiliationHelp(authorCard(page), false);

      await enableHelp(page);
      await expectAffiliationHelp(authorCard(page), true);

      await switchAuthorType(page, 'person');
      await switchAuthorType(page, 'person');
      await switchAuthorType(page, 'institution');
      const personRow = await switchAuthorType(page, 'person');
      await expectPersonHelpIcons(personRow, true);
    });
  });

});