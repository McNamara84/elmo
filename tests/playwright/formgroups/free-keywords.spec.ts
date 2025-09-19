import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { REPO_ROOT, SELECTORS } from '../utils';

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

    await page.addStyleTag({ path: path.join(REPO_ROOT, 'node_modules/@yaireo/tagify/dist/tagify.css') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/jquery/dist/jquery.min.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/@yaireo/tagify/dist/tagify.js') });
    await page.addScriptTag({
      content: `window.translations = ${JSON.stringify({
        keywords: { free: { placeholder: 'Please enter keywords and separate them by a comma.' } },
      })};`,
    });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'js/freekeywordTags.js') });
    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));

    await waitForFreeKeywordTagify(page);
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
});