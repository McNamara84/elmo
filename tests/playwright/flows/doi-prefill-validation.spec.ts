import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { navigateToHome, REPO_ROOT, registerGoogleMapsNoopRoute, waitForHomepageReady } from '../utils';

const CONTACT_FIXTURES = ['icdp', 'dqto', 'fidgeo'].map(name => ({
  name,
  attributes: JSON.parse(readFileSync(
    path.join(REPO_ROOT, `tests/fixtures/doi-prefill/issue-1300-${name}.json`), 'utf8'
  )).data.attributes,
  emailSelector: '[data-creator-row]:has(input[name="contacts[]"]:checked) input[name="cpEmail[]"]',
}));
CONTACT_FIXTURES.push({
  name: 'unmatched contributor',
  attributes: {
    ...CONTACT_FIXTURES[0].attributes,
    contributors: [{ nameType: 'Personal', familyName: 'External', givenName: 'Contact', contributorType: 'ContactPerson' }],
  },
  emailSelector: 'input[name="cbContactEmail[]"]',
});

test.describe('DOI contact validation, issue #1300', () => {
  for (const { name, attributes, emailSelector } of CONTACT_FIXTURES) {
    test(`marks untouched ${name} contact emails red on immediate Submit`, async ({ page }) => {
      const browserErrors: string[] = [];
      page.on('pageerror', error => browserErrors.push(error.message));
      await registerGoogleMapsNoopRoute(page);
      await page.route('**/api/v2/vocabs/thesauri/availability', route => route.fulfill({ json: {} }));
      await page.route('**/api/v2/doi/lookup/**', route => route.fulfill({ json: { found: true, attributes } }));
      await navigateToHome(page);
      await waitForHomepageReady(page);

      await page.locator('#input-resourceinformation-source-doi').fill(attributes.doi);
      await page.locator('#button-resourceinformation-prefill-doi').click();
      await expect(page.locator('#modal-doi-prefill')).toBeVisible();
      await page.locator('#button-doi-prefill-confirm').click();
      await expect(page.locator('#modal-doi-prefill')).toBeHidden();
      await expect(page.locator('#doi-lookup-spinner')).toHaveCount(0);

      // Do not focus or edit imported fields: blur used to hide this regression.
      await page.locator('#button-form-submit').click();
      await expect(page.locator('#modal-validation-failed')).toBeVisible();
      await expect(page.locator('#modal-submit')).toBeHidden();
      await page.locator('#modal-validation-failed [data-bs-dismiss="modal"]').first().click();
      await expect(page.locator('#modal-validation-failed')).toBeHidden();

      const emails = page.locator(emailSelector);
      const expectedContacts = attributes.contributors.filter((entry: any) => entry.contributorType === 'ContactPerson');
      await expect(emails).toHaveCount(expectedContacts.length);
      for (const email of await emails.all()) {
        await expect(email).toBeVisible();
        await expect(email).toHaveValue('');
        await expect(email).toHaveJSProperty('required', true);
        await expect(email).toHaveCSS('border-top-color', 'rgb(220, 53, 69)');
        await expect(email.locator('..').locator('.invalid-feedback')).toBeVisible();
      }
      await expect(page.locator('#contact-person-error')).toBeVisible();
      for (const optional of await page.locator(
        '[data-creator-row]:has(input[name="contacts[]"]:not(:checked)) input[name="cpEmail[]"], '
        + 'input[name="cpOnlineResource[]"], input[name="cbContactWebsite[]"]'
      ).all()) {
        await expect(optional).toHaveJSProperty('required', false);
      }

      await emails.first().fill('invalid-email');
      await expect(emails.first()).toHaveCSS('border-top-color', 'rgb(220, 53, 69)');
      await expect(page.locator('#contact-person-error')).toBeVisible();
      await emails.first().fill('contact@example.org');
      await expect(emails.first()).not.toHaveCSS('border-top-color', 'rgb(220, 53, 69)');
      await expect(emails.first().locator('..').locator('.invalid-feedback')).toBeHidden();
      await expect(page.locator('#contact-person-error')).toHaveCount(0);
      for (const email of (await emails.all()).slice(1)) {
        await expect(email).toHaveCSS('border-top-color', 'rgb(220, 53, 69)');
      }

      // Saving an incomplete draft must remain available after failed submission.
      await emails.first().fill('');
      await page.locator('#button-form-save').click();
      await expect(page.locator('#modal-saveas')).toBeVisible();
      expect(browserErrors).toEqual([]);
    });
  }
});
