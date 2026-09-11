import { test, expect } from '@playwright/test';
import { navigateToHome } from '../utils';

const LOG_ENDPOINT = '**/endpoints/log_page_event.php';
const ISO_INSTANT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

test.describe('Page load event logging', () => {
  test('sends log_page_event request on page load', async ({ page }) => {
    let capturedBody: URLSearchParams | null = null;

    await page.route(LOG_ENDPOINT, async (route) => {
      const postData = route.request().postData() || '';
      capturedBody = new URLSearchParams(postData);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'logged' }),
      });
    });

    // 1) Attach response waiter before navigation so we don't miss the first call
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('log_page_event.php')
    );

    // 2) Navigate, which triggers the page-load logging request
    await navigateToHome(page);

    // 3) Wait for the logging response to arrive
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    // 4) Assert payload values captured by the route mock
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.get('event')).toBe('page loaded');

    const timestamp = capturedBody!.get('timestamp') || '';
    expect(timestamp).toMatch(ISO_INSTANT_REGEX);
  });
});
