import { test, expect, type Locator } from '@playwright/test';
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { registerStaticAssetRoutes, REPO_ROOT } from '../utils';

const FIXTURE_PATH = '__changelog_fixture__';
const CHANGELOG_PATH = '**/json/changelog.json';
const EDITION_LABELS: Record<string, string> = {
  all: 'All ELMOs',
  elmo: 'ELMO',
  msl: 'ELMO-MSL',
  gem: 'ELMO-GEM',
  igsn: 'ELMO-IGSN',
};

type ChangelogReference = { type: 'issue' | 'pull'; number: number };
type ChangelogEntry = {
  parts?: { value: string }[];
  editions?: string[];
  references?: ChangelogReference[];
};
type ChangelogRelease = {
  version: string;
  sections: { entries: ChangelogEntry[] }[];
};
type ChangelogData = {
  currentVersion: string;
  releases: ChangelogRelease[];
};

const changelogData = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'json/changelog.json'), 'utf8')
) as ChangelogData;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const REPOSITORY_URL = 'https://github.com/McNamara84/elmo';

function editionGroups(release: ChangelogRelease): string[][] {
  return release.sections.map(section =>
    section.entries.flatMap(entry => (entry.editions ?? []).map(edition => EDITION_LABELS[edition]))
  );
}

function entryText(entry: ChangelogEntry): string {
  return (entry.parts ?? []).map(part => part.value).join('');
}

function releaseByVersion(version: string): ChangelogRelease {
  const release = changelogData.releases.find(item => item.version === version);
  if (!release) throw new Error(`Changelog release ${version} is missing`);
  return release;
}

async function expectEntryLinks(rows: Locator, release: ChangelogRelease, textPrefix: string) {
  const references = release.sections
    .flatMap(section => section.entries)
    .find(entry => entryText(entry).startsWith(textPrefix))?.references ?? [];
  expect(references.length, `${release.version} entry "${textPrefix}"`).toBeGreaterThan(0);
  const row = rows.filter({ hasText: textPrefix });
  for (const reference of references) {
    const label = `${reference.type === 'issue' ? 'Issue' : 'PR'} #${reference.number}`;
    const kind = reference.type === 'issue' ? 'issues' : 'pull';
    await expect(row.getByRole('link', { name: label, exact: true }))
      .toHaveAttribute('href', `${REPOSITORY_URL}/${kind}/${reference.number}`);
  }
}

async function expectEditionGroups(releaseRoot: Locator, release: ChangelogRelease) {
  const groups = await releaseRoot.locator('.accordion-body > ul > li').evaluateAll(sections => sections.map(section =>
    [...section.querySelectorAll(':scope > ul > li > .changelog-edition-badge')]
      .map(badge => badge.textContent?.trim())
  ));
  expect(groups).toEqual(editionGroups(release));
}

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
    .replace(/<\?php echo htmlspecialchars\(\$changelogVersion[\s\S]*?\?>/u, changelogData.currentVersion)
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
    await expect(versionButton).toContainText(changelogData.currentVersion);
    await versionButton.click();
    const changelog = page.locator('#modal-changelog');
    await expect(changelog).toBeVisible();
    await expect(changelog.locator('.accordion-item')).toHaveCount(changelogData.releases.length);
    await expect(changelog.locator('.accordion-item').first().locator('.accordion-collapse')).toHaveClass(/show/u);

    const release221 = releaseByVersion('2.2.1');
    const previousRelease = changelog.locator('.accordion-item').filter({
      has: page.getByRole('button', { name: /^Version 2\.2\.1 -/u }),
    });
    await previousRelease.locator('.accordion-button').click();
    const previousEntries = previousRelease.locator('.accordion-body > ul > li > ul > li');
    await expectEntryLinks(previousEntries, release221, 'Reusing metadata from a DOI now marks');
    await expectEntryLinks(previousEntries, release221, 'ORCID, ROR, and DOI logos');
    await expectEditionGroups(previousRelease, release221);

    const release220 = releaseByVersion('2.2.0');
    const migratedRelease = changelog.locator('.accordion-item').filter({
      has: page.getByRole('button', { name: /^Version 2\.2\.0 -/u }),
    });
    await migratedRelease.locator('.accordion-button').click();
    await expect(changelog.getByText('ELMO-GEM', { exact: true }).first()).toBeVisible();
    const releaseEntries = migratedRelease.locator('.accordion-body > ul > li > ul > li');
    await expectEntryLinks(releaseEntries, release220, 'ELMO-GEM submissions without a DOI');
    await expectEntryLinks(releaseEntries, release220, 'Related Work now starts empty');
    await expectEntryLinks(releaseEntries, release220, 'The footer version opens a separate changelog');
    await expectEditionGroups(migratedRelease, release220);
    const historicalRelease = changelog.locator('.accordion-item').filter({
      has: page.getByRole('button', { name: /^Version 2\.1\.2 -/u }),
    });
    await expect(historicalRelease.locator('.badge')).toHaveCount(0);
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
    await expect(changelog.locator('.accordion-item')).toHaveCount(changelogData.releases.length);
    expect(requests).toBe(2);
  });

  test('refreshes cached changelog data when the modal is opened again', async ({ page }) => {
    const current = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'json/changelog.json'), 'utf8'));
    const marker = { type: 'issue', number: 987654 };
    const currentEntry = current.releases[0].sections[0].entries[0];
    currentEntry.references = [
      ...(currentEntry.references ?? []).filter((reference: ChangelogReference) => reference.number !== marker.number),
      marker,
    ];
    const outdated = structuredClone(current);
    const outdatedEntry = outdated.releases[0].sections[0].entries[0];
    outdatedEntry.references = outdatedEntry.references.filter((reference: ChangelogReference) => reference.number !== marker.number);
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
    await expect(changelog.locator('.accordion-item').first().locator('.accordion-collapse')).toBeVisible();
    await expect(changelog.getByRole('link', { name: `Issue #${marker.number}`, exact: true })).toHaveCount(0);
    await changelog.locator('.btn-close').click();
    await page.locator('#button-changelog-show').click();
    await expect(changelog.getByRole('link', { name: `Issue #${marker.number}`, exact: true }).first()).toBeVisible();
    expect(requests).toBe(2);
  });

  test('aligns all five edition badges without clipping ELMO-IGSN', async ({ page }) => {
    const data = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'json/changelog.json'), 'utf8'));
    const editions = ['all', 'elmo', 'msl', 'gem', 'igsn'];
    const template = data.releases[0].sections[0].entries[0];
    data.releases[0].sections[0].entries = editions.map(edition => ({
      ...template, editions: [edition],
    }));
    await page.route(CHANGELOG_PATH, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    }));

    await page.locator('#button-changelog-show').click();
    const badges = page.locator('#modal-changelog .accordion-item').first()
      .locator('.changelog-edition-badge');
    const badgeCount = data.releases[0].sections
      .flatMap((section: { entries: { editions: string[] }[] }) => section.entries)
      .reduce((count: number, entry: { editions: string[] }) => count + entry.editions.length, 0);
    await expect(badges).toHaveCount(badgeCount);
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
    await expect(versionButton).toHaveAccessibleName(
      new RegExp(`Changelog\\s*${escapeRegExp(changelogData.currentVersion)}`, 'u')
    );
    await versionButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#modal-changelog')).toBeVisible();
    await expect(page.locator('#modal-changelog .accordion-item')).toHaveCount(changelogData.releases.length);
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
    await expect(page.locator('#modal-changelog .accordion-item')).toHaveCount(changelogData.releases.length);
    expect(problems).toEqual([]);
  });
});
