import { expect, test, type Locator } from '@playwright/test';
import { navigateToHome, runAxeAudit, SELECTORS } from '../utils';

async function expectClassTokens(locator: Locator, expectedPresent: string[], expectedAbsent: string[] = []) {
  const classList = await locator.evaluate((element) =>
    element.className
      .split(/\s+/)
      .map((token: string) => token.trim())
      .filter(Boolean)
  );

  for (const className of expectedPresent) {
    expect(classList).toContain(className);
  }

  for (const className of expectedAbsent) {
    expect(classList).not.toContain(className);
  }
}

test.describe('Contextual help toggle', () => {
  test('displays contextual guidance, persists preferences, and keeps accessible styling', async ({
    page,
    browserName,
  }) => {
    await navigateToHome(page);

    const helpDropdownToggle = page.locator(SELECTORS.navigation.helpToggle);
    await expect(helpDropdownToggle).toBeVisible();

    const sampleInput = page.locator('#input-resourceinformation-publicationyear');
    await expect(sampleInput).toBeVisible();

    await helpDropdownToggle.click();

    const helpOnButton = page.locator(SELECTORS.navigation.helpOnButton);
    const helpOffButton = page.locator(SELECTORS.navigation.helpOffButton);

    await expect(helpOnButton).toBeVisible();
    await expect(helpOffButton).toBeVisible();

    if (browserName === 'chromium') {
      await test.step('Validate accessibility of the help controls', async () => {
        await runAxeAudit(page);
      });
    }

    await test.step('Enable contextual help and load documentation', async () => {
      await helpOnButton.click();

      await expectClassTokens(helpOnButton, ['active']);
      await expectClassTokens(helpOffButton, [], ['active']);

      await expectClassTokens(sampleInput, ['input-right-no-round-corners'], ['input-right-with-round-corners']);

      const helpStatus = await page.evaluate(() => window.localStorage.getItem('helpStatus'));
      expect(helpStatus).toBe('help-on');

      const helpEntry = page.locator('[data-help-section-id="help-resourceinformation-fg"]').first();
      await expect(helpEntry).toBeVisible();
      await helpEntry.scrollIntoViewIfNeeded();

      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('doc/help.php')
      );

      await helpEntry.click();

      const response = await responsePromise;
      expect(response.ok()).toBeTruthy();

      const helpModal = page.locator(SELECTORS.modals.help);
      await expect(helpModal).toBeVisible();
      await expect(helpModal).toHaveAttribute('aria-labelledby', 'helpModalLabel');

      const helpModalBody = helpModal.locator('.modal-body');
      await expect(helpModalBody).toContainText('Resource Information');
      await expect(helpModalBody).toContainText('Please specify general metadata for the data set here.');

      await helpModal.locator('button[aria-label="Close"]').click();
      await expect(helpModal).toBeHidden();
    });

    await test.step('Disable contextual help and verify persistence after reload', async () => {
      await helpDropdownToggle.click();
      await expect(helpOffButton).toBeVisible();
      await helpOffButton.click();

      await expectClassTokens(helpOffButton, ['active']);
      await expectClassTokens(helpOnButton, [], ['active']);

      await expectClassTokens(sampleInput, ['input-right-with-round-corners'], ['input-right-no-round-corners']);

      const helpStatus = await page.evaluate(() => window.localStorage.getItem('helpStatus'));
      expect(helpStatus).toBe('help-off');

      await page.reload();

      await expectClassTokens(sampleInput, ['input-right-with-round-corners'], ['input-right-no-round-corners']);

      const persistedStatus = await page.evaluate(() => window.localStorage.getItem('helpStatus'));
      expect(persistedStatus).toBe('help-off');

      await helpDropdownToggle.click();
      await expect(helpOffButton).toBeVisible();
      await expectClassTokens(helpOffButton, ['active']);
      await expectClassTokens(helpOnButton, [], ['active']);
    });
  });
});