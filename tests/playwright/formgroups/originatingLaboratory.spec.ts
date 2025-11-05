import { test, expect } from '@playwright/test';
import { enableHelp, expectNavbarVisible, navigateToHome, SELECTORS } from '../utils';

test.describe('Originating Laboratory', () => {
    test.beforeEach(async ({ page }) => {
        await navigateToHome(page);
        await expectNavbarVisible(page);
        await expect(page.locator(SELECTORS.formGroups.originatingLaboratory)).toBeVisible();
    });

    test('Laboratory select loads options from JSON', async ({ page }) => {
        // Warte hier auf das Laden der Optionen
        await page.waitForFunction(() =>
            document.querySelectorAll('#input-originatinglaboratory-name option').length > 1
        );

        const select = page.locator('#input-originatinglaboratory-name');
        const options = select.locator('option');
        const count = await options.count();
        expect(count).toBeGreaterThan(1);

        const optionTexts = await options.allTextContents();
        expect(optionTexts.join(' ')).toContain('');
    });

});