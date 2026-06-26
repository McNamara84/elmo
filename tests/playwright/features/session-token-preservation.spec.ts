import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

test.describe('Session token preservation', () => {
  test('form CSRF token survives page reload and new tab in the same session', async ({ page, context }) => {
    await navigateToHome(page);

    const csrfField = page.locator('#input-form-csrf-token');
    await expect(csrfField).not.toHaveValue('');
    const sessionToken = await csrfField.inputValue();
    expect(sessionToken.length).toBeGreaterThanOrEqual(32);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(csrfField).toHaveValue(sessionToken);

    const secondTab = await context.newPage();
    try {
      await navigateToHome(secondTab);
      await expect(secondTab.locator('#input-form-csrf-token')).toHaveValue(sessionToken);
    } finally {
      await secondTab.close();
    }
  });
});
