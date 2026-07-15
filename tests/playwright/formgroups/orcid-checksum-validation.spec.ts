import { test, expect } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

test.describe('ORCID Checksum Validation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
    await page.locator('#button-author-add').click();
  });

  function firstAuthor(page) {
    return page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`).first();
  }

  test('shows invalid feedback for ORCID with bad checksum on blur', async ({ page }) => {
    const authorRow = firstAuthor(page);
    const orcidInput = authorRow.locator('input[name="orcids[]"]');
    // 0000-0002-1825-0098 has wrong check digit (valid would be 0097)
    await orcidInput.fill('0000-0002-1825-0098');
    // Trigger blur by clicking another field
    await authorRow.locator('input[name="familynames[]"]').click();

    await expect(orcidInput).toHaveClass(/is-invalid/);
    const feedback = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row] .invalid-feedback`).first();
    await expect(feedback).toBeVisible();
  });

  test('shows valid feedback for ORCID with correct checksum on blur', async ({ page }) => {
    const authorRow = firstAuthor(page);
    const orcidInput = authorRow.locator('input[name="orcids[]"]');
    await orcidInput.fill('0000-0002-1825-0097');
    await authorRow.locator('input[name="familynames[]"]').click();

    await expect(orcidInput).toHaveClass(/is-valid/);
    await expect(orcidInput).not.toHaveClass(/is-invalid/);
  });

  test('resets validation state when ORCID field is cleared', async ({ page }) => {
    const authorRow = firstAuthor(page);
    const orcidInput = authorRow.locator('input[name="orcids[]"]');
    // First make it invalid
    await orcidInput.fill('0000-0002-1825-0098');
    await authorRow.locator('input[name="familynames[]"]').click();
    await expect(orcidInput).toHaveClass(/is-invalid/);

    // Clear the field
    await orcidInput.fill('');
    await authorRow.locator('input[name="familynames[]"]').click();

    await expect(orcidInput).not.toHaveClass(/is-invalid/);
    await expect(orcidInput).not.toHaveClass(/is-valid/);
  });

  test('auto-formats pasted ORCID URL and validates checksum', async ({ page }) => {
    const authorRow = firstAuthor(page);
    const orcidInput = authorRow.locator('input[name="orcids[]"]');
    await orcidInput.focus();

    // Simulate paste of a full ORCID URL via fill + dispatch
    await page.evaluate(() => {
      const input = document.querySelector('#group-author [data-creator-row] input[name="orcids[]"]') as HTMLInputElement;
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
    await authorRow.locator('input[name="familynames[]"]').click();

    await expect(orcidInput).toHaveValue('0000-0002-1825-0097');
    await expect(orcidInput).toHaveClass(/is-valid/);
  });

  test('auto-inserts hyphens while typing', async ({ page }) => {
    const orcidInput = firstAuthor(page).locator('input[name="orcids[]"]');
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

    const authorRow = firstAuthor(page);
    const orcidInput = authorRow.locator('input[name="orcids[]"]');
    // Enter ORCID with invalid checksum
    await orcidInput.fill('0000-0002-1825-0098');
    // Trigger blur
    await authorRow.locator('input[name="familynames[]"]').click();

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

    const authorRow = firstAuthor(page);
    const orcidInput = authorRow.locator('input[name="orcids[]"]');
    await orcidInput.fill('0000-0002-1825-0097');
    await authorRow.locator('input[name="familynames[]"]').click();

    await page.waitForTimeout(500);
    expect(apiCalled).toBe(true);
  });

  test('validates ORCID ending with X', async ({ page }) => {
    const authorRow = firstAuthor(page);
    const orcidInput = authorRow.locator('input[name="orcids[]"]');
    // 0000-0001-2345-672X has a valid X check digit (ISO 7064 Mod 11-2)
    await orcidInput.fill('0000-0001-2345-672X');
    await authorRow.locator('input[name="familynames[]"]').click();

    await expect(orcidInput).toHaveClass(/is-valid/);
  });

  test('contributor person ORCID field also validates checksum', async ({ page }) => {
    const orcidInput = page.locator('#input-contributor-orcid');
    await orcidInput.fill('0000-0002-1825-0098');
    await page.locator('#input-contributor-lastname').click();

    await expect(orcidInput).toHaveClass(/is-invalid/);
  });

  test('ORCID search result clears invalid state', async ({ page }) => {
    const authorRow = firstAuthor(page);
    const orcidInput = authorRow.locator('input[name="orcids[]"]');

    // 1. Enter invalid ORCID → field turns red
    await orcidInput.fill('0000-0002-1825-0098');
    await authorRow.locator('input[name="familynames[]"]').click();
    await expect(orcidInput).toHaveClass(/is-invalid/);

    // 2. Mock ORCID search API + record lookup
    await page.route('**/pub.orcid.org/v3.0/expanded-search/**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          'expanded-result': [{
            'orcid-id': '0000-0002-1825-0097',
            'given-names': 'Josiah',
            'family-names': 'Carberry',
            'institution-name': ['Brown University']
          }]
        })
      });
    });

    await page.route('**/pub.orcid.org/v3.0/0000-0002-1825-0097/record', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          person: { name: { 'family-name': { value: 'Carberry' }, 'given-names': { value: 'Josiah' } } },
          'activities-summary': { employments: { 'affiliation-group': [] }, educations: { 'affiliation-group': [] } }
        })
      });
    });

    // 3. Open search modal, search, and select result
    const searchBtn = page.locator(`${SELECTORS.formGroups.authors} .orcid-search-btn`).first();
    await searchBtn.click();
    await page.locator('#input-orcid-search-lastname').fill('Carberry');
    await page.locator('#button-orcid-search-execute').click();
    const acceptBtn = page.locator('.orcid-search-accept-btn').first();
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // 4. ORCID field should now be valid (green)
    await expect(page.locator('#modal-orcid-search')).toBeHidden();
    await expect(orcidInput).toHaveValue('0000-0002-1825-0097');
    await expect(orcidInput).toHaveClass(/is-valid/);
    await expect(orcidInput).not.toHaveClass(/is-invalid/);
  });
});
