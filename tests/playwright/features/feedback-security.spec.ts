import { test, expect, type Page } from '@playwright/test';
import { navigateToHome, SELECTORS } from '../utils';

const FEEDBACK_ENDPOINT = '**/send_feedback_mail.php';
const CSRF_ENDPOINT = '**/api/csrf_token.php';
const INTERACTION_ENDPOINT = '**/api/interaction_start.php';

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

async function fillFeedbackForm(page: Page) {
  const textareas = page.locator('textarea[name^="feedbackQuestion"]');
  const count = await textareas.count();
  for (let index = 0; index < count; index++) {
    await textareas.nth(index).fill(`Test feedback answer ${index + 1}`);
  }
}

function parseSubmissionFields(postData: string): Record<string, string> {
  const params = new URLSearchParams(postData);
  const fields: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    fields[key] = value;
  }
  return fields;
}

test.describe('Feedback Security Features', () => {
  test.describe('Honeypot field protection', () => {
    test('honeypot field exists but is hidden from view', async ({ page }) => {
      const { feedbackModal } = await navigateToFeedbackModal(page);

      const honeypotField = feedbackModal.locator('#input-feedback-please-fill-in-this-field');
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

      const honeypotField = feedbackModal.locator('#input-feedback-please-fill-in-this-field');
      await expect(honeypotField).toHaveAttribute('tabindex', '-1');
      await expect(honeypotField).toHaveAttribute('autocomplete', 'off');
    });
  });

  test.describe('CSRF token protection', () => {
    test('CSRF token field exists and is empty while the modal is open', async ({ page }) => {
      const { feedbackModal } = await navigateToFeedbackModal(page);

      const csrfField = feedbackModal.locator('input[name="csrf-token"]');
      await expect(csrfField).toBeAttached();
      await expect(csrfField).toHaveAttribute('type', 'hidden');
      await expect(csrfField).toHaveValue('');
    });

    test('opening the modal starts the interaction timer but does not fetch a CSRF token', async ({ page }) => {
      await navigateToHome(page);

      let csrfRequestCount = 0;
      await page.route(CSRF_ENDPOINT, async (route) => {
        csrfRequestCount += 1;
        await route.continue();
      });

      const interactionPromise = page.waitForRequest((request) =>
        request.url().includes('interaction_start.php?scope=feedback')
      );

      await page.locator('#button-feedback-openmodalfooter').click();
      await expect(page.locator(SELECTORS.modals.feedback)).toBeVisible();
      await interactionPromise;

      expect(csrfRequestCount).toBe(0);
      await expect(page.locator('#input-feedback-csrf-token')).toHaveValue('');

      await page.unroute(CSRF_ENDPOINT);
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

      await Promise.all([csrfPromise, sendButton.click()]);

      await expect(csrfField).not.toHaveValue('');
      expect((await csrfField.inputValue()).length).toBeGreaterThanOrEqual(32);

      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('CSRF token is cleared when the modal is reopened and reused on the next send', async ({ page }) => {
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'OK' }),
        });
      });

      const { feedbackModal, feedbackButton } = await navigateToFeedbackModal(page);
      await fillFeedbackForm(page);

      const csrfField = feedbackModal.locator('input[name="csrf-token"]');
      const sendButton = feedbackModal.locator('#button-feedback-send');

      await Promise.all([
        page.waitForResponse((response) => response.url().includes('send_feedback_mail.php')),
        page.waitForRequest((request) => request.url().includes('csrf_token.php')),
        sendButton.click(),
      ]);
      const firstToken = await csrfField.inputValue();
      expect(firstToken.length).toBeGreaterThanOrEqual(32);

      await feedbackModal.locator('button[aria-label="Close"]').click();
      await expect(feedbackModal).toBeHidden();

      await feedbackButton.click();
      await expect(feedbackModal).toBeVisible();
      await expect(csrfField).toHaveValue('');

      await fillFeedbackForm(page);
      await Promise.all([
        page.waitForResponse((response) => response.url().includes('send_feedback_mail.php')),
        page.waitForRequest((request) => request.url().includes('csrf_token.php')),
        sendButton.click(),
      ]);

      const secondToken = await csrfField.inputValue();
      expect(secondToken).toBe(firstToken);

      await page.unroute(FEEDBACK_ENDPOINT);
    });
  });

  test.describe('Server-side interaction timing', () => {
    test('feedback POST does not include client-side time fields', async ({ page }) => {
      let capturedFields: Record<string, string> = {};

      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        capturedFields = parseSubmissionFields(route.request().postData() || '');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'OK' }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);
      await fillFeedbackForm(page);

      await Promise.all([
        page.waitForResponse((response) => response.url().includes('send_feedback_mail.php')),
        feedbackModal.locator('#button-feedback-send').click(),
      ]);

      expect(capturedFields).not.toHaveProperty('feedback_time_spent');
      expect(capturedFields).not.toHaveProperty('time_spent');

      await page.unroute(FEEDBACK_ENDPOINT);
    });
  });

  test.describe('Rate limiting protection', () => {
    test('form includes required security fields in submission', async ({ page }) => {
      let capturedFields: Record<string, string> = {};

      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        capturedFields = parseSubmissionFields(route.request().postData() || '');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'OK' }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);
      await fillFeedbackForm(page);

      await Promise.all([
        page.waitForResponse((response) => response.url().includes('send_feedback_mail.php')),
        feedbackModal.locator('#button-feedback-send').click(),
      ]);

      expect(capturedFields).toHaveProperty('csrf-token');
      expect(capturedFields).toHaveProperty('please-fill-in-this-field');
      expect(capturedFields['please-fill-in-this-field']).toBe('');
      expect(capturedFields['csrf-token'].length).toBeGreaterThan(0);
      expect(capturedFields).not.toHaveProperty('feedback_time_spent');

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

      await Promise.all([
        page.waitForResponse((response) => response.url().includes('send_feedback_mail.php')),
        feedbackModal.locator('#button-feedback-send').click(),
      ]);

      const errorAlert = feedbackModal.locator('#panel-feedback-status .alert-danger');
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

      await Promise.all([
        page.waitForResponse((response) => response.url().includes('send_feedback_mail.php')),
        feedbackModal.locator('#button-feedback-send').click(),
      ]);

      const errorAlert = feedbackModal.locator('#panel-feedback-status .alert-danger');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('Ungültige Anfrage');

      await page.unroute(FEEDBACK_ENDPOINT);
    });

    test('shows time validation error when form submitted too quickly', async ({ page }) => {
      await page.route(FEEDBACK_ENDPOINT, async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Formular zu schnell ausgefüllt. Bitte nehmen Sie sich etwas mehr Zeit.',
          }),
        });
      });

      const { feedbackModal } = await navigateToFeedbackModal(page);
      await fillFeedbackForm(page);

      await Promise.all([
        page.waitForResponse((response) => response.url().includes('send_feedback_mail.php')),
        feedbackModal.locator('#button-feedback-send').click(),
      ]);

      const errorAlert = feedbackModal.locator('#panel-feedback-status .alert-danger');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText('zu schnell');

      await page.unroute(FEEDBACK_ENDPOINT);
    });
  });
});
