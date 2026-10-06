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
  const initScript = footer.match(/<script type="module" src="js\/changelogInit\.js[^"]*"><\/script>/u)?.[0]
    .replace(/<\?php[\s\S]*?\?>/gu, 'fixture');
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
    await expect(versionButton).toContainText('Changelog');
    await expect(versionButton).toContainText('2.2.0');
    await versionButton.click();
    const changelog = page.locator('#modal-changelog');
    await expect(changelog).toBeVisible();
    await expect(changelog.locator('.accordion-item')).toHaveCount(19);
    await expect(changelog.locator('.accordion-item').first().locator('.accordion-collapse')).toHaveClass(/show/u);
    await expect(changelog.getByText('ELMO-GEM', { exact: true }).first()).toBeVisible();
    await expect(changelog.getByRole('link', { name: 'PR #1188' }).first())
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/pull/1188');
    const latestEntries = changelog.locator('.accordion-item').first()
      .locator('.accordion-body > ul > li > ul > li');
    const doiEntry = latestEntries.filter({ hasText: 'ELMO-GEM now branches on the DOI field at submit' });
    const relatedWorkEntry = latestEntries.filter({ hasText: 'Related Work now starts empty' });
    await expect(doiEntry.getByRole('link', { name: 'Issue #1127' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/issues/1127');
    await expect(doiEntry.getByRole('link', { name: 'PR #1188' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/pull/1188');
    await expect(relatedWorkEntry.getByRole('link', { name: 'Issue #812' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/issues/812');
    await expect(relatedWorkEntry.getByRole('link', { name: 'Issue #1009' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/issues/1009');
    await expect(relatedWorkEntry.getByRole('link', { name: 'PR #1229' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/pull/1229');
    const changelogEntry = latestEntries.filter({ hasText: 'The footer version opens a separate changelog' });
    await expect(changelogEntry.getByRole('link', { name: 'Issue #807' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/issues/807');
    await expect(changelogEntry.getByRole('link', { name: 'Issue #909' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/issues/909');
    await expect(changelogEntry.getByRole('link', { name: 'Issue #1240' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/issues/1240');
    await expect(changelogEntry.getByRole('link', { name: 'PR #1246' }))
      .toHaveAttribute('href', 'https://github.com/McNamara84/elmo/pull/1246');
    const groups = await changelog.locator('.accordion-item').first()
      .locator('.accordion-body > ul > li').evaluateAll(sections => sections.map(section =>
        [...section.querySelectorAll(':scope > ul > li > .changelog-edition-badge')]
          .map(badge => badge.textContent?.trim())
      ));
    expect(groups).toEqual([
      ['All ELMOs', 'All ELMOs', 'All ELMOs', 'All ELMOs', 'All ELMOs', 'All ELMOs', 'All ELMOs',
        'All ELMOs', 'All ELMOs', 'All ELMOs', 'All ELMOs',
        'ELMO-GEM', 'ELMO-GEM', 'ELMO-GEM', 'ELMO-GEM', 'ELMO-GEM'],
      ['All ELMOs', 'All ELMOs', 'All ELMOs', 'All ELMOs', 'All ELMOs', 'All ELMOs',
        'ELMO', 'ELMO-MSL', 'ELMO-IGSN', 'ELMO-MSL', 'ELMO-GEM'],
      ['All ELMOs', 'ELMO-GEM'],
    ]);
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

  test('refreshes cached changelog data when the modal is opened again', async ({ page }) => {
    const current = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'json/changelog.json'), 'utf8'));
    const outdated = structuredClone(current);
    for (const section of outdated.releases[0].sections) {
      for (const entry of section.entries) {
        entry.references = entry.references?.filter((reference: { type: string }) => reference.type !== 'issue');
      }
    }
    let requests = 0;
    await page.route(CHANGELOG_PATH, async route => {
      requests++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'public, max-age=86400' },
        body: JSON.stringify(requests === 1 ? outdated : current),
      });
    });

    await page.locator('#button-changelog-show').click();
    const changelog = page.locator('#modal-changelog');
    await expect(changelog.getByRole('link', { name: 'PR #1188' }).first()).toBeVisible();
    await expect(changelog.getByRole('link', { name: 'Issue #1127' })).toHaveCount(0);
    await changelog.locator('.btn-close').click();
    await page.locator('#button-changelog-show').click();
    await expect(changelog.getByRole('link', { name: 'Issue #1127' }).first()).toBeVisible();
    expect(requests).toBe(2);
  });

  test('aligns all five edition badges without clipping ELMO-IGSN', async ({ page }) => {
    const data = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'json/changelog.json'), 'utf8'));
    const editions = ['all', 'elmo', 'msl', 'gem', 'igsn'];
    data.releases[0].sections[0].entries.slice(0, 5).forEach((entry: { editions: string[] }, index: number) => {
      entry.editions = [editions[index]];
    });
    await page.route(CHANGELOG_PATH, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    }));

    await page.locator('#button-changelog-show').click();
    const badges = page.locator('#modal-changelog .accordion-item').first()
      .locator('.changelog-edition-badge');
    await expect(badges).toHaveCount(29);
    const metrics = await badges.evaluateAll(nodes => nodes.slice(0, 5).map(node => ({
      label: node.textContent,
      width: node.getBoundingClientRect().width,
      fits: node.scrollWidth <= node.clientWidth,
      background: getComputedStyle(node).backgroundColor,
      foreground: getComputedStyle(node).color,
    })));
    expect(metrics.map(metric => metric.label)).toEqual([
      'All ELMOs', 'ELMO', 'ELMO-MSL', 'ELMO-GEM', 'ELMO-IGSN'
    ]);
    expect(metrics.every(metric => metric.fits)).toBe(true);
    expect(Math.max(...metrics.map(metric => metric.width)) - Math.min(...metrics.map(metric => metric.width)))
      .toBeLessThan(1);
    expect(metrics.map(({ background, foreground }) => [background, foreground])).toEqual([
      ['rgb(0, 40, 100)', 'rgb(255, 255, 255)'],
      ['rgb(0, 40, 100)', 'rgb(255, 255, 255)'],
      ['rgb(61, 156, 82)', 'rgb(0, 0, 0)'],
      ['rgb(0, 98, 163)', 'rgb(255, 255, 255)'],
      ['rgb(0, 0, 0)', 'rgb(255, 255, 255)'],
    ]);
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

  test('shows the version at the same text size as the neighboring footer links', async ({ page }) => {
    const version = page.locator('#button-changelog-show');
    const guide = page.locator('#buttonHelp');
    const fontSize = async () => page.evaluate(() => ({
      version: getComputedStyle(document.querySelector('#button-changelog-show')!).fontSize,
      guide: getComputedStyle(document.querySelector('#buttonHelp')!).fontSize,
    }));

    await expect(version).toBeVisible();
    await expect(guide).toBeVisible();
    expect(await fontSize()).toEqual({ version: '20px', guide: '20px' });

    await page.setViewportSize({ width: 375, height: 812 });
    expect(await fontSize()).toEqual({ version: '20px', guide: '20px' });
  });

  test('opens both dialogs without browser console warnings or errors', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));

    await page.reload();
    await page.locator('#bd-help').click();
    await page.locator('#button-about-show').click();
    await expect(page.locator('#modal-about')).toBeVisible();
    await page.locator('#modal-about .btn-close').click();
    await page.locator('#button-changelog-show').click();
    await expect(page.locator('#modal-changelog .accordion-item')).toHaveCount(19);
    expect(problems).toEqual([]);
  });
});
