import { test, expect } from '@playwright/test';
import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs';
import { completeMinimalDatasetForm, navigateToHome, waitForFormInteractionReady } from '../utils';

test.describe('Issue #1142 roleless contributor export', () => {
  test.setTimeout(90_000);

  test('exports draft persons and institutions with the Other fallback', async ({ page }) => {
    await navigateToHome(page);
    // The fixed footer can cover form controls in Playwright's default viewport.
    await page.locator('footer.fixed-bottom').evaluate((footer) => footer.classList.remove('fixed-bottom'));
    await completeMinimalDatasetForm(page);

    const personRow = page.locator('[contributor-person-row]').first();
    await personRow.locator('input[name="cbPersonLastname[]"]').fill('Roleless');
    await personRow.locator('input[name="cbPersonFirstname[]"]').fill('Person');
    await addAffiliation(personRow, 'Person University');

    const institutionRow = page.locator('[contributors-row]').first();
    await institutionRow.locator('input[name="cbOrganisationName[]"]').fill('Roleless Institute');
    await addAffiliation(institutionRow, 'Institute Network');

    await expect(personRow.locator('input[name="cbPersonRoles[]"]')).toHaveValue('');
    await expect(institutionRow.locator('input[name="cbOrganisationRoles[]"]')).toHaveValue('');

    await page.locator('#button-form-save').click();
    const saveAsModal = page.locator('#modal-saveas');
    await expect(saveAsModal).toBeVisible();
    await page.locator('#input-saveas-filename').fill('issue-1142-roleless-contributors');

    await waitForFormInteractionReady(page, 'save');

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('save/save_data.php'),
      { timeout: 30_000 },
    );

    await page.locator('#button-saveas-save').click();

    const [download, response] = await Promise.all([downloadPromise, responsePromise]);
    expect(response.status()).toBe(200);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const xml = fs.readFileSync(downloadPath!, 'utf8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const resource = extractDataCiteResource(parser.parse(xml));
    const contributors = toArray(resource?.contributors?.contributor);

    const person = contributors.find(
      (contributor) => contributor.familyName === 'Roleless',
    );
    const institution = contributors.find(
      (contributor) => textOf(contributor.contributorName) === 'Roleless Institute',
    );

    expect(person, `Expected roleless person in ${JSON.stringify(contributors)}`).toBeTruthy();
    expect(textOf(person.contributorName)).toBe('Roleless, Person');
    expect(person.givenName).toBe('Person');
    expect(person.contributorType).toBe('Other');
    expect(textOf(person.affiliation)).toBe('Person University');

    expect(institution, `Expected roleless institution in ${JSON.stringify(contributors)}`).toBeTruthy();
    expect(institution.contributorType).toBe('Other');
    expect(textOf(institution.affiliation)).toBe('Institute Network');
  });
});

async function addAffiliation(row: import('@playwright/test').Locator, value: string): Promise<void> {
  const tagInput = row.locator('.tagify__input[title^="Affiliation"]');
  await expect(tagInput).toBeVisible();
  await tagInput.click();
  await tagInput.fill(value);
  await tagInput.press('Enter');
}

function extractDataCiteResource(parsedXml: Record<string, any>): Record<string, any> | null {
  const envelope = parsedXml.envelope
    ?? Object.entries(parsedXml).find(([key]) => key.endsWith(':envelope'))?.[1];

  if (!envelope || typeof envelope !== 'object') {
    return null;
  }

  return envelope.resource
    ?? Object.entries(envelope).find(([key]) => key.endsWith(':resource'))?.[1]
    ?? null;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && '#text' in value) {
    return String((value as Record<string, unknown>)['#text']);
  }

  return '';
}
