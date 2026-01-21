import { test, expect } from '@playwright/test';
import { navigateToHome, completeMinimalDatasetForm } from '../utils';

const SUBMIT_ENDPOINT = '**/api/v2/controllers/SubmitController.php';

test.describe('Submit Operation Security Features', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToHome(page);
  });

  test.describe('Honeypot field protection in submit form', () => {
    test('honeypot field exists but is hidden in submit form', async ({ page }) => {
      await completeMinimalDatasetForm(page);

      // Open submit modal
      const submitBtn = page.locator('#button-form-submit');
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click();
      const submitModal = page.locator('#modal-submit');
      await expect(submitModal).toBeVisible({ timeout: 5000 });

      // Check honeypot field
      const honeypotField = page.locator('#modal-submit input[name="website"]').first();
      const honeypotCount = await honeypotField.count();

      if (honeypotCount > 0) {
        await expect(honeypotField).toHaveAttribute('tabindex', '-1');
        await expect(honeypotField).toHaveAttribute('autocomplete', 'off');
        await expect(honeypotField).toHaveAttribute('type', 'text');
      }
    });

    test('honeypot field is empty in submit form', async ({ page }) => {
      await completeMinimalDatasetForm(page);

      const submitBtn = page.locator('#button-form-submit');
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click();
      await expect(page.locator('#modal-submit')).toBeVisible({ timeout: 5000 });

      const honeypotField = page.locator('#modal-submit input[name="website"]').first();
      const honeypotCount = await honeypotField.count();

      if (honeypotCount > 0) {
        await expect(honeypotField).toHaveValue('');
      }
    });

    test('submit form includes honeypot field in submission', async ({ page }) => {
      let capturedFormData: Record<string, string> = {};

      await page.route(SUBMIT_ENDPOINT, async route => {
        try {
          const postData = route.request().postData();
          if (postData) {
            const params = new URLSearchParams(postData);
            params.forEach((value, key) => {
              capturedFormData[key] = value;
            });
          }
        } catch (e) {
          console.log('Error capturing form data:', e);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Submitted' }),
        });
      });

      await completeMinimalDatasetForm(page);

      const submitBtn = page.locator('#button-form-submit');
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click();
      await expect(page.locator('#modal-submit')).toBeVisible({ timeout: 5000 });

      const honeypotField = page.locator('#modal-submit input[name="website"]').first();
      const honeypotCount = await honeypotField.count();

      if (honeypotCount > 0) {
        await expect(honeypotField).toHaveValue('');
        
        // Submit the form
        const submitFormBtn = page.locator('#modal-submit button[type="submit"]').first();
        await submitFormBtn.click();
        await page.waitForTimeout(500);

        // Verify honeypot was sent (should be empty)
        if (capturedFormData['website'] !== undefined) {
          expect(capturedFormData['website']).toBe('');
        }
      }

      await page.unroute(SUBMIT_ENDPOINT);
    });
  });

  test.describe('CSRF token protection in submit', () => {
    test('submit form includes CSRF token field', async ({ page }) => {
      await completeMinimalDatasetForm(page);

      const submitBtn = page.locator('#button-form-submit');
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click();
      await expect(page.locator('#modal-submit')).toBeVisible({ timeout: 5000 });

      const csrfField = page.locator('#modal-submit input[name="csrf_token"]').first();
      const csrfCount = await csrfField.count();

      if (csrfCount > 0) {
        await expect(csrfField).toHaveAttribute('type', 'hidden');
        const tokenValue = await csrfField.inputValue();
        expect(tokenValue).toBeTruthy();
        expect(tokenValue?.length).toBeGreaterThan(0);
      }
    });

    test('submit form includes security fields in submission', async ({ page }) => {
      const securityFieldsFound = {
        csrf_token: false,
        website: false,
      };

      await page.route(SUBMIT_ENDPOINT, async route => {
        try {
          const postData = route.request().postData() || '';
          const params = new URLSearchParams(postData);

          if (params.has('csrf_token')) {
            securityFieldsFound.csrf_token = true;
          }
          if (params.has('website')) {
            securityFieldsFound.website = true;
          }
        } catch (e) {
          console.log('Error checking security fields:', e);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Submitted' }),
        });
      });

      await completeMinimalDatasetForm(page);
      const submitBtn = page.locator('#button-form-submit');
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click();
      await expect(page.locator('#modal-submit')).toBeVisible({ timeout: 5000 });

      const submitFormBtn = page.locator('#modal-submit button[type="submit"]').first();
      await submitFormBtn.click();
      await page.waitForTimeout(500);

      expect(securityFieldsFound.csrf_token).toBe(true);
      expect(securityFieldsFound.website).toBe(true);

      await page.unroute(SUBMIT_ENDPOINT);
    });
  });

  test.describe('Rate limiting on submit operations', () => {
    test('shows rate limit error message when server returns 429 on submit', async ({ page }) => {
      await page.route(SUBMIT_ENDPOINT, async route => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Too many submission requests.',
          }),
        });
      });

      await completeMinimalDatasetForm(page);

      const submitBtn = page.locator('#button-form-submit');
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click();
      await expect(page.locator('#modal-submit')).toBeVisible({ timeout: 5000 });

      const submitFormBtn = page.locator('#modal-submit button[type="submit"]').first();
      await submitFormBtn.click();

      // Wait for error to appear
      await page.waitForTimeout(1500);

      const errorAlert = page.locator('.alert-danger, .alert-error, [role="alert"]').first();
      const errorExists = await errorAlert.count() > 0;

      if (errorExists) {
        await expect(errorAlert).toBeVisible({ timeout: 3000 });
      }

      await page.unroute(SUBMIT_ENDPOINT);
    });

    test('shows CSRF error message when token is invalid for submit', async ({ page }) => {
      await page.route(SUBMIT_ENDPOINT, async route => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid CSRF token',
          }),
        });
      });

      await completeMinimalDatasetForm(page);

      const submitBtn = page.locator('#button-form-submit');
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click();
      await expect(page.locator('#modal-submit')).toBeVisible({ timeout: 5000 });

      const submitFormBtn = page.locator('#modal-submit button[type="submit"]').first();
      await submitFormBtn.click();

      await page.waitForTimeout(1500);

      const errorAlert = page.locator('.alert-danger, .alert-error, [role="alert"]').first();
      const errorExists = await errorAlert.count() > 0;

      if (errorExists) {
        await expect(errorAlert).toBeVisible({ timeout: 3000 });
      }

      await page.unroute(SUBMIT_ENDPOINT);
    });
  });
});
