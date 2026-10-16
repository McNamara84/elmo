import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import { navigateToHome, registerGoogleMapsNoopRoute, waitForFormInteractionReady, waitForHomepageReady } from '../../utils';

const FIXTURE = path.join(__dirname, 'testDataIcgemContactRoundtrip/elmogem_contact_info_roundtrip.xml');

/** Saved grav:contact pairs for the fixture, in author order then contributor order. */
const EXPECTED_CONTACTS = [
  { email: 'cont_pers_author_1@mail.com', website: 'cont_pers_author_1.com' },
  { email: 'cont_pers_author_2@mail.com', website: 'cont_pers_author_2.com' },
  { email: 'cont_pers_1@mail.com', website: 'cont_pers_1.com' },
  { email: 'cont_inst_1@mail.com', website: 'cont_inst_1.com' },
  { email: 'cont_inst_2@mail.com', website: 'cont_inst_2.com' },
  { email: 'cont_pers_2@mail.com', website: 'cont_pers_2.com' },
  { email: 'cont_pers_author_2@mail.com', website: '' },
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
 * Reads a grav:contact list into address and website pairs.
 * A new child element stays ignored until this reader and the upload parser both accept it.
 */
function gravContactPairs(xml: string): Array<{ email: string; website: string }> {
  const block = xml.match(/<(?:[\w.-]+:)?contact\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?contact>/);
  if (!block) return [];

  const pairs: Array<{ email: string; website: string }> = [];
  let current: { email: string; website: string } | null = null;
  const token = /<(?:[\w.-]+:)?(address|onlineResource)\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?\1>/g;
  let found: RegExpExecArray | null;
  while ((found = token.exec(block[1])) !== null) {
    const value = decodeXml(found[2]);
    if (!value) continue;
    if (found[1] === 'address') {
      current = { email: value, website: '' };
      pairs.push(current);
      continue;
    }
    if (!current || current.website) {
      current = { email: '', website: value };
      pairs.push(current);
      continue;
    }
    current.website = value;
  }
  return pairs;
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
  return capturedBody;
}

test('uploads the contact round-trip file and keeps every email and website in the ICGEM download', async ({ page }) => {
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

  const authors = page.locator('[data-author-card]');
  await expect(authors).toHaveCount(2);
  await expect(authors.nth(0).locator('[name="familynames[]"]')).toHaveValue('cont_pers_author_1');
  await expect(authors.nth(0).locator('[name="contacts[]"]')).toBeChecked();
  await expect(authors.nth(0).locator('[name="cpEmail[]"]')).toHaveValue('cont_pers_author_1@mail.com');
  await expect(authors.nth(0).locator('[name="cpOnlineResource[]"]')).toHaveValue('cont_pers_author_1.com');
  await expect(authors.nth(1).locator('[name="familynames[]"]')).toHaveValue('cont_pers_author_2');
  await expect(authors.nth(1).locator('[name="contacts[]"]')).toBeChecked();
  await expect(authors.nth(1).locator('[name="cpEmail[]"]')).toHaveValue('cont_pers_author_2@mail.com');
  await expect(authors.nth(1).locator('[name="cpOnlineResource[]"]')).toHaveValue('cont_pers_author_2.com');

  const downloaded = await downloadIcgemXml(page);
  expect(gravContactPairs(downloaded)).toEqual(EXPECTED_CONTACTS);
  for (const contact of EXPECTED_CONTACTS) {
    expect(downloaded).toContain(contact.email);
    if (contact.website) expect(downloaded).toContain(contact.website);
  }
  expect(pageErrors).toEqual([]);
});
