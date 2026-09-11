import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { completeMinimalDatasetForm, navigateToHome } from '../utils';

type ExpectedTitle = {
  text: string;
  /** DataCite titleType attribute; null means the attribute is omitted (Main Title). */
  titleType: string | null;
  /** Visible option label in the form dropdown. */
  formLabel: string;
};

/**
 * Two titles per case: main title (no titleType attribute) + one non-main type.
 */
const TITLE_CASES: Array<{ name: string; titles: [ExpectedTitle, ExpectedTitle] }> = [
  {
    name: 'Main Title + Other',
    titles: [
      { text: 'main-title-text', titleType: null, formLabel: 'Main Title' },
      { text: 'other-title-text', titleType: 'Other', formLabel: 'Other' },
    ],
  },
  {
    name: 'Main Title + Subtitle',
    titles: [
      { text: 'main-title-text', titleType: null, formLabel: 'Main Title' },
      { text: 'subtitle-text', titleType: 'Subtitle', formLabel: 'Subtitle' },
    ],
  },
];

async function waitForTitleTypesReady(page: Page) {
  await page.waitForFunction(() => {
    const select = document.querySelector('#input-resourceinformation-titletype');
    if (!(select instanceof HTMLSelectElement)) return false;
    return Array.from(select.options).some((opt) => opt.textContent?.trim() === 'Other')
      && Array.from(select.options).some((opt) => opt.textContent?.trim() === 'Subtitle');
  }, { timeout: 30_000 });
}

async function fillTwoTitles(page: Page, titles: [ExpectedTitle, ExpectedTitle]) {
  const titleInputs = page.locator('input[name="title[]"]');
  const titleTypeSelects = page.locator('select[name="titleType[]"]');

  await titleInputs.first().fill(titles[0].text);

  // First title type is hidden for Main Title; set it if the option exists.
  const firstTypeVisible = await titleTypeSelects.first().isVisible().catch(() => false);
  if (firstTypeVisible) {
    await titleTypeSelects.first().selectOption({ label: titles[0].formLabel });
  }

  await page.locator('#button-resourceinformation-addtitle').click();
  await expect(titleInputs).toHaveCount(2);

  await titleInputs.nth(1).fill(titles[1].text);
  await expect(titleTypeSelects.nth(1)).toBeVisible();
  await titleTypeSelects.nth(1).selectOption({ label: titles[1].formLabel });

  const selectedLabel = await titleTypeSelects.nth(1).locator('option:checked').textContent();
  expect(selectedLabel?.trim()).toBe(titles[1].formLabel);
}

async function downloadSavedXml(page: Page, filename: string): Promise<string> {
  await page.locator('#button-form-save').click();
  const saveModal = page.locator('#modal-saveas');
  await expect(saveModal).toBeVisible({ timeout: 5_000 });

  await page.locator('#input-saveas-filename').fill(filename);
  // Satisfy server-side minimum interaction time for save.
  await page.waitForTimeout(2200);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.locator('#button-saveas-save').click(),
  ]);

  const downloadPath = await download.path();
  expect(downloadPath, 'Save should produce a downloadable XML file').toBeTruthy();
  return fs.readFileSync(downloadPath!, 'utf-8');
}

function extractDataciteTitles(xmlContent: string): Array<{ text: string; titleType: string | null }> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const parsed = parser.parse(xmlContent);

  const resource =
    parsed?.resource
    ?? parsed?.envelope?.resource
    ?? null;
  expect(resource, 'Downloaded XML should contain a DataCite resource').toBeTruthy();

  const rawTitles = resource.titles?.title;
  expect(rawTitles, 'Downloaded XML should contain titles').toBeTruthy();

  const titleNodes = Array.isArray(rawTitles) ? rawTitles : [rawTitles];
  return titleNodes.map((node: any) => {
    if (typeof node === 'string') {
      return { text: node, titleType: null };
    }
    const text = typeof node['#text'] === 'string' ? node['#text'] : String(node['#text'] ?? '');
    const titleType = Object.prototype.hasOwnProperty.call(node, '@_titleType')
      ? String(node['@_titleType'])
      : null;
    return { text, titleType };
  });
}

test.describe('Title types download XML', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await expect(page.locator('#input-resourceinformation-doi')).toBeVisible({ timeout: 15_000 });
    await waitForTitleTypesReady(page);
  });

  for (const testCase of TITLE_CASES) {
    test(`save/download keeps title text and titleType for ${testCase.name}`, async ({ page }) => {
      await completeMinimalDatasetForm(page);
      await fillTwoTitles(page, testCase.titles);

      const xmlContent = await downloadSavedXml(
        page,
        `title-types-${testCase.titles[1].titleType?.toLowerCase() ?? 'main'}`,
      );

      const actualTitles = extractDataciteTitles(xmlContent);
      expect(actualTitles).toHaveLength(2);

      for (let i = 0; i < 2; i++) {
        expect(actualTitles[i].text).toBe(testCase.titles[i].text);
        expect(actualTitles[i].titleType).toBe(testCase.titles[i].titleType);
      }
    });
  }
});
