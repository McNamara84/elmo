import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { registerStaticAssetRoutes, REPO_ROOT } from '../utils';

const FIXTURE_PATH = '__changelog_fixture__';
const CHANGELOG_PATH = '**/json/changelog.json';

async function fixtureHtml(baseURL: string): Promise<string> {
  const [header, modals, footer] = await Promise.all([
    fs.readFile(path.join(REPO_ROOT, 'header.php'), 'utf8'),
    fs.readFile(path.join(REPO_ROOT, 'modals.html'), 'utf8'),
    fs.readFile(path.join(REPO_ROOT, 'footer.html'), 'utf8'),
  ]);
  const headerMarkup = header
    .slice(header.indexOf('<header '), header.indexOf('</header>') + '</header>'.length)
    .replace(/<\?php foreach \(\$langCodes as \$code\): \?>[\s\S]*?<\?php endforeach; \?>/u, '')
    .replace(/<\?php[\s\S]*?\?>/gu, '');
  const modalMarkup = modals.slice(
    modals.indexOf('<!-- About Modal -->'),
    modals.indexOf('<!-- Save As Modal -->')
  );
  const footerMarkup = footer
    .slice(footer.indexOf('<footer '), footer.indexOf('</footer>') + '</footer>'.length)
    .replace(/<\?php echo htmlspecialchars\(\$changelogVersion[\s\S]*?\?>/u, '2.2.0')
    .replace(/<\?php[\s\S]*?\?>/gu, '');
  const initScript = footer.match(/<script type="module" src="js\/changelog[^"]+\.js"><\/script>/u)?.[0];
  if (!initScript) throw new Error('Changelog initialization script is missing from footer.html');

  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><base href="${baseURL}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="css/gfz-cd.css">
  </head><body>
    ${headerMarkup}
    <main class="container my-4"><h1>ELMO</h1></main>
    ${modalMarkup}
    ${footerMarkup}
    <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
    ${initScript}
  </body></html>`;
}

test.describe('Changelog access and rendering', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const projectBase = testInfo.project.use.baseURL ?? 'http://localhost:8080/';
    const baseURL = new URL(projectBase).href.replace(/\/?$/u, '/');
    await registerStaticAssetRoutes(page);
    await page.route(`**/${FIXTURE_PATH}`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: await fixtureHtml(baseURL),
      });
    });
    await page.goto(new URL(FIXTURE_PATH, baseURL).href);
  });

  test('keeps About under Help and opens the separate changelog from the footer', async ({ page }) => {
    await page.locator('#bd-help').click();
    await page.locator('#button-about-show').click();
    const about = page.locator('#modal-about');
    await expect(about).toBeVisible();
    await expect(about.getByRole('link', { name: 'About the metadata editor' }))
      .toHaveAttribute('href', 'https://dataservices.gfz-potsdam.de/web/publish-data/publication-instructions');
    await expect(about.locator('#accordion-changelog')).toHaveCount(0);
    await about.locator('.btn-close').click();
    await expect(about).toBeHidden();

    const versionButton = page.locator('#button-changelog-show');
    await expect(versionButton).toContainText('2.2.0');
    await versionButton.click();
    const changelog = page.locator('#modal-changelog');
    await expect(changelog).toBeVisible();
    await expect(changelog.locator('.accordion-item')).toHaveCount(19);
    await expect(changelog.locator('.accordion-item').first().locator('.accordion-collapse')).toHaveClass(/show/u);
    await expect(changelog.getByText('ELMO-GEM', { exact: true }).first()).toBeVisible();
    await expect(changelog.getByRole('link', { name: 'PR #1188' }).first())
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/pull/1188');
    await expect(changelog.locator('.accordion-item').nth(1).locator('.badge')).toHaveCount(0);
  });

  test('shows a recoverable error when the JSON request fails', async ({ page }) => {
    const data = await fs.readFile(path.join(REPO_ROOT, 'json/changelog.json'), 'utf8');
    let requests = 0;
    await page.route(CHANGELOG_PATH, async route => {
      requests++;
      await route.fulfill(requests === 1
        ? { status: 503, contentType: 'text/plain', body: 'Unavailable' }
        : { status: 200, contentType: 'application/json', body: data });
    });

    await page.locator('#button-changelog-show').click();
    const changelog = page.locator('#modal-changelog');
    await expect(changelog.getByRole('alert')).toContainText('could not be loaded');
    await changelog.locator('.btn-close').click();
    await page.locator('#button-changelog-show').click();
    await expect(changelog.locator('.accordion-item')).toHaveCount(19);
    expect(requests).toBe(2);
  });

  test('keeps the version accessible in the compact mobile footer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const versionButton = page.locator('#button-changelog-show');
    await expect(versionButton).toBeVisible();
    await expect(versionButton).toHaveAccessibleName(/Changelog\s*2\.2\.0/u);
    await versionButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#modal-changelog')).toBeVisible();
    await expect(page.locator('#modal-changelog .accordion-item')).toHaveCount(19);
  });
});
