import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

test.describe('ORCID Checksum Validation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test('shows invalid feedback for ORCID with bad checksum on blur', async ({ page }) => {
    const orcidInput = page.locator('#input-author-orcid');
    // 0000-0002-1825-0098 has wrong check digit (valid would be 0097)
    await orcidInput.fill('0000-0002-1825-0098');
    // Trigger blur by clicking another field
    await page.locator('#input-author-lastname').click();

    await expect(orcidInput).toHaveClass(/is-invalid/);
    const feedback = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row] .invalid-feedback`).first();
    await expect(feedback).toBeVisible();
  });

  test('shows valid feedback for ORCID with correct checksum on blur', async ({ page }) => {
    const orcidInput = page.locator('#input-author-orcid');
    await orcidInput.fill('0000-0002-1825-0097');
    await page.locator('#input-author-lastname').click();

    await expect(orcidInput).toHaveClass(/is-valid/);
    await expect(orcidInput).not.toHaveClass(/is-invalid/);
  });

  test('resets validation state when ORCID field is cleared', async ({ page }) => {
    const orcidInput = page.locator('#input-author-orcid');
    // First make it invalid
    await orcidInput.fill('0000-0002-1825-0098');
    await page.locator('#input-author-lastname').click();
    await expect(orcidInput).toHaveClass(/is-invalid/);

    // Clear the field
    await orcidInput.fill('');
    await page.locator('#input-author-lastname').click();

    await expect(orcidInput).not.toHaveClass(/is-invalid/);
    await expect(orcidInput).not.toHaveClass(/is-valid/);
  });

  test('auto-formats pasted ORCID URL and validates checksum', async ({ page }) => {
    const orcidInput = page.locator('#input-author-orcid');
    await orcidInput.focus();

    // Simulate paste of a full ORCID URL via fill + dispatch
    await page.evaluate(() => {
      const input = document.querySelector('#input-author-orcid') as HTMLInputElement;
      input.value = '';
      input.focus();
      const pasteData = new DataTransfer();
      pasteData.setData('text/plain', 'https://orcid.org/0000-0002-1825-0097');
      const pasteEvent = new ClipboardEvent('paste', { clipboardData: pasteData, bubbles: true });
      input.dispatchEvent(pasteEvent);
      input.value = 'https://orcid.org/0000-0002-1825-0097';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Wait briefly for the paste handler
    await page.waitForTimeout(100);
    // Trigger blur to run validation
    await page.locator('#input-author-lastname').click();

    await expect(orcidInput).toHaveValue('0000-0002-1825-0097');
    await expect(orcidInput).toHaveClass(/is-valid/);
  });

  test('auto-inserts hyphens while typing', async ({ page }) => {
    const orcidInput = page.locator('#input-author-orcid');
    await orcidInput.click();
    // Type digits one by one — the input handler should insert hyphens
    await orcidInput.pressSequentially('0000000218250097', { delay: 30 });

    await expect(orcidInput).toHaveValue('0000-0002-1825-0097');
  });

  test('does not trigger ORCID API lookup for invalid checksum', async ({ page }) => {
    let apiCalled = false;
    await page.route('**/pub.orcid.org/v3.0/**', async route => {
      apiCalled = true;
      await route.fulfill({ status: 200, body: '{}' });
    });

    const orcidInput = page.locator('#input-author-orcid');
    // Enter ORCID with invalid checksum
    await orcidInput.fill('0000-0002-1825-0098');
    // Trigger blur
    await page.locator('#input-author-lastname').click();

    // Wait a bit to ensure no API call happens
    await page.waitForTimeout(500);
    expect(apiCalled).toBe(false);
  });

  test('triggers ORCID API lookup for valid checksum', async ({ page }) => {
    let apiCalled = false;
    await page.route('**/pub.orcid.org/v3.0/**', async route => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          person: { name: { 'family-name': { value: 'Test' }, 'given-names': { value: 'User' } } },
          'activities-summary': { employments: { 'affiliation-group': [] }, educations: { 'affiliation-group': [] } }
        })
      });
    });

    const orcidInput = page.locator('#input-author-orcid');
    await orcidInput.fill('0000-0002-1825-0097');
    await page.locator('#input-author-lastname').click();

    await page.waitForTimeout(500);
    expect(apiCalled).toBe(true);
  });

  test('validates ORCID ending with X', async ({ page }) => {
    const orcidInput = page.locator('#input-author-orcid');
    // 0000-0001-6772-672X is a real ORCID with X check digit
    await orcidInput.fill('0000-0001-6772-672X');
    await page.locator('#input-author-lastname').click();

    await expect(orcidInput).toHaveClass(/is-valid/);
  });

  test('contributor person ORCID field also validates checksum', async ({ page }) => {
    // Ensure the contributor persons form group is visible
    const contributorGroup = page.locator(SELECTORS.formGroups.contributorPersons);

    const orcidInput = contributorGroup.locator('input[name="cbORCID[]"]').first();
    await orcidInput.fill('0000-0002-1825-0098');
    await contributorGroup.locator('input[name="cbPersonLastName[]"]').first().click();

    await expect(orcidInput).toHaveClass(/is-invalid/);
  });
});
