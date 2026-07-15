import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { completeMinimalDatasetForm, navigateToHome } from '../utils';

const AWARD_URI = 'https://example.org/awards/issue-1147';

test.describe('Issue 1147 funding-reference draft save', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await completeMinimalDatasetForm(page);
  });

  test('Save & Download preserves an Award URI without funder or grant number', async ({ page }) => {
    const funder = page.locator('#input-funder').first();
    const grantNumber = page.locator('#input-grantnumber').first();
    const awardUri = page.locator('#input-awarduri').first();

    await awardUri.fill(AWARD_URI);
    await expect(funder).toHaveValue('');
    await expect(grantNumber).toHaveValue('');

    await page.locator('#button-form-save').click();
    const saveModal = page.locator('#modal-saveas');
    await expect(saveModal).toBeVisible({ timeout: 10_000 });
    await page.locator('#input-saveas-filename').fill('issue-1147-uri-only-award');

    await page.waitForTimeout(2200);
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('#button-saveas-save').click();
    const download = await downloadPromise;
    const downloadPath = await download.path();

    expect(downloadPath).not.toBeNull();
    const xml = readFileSync(downloadPath!, 'utf8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      trimValues: false,
    });
    const parsed = parser.parse(xml);
    const resource = parsed.envelope?.resource;
    const fundingReference = resource?.fundingReferences?.fundingReference;

    expect(fundingReference).toBeTruthy();
    expect(fundingReference.funderName ?? '').toBe('');
    expect(fundingReference.awardNumber?.awardURI).toBe(AWARD_URI);
    expect(fundingReference.awardNumber?.['#text'] ?? '').toBe('');
  });

  test('Submit still requires a funder for an URI-only award', async ({ page }) => {
    const funder = page.locator('#input-funder').first();
    await page.locator('#input-awarduri').first().fill(AWARD_URI);

    await page.locator('#button-form-submit').click();

    await expect(funder).toHaveAttribute('required', 'required');
    expect(await funder.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false);
  });
});
