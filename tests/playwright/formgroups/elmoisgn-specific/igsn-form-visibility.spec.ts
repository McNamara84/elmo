import { test, expect } from '@playwright/test';
import { navigateToHome } from '../../utils';

test.describe('IGSN Edition – Form Group Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('shows used instruments form group', async ({ page }) => {
    await expect(page.locator('#group-usedinstruments')).toBeVisible();
  });

  test('shows authors form group', async ({ page }) => {
    await expect(page.locator('#group-author')).toBeVisible();
  });

  test('shows resource information form group', async ({ page }) => {
    await expect(page.locator('#input-resourceinformation-doi')).toBeVisible();
  });

  test('hides GCMD thesauri keywords', async ({ page }) => {
    await expect(page.locator('#group-thesauruskeyword')).toHaveCount(0);
  });

  test('hides free keywords form group', async ({ page }) => {
    await expect(page.locator('#group-freekeyword')).toHaveCount(0);
  });

  test('hides spatial-temporal coverage form group', async ({ page }) => {
    await expect(page.locator('#group-stc')).toHaveCount(0);
  });

  test('hides related work form group', async ({ page }) => {
    await expect(page.locator('#group-relatedwork')).toHaveCount(0);
  });

  test('hides MSL keywords', async ({ page }) => {
    await expect(page.locator('#input-mslkeyword')).toHaveCount(0);
  });

  test('hides originating laboratory', async ({ page }) => {
    await expect(page.locator('#group-originatinglaboratory')).toHaveCount(0);
  });

  test('hides GGM properties', async ({ page }) => {
    await expect(page.locator('#group-ggmspropertiesessential')).toHaveCount(0);
  });
});
