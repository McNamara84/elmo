import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../utils/constants';

const FIXTURE_PATH = '__orcid_layout_fixture__';
const ORCID = '0000-0003-2450-824X';
const WIDTHS = [1440, 1280, 1024, 992, 991, 768, 576, 375, 320, 1920];
const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml',
};

async function openFixture(page: Page, testInfo: TestInfo, language = 'en') {
  const baseURL = new URL(testInfo.project.use.baseURL ?? 'http://localhost:8080/');
  baseURL.pathname = baseURL.pathname.replace(/\/?$/u, '/');
  const [authors, contributors, translations] = await Promise.all([
    readFile(path.join(REPO_ROOT, 'formgroups/authors.html'), 'utf8'),
    readFile(path.join(REPO_ROOT, 'formgroups/contributors.html'), 'utf8'),
    readFile(path.join(REPO_ROOT, `lang/${language}.json`), 'utf8'),
  ]);
  const markup = (authors + contributors).replace(/<\?php[\s\S]*?\?>/gu, '');
  const html = `<!doctype html><html lang="${language}" data-help-status="help-on"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <base href="${baseURL.href}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.css">
    <link rel="stylesheet" href="node_modules/@yaireo/tagify/dist/tagify.css">
    <link rel="stylesheet" href="css/gfz-cd.css">
    <link rel="stylesheet" href="css/tagify-adj.css">
    <link rel="stylesheet" href="css/darkmode.css">
  </head><body>${markup}
    <script src="node_modules/jquery/dist/jquery.min.js"></script>
    <script src="node_modules/jquery-ui/dist/jquery-ui.min.js"></script>
    <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
    <script src="node_modules/@yaireo/tagify/dist/tagify.js"></script>
    <script>
      window.translations = ${translations};
      window.currentTranslations = window.translations;
      window.elmo = { translate: key => key.split('.').reduce((value, part) => value?.[part], window.translations) };
      window.ELMO_FEATURES = { showAuthorInstitution: true, showContactInstitution: false };
      localStorage.setItem('helpStatus', 'help-on');
    </script>
    <script src="js/roles.js"></script>
    <script src="js/validation/orcidValidation.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/authorStack.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/contributorStack.js"></script>
  </body></html>`;

  // Serve the production assets under each project's origin and path prefix.
  await page.route(`${baseURL.href}**`, async route => {
    const url = new URL(route.request().url());
    const relativePath = decodeURIComponent(url.pathname.slice(baseURL.pathname.length));
    if (relativePath === FIXTURE_PATH) {
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      return;
    }
    if (relativePath.startsWith('api/')) {
      await route.fulfill({ json: [{ name: 'Researcher' }, { name: 'Contact Person' }] });
      return;
    }
    const filePath = path.resolve(REPO_ROOT, relativePath);
    if (!filePath.startsWith(`${REPO_ROOT}${path.sep}`)) {
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      body: await readFile(filePath),
    });
  });
  await page.goto(new URL(FIXTURE_PATH, baseURL).href);
  await page.waitForFunction(() => Boolean((window as any).authorStack && (window as any).contributorStack));
  await page.evaluate(() => {
    const entry = { type: 'person', familyname: 'Kreuz', givenname: 'Angela', affiliations: [] };
    (window as any).authorStack.setAuthors([entry]);
    (window as any).contributorStack.setContributors([{ ...entry, roles: [] }]);
  });
  await page.waitForFunction(() => Boolean((document.querySelector('[name="cbPersonRoles[]"]') as any)?._tagify));
  await page.evaluate(() => document.fonts.ready);
}

function orcidInputs(page: Page) {
  return [
    page.locator('[data-author-card] input[name="orcids[]"]').first(),
    page.locator('[data-contributor-card] input[name="cbORCID[]"]').first(),
  ];
}

async function expectIdentifierFits(input: Locator) {
  await expect(input).toBeVisible();
  const metrics = await input.evaluate((element: HTMLInputElement) => {
    const style = getComputedStyle(element);
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const bounds = element.getBoundingClientRect();
    const card = element.closest('[data-author-card], [data-contributor-card]')!.getBoundingClientRect();
    return {
      name: element.name,
      available: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      required: context.measureText(element.value).width,
      fontSize: parseFloat(style.fontSize),
      contained: bounds.left >= card.left && bounds.right <= card.right,
    };
  });
  expect(metrics.available, JSON.stringify(metrics)).toBeGreaterThanOrEqual(metrics.required - 0.5);
  expect(metrics.fontSize).toBe(16);
  expect(metrics.contained).toBe(true);
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'The form must fit within the viewport').toBeLessThanOrEqual(1);
}

for (const language of ['en', 'de', 'fr']) {
  test(`shows complete validated ORCIDs at every supported width (${language})`, async ({ page }, testInfo) => {
    await openFixture(page, testInfo, language);
    const inputs = orcidInputs(page);
    for (const input of inputs) {
      await input.fill(ORCID);
      await input.blur();
      await expect(input).toHaveClass(/is-valid/);
    }
    for (const width of WIDTHS) {
      await test.step(`${width}px`, async () => {
        await page.setViewportSize({ width, height: 1000 });
        for (const input of inputs) await expectIdentifierFits(input);
        await expectNoPageOverflow(page);
      });
    }
  });
}
