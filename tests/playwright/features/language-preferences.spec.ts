import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  fulfillWithLocalAsset,
  navigateToHome,
  openLanguageMenu,
  registerStaticAssetRoutes,
  REPO_ROOT,
} from '../utils';

const FRENCH_TEXT = {
  language: 'Langue',
  help: 'Aide',
  clearTooltip: 'Supprimer toutes les entrées ou le contenu.',
};

const ENGLISH_TEXT = {
  language: 'Language',
  help: 'Help',
};

const FALLBACK_TEST_LANGUAGE = 'de';
const HOME_PATHS = new Set(['/', '/index.php', '/elmo/', '/elmo/index.php']);

let cachedLanguagePageHtml: string | null = null;

async function loadLanguagePageHtml() {
  if (cachedLanguagePageHtml) {
    return cachedLanguagePageHtml;
  }

  const [headerTemplate, footerTemplate, settingsTemplate] = await Promise.all([
    fs.readFile(path.join(REPO_ROOT, 'header.php'), 'utf-8'),
    fs.readFile(path.join(REPO_ROOT, 'footer.html'), 'utf-8'),
    fs.readFile(path.join(REPO_ROOT, 'settings.php'), 'utf-8'),
  ]);

  const languageCodes = (await fs.readdir(path.join(REPO_ROOT, 'lang')))
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => fileName.replace(/\.json$/u, ''))
    .sort((left, right) => left.localeCompare(right));

  const languageMenuItems = languageCodes
    .map(
      (code) => `          <li><a class="dropdown-item" data-bs-language-value="${code}" data-translate="buttons.lang${code
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')}"><i class="bi bi-globe"></i> ${code.toUpperCase()}</a></li>`
    )
    .join('\n');

  let headerHtml = headerTemplate.replace(
    /<\?php foreach \(\$langCodes as \$code\): \?>[\s\S]*?<\?php endforeach; \?>/u,
    languageMenuItems,
  );

  headerHtml = headerHtml
    .replace(/<\?php[\s\S]*?\?>/gu, '')
    .replace(/<base href="[^"]*">/u, '<base href="./">');

  const maxTitlesMatch = settingsTemplate.match(/\$maxTitles\s*=\s*(\d+);/u);
  const maxTitlesValue = maxTitlesMatch ? maxTitlesMatch[1] : '2';

  let footerHtml = footerTemplate
    .replace(
      /<\?php if \(\$showFeedbackLink\): \?>[\s\S]*?<\?php endif; \?>/u,
      `          <button type="button" class="btn feedback-button multi-color-blink m-2 text-feedback" id="button-feedback-openmodalfooter"
            data-bs-toggle="modal" data-bs-target="#modal-feedback" data-translate="feedback.button"
            data-translate-tooltip="modals.feedback.buttonTooltip">
            Feedback
          </button>`,
    )
    .replace(/<\?php[\s\S]*?\?>/gu, '')
    .replace(/var maxTitles = "[^"]*";/u, `  var maxTitles = "${maxTitlesValue}";`);

  cachedLanguagePageHtml = `${headerHtml}
    <main id="main-content" class="container py-4">
      <section class="card shadow-sm">
        <div class="card-body">
          <p class="lead" data-translate="header.language">Language</p>
        </div>
      </section>
    </main>
${footerHtml}`;

  return cachedLanguagePageHtml;
}

test.describe('Language preferences', () => {
  test.beforeEach(async ({ page }) => {
    await registerStaticAssetRoutes(page);
    await page.route('**', async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      if (HOME_PATHS.has(pathname)) {
        const body = await loadLanguagePageHtml();
        await route.fulfill({
          status: 200,
          body,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
        return;
      }

      await route.fallback();
    });
    await page.route('**/lang/*.json', fulfillWithLocalAsset);
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: '[]',
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    });
    await page.route('**/settings.php?*', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ apiKey: 'test', showMslLabs: false }),
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    });
  });

  test('persists selected language across reloads', async ({ page }) => {
    await navigateToHome(page);

    const languageMenu = await openLanguageMenu(page);
    await languageMenu.locator('[data-bs-language-value="fr"]').click();

    await expect(page.locator('#bd-lang')).toContainText(FRENCH_TEXT.language);
    await expect(page.locator('#bd-help')).toContainText(FRENCH_TEXT.help);
    await expect(page.locator('#button-form-reset')).toHaveAttribute(
      'data-bs-original-title',
      new RegExp(FRENCH_TEXT.clearTooltip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );

    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('userLanguage')))
      .toBe('fr');

    await page.reload();

    await expect(page.locator('#bd-lang')).toContainText(FRENCH_TEXT.language);
    await expect(page.locator('#bd-help')).toContainText(FRENCH_TEXT.help);
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('userLanguage')))
      .toBe('fr');

    const reopenedMenu = await openLanguageMenu(page);
    await expect(reopenedMenu.locator('[data-bs-language-value="fr"]')).toHaveClass(/\bactive\b/);
    await page.locator('body').click();
  });

  test('falls back to English when a translation file is unavailable', async ({ page }) => {
    await navigateToHome(page);

    await page.route(`**/lang/${FALLBACK_TEST_LANGUAGE}.json`, async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    const languageMenu = await openLanguageMenu(page);
    await languageMenu.locator(`[data-bs-language-value="${FALLBACK_TEST_LANGUAGE}"]`).click();

    await expect(page.locator('#bd-lang')).toContainText(ENGLISH_TEXT.language);
    await expect(page.locator('#bd-help')).toContainText(ENGLISH_TEXT.help);

    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('userLanguage')))
      .toMatch(/^(en|auto)$/);

    const reopenedMenu = await openLanguageMenu(page);
    await expect(reopenedMenu.locator('[data-bs-language-value="en"]')).toHaveClass(/\bactive\b/);
    await page.locator('body').click();
  });
});