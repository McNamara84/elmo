import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { XMLParser } from 'fast-xml-parser';
import { completeMinimalDatasetForm, expectNavbarVisible, navigateToHome } from '../utils';

const SAVE_ENDPOINT = '**/save/save_data.php';

const INPUT_AUTHORS = [
  {
    type: 'person',
    familyname: 'Payload',
    givenname: 'Jane',
    orcid: '0000-0002-1825-0097',
    isContact: true,
    email: 'jane@example.org',
    website: 'https://example.org/jane',
    affiliations: [
      { label: 'GFZ', rorId: '04z8jg394' },
      { label: 'University of Potsdam', rorId: '012m9bp23' },
    ],
  },
  {
    type: 'institution',
    institutionname: 'Payload Institute',
    affiliations: [{ label: 'Helmholtz', rorId: '03qjp1d79' }],
  },
  {
    type: 'person',
    familyname: 'Sukarno',
    givenname: '',
    orcid: '',
    isContact: false,
    email: '',
    website: '',
    affiliations: [],
  },
];

test.describe('XML Authors roundtrip', () => {
  test('preserves the complete mixed person/institution order after save and upload', async ({ page }) => {
    test.slow();

    await navigateToHome(page);
    await expectNavbarVisible(page);
    await completeMinimalDatasetForm(page);

    await page.evaluate((authors) => {
      (window as any).authorStack.setAuthors(authors);
    }, INPUT_AUTHORS);

    const expectedAuthors = await collectComparableAuthors(page);
    expect(expectedAuthors.map((author: any) => author.type)).toEqual([
      'person',
      'institution',
      'person',
    ]);

    const xml = await saveXml(page);
    expect(extractCreatorNames(xml)).toEqual([
      'Payload, Jane',
      'Payload Institute',
      'Sukarno',
    ]);

    const tempDir = join(tmpdir(), 'elmo-e2e');
    mkdirSync(tempDir, { recursive: true });
    const savedXmlPath = join(tempDir, 'e2e-xml-mixed-authors-roundtrip.xml');
    writeFileSync(savedXmlPath, xml, 'utf8');

    await closeNotificationModalIfPresent(page);
    await clearForm(page);
    await expect.poll(() => collectComparableAuthors(page)).toEqual([]);

    await page.locator('#button-form-load').click();
    const uploadModal = page.locator('#modal-uploadxml');
    await expect(uploadModal).toBeVisible({ timeout: 5000 });
    await page.locator('#input-uploadxml-file').setInputFiles(savedXmlPath);

    await expect.poll(
      () => collectComparableAuthors(page),
      { timeout: 20000 },
    ).toEqual(expectedAuthors);

    await expect.poll(() => page.locator(
      '[data-author-stack] > [data-author-entry-row]',
    ).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-author-entry-type')))).toEqual([
      'person',
      'institution',
      'person',
    ]);
  });
});

async function collectComparableAuthors(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() => (window as any).authorStack.collectPayload().map((author: any) => {
    const { entryKey: _entryKey, ...comparableAuthor } = author;
    return comparableAuthor;
  }));
}

async function saveXml(page: Page): Promise<string> {
  let capturedBody = '';
  let capturedStatus = 0;

  await page.route(SAVE_ENDPOINT, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const response = await route.fetch();
    capturedStatus = response.status();
    const body = await response.body();
    capturedBody = body.toString('utf8');
    await route.fulfill({ response, body });
  });

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/save/save_data.php')
      && response.request().method() === 'POST',
    { timeout: 30000 },
  );

  await page.waitForTimeout(2100);
  await page.locator('#button-form-save').click();
  const saveAsModal = page.locator('#modal-saveas');
  await expect(saveAsModal).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#saveas-extension')).toHaveText('.xml');
  await page.locator('#input-saveas-filename').fill('e2e-xml-mixed-authors-roundtrip');
  await page.waitForTimeout(2200);
  await page.locator('#button-saveas-save').click();
  await responsePromise;
  await page.unroute(SAVE_ENDPOINT);

  expect(capturedStatus).toBe(200);
  expect(capturedBody.trim()).not.toBe('');
  return capturedBody;
}

async function closeNotificationModalIfPresent(page: Page): Promise<void> {
  const notificationModal = page.locator('#modal-notification');

  await expect(notificationModal).toBeVisible({ timeout: 10000 }).catch(() => {});
  if (!(await notificationModal.isVisible().catch(() => false))) {
    return;
  }

  await expect(notificationModal.locator('.alert-danger')).toHaveCount(0);
  try {
    await expect(notificationModal).toBeHidden({ timeout: 6000 });
  } catch {
    await notificationModal.locator('.btn-close').first().click().catch(() => {});
    await notificationModal.locator('.btn-primary').first().click().catch(() => {});
    await expect(notificationModal).toBeHidden({ timeout: 3000 });
  }

  await page.waitForFunction(
    () => !document.querySelector('.modal-backdrop'),
    { timeout: 3000 },
  ).catch(() => {});
}

async function clearForm(page: Page): Promise<void> {
  await page.locator('#button-form-reset').click({ force: true });

  const confirmModal = page.locator('#modal-confirm');
  try {
    await expect(confirmModal).toBeVisible({ timeout: 3000 });
    await page.locator('#button-confirm-action').click();
    await expect(confirmModal).toBeHidden({ timeout: 5000 });
  } catch {
    // No confirmation modal appeared.
  }

  await expect(page.locator('input[name="title[]"]').first()).toHaveValue('', { timeout: 5000 });
}

function extractCreatorNames(xml: string): string[] {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  }).parse(xml);
  const resource = extractResourceNode(parsed);
  const creators = toArray(resource?.creators?.creator);

  return creators.map((creator) => extractText(creator.creatorName));
}

function extractResourceNode(parsedXml: any): any {
  if (parsedXml?.resource) {
    return parsedXml.resource;
  }
  if (parsedXml?.envelope?.resource) {
    return parsedXml.envelope.resource;
  }

  const envelopeKey = Object.keys(parsedXml ?? {}).find((key) => key.endsWith(':envelope'));
  const envelope = envelopeKey ? parsedXml[envelopeKey] : null;
  if (!envelope) {
    return null;
  }

  const resourceKey = Object.keys(envelope).find(
    (key) => key === 'resource' || key.endsWith(':resource'),
  );
  return resourceKey ? envelope[resourceKey] : null;
}

function toArray(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

function extractText(value: any): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return String(value?.['#text'] ?? '');
}
