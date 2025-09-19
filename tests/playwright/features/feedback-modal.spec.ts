import { test, expect, type Page, type Route } from '@playwright/test';

const FEEDBACK_ENDPOINT = '**/send_feedback_mail.php';
const DEFAULT_NETWORK_DELAY_MS = 150;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function navigateToFeedbackModal(page: Page) {
  await page.goto('');

  const feedbackButton = page.locator('#button-feedback-openmodalfooter');
  if (!(await feedbackButton.isVisible())) {
    test.skip(true, 'Feedback feature is disabled via feature flag.');
  }

  await feedbackButton.click();

  const feedbackModal = page.locator('#modal-feedback');
  await expect(feedbackModal).toBeVisible();
  await expect(feedbackModal.locator('#form-feedback')).toBeVisible();

  return { feedbackButton, feedbackModal };
}

async function fillFeedbackForm(page: Page) {
  const textareas = page.locator('textarea[name^="feedbackQuestion"]');
  const count = await textareas.count();
  for (let index = 0; index < count; index++) {
    await textareas
      .nth(index)
      .fill(`Automated feedback answer ${index + 1}`);
  }
}

async function mockFeedbackEndpoint(
  page: Page,
  status: number,
  handler?: (route: Route) => Promise<void>,
  options?: { delayMs?: number }
) {
  const delayMs = options?.delayMs ?? DEFAULT_NETWORK_DELAY_MS;
  await page.route(FEEDBACK_ENDPOINT, async (route) => {
    if (delayMs > 0) {
      await delay(delayMs);
    }

    if (handler) {
      await handler(route);
      return;
    }

    await route.fulfill({
      status,
      contentType: 'text/plain',
      body: status === 200 ? 'OK' : 'Internal Server Error',
    });
  });
}

test.describe('Feedback modal interactions', () => {
  test('shows success feedback flow when the backend responds with 200', async ({ page }) => {
    const { feedbackButton, feedbackModal } = await navigateToFeedbackModal(page);
    const feedbackForm = feedbackModal.locator('#form-feedback');
    const statusPanel = feedbackModal.locator('#panel-feedback-status');
    const thankYouPanel = feedbackModal.locator('#panel-feedback-message');
    const sendButton = feedbackModal.locator('#button-feedback-send');
    const closeButton = feedbackModal.locator('button[aria-label="Close"]');

    await fillFeedbackForm(page);

    const sendingLabel = await page.evaluate(() => {
      return (window as any).translations?.modals?.feedback?.sending ?? 'Sending...';
    });
    const successLabel = await page.evaluate(() => {
      return (window as any).translations?.modals?.feedback?.success ?? 'Thanks for your feedback!';
    });

    await mockFeedbackEndpoint(page, 200);

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_feedback_mail.php')
    );

    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(sendButton).toBeDisabled();
    await expect(sendButton).toContainText(sendingLabel);
    await expect(sendButton.locator('.spinner-border')).toBeVisible();

    const response = await responsePromise;
    expect(response.status()).toBe(200);

    await expect(feedbackForm).toBeHidden();
    await expect(thankYouPanel).toHaveCSS('display', 'block');

    const successAlert = statusPanel.locator('.alert-success');
    await expect(successAlert).toBeVisible();
    await expect(successAlert).toContainText(successLabel);

    await expect(feedbackModal).toBeVisible();

    // Close the modal explicitly to avoid flakiness on slow CI environments
    await closeButton.click();
    await expect(feedbackModal).toBeHidden();
    await expect(feedbackButton).toBeFocused();

    await feedbackButton.click();
    await expect(feedbackModal).toBeVisible();
    await expect(feedbackForm).toBeVisible();
    await expect(thankYouPanel).toBeHidden();
    await expect(statusPanel).toBeEmpty();

    const sendLabel = await page.evaluate(() => {
      return (window as any).translations?.modals?.feedback?.sendButton ?? 'Send Feedback';
    });
    await expect(sendButton).toHaveText(sendLabel);

    const textareas = page.locator('textarea[name^="feedbackQuestion"]');
    const count = await textareas.count();
    for (let index = 0; index < count; index++) {
      await expect(textareas.nth(index)).toHaveValue('');
    }

    await page.unroute(FEEDBACK_ENDPOINT);
  });

  test('shows error feedback flow when the backend responds with 500', async ({ page }) => {
    const { feedbackButton, feedbackModal } = await navigateToFeedbackModal(page);
    const feedbackForm = feedbackModal.locator('#form-feedback');
    const statusPanel = feedbackModal.locator('#panel-feedback-status');
    const sendButton = feedbackModal.locator('#button-feedback-send');
    const closeButton = feedbackModal.locator('button[aria-label="Close"]');

    await fillFeedbackForm(page);

    const errorLabel = await page.evaluate(() => {
      return (window as any).translations?.modals?.feedback?.error ?? 'Error when sending feedback: ';
    });
    const sendLabel = await page.evaluate(() => {
      return (window as any).translations?.modals?.feedback?.sendButton ?? 'Send Feedback';
    });

    await mockFeedbackEndpoint(page, 500, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'Internal Server Error',
      });
    });

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('send_feedback_mail.php')
    );

    await sendButton.click();
    await expect(sendButton).toBeDisabled();

    const response = await responsePromise;
    expect(response.status()).toBe(500);

    const errorAlert = statusPanel.locator('.alert-danger');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(errorLabel);

    await expect(sendButton).toBeEnabled();
    await expect(sendButton).toHaveText(sendLabel);
    await expect(sendButton).toBeFocused();

    await closeButton.click();
    await expect(feedbackModal).toBeHidden();
    await expect(feedbackButton).toBeFocused();

    await feedbackButton.click();
    await expect(feedbackModal).toBeVisible();
    await expect(feedbackForm).toBeVisible();
    await expect(statusPanel).toBeEmpty();

    const textareas = page.locator('textarea[name^="feedbackQuestion"]');
    const count = await textareas.count();
    for (let index = 0; index < count; index++) {
      await expect(textareas.nth(index)).toHaveValue('');
    }

    await page.unroute(FEEDBACK_ENDPOINT);
  });
});