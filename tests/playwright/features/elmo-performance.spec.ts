import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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

const MEASUREMENT_RUNS = 3;

const average = (values: Array<number | undefined>) => {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) {
    return undefined;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

type NavigationTiming = {
  startTime?: number;
  responseEnd?: number;
  domContentLoadedEventEnd?: number;
  loadEventEnd?: number;
  duration?: number;
} | null;

type RunMetrics = {
  attempt: number;
  totalLoadTimeMs: number;
  timestamp: string;
  navigation: NavigationTiming;
};

const collectNavigationTiming = async (page: Page): Promise<NavigationTiming> => {
  return page.evaluate(() => {
    const [entry] = performance.getEntriesByType('navigation');
    if (!entry) {
      return null;
    }

    const navigationEntry = entry as Partial<PerformanceNavigationTiming> | undefined;
    if (!navigationEntry) {
      return null;
    }

    const toNumberInner = (value: unknown) => (typeof value === 'number' ? value : undefined);

    return {
      startTime: toNumberInner(navigationEntry.startTime),
      responseEnd: toNumberInner(navigationEntry.responseEnd),
      domContentLoadedEventEnd: toNumberInner(navigationEntry.domContentLoadedEventEnd),
      loadEventEnd: toNumberInner(navigationEntry.loadEventEnd),
      duration: toNumberInner(navigationEntry.duration),
    };
  });
};

test.describe('Homepage performance', () => {
  test('measures average load time for fully rendered homepage', async ({ page }, testInfo) => {
    const runs: RunMetrics[] = [];

    for (let attempt = 1; attempt <= MEASUREMENT_RUNS; attempt += 1) {
      const runMetrics = await test.step(`load measurement run ${attempt}`, async () => {
        const start = Date.now();

        const response = await page.goto('/', {
          waitUntil: 'domcontentloaded',
        });

        expect(response, 'Homepage should respond successfully').not.toBeNull();
        expect(response!.ok()).toBeTruthy();

        await page.waitForLoadState('networkidle');

        for (const selector of KEY_SECTIONS) {
          await test.step(`run ${attempt}: wait for ${selector}`, async () => {
            await expect(page.locator(selector)).toBeVisible();
          });
        }

        const end = Date.now();
        const totalLoadTimeMs = end - start;

        const navigationTiming = await collectNavigationTiming(page);

        const run: RunMetrics = {
          attempt,
          totalLoadTimeMs,
          timestamp: new Date().toISOString(),
          navigation: navigationTiming,
        };

        console.log(
          `\n[performance] ${testInfo.project.name}: run ${attempt} fully loaded in ${totalLoadTimeMs.toFixed(0)} ms` +
            (navigationTiming && typeof navigationTiming?.duration === 'number'
              ? ` (navigation duration ${navigationTiming.duration.toFixed(0)} ms)`
              : ''),
        );

        return run;
      });

      runs.push(runMetrics);
    }

    const averageLoadTimeMs = average(runs.map((run) => run.totalLoadTimeMs));

    const navigationDurations = runs.map((run) => run.navigation?.duration);
    const navigationDomContentLoaded = runs.map((run) => run.navigation?.domContentLoadedEventEnd);
    const navigationLoadEventEnd = runs.map((run) => run.navigation?.loadEventEnd);
    const navigationStartTimes = runs.map((run) => run.navigation?.startTime);
    const navigationResponseEnd = runs.map((run) => run.navigation?.responseEnd);

    const aggregatedNavigation = {
      startTime: average(navigationStartTimes),
      responseEnd: average(navigationResponseEnd),
      duration: average(navigationDurations),
      domContentLoadedEventEnd: average(navigationDomContentLoaded),
      loadEventEnd: average(navigationLoadEventEnd),
    };

    const metrics = {
      browser: testInfo.project.name,
      totalLoadTimeMs: averageLoadTimeMs,
      averageLoadTimeMs,
      runs,
      navigation: aggregatedNavigation,
      timestamp: new Date().toISOString(),
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

    const averageLoadDescription =
      typeof averageLoadTimeMs === 'number' ? `${Math.round(averageLoadTimeMs)} ms` : 'n/a';
    const descriptionParts = [`Average fully loaded in ${averageLoadDescription}`];
    if (navigationDurations.some((value) => typeof value === 'number')) {
      const averageNavigationDuration = average(navigationDurations);
      const navigationDescription =
        typeof averageNavigationDuration === 'number'
          ? `${Math.round(averageNavigationDuration)} ms`
          : 'n/a';
      descriptionParts.push(`avg navigation duration ${navigationDescription}`);
    }

    testInfo.annotations.push({
      type: 'performance',
      description: descriptionParts.join(' | '),
    });

    if (typeof averageLoadTimeMs === 'number') {
      const runBreakdown = runs
        .map((run) => `#${run.attempt}: ${Math.round(run.totalLoadTimeMs)} ms`)
        .join(', ');
      console.log(
        `\n[performance] ${testInfo.project.name}: average fully loaded in ${Math.round(averageLoadTimeMs)} ms` +
          (runBreakdown ? ` (runs ${runBreakdown})` : ''),
      );
    }
  });
});