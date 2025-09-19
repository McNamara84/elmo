import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

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

    await page.locator('#input-author-orcid').fill('0000-0002-1825-0097');
    await page.getByRole('textbox', { name: 'Last Name*' }).click();

    await expect(page.getByRole('textbox', { name: 'Last Name*' })).toHaveValue('Carberry');
    await expect(page.getByRole('textbox', { name: 'First Name*' })).toHaveValue('Josiah');

    const affiliationTags = page.locator(`${SELECTORS.formGroups.authors} tag`);
    await expect(affiliationTags).toHaveCount(2);
    await expect(affiliationTags.nth(0)).toContainText('Brown University');
    await expect(affiliationTags.nth(1)).toContainText('Yale University');
    await expect(page.locator('#input-author-rorid')).toHaveValue('https://ror.org/05p8bnz29,https://ror.org/05rrcem69');
  });

  test('shows contact person fields when toggled and clears them when disabled', async ({ page }) => {
    const contactToggleLabel = page.locator('label[for="checkbox-author-contactperson"]');
    const emailInput = page.locator('#input-contactperson-email');
    const websiteInput = page.locator('#input-contactperson-website');

    await expect(emailInput).toBeHidden();
    await expect(websiteInput).toBeHidden();

    await contactToggleLabel.click();

    await expect(emailInput).toBeVisible();
    await expect(websiteInput).toBeVisible();

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

    const lastName = page.getByRole('textbox', { name: 'Last Name*' });
    const firstName = page.getByRole('textbox', { name: 'First Name*' });

    await lastName.fill('Existing');
    await firstName.fill('Author');

    await page.locator('#input-author-orcid').fill('1234');
    await firstName.click();
    await page.waitForTimeout(500);

    expect(requestTriggered).toBe(false);
    await expect(lastName).toHaveValue('Existing');
    await expect(firstName).toHaveValue('Author');
  });
});