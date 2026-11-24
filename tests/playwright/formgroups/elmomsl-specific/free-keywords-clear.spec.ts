import { expect, test, type Page } from '@playwright/test';
import { expectNavbarVisible, navigateToHome } from '../../utils';

const MSL_DEFAULT_FREE_KEYWORDS = ['EPOS', 'multi-scale laboratories'];
const CUSTOM_KEYWORD = 'Issue 1148 custom keyword';

async function getFreeKeywordValues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const input = document.querySelector('#input-freekeyword') as any;
    return (input?._tagify?.value || []).map((tag: { value: string }) => tag.value);
  });
}

test.describe('ELMO-MSL default free keywords', () => {
  test('restores the defaults and removes custom keywords after a confirmed clear', async ({ page }) => {
    await navigateToHome(page);
    await expectNavbarVisible(page);
    await page.waitForFunction(() => {
      const input = document.querySelector('#input-freekeyword') as any;
      return Boolean(input?._tagify);
    });

    await expect.poll(() => getFreeKeywordValues(page)).toEqual(MSL_DEFAULT_FREE_KEYWORDS);

    await page.locator('#input-resourceinformation-publicationyear').fill('2026');
    await page.evaluate((customKeyword) => {
      const input = document.querySelector('#input-freekeyword') as any;
      input._tagify.removeTags('EPOS');
      input._tagify.addTags([{ value: customKeyword }]);
    }, CUSTOM_KEYWORD);

    await expect.poll(() => getFreeKeywordValues(page)).toEqual([
      'multi-scale laboratories',
      CUSTOM_KEYWORD,
    ]);

    await page.locator('#button-form-reset').click();
    await expect(page.locator('#modal-confirm')).toBeVisible();
    await page.locator('#button-confirm-action').click();
    await expect(page.locator('#modal-confirm')).toBeHidden();

    await expect.poll(() => getFreeKeywordValues(page)).toEqual(MSL_DEFAULT_FREE_KEYWORDS);
    await expect(page.locator('#input-resourceinformation-publicationyear')).toHaveValue('');
  });
});
