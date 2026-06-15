import { test, expect, type Page } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

const FEEDBACK_ENDPOINT = '**/send_feedback_mail.php';
const CSRF_ENDPOINT = '**/api/csrf_token.php';

/**
 * Helper function to navigate to the feedback modal
 */
async function navigateToFeedbackModal(page: Page) {
  await navigateToHome(page);

  const feedbackButton = page.locator('#button-feedback-openmodalfooter');
  await expect(feedbackButton).toBeVisible();

  await feedbackButton.click();

  const feedbackModal = page.locator(SELECTORS.modals.feedback);
  // Rely on Playwright's default assertion timeout to avoid flakiness on slower environments
  await expect(feedbackModal).toBeVisible();
  await expect(feedbackModal.locator('#form-feedback')).toBeVisible();

  return { feedbackButton, feedbackModal };
}

/**
 * Fill all feedback form textareas with test content
 */
async function fillFeedbackForm(page: Page) {
  const textareas = page.locator('textarea[name^="feedbackQuestion"]');
  const count = await textareas.count();
  for (let index = 0; index < count; index++) {
    await textareas.nth(index).fill(`Test feedback answer ${index + 1}`);
  }
}

test.describe('Feedback Security Features', () => {
  test.describe('Honeypot field protection', () => {
    test('honeypot field exists but is hidden from view', async ({ page }) => {
      const { feedbackModal } = await navigateToFeedbackModal(page);

      // Check that honeypot field exists
      const honeypotField = feedbackModal.locator('input[name="website"]');
      await expect(honeypotField).toBeAttached();

      // Check that honeypot container is positioned off-screen
      const honeypotContainer = honeypotField.locator('..');
      const boundingBox = await honeypotContainer.boundingBox();

      // Either the bounding box should be null (not rendered) or positioned off-screen
      if (boundingBox) {
        expect(boundingBox.x).toBeLessThan(0);
      }

      // Verify aria-hidden is set for accessibility
      await expect(honeypotContainer).toHaveAttribute('aria-hidden', 'true');
    });

    test('honeypot field has correct attributes to prevent autofill', async ({ page }) => {
      const { feedbackModal } = await navigateToFeedbackModal(page);

      const honeypotField = feedbackModal.locator('input[name="website"]');
      await expect(honeypotField).toHaveAttribute('tabindex', '-1');
      await expect(honeypotField).toHaveAttribute('autocomplete', 'off');
    });
  });

  test.describe('CSRF token protection', () => {
    test('CSRF token field exists in the form', async ({ page }) => {
      const { feedbackModal } = await navigateToFeedbackModal(page);

      const csrfField = feedbackModal.locator('input[name="csrf_token"]');
      await expect(csrfField).toBeAttached();
      await expect(csrfField).toHaveAttribute('type', 'hidden');
    });

    test('CSRF token is fetched when modal opens', async ({ page }) => {
      await navigateToHome(page);

      // Wait for CSRF token request when opening modal
      const csrfPromise = page.waitForRequest((request) =>
        request.url().includes('csrf_token.php')
      );

      const feedbackButton = page.locator('#button-feedback-openmodalfooter');
      await expect(feedbackButton).toBeVisible();

      await feedbackButton.click();
      const feedbackModal = page.locator(SELECTORS.modals.feedback);
      await expect(feedbackModal).toBeVisible();

      // Verify CSRF token was requested
      await csrfPromise;

      // Wait until the token field is populated
      const csrfField = feedbackModal.locator('input[name="csrf_token"]');
      await expect(csrfField).not.toHaveValue('');
      const tokenValue = await csrfField.inputValue();

      // Token should be a non-empty string (64 hex characters)
      expect(tokenValue.length).toBeGreaterThanOrEqual(32);
    });

    test('CSRF token is refreshed when modal is reopened', async ({ page }) => {
      const { feedbackModal } = await navigateToFeedbackModal(page);

      // Wait for initial token to be populated
      const csrfField = feedbackModal.locator('input[name="csrf_token"]');
      await expect(csrfField).not.toHaveValue('');
      const firstToken = await csrfField.inputValue();

      // Close modal
      const closeButton = feedbackModal.locator('button[aria-label="Close"]');
      await closeButton.click();
      await expect(feedbackModal).toBeHidden();

      // Wait for a new CSRF token request when reopening
      const csrfPromise = page.waitForRequest((request) =>
        request.url().includes('csrf_token.php')
      );

      // Reopen modal
      const feedbackButton = page.locator('#button-feedback-openmodalfooter');
      await feedbackButton.click();
      await expect(feedbackModal).toBeVisible();
      await csrfPromise;

      // Wait for new token to be populated
      await expect(csrfField).not.toHaveValue('');
      const secondToken = await csrfField.inputValue();

      // Tokens should be different
      expect(secondToken).not.toBe(firstToken);
    });
  });

  test.describe('Time-spent tracking', () => {
    test('time_spent hidden field exists in the form', async ({ page }) => {
      const { feedbackModal } = await navigateToFeedbackModal(page);

      const timeSpentField = feedbackModal.locator('input[name="feedback_time_spent"]');
      await expect(timeSpentField).toBeAttached();
      await expect(timeSpentField).toHaveAttribute('type', 'hidden');
    });

    test('time_spent is initially 0', async ({ page }) => {
      const { feedbackModal } = await navigateToFeedbackModal(page);

      const timeSpentField = feedbackModal.locator('input[name="feedback_time_spent"]');
      const initialValue = await timeSpentField.inputValue();
      expect(initialValue).toBe('0');
    });

    test('time_spent is updated when form is submitted', async ({ page }) => {
      // Set up the route mock BEFORE opening the modal
      let capturedTimeSpent = '0';
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        const postData = route.request().postData() || '';
        const params = new URLSearchParams(postData);
        capturedTimeSpent = params.get('feedback_time_spent') || '0';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'OK' }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);

      await fillFeedbackForm(page);

      // Wait past the client-side minimum interaction gate.
      await page.waitForTimeout(3100);

      const sendButton = feedbackModal.locator('#button-feedback-send');
      
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      // Time spent should reflect the modal minimum interaction time.
      const timeSpentNum = parseInt(capturedTimeSpent, 10);
      expect(timeSpentNum).toBeGreaterThanOrEqual(3);
      
      await page.unroute(FEEDBACK_ENDPOINT);
    });
  });

  test.describe('Rate limiting protection', () => {
    test('form includes all required security fields in submission', async ({ page }) => {
      // Set up the route mock BEFORE opening the modal
      let capturedFields: Record<string, string> = {};
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        const postData = route.request().postData() || '';
        const params = new URLSearchParams(postData);
        for (const [key, value] of params.entries()) {
          capturedFields[key] = value;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'OK' }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);

      await fillFeedbackForm(page);

      // Wait for CSRF token to be populated before submitting
      await expect(feedbackModal.locator('input[name="csrf_token"]')).not.toHaveValue('');
      await page.waitForTimeout(3100);

      const sendButton = feedbackModal.locator('#button-feedback-send');
      
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      // Verify all security fields are present
      expect(capturedFields).toHaveProperty('csrf_token');
      expect(capturedFields).toHaveProperty('feedback_time_spent');
      expect(capturedFields).toHaveProperty('website'); // Honeypot - should be empty

      // Honeypot should be empty (not filled by normal user)
      expect(capturedFields['website']).toBe('');

      // CSRF token should be non-empty
      expect(capturedFields['csrf_token'].length).toBeGreaterThan(0);
      
      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('shows rate limit error message when server returns 429', async ({ page }) => {
      // Mock rate limit response BEFORE opening modal
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Sie haben zu viele Anfragen gesendet. Bitte versuchen Sie es in einer Stunde erneut.',
          }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);

      await fillFeedbackForm(page);
      await expect(feedbackModal.locator('input[name="csrf_token"]')).not.toHaveValue('');
      await page.waitForTimeout(3100);

      const sendButton = feedbackModal.locator('#button-feedback-send');
      
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      // Error message should be displayed
      const statusPanel = feedbackModal.locator('#panel-feedback-status');
      const errorAlert = statusPanel.locator('.alert-danger');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('zu viele Anfragen');
      
      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('shows CSRF error message when token is invalid', async ({ page }) => {
      // Mock CSRF validation error BEFORE opening modal
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Ungültige Anfrage. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
          }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);

      await fillFeedbackForm(page);
      await expect(feedbackModal.locator('input[name="csrf_token"]')).not.toHaveValue('');
      await page.waitForTimeout(3100);

      const sendButton = feedbackModal.locator('#button-feedback-send');
      
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      // Error message should be displayed
      const statusPanel = feedbackModal.locator('#panel-feedback-status');
      const errorAlert = statusPanel.locator('.alert-danger');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('Ungültige Anfrage');
      
      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('shows time validation error when form submitted too quickly', async ({ page }) => {
      let requestSent = false;
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        requestSent = true;
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Formular zu schnell ausgefüllt. Bitte nehmen Sie sich etwas mehr Zeit.',
          }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);

      await fillFeedbackForm(page);

      const sendButton = feedbackModal.locator('#button-feedback-send');

      await sendButton.click();

      // Client-side gate should block the request and show a warning immediately.
      const statusPanel = feedbackModal.locator('#panel-feedback-status');
      const warningAlert = statusPanel.locator('.alert-warning');
      await expect(warningAlert).toBeVisible();
      await expect(warningAlert).toContainText('at least 3 seconds');
      expect(requestSent).toBe(false);
      
      await page.unroute(FEEDBACK_ENDPOINT);
    });
  });
});
