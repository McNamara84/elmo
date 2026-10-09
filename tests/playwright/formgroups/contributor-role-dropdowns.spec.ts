
import { expect, test, type Locator, type Page } from '@playwright/test';

type RoleRecord = string | { name?: string };

function roleNames(payload: unknown): string[] {
  expect(Array.isArray(payload)).toBe(true);
  return (payload as RoleRecord[])
    .map(role => (typeof role === 'string' ? role : role.name || ''))
    .filter(name => name.length > 0);
}

/**
 * The role picker requests the type list and the shared ("both") list.
 * Persons always include Contact Person. Institutions include it only when
 * that feature is on. Names stay in API order, without duplicates.
 */
function expectedDropdownNames(primary: string[], shared: string[], includeContactPerson: boolean): string[] {
  const names = [...primary, ...shared].filter(name => includeContactPerson || name !== 'Contact Person');
  if (includeContactPerson) {
    names.push('Contact Person');
  }
  return [...new Set(names)];
}

async function fetchRoleNames(page: Page, type: 'person' | 'institution' | 'both'): Promise<string[]> {
  const response = await page.request.get(`api/v2/vocabs/roles?type=${type}`);
  expect(response.ok()).toBeTruthy();
  return roleNames(await response.json());
}

async function assertRoleDropdown(element: Locator, expectedNames: string[]) {
  await element.getByRole('textbox', { name: 'Role(s)', description: 'Role(s)' }).click();
  const items = element.page().locator('.tagify__dropdown .tagify__dropdown__item');
  await expect(items).toHaveText(expectedNames);
  await element.page().keyboard.press('Escape');
}

async function assertRolesForPerson(element: Locator, personApiResponse: string[]) {
  await assertRoleDropdown(element, personApiResponse);
}

async function assertRolesForInstitution(element: Locator, institutionApiResponse: string[]) {
  await assertRoleDropdown(element, institutionApiResponse);
}

test('contributor role dropdowns match the roles API exactly', async ({ page }) => {
  const personApiResponse = await fetchRoleNames(page, 'person');
  const institutionApiResponse = await fetchRoleNames(page, 'institution');
  const sharedRoles = await fetchRoleNames(page, 'both');

  await page.goto('');
  await page.waitForFunction(() => Boolean((window as any).contributorStack));
  const includeInstitutionContact = await page.evaluate(
    () => (window as any).ELMO_FEATURES?.showContactInstitution === true
  );

  await page.getByRole('button', { name: 'Add Person', exact: true }).click();
  await assertRolesForPerson(
    page.locator('#contributor-edit-0'),
    expectedDropdownNames(personApiResponse, sharedRoles, true)
  );

  await page.getByRole('button', { name: 'Add Person', exact: true }).click();
  await assertRolesForPerson(
    page.locator('#contributor-edit-1'),
    expectedDropdownNames(personApiResponse, sharedRoles, true)
  );

  await page.getByRole('button', { name: 'Add Institution', exact: true }).click();
  await assertRolesForInstitution(
    page.locator('#contributor-edit-2'),
    expectedDropdownNames(institutionApiResponse, sharedRoles, includeInstitutionContact)
  );
});
