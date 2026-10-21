import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import { navigateToHome, registerGoogleMapsNoopRoute, waitForFormInteractionReady, waitForHomepageReady } from '../../utils';

const FIXTURE = path.join(__dirname, 'testDataIcgemContactRoundtrip/elmogem_contact_info_roundtrip.xml');

/**
 * Contacts that land on a contributor card and come back in the download.
 * cont_pers_1 is an author, so normal mapping does not make a contributor card
 * for that ContactPerson, and the grav address is not copied onto the author.
 */
const EXPECTED_CONTACTS = [
  { nameType: 'Organizational', name: 'cont_inst_1', email: 'cont_inst_1@mail.com', website: 'cont_inst_1.com' },
  { nameType: 'Organizational', name: 'cont_inst_2', email: 'cont_inst_2@mail.com', website: 'cont_inst_2.com' },
  { nameType: 'Personal', name: 'cont_pers_2', email: 'cont_pers_2@mail.com', website: 'cont_pers_2.com' },
];

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/**
 * Reads grav:contacts/grav:contact entries.
 * A new child element stays ignored until this reader and the upload parser both accept it.
 */
function gravContactPairs(xml: string): Array<{ nameType: string; name: string; email: string; website: string }> {
  const wrapper = xml.match(/<(?:[\w.-]+:)?contacts\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?contacts>/);
  if (!wrapper) return [];

  const contacts: Array<{ nameType: string; name: string; email: string; website: string }> = [];
  const block = /<(?:[\w.-]+:)?contact\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?contact>/g;
  let found: RegExpExecArray | null;
  while ((found = block.exec(wrapper[1])) !== null) {
    const text = (tag: string) => {
      const match = found?.[1].match(new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`));
      return match ? decodeXml(match[1]) : '';
    };
    contacts.push({
      nameType: text('nameType'),
      name: text('name'),
      email: text('address'),
      website: text('onlineResource'),
    });
  }
  return contacts;
}

async function downloadIcgemXml(page: Page): Promise<string> {
  let capturedBody = '';
  let capturedStatus = 0;

  await page.route('**/save/save_data.php', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const response = await route.fetch();
    capturedStatus = response.status();
    capturedBody = (await response.body()).toString('utf-8');
    await route.fulfill({ response, body: capturedBody });
  });

  await page.locator('#button-form-save').click();
  await page.locator('#modal-saveas').waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('#input-saveas-filename').fill('elmogem-contact-info-roundtrip');
  await waitForFormInteractionReady(page, 'save');
  await page.locator('#button-saveas-save').click();
  await page.waitForResponse(
    (response) => response.url().includes('/save/save_data.php') && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.unroute('**/save/save_data.php');

  expect(capturedStatus, capturedBody.slice(0, 500)).toBe(200);
  expect(capturedBody.trim().length).toBeGreaterThan(0);

  const notification = page.locator('#modal-notification');
  await expect(notification).toBeVisible();
  await notification.locator('.btn-primary').click();
  await expect(notification).toBeHidden();
  await expect(page.locator('#modal-saveas')).toBeHidden();
  return capturedBody;
}

test('uploads the contact round-trip file, reloads the download, and keeps every card', async ({ page }) => {
  await registerGoogleMapsNoopRoute(page);
  await page.route('**/api/v2/vocabs/thesauri/availability', route => route.fulfill({ json: {} }));
  await page.route('**/api/v2/vocabs/titletypes', route => route.fulfill({
    json: [{ id: 1, name: 'Main Title' }, { id: 2, name: 'Alternative Title' }],
  }));
  await navigateToHome(page);
  await waitForHomepageReady(page);
  await page.waitForFunction(async () => {
    const app = window as any;
    await app.thesauriReady;
    return Boolean(app.authorStack && app.contributorStack && app.icgemModule
      && (document.querySelector('#input-freekeyword') as any)?._tagify);
  });

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.locator('#button-form-load').click();
  await expect(page.locator('#modal-uploadxml')).toBeVisible();
  await page.locator('#input-uploadxml-file').setInputFiles(FIXTURE);
  await expect(page.locator('#toast-upload-feedback')).toHaveClass(/text-bg-success/);
  await expect(page.locator('#modal-uploadxml')).toBeHidden();

  await expectRoundTripCards(page, true);

  const downloaded = await downloadIcgemXml(page);
  expect(gravContactPairs(downloaded)).toEqual(EXPECTED_CONTACTS);
  for (const contact of EXPECTED_CONTACTS) {
    expect(downloaded).toContain(contact.email);
    if (contact.website) expect(downloaded).toContain(contact.website);
  }

  await page.locator('#button-form-reset').click();
  await expect(page.locator('#modal-confirm')).toBeVisible();
  await page.locator('#button-confirm-action').click();
  await expect(page.locator('#modal-confirm')).toBeHidden();
  await expect(page.locator('[data-author-card]')).toHaveCount(0);
  await expect(page.locator('[data-contributor-card]')).toHaveCount(0);

  const toastClose = page.locator('#toast-upload-feedback .btn-close');
  if (await toastClose.isVisible()) await toastClose.click();
  await page.locator('#button-form-load').click();
  await expect(page.locator('#modal-uploadxml')).toBeVisible();
  await page.locator('#input-uploadxml-file').setInputFiles({
    name: 'elmogem-contact-info-roundtrip.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from(downloaded),
  });
  await expect(page.locator('#toast-upload-feedback')).toHaveClass(/text-bg-success/);
  await expect(page.locator('#modal-uploadxml')).toBeHidden();

  await expectRoundTripCards(page, false);
  expect(pageErrors).toEqual([]);
});

async function expectRoundTripCards(page: Page, authorIsContact: boolean) {
  const authors = page.locator('[data-author-card]');
  await expect(authors).toHaveCount(2);
  await expect(authors.nth(0).locator('[name="familynames[]"]')).toHaveValue('author_1');
  await expect(authors.nth(0).locator('[name="contacts[]"]')).not.toBeChecked();
  await expect(authors.nth(0).locator('[name="cpEmail[]"]')).toHaveValue('');
  await expect(authors.nth(0).locator('[name="cpOnlineResource[]"]')).toHaveValue('');

  await expect(authors.nth(1).locator('[name="familynames[]"]')).toHaveValue('cont_pers_1');
  if (authorIsContact) {
    await expect(authors.nth(1).locator('[name="contacts[]"]')).toBeChecked();
  } else {
    await expect(authors.nth(1).locator('[name="contacts[]"]')).not.toBeChecked();
  }
  await expect(authors.nth(1).locator('[name="cpEmail[]"]')).toHaveValue('');
  await expect(authors.nth(1).locator('[name="cpOnlineResource[]"]')).toHaveValue('');

  const contributors = page.locator('[data-contributor-card]');
  await expect(contributors).toHaveCount(EXPECTED_CONTACTS.length);
  for (const [index, contact] of EXPECTED_CONTACTS.entries()) {
    const card = contributors.nth(index);
    const name = card.locator(contact.nameType === 'Organizational'
      ? '[name="cbOrganisationName[]"]'
      : '[name="cbPersonLastname[]"]');
    await expect(name).toHaveValue(contact.name);
    await expect(card.locator('[name="cbContactEmail[]"]')).toHaveValue(contact.email);
    await expect(card.locator('[name="cbContactWebsite[]"]')).toHaveValue(contact.website);
  }
}
