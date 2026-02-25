import { expect, test } from '@playwright/test';
import { navigateToHome } from '../utils';

type MediaQueryEvent = { matches: boolean; media: string };
type MediaQueryListener =
  | ((event: MediaQueryEvent) => void)
  | { handleEvent(event: MediaQueryEvent): void };

declare global {
  interface Window {
    __setPrefersDark(value: boolean): void;
  }
}

test.describe('Theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const preferenceStorageKey = '__mock_prefers_dark';
      const initialisationKey = '__theme_mock_initialised';
      const storedPreference = window.localStorage.getItem(preferenceStorageKey);
      let prefersDark = storedPreference === 'true';

      if (storedPreference === null) {
        prefersDark = false;
        window.localStorage.setItem(preferenceStorageKey, 'false');
      }

      if (!window.sessionStorage.getItem(initialisationKey)) {
        window.localStorage.removeItem('theme');
        window.sessionStorage.setItem(initialisationKey, '1');
      }

      const records: Array<{
        query: string;
        listeners: Set<MediaQueryListener>;
        list: {
          media: string;
          matches: boolean;
          onchange: ((event: MediaQueryEvent) => void) | null;
          addListener(listener: MediaQueryListener): void;
          removeListener(listener: MediaQueryListener): void;
          addEventListener(type: string, listener: MediaQueryListener): void;
          removeEventListener(type: string, listener: MediaQueryListener): void;
          dispatchEvent(event: MediaQueryEvent): boolean;
        };
      }> = [];

      const notifyRecord = (
        record: (typeof records)[number],
        event: MediaQueryEvent,
      ) => {
        record.listeners.forEach((listener) => {
          if (typeof listener === 'function') {
            listener(event);
          } else if (listener && typeof listener.handleEvent === 'function') {
            listener.handleEvent(event);
          }
        });

        if (typeof record.list.onchange === 'function') {
          record.list.onchange(event);
        }
      };

      const recomputeMatches = () => {
        for (const record of records) {
          const shouldMatch =
            record.query === '(prefers-color-scheme: dark)' ? prefersDark : false;

          if (record.list.matches !== shouldMatch) {
            record.list.matches = shouldMatch;
            const event = {
              matches: shouldMatch,
              media: record.query,
            } as MediaQueryEvent;

            notifyRecord(record, event);
          }
        }
      };

      window.matchMedia = ((query: string) => {
        const record = {
          query,
          listeners: new Set<MediaQueryListener>(),
          list: {
            media: query,
            matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
            onchange: null,
            addListener(listener: MediaQueryListener) {
              record.listeners.add(listener);
            },
            removeListener(listener: MediaQueryListener) {
              record.listeners.delete(listener);
            },
            addEventListener(_type: string, listener: MediaQueryListener) {
              record.listeners.add(listener);
            },
            removeEventListener(_type: string, listener: MediaQueryListener) {
              record.listeners.delete(listener);
            },
            dispatchEvent(event: MediaQueryEvent) {
              notifyRecord(record, event);
              return true;
            },
          },
        };

        records.push(record);
        return record.list as unknown as MediaQueryList;
      }) as typeof window.matchMedia;

      window.__setPrefersDark = (value: boolean) => {
        prefersDark = Boolean(value);
        window.localStorage.setItem(preferenceStorageKey, prefersDark ? 'true' : 'false');
        recomputeMatches();
      };

      recomputeMatches();
    });
  });

  test('allows switching themes and respects auto mode preference', async ({ page }) => {
    await navigateToHome(page);

    const html = page.locator('html');
    const themeToggle = page.locator('#bd-theme');
    const themeMenu = page.locator('#bd-theme + ul.dropdown-menu');
    const themeOption = (value: string) =>
      page.locator(`#bd-theme + ul.dropdown-menu [data-bs-theme-value="${value}"]`);

    const expectThemeState = async (value: 'dark' | 'light') => {
      await expect(html).toHaveAttribute('data-bs-theme', value);
      await expect.poll(async () => page.evaluate(() => localStorage.getItem('theme'))).toBe(
        value,
      );

      const activeItems = page.locator('#bd-theme + ul.dropdown-menu .dropdown-item.active');
      await expect(activeItems).toHaveCount(1);
      await expect(activeItems.first()).toHaveAttribute('data-bs-theme-value', value);
    };

    const chooseTheme = async (value: 'dark' | 'light' | 'auto') => {
      await themeToggle.click();
      await expect(themeMenu).toBeVisible();
      await themeOption(value).click();
      await expect(themeMenu).not.toBeVisible();
    };

    await chooseTheme('dark');
    await expectThemeState('dark');

    await page.reload();
    await expectThemeState('dark');

    await chooseTheme('light');
    await expectThemeState('light');

    await page.reload();
    await expectThemeState('light');

    await chooseTheme('auto');
    await expectThemeState('light');

    await page.evaluate(() => {
      window.__setPrefersDark(true);
    });

    await expectThemeState('dark');

    await page.reload();
    await expectThemeState('dark');
  });
});