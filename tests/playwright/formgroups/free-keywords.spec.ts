import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, SELECTORS } from '../utils';
import { injectScript, injectStylesheet } from '../utils/assets';

const CURATED_KEYWORDS = [
  { free_keyword: 'Arctic Ocean Circulation' },
  { free_keyword: 'Baltic Sea Monitoring' },
  { free_keyword: 'Crustal Deformation Analysis' },
];

const FREE_KEYWORDS_TEMPLATE = readFileSync(path.join(REPO_ROOT, 'formgroups/freeKeywords.html'), 'utf8');
const TEST_ROUTE_PATH = '/free-keywords-test';
const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Free Keywords Playground</title>
  </head>
  <body>
    <main class="container p-3">
      ${FREE_KEYWORDS_TEMPLATE}
      <div id="help-freeKeywords" role="note">Help placeholder</div>
    </main>
  </body>
</html>`;

async function waitForFreeKeywordTagify(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => Boolean((document.querySelector('#input-freekeyword') as any)?._tagify));
}

test.describe('Free Keywords Form Group', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**${TEST_ROUTE_PATH}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: TEST_PAGE_HTML,
      });
    });

    await page.route('**/api/v2/vocabs/freekeywords/curated', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CURATED_KEYWORDS),
      });
    });

    await page.goto(TEST_ROUTE_PATH);

    await injectStylesheet(page, 'node_modules/@yaireo/tagify/dist/tagify.css');
    await injectScript(page, 'node_modules/jquery/dist/jquery.min.js');
    await injectScript(page, 'node_modules/@yaireo/tagify/dist/tagify.js');
    await page.addScriptTag({
      content: `window.translations = ${JSON.stringify({
        keywords: { free: { placeholder: 'Please enter keywords and separate them by a comma.' } },
      })};`,
    });
    await injectScript(page, 'js/freekeywordTags.js');
    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));

    await waitForFreeKeywordTagify(page);

    // Wait for any async initialization (e.g., AJAX whitelist loading) to settle,
    // then ensure a clean tag state. In some CI environments, tags may be
    // unexpectedly pre-populated during initialization.
    await page.waitForFunction(() => {
      const el = document.querySelector('#input-freekeyword') as any;
      return el?._tagify?.settings?.whitelist?.length > 0;
    }, { timeout: 5000 }).catch(() => { /* whitelist may remain empty if mock responds with [] */ });
    await page.evaluate(() => {
      const el = document.querySelector('#input-freekeyword') as any;
      if (el?._tagify) {
        el._tagify.removeAllTags();
      }
    });
  });

  test('renders accessible field, help affordances, and Tagify configuration', async ({ page }) => {
    const header = page.locator('b[data-translate="keywords.free.title"]');
    await expect(header).toBeVisible();
    await expect(header).toHaveText('Free Keywords');

    const label = page.locator('label[for="input-freekeyword"]');
    await expect(label).toHaveClass(/visually-hidden/);
    await expect(label).toHaveText('Free Keyword');

    const input = page.locator('#input-freekeyword');
    await expect(input).toHaveAttribute('name', 'freekeywords[]');
    await expect(input).toHaveClass(/form-control/);

    const tagifySettings = await page.evaluate(() => {
      const tagify = (document.querySelector('#input-freekeyword') as any)._tagify;
      return {
        placeholder: tagify.settings.placeholder,
        dropdown: tagify.settings.dropdown,
        whitelist: tagify.settings.whitelist,
      };
    });

    expect(tagifySettings.placeholder).toContain('Please enter keywords');
    expect(tagifySettings.dropdown).toMatchObject({
      maxItems: 50,
      closeOnSelect: true,
      highlightFirst: false,
      hideOnEmpty: true,
      enabled: 3,
    });
    expect(tagifySettings.whitelist).toEqual(CURATED_KEYWORDS.map(item => item.free_keyword));

    const helpIcon = page.locator(`${SELECTORS.formGroups.freeKeywords} i.bi-question-circle-fill`);
    await expect(helpIcon).toHaveAttribute('data-help-section-id', 'help-freeKeywords');
    const helpStyles = await helpIcon.evaluate(element => {
      const styles = window.getComputedStyle(element as HTMLElement);
      return { display: styles.display, visibility: styles.visibility };
    });
    expect(helpStyles.display).not.toBe('none');
    expect(helpStyles.visibility).toBe('visible');

    const tagInput = page.locator(`${SELECTORS.formGroups.freeKeywords} .tagify__input`);
    await expect(tagInput).toBeVisible();
    const isEditable = await tagInput.evaluate(element => (element as HTMLElement).isContentEditable);
    expect(isEditable).toBe(true);
  });

  test('supports curated suggestions, manual keywords, keyboard interactions, and removal', async ({ page }) => {
    const tagInput = page.locator(`${SELECTORS.formGroups.freeKeywords} .tagify__input`);
    await tagInput.click();
    await tagInput.type('Arc');

    const dropdown = page.locator('.tagify__dropdown');
    await expect(dropdown).toBeVisible();

    const dropdownItems = dropdown.locator('.tagify__dropdown__item');
    await expect(dropdownItems.first()).toContainText('Arctic Ocean Circulation');

    await dropdownItems
      .filter({ hasText: 'Arctic Ocean Circulation' })
      .first()
      .click();

    const tags = page.locator(`${SELECTORS.formGroups.freeKeywords} .tagify__tag`);
    await expect(tags).toHaveCount(1);
    await expect(tags.first()).toContainText('Arctic Ocean Circulation');

    let tagValues = await page.evaluate(() => {
      const tagify = (document.querySelector('#input-freekeyword') as any)._tagify;
      return tagify.value.map((tag: any) => tag.value);
    });
    expect(tagValues).toEqual(['Arctic Ocean Circulation']);

    await tagInput.type('Custom keyword');
    await tagInput.press('Enter');

    await expect(tags).toHaveCount(2);
    tagValues = await page.evaluate(() => {
      const tagify = (document.querySelector('#input-freekeyword') as any)._tagify;
      return tagify.value.map((tag: any) => tag.value);
    });
    expect(tagValues).toEqual(['Arctic Ocean Circulation', 'Custom keyword']);

    await page.evaluate(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      input._tagify.removeTags(input._tagify.value[0].value);
    });
    await expect(tags).toHaveCount(1);

    tagValues = await page.evaluate(() => {
      const tagify = (document.querySelector('#input-freekeyword') as any)._tagify;
      return tagify.value.map((tag: any) => tag.value);
    });
    expect(tagValues).toEqual(['Custom keyword']);
  });

  test('updates placeholder on translation changes while preserving existing tags', async ({ page }) => {
    const tagInput = page.locator(`${SELECTORS.formGroups.freeKeywords} .tagify__input`);
    await tagInput.click();
    await tagInput.type('Persistent Tag');
    await tagInput.press('Enter');

    const beforePlaceholder = await page.evaluate(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      return input._tagify.settings.placeholder;
    });

    await page.evaluate(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      const translations = (window as any).translations || ((window as any).translations = {});
      translations.keywords = translations.keywords || {};
      translations.keywords.free = translations.keywords.free || {};
      translations.keywords.free.placeholder = 'Geben Sie freie Schlagwörter ein.';

      document.dispatchEvent(new Event('translationsLoaded'));
    });

    await page.waitForFunction(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      return input?._tagify?.settings?.placeholder === 'Geben Sie freie Schlagwörter ein.';
    });

    await page.waitForFunction(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      return Array.isArray(input?._tagify?.value) &&
        input._tagify.value.some((tag: any) => tag.value === 'Persistent Tag');
    });

    const result = await page.evaluate(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      return {
        afterPlaceholder: input._tagify.settings.placeholder,
        values: input._tagify.value.map((tag: any) => tag.value),
        display: window.getComputedStyle(input).display,
        whitelist: input._tagify.settings.whitelist,
      };
    });

    expect(beforePlaceholder).toContain('Please enter keywords');
    expect(result.afterPlaceholder).toBe('Geben Sie freie Schlagwörter ein.');
    expect(result.values).toEqual(['Persistent Tag']);
    expect(result.display).toBe('block');
    expect(result.whitelist).toEqual(CURATED_KEYWORDS.map(item => item.free_keyword));
  });

  test('renders CSV upload modal with disabled confirm button initially', async ({ page }) => {
    const modal = page.locator('#freeKeywordsCsvModal');
    const fileInput = page.locator('#input-freekeywords-csv');
    const confirmButton = page.locator('#button-confirm-csv-upload');
    const dropzone = page.locator('#freekeywords-csv-dropzone');

    await expect(modal).toBeAttached();
    await expect(fileInput).toBeAttached();
    await expect(dropzone).toBeVisible();
    await expect(confirmButton).toBeDisabled();
  });

  test('accepts a valid CSV file and enables confirm button', async ({ page }) => {
    const fileInput = page.locator('#input-freekeywords-csv');
    const fileName = page.locator('#freekeywords-csv-filename');
    const feedback = page.locator('#freekeywords-csv-feedback');
    const confirmButton = page.locator('#button-confirm-csv-upload');

    await fileInput.setInputFiles({
      name: 'geoscience-keywords.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('rock mechanics, seismology\nInSAR; rock mechanics'),
    });

    await expect(fileName).toHaveText('geoscience-keywords.csv');
    await expect(feedback).toContainText('keywords ready to import.');
    await expect(confirmButton).toBeEnabled();
  });

  test('accepts a CSV file smaller than 1 MB', async ({ page }) => {
    const fileInput = page.locator('#input-freekeywords-csv');
    const fileName = page.locator('#freekeywords-csv-filename');
    const feedback = page.locator('#freekeywords-csv-feedback');
    const confirmButton = page.locator('#button-confirm-csv-upload');

    const line = 'keyword_for_upload_test\n';
    let content = '';

    for (let i = 0; i < 5000; i++) {
      content += line;
    }

    await fileInput.setInputFiles({
      name: 'free-keywords-under-limit.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(content, 'utf8'),
    });

    await expect(fileName).toHaveText('free-keywords-under-limit.csv');
    await expect(feedback).toContainText('keywords ready to import.');
    await expect(confirmButton).toBeEnabled();
  });

  test('rejects a CSV file larger than 1 MB', async ({ page }) => {
    const fileInput = page.locator('#input-freekeywords-csv');
    const fileName = page.locator('#freekeywords-csv-filename');
    const feedback = page.locator('#freekeywords-csv-feedback');
    const confirmButton = page.locator('#button-confirm-csv-upload');

    const line = 'very_long_free_keyword_for_geoscience_metadata_upload_limit_validation_test_case\n';
    let content = '';

    for (let i = 0; i < 25000; i++) {
      content += line;
    }

    await fileInput.setInputFiles({
      name: 'free-keywords-over-limit.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(content, 'utf8'),
    });

    await expect(fileName).toHaveText('free-keywords-over-limit.csv');
    await expect(feedback).toHaveText(
      'The selected CSV file is too large. Please upload a file smaller than 1 MB.'
    );
    await expect(confirmButton).toBeDisabled();
  });

  test('rejects a non-csv file upload', async ({ page }) => {
    const fileInput = page.locator('#input-freekeywords-csv');
    const feedback = page.locator('#freekeywords-csv-feedback');
    const confirmButton = page.locator('#button-confirm-csv-upload');

    await fileInput.setInputFiles({
      name: 'geoscience-keywords.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('seismology'),
    });

    await expect(feedback).toHaveText('Please select a valid CSV file.');
    await expect(confirmButton).toBeDisabled();
  });

  test('imports CSV keywords into Tagify after confirm', async ({ page }) => {
    const fileInput = page.locator('#input-freekeywords-csv');
    const confirmButton = page.locator('#button-confirm-csv-upload');

    await fileInput.setInputFiles({
      name: 'tectonics-keywords.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('fault creep, induced seismicity'),
    });

    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await page.waitForFunction(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      return Array.isArray(input?._tagify?.value) &&
        input._tagify.value.some((tag: any) => tag.value === 'fault creep') &&
        input._tagify.value.some((tag: any) => tag.value === 'induced seismicity');
    });

    const tagValues = await page.evaluate(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      return input._tagify.value.map((tag: any) => tag.value);
    });

    expect(tagValues).toEqual(['fault creep', 'induced seismicity']);
  });
});