import { expect, test } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const KEY_SECTIONS = [
  'header[role="banner"]',
  'main#main-content',
  'form#form-mde',
  '[data-translate="resourceInfo.title"]',
  '[data-translate="rights.title"]',
  '[data-translate="authors.title"]',
  '[data-translate="descriptions.title"]',
  '[data-translate="keywords.free.title"]',
  '[data-translate="coverage.title"]',
  '[data-translate="relatedWork.title"]',
  '[data-translate="funding.title"]',
  'footer.footer',
  '#button-form-submit',
];

test.describe('Homepage performance', () => {
  test('measures load time for fully rendered homepage', async ({ page }, testInfo) => {
    const start = Date.now();

    const response = await page.goto('/', {
      waitUntil: 'domcontentloaded',
    });

    expect(response, 'Homepage should respond successfully').not.toBeNull();
    expect(response!.ok()).toBeTruthy();

    await page.waitForLoadState('networkidle');

    for (const selector of KEY_SECTIONS) {
      await test.step(`wait for ${selector}`, async () => {
        await expect(page.locator(selector)).toBeVisible();
      });
    }

    const end = Date.now();
    const totalLoadTimeMs = end - start;

    const navigationTiming = await page.evaluate(() => {
      const [entry] = performance.getEntriesByType('navigation');
      if (!entry) {
        return null;
      }

      const navigationEntry = entry as Record<string, unknown> | undefined;
      if (!navigationEntry) {
        return null;
      }

      const toNumber = (value: unknown) => (typeof value === 'number' ? value : undefined);

      return {
        startTime: toNumber(navigationEntry.startTime),
        responseEnd: toNumber(navigationEntry.responseEnd),
        domContentLoadedEventEnd: toNumber(navigationEntry.domContentLoadedEventEnd),
        loadEventEnd: toNumber(navigationEntry.loadEventEnd),
        duration: toNumber(navigationEntry.duration),
      };
    });

    const metrics = {
      browser: testInfo.project.name,
      totalLoadTimeMs,
      timestamp: new Date().toISOString(),
      navigation: navigationTiming,
    };

    const metricsDir = path.join(process.cwd(), 'test-results', 'performance');
    await fs.mkdir(metricsDir, { recursive: true });

    const sanitizedProject = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const metricsPath = path.join(metricsDir, `${sanitizedProject}.json`);
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');

    await testInfo.attach('elmo-performance', {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    });

    testInfo.annotations.push({
      type: 'performance',
      description: `Homepage fully loaded in ${totalLoadTimeMs.toFixed(0)} ms`,
    });

    console.log(
      `\n[performance] ${testInfo.project.name}: fully loaded in ${totalLoadTimeMs.toFixed(0)} ms` +
        (navigationTiming && typeof navigationTiming.duration === 'number'
          ? ` (navigation duration ${navigationTiming.duration.toFixed(0)} ms)`
          : ''),
    );
  });
});