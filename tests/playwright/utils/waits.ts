import { expect, type Page, type Response } from '@playwright/test';
import { performance as nodePerformance } from 'node:perf_hooks';

const FORM_INTERACTION_MINIMUM_MS = {
  save: 2_000,
  submit: 3_000,
} as const;

const SERVER_CLOCK_MARGIN_MS = 150;
const trackedPages = new WeakSet<Page>();
const interactionStartedAt = new WeakMap<Page, number>();

function isSuccessfulProtectedFormResponse(response: Response): boolean {
  if (response.request().method() !== 'POST' || !response.ok()) {
    return false;
  }

  const pathname = new URL(response.url()).pathname;
  return pathname.endsWith('/save/save_data.php') || pathname.endsWith('/send_xml_file.php');
}

async function startTrackingFormInteraction(page: Page): Promise<void> {
  if (!trackedPages.has(page)) {
    page.on('domcontentloaded', () => {
      interactionStartedAt.set(page, nodePerformance.now());
    });
    page.on('response', response => {
      if (isSuccessfulProtectedFormResponse(response)) {
        interactionStartedAt.set(page, nodePerformance.now());
      }
    });
    trackedPages.add(page);
  }

  if (interactionStartedAt.has(page)) {
    return;
  }

  const elapsedSinceNavigationResponseMs = await page.evaluate(() => {
    const [entry] = window.performance.getEntriesByType('navigation');
    const responseEnd = entry && 'responseEnd' in entry
      ? (entry as PerformanceNavigationTiming).responseEnd
      : 0;

    return Math.max(0, window.performance.now() - responseEnd);
  });

  // The server timer starts before responseEnd. Using responseEnd as the epoch is
  // deliberately conservative and avoids relying on a client-provided timestamp.
  interactionStartedAt.set(page, nodePerformance.now() - elapsedSinceNavigationResponseMs);
}

/**
 * Waits only for the remaining part of the server-enforced interaction window.
 * Most realistic form flows already exceed the minimum and therefore continue
 * immediately. A successful save/submit response starts a new window.
 */
export async function waitForFormInteractionReady(
  page: Page,
  operation: keyof typeof FORM_INTERACTION_MINIMUM_MS,
): Promise<void> {
  await startTrackingFormInteraction(page);

  const startedAt = interactionStartedAt.get(page);
  if (startedAt === undefined) {
    throw new Error('Could not determine the form interaction start time.');
  }

  const requiredElapsedMs = FORM_INTERACTION_MINIMUM_MS[operation] + SERVER_CLOCK_MARGIN_MS;
  const remainingMs = Math.max(0, requiredElapsedMs - (nodePerformance.now() - startedAt));
  if (remainingMs === 0) {
    return;
  }

  await expect.poll(
    () => nodePerformance.now() - startedAt,
    {
      message: `wait for the remaining ${operation} interaction window`,
      timeout: remainingMs + 2_000,
      intervals: [25, 50, 100],
    },
  ).toBeGreaterThanOrEqual(requiredElapsedMs);
}

/** Waits for the asynchronous homepage boot tasks that make the form interactive. */
export async function waitForHomepageReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const app = (window as any).elmo;
    const requiredDropdowns = [
      '#input-resourceinformation-resourcetype',
      '#input-resourceinformation-language',
      '#input-resourceinformation-titletype',
    ];

    return Boolean(app?.translations?.general)
      && requiredDropdowns.every(selector => {
        const dropdown = document.querySelector<HTMLSelectElement>(selector);
        return dropdown && !dropdown.disabled && dropdown.options.length > 1;
      })
      && (window as any).descriptionTypesReady instanceof Promise;
  });

  await page.evaluate(async () => {
    await (window as any).descriptionTypesReady;
  });
}

/** Flushes browser microtasks and two rendering frames without a wall-clock sleep. */
export async function waitForRenderingSettled(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

/** Prevents unrelated Google Maps downloads in tests that never interact with the map. */
export async function registerGoogleMapsNoopRoute(page: Page): Promise<void> {
  await page.route('https://maps.googleapis.com/maps/api/js**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        const resolveMapsBootstrap = window.google?.maps?.__ib__;
        if (window.google?.maps) {
          window.google.maps.importLibrary = () => new Promise(() => {});
          resolveMapsBootstrap?.();
        }
      `,
    });
  });
}
