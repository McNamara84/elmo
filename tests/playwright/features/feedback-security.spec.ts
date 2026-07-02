import { test, expect, type Page } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

const FEEDBACK_ENDPOINT = '**/send_feedback_mail.php';
const INTERACTION_ENDPOINT = '**/api/interaction_start.php';

/**
 * Helper function to navigate to the feedback modal
 */
async function navigateToFeedbackModal(page: Page) {
  await navigateToHome(page);

  const feedbackButton = page.locator('#button-feedback-openmodalfooter');
  await expect(feedbackButton).toBeVisible();

  await feedbackButton.click();

  const feedbackModal = page.locator(SELECTORS.modals.feedback);
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

      const honeypotField = feedbackModal.locator('input[name="website"]');
      await expect(honeypotField).toBeAttached();

      const honeypotContainer = honeypotField.locator('..');
      const boundingBox = await honeypotContainer.boundingBox();

      if (boundingBox) {
        expect(boundingBox.x).toBeLessThan(0);
      }

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

      const csrfField = feedbackModal.locator('input[name="csrf-token"]');
      await expect(csrfField).toBeAttached();
      await expect(csrfField).toHaveAttribute('type', 'hidden');
      await expect(csrfField).toHaveValue('');
    });

    test('interaction timer starts when modal opens', async ({ page }) => {
      await navigateToHome(page);

      const interactionPromise = page.waitForRequest((request) =>
        request.url().includes('interaction_start.php')
      );

      const feedbackButton = page.locator('#button-feedback-openmodalfooter');
      await feedbackButton.click();

      const feedbackModal = page.locator(SELECTORS.modals.feedback);
      await expect(feedbackModal).toBeVisible();
      await interactionPromise;
    });

    test('CSRF token is fetched when feedback is sent', async ({ page }) => {
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'OK' }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);
      await fillFeedbackForm(page);

      const csrfField = feedbackModal.locator('input[name="csrf-token"]');
      await expect(csrfField).toHaveValue('');

      const csrfPromise = page.waitForRequest((request) =>
        request.url().includes('csrf_token.php')
      );

      const sendButton = feedbackModal.locator('#button-feedback-send');
      await Promise.all([
        csrfPromise,
        sendButton.click(),
      ]);

      await expect(csrfField).not.toHaveValue('');
      const tokenValue = await csrfField.inputValue();
      expect(tokenValue.length).toBeGreaterThanOrEqual(32);

      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('CSRF token is reused when feedback is sent again in the same session', async ({ page }) => {
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'OK' }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);
      await fillFeedbackForm(page);

      const csrfField = feedbackModal.locator('input[name="csrf-token"]');
      const sendButton = feedbackModal.locator('#button-feedback-send');

      await Promise.all([
        page.waitForRequest((request) => request.url().includes('csrf_token.php')),
        sendButton.click(),
      ]);
      const firstToken = await csrfField.inputValue();

      const feedbackButton = page.locator('#button-feedback-openmodalfooter');
      await feedbackButton.click();
      await expect(feedbackModal).toBeVisible();
      await fillFeedbackForm(page);

      await Promise.all([
        page.waitForRequest((request) => request.url().includes('csrf_token.php')),
        sendButton.click(),
      ]);
      const secondToken = await csrfField.inputValue();

      expect(secondToken).toBe(firstToken);

      await page.unroute(FEEDBACK_ENDPOINT);
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
      await page.waitForTimeout(2000);

      const sendButton = feedbackModal.locator('#button-feedback-send');
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      const timeSpentNum = parseInt(capturedTimeSpent, 10);
      expect(timeSpentNum).toBeGreaterThanOrEqual(1);

      await page.unroute(FEEDBACK_ENDPOINT);
    });
  });

  test.describe('Rate limiting protection', () => {
    test('form includes all required security fields in submission', async ({ page }) => {
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

      const sendButton = feedbackModal.locator('#button-feedback-send');
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      expect(capturedFields).toHaveProperty('csrf-token');
      expect(capturedFields).toHaveProperty('feedback_time_spent');
      expect(capturedFields).toHaveProperty('website');
      expect(capturedFields['website']).toBe('');
      expect(capturedFields['csrf-token'].length).toBeGreaterThan(0);

      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('shows rate limit error message when server returns 429', async ({ page }) => {
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

      const sendButton = feedbackModal.locator('#button-feedback-send');
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      const statusPanel = feedbackModal.locator('#panel-feedback-status');
      const errorAlert = statusPanel.locator('.alert-danger');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('zu viele Anfragen');

      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('shows CSRF error message when token is invalid', async ({ page }) => {
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

      const sendButton = feedbackModal.locator('#button-feedback-send');
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      const statusPanel = feedbackModal.locator('#panel-feedback-status');
      const errorAlert = statusPanel.locator('.alert-danger');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('Ungültige Anfrage');

      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('shows time validation error when form submitted too quickly', async ({ page }) => {
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
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
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('send_feedback_mail.php')
      );

      await sendButton.click();
      await responsePromise;

      const statusPanel = feedbackModal.locator('#panel-feedback-status');
      const errorAlert = statusPanel.locator('.alert-danger');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('zu schnell');

      await page.unroute(FEEDBACK_ENDPOINT);
    });
  });
});
