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
  const [authors, contributors, translations, modals] = await Promise.all([
    readFile(path.join(REPO_ROOT, 'formgroups/authors.html'), 'utf8'),
    readFile(path.join(REPO_ROOT, 'formgroups/contributors.html'), 'utf8'),
    readFile(path.join(REPO_ROOT, `lang/${language}.json`), 'utf8'),
    readFile(path.join(REPO_ROOT, 'modals.html'), 'utf8'),
  ]);
  const markup = (authors + contributors).replace(/<\?php[\s\S]*?\?>/gu, '');
  const orcidModal = modals.slice(modals.indexOf('<!-- ORCID Search Modal -->'), modals.indexOf('<!-- Feedback Modal -->', modals.indexOf('<!-- ORCID Search Modal -->')));
  const html = `<!doctype html><html lang="${language}" data-help-status="help-on"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <base href="${baseURL.href}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.css">
    <link rel="stylesheet" href="node_modules/@yaireo/tagify/dist/tagify.css">
    <link rel="stylesheet" href="css/gfz-cd.css">
    <link rel="stylesheet" href="css/tagify-adj.css">
    <link rel="stylesheet" href="css/darkmode.css">
  </head><body>${markup}${orcidModal}
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
  return baseURL;
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
      // Firefox input.clientWidth excludes the padding; measure the visible border box instead.
      available: bounds.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
        - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
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

async function expectControlsFit(card: Locator) {
  await expect(card.locator('.orcid-search-btn')).toBeVisible();
  // Capture all rectangles together; focus can still be smoothly scrolling the page.
  const { bounds, controls } = await card.evaluate(element => ({
    bounds: element.getBoundingClientRect().toJSON(),
    controls: Array.from(element.querySelectorAll('.person-orcid-field input[type="text"], .person-orcid-field .orcid-search-btn, .person-orcid-field .input-group-text, [data-author-contact-toggle]'))
      .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
      .map(node => ({ ...node.getBoundingClientRect().toJSON(), label: node.outerHTML.slice(0, 160) })),
  }));
  for (const [index, box] of controls.entries()) {
    expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    for (const other of controls.slice(0, index)) {
      const overlapX = Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
      const overlapY = Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
      // Adjacent Bootstrap controls share a 1px border; allow fractional rounding.
      expect(Math.min(overlapX, overlapY), JSON.stringify({ box, other, overlapX, overlapY })).toBeLessThanOrEqual(1.1);
    }
  }
}

test('balances both names on wide cards and wraps them below ORCID on narrow cards', async ({ page }, testInfo) => {
  await openFixture(page, testInfo);
  for (const width of [1920, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const card of await page.locator('[data-author-card], [data-contributor-card]').all()) {
      const orcid = (await card.locator('.person-orcid-field').boundingBox())!;
      const names = await card.locator('.person-name-field').all();
      const family = (await names[0].boundingBox())!;
      const given = (await names[1].boundingBox())!;
      expect(Math.abs(family.width - given.width)).toBeLessThanOrEqual(1);
      if (width === 1920) {
        expect(Math.abs(orcid.y - family.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(family.y - given.y)).toBeLessThanOrEqual(1);
      } else {
        expect(family.y).toBeGreaterThanOrEqual(orcid.y + orcid.height - 1);
        expect(given.y).toBeGreaterThanOrEqual(family.y + family.height - 1);
      }
      await expectControlsFit(card);
    }
    await expectNoPageOverflow(page);
  }
});

test('keeps identifiers and controls readable with validation, contacts and help changes', async ({ page }, testInfo) => {
  await openFixture(page, testInfo, 'fr');
  const author = page.locator('[data-author-card]').first();
  const contributor = page.locator('[data-contributor-card]').first();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [value, state] of [['', ''], ['0000-0002-1825-0098', 'is-invalid'], ['0000-0002-1825-0097', 'is-valid'], [ORCID, 'is-valid']]) {
      for (const input of orcidInputs(page)) {
        await input.fill(value);
        await input.blur();
        if (state) await expect(input).toHaveClass(new RegExp(state));
        else await expect(input).not.toHaveClass(/is-valid|is-invalid/);
        await expectIdentifierFits(input);
      }
      for (const card of [author, contributor]) await expectControlsFit(card);
      await expectNoPageOverflow(page);
    }
  }
  await author.locator('[data-author-contact-toggle]').click();
  await expect(author.locator('[name="cpEmail[]"]')).toBeVisible();
  await contributor.locator('[name="cbPersonRoles[]"]').evaluate((element: any) => element._tagify.addTags(['Contact Person']));
  await expect(contributor.locator('[name="cbContactEmail[]"]')).toBeVisible();
  for (const status of ['help-off', 'help-on']) {
    await page.evaluate(value => {
      localStorage.setItem('helpStatus', value);
      document.documentElement.dataset.helpStatus = value;
      document.dispatchEvent(new CustomEvent('helpStatus:changed'));
    }, status);
    for (const card of [author, contributor]) {
      const help = card.locator('.person-orcid-field i[data-help-section-id]');
      if (status === 'help-on') await expect(help).toBeVisible();
      else await expect(help).toBeHidden();
      await expectControlsFit(card);
    }
    for (const input of orcidInputs(page)) await expectIdentifierFits(input);
    await expectNoPageOverflow(page);
  }
});

test('preserves the layout for additional, restored and reopened person cards', async ({ page }, testInfo) => {
  await openFixture(page, testInfo, 'de');
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.locator('[data-author-add-type="person"]').click();
  await page.locator('[data-contributor-add-type="person"]').click();
  for (const group of ['author', 'contributor']) {
    const cards = page.locator(`[data-${group}-card]`);
    await expect(cards).toHaveCount(2);
    for (const card of await cards.all()) {
      await card.locator('input[name="orcids[]"], input[name="cbORCID[]"]').fill(ORCID);
      await card.locator('input[name="orcids[]"], input[name="cbORCID[]"]').blur();
    }
    await expect(cards.first().locator('.person-orcid-field i[data-help-section-id]')).toBeVisible();
    await expect(cards.last().locator('.person-orcid-field i[data-help-section-id]')).toBeHidden();
  }
  await page.evaluate(() => {
    const authorStack = (window as any).authorStack;
    const contributorStack = (window as any).contributorStack;
    authorStack.setAuthors(authorStack.collectPayload());
    contributorStack.setContributors(contributorStack.collectPayload());
  });
  for (const group of ['author', 'contributor']) {
    const cards = page.locator(`[data-${group}-card]`);
    for (const card of await cards.all()) {
      const toggle = card.locator(`[data-${group}-toggle-edit]`);
      const input = card.locator('input[name="orcids[]"], input[name="cbORCID[]"]');
      await toggle.click();
      await expect(input).toBeHidden();
      await toggle.click();
      await expect(input).toHaveValue(ORCID);
      await input.focus();
      await input.blur();
      await expectIdentifierFits(input);
      await expectControlsFit(card);
    }
    await cards.first().locator(`[data-${group}-remove]`).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator('.person-orcid-field i[data-help-section-id]')).toBeVisible();
  }
  await expectNoPageOverflow(page);
});

test('opens ORCID search for the correct card on narrow screens', async ({ page }, testInfo) => {
  const baseURL = await openFixture(page, testInfo, 'fr');
  await page.addScriptTag({ url: new URL('js/orcidSearch.js', baseURL).href });
  await page.setViewportSize({ width: 375, height: 1000 });
  const modal = page.locator('#modal-orcid-search');
  for (const group of ['author', 'contributor']) {
    await page.locator(`[data-${group}-card] .orcid-search-btn`).click();
    await expect(modal).toBeVisible();
    await expect(page.locator('#orcid-search-context-group')).toHaveValue(group);
    await expect(page.locator('#orcid-search-context-row-index')).toHaveValue('0');
    await modal.locator('.btn-close').click();
    await expect(modal).toBeHidden();
  }
  await expectNoPageOverflow(page);
});

test('retains readable person fields after switching from institution and back', async ({ page }, testInfo) => {
  await openFixture(page, testInfo);
  for (const group of ['author', 'contributor']) {
    const card = page.locator(`[data-${group}-card]`);
    await card.locator('input[name="familynames[]"], input[name="cbPersonLastname[]"]').fill('');
    await card.locator('input[name="givennames[]"], input[name="cbPersonFirstname[]"]').fill('');
    for (const type of ['institution', 'person']) {
      await expect(page.locator(`[data-${group}-type-option="${type}"]`)).toBeEnabled();
      await page.locator(`[data-${group}-type-option="${type}"]`).click();
      await expect(page.locator(`[data-${group}-card]`)).toHaveCount(1);
    }
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  for (const input of orcidInputs(page)) {
    await input.fill(ORCID);
    await input.blur();
    await expectIdentifierFits(input);
    await expect(input.locator('..').locator('label')).toHaveAttribute('for', (await input.getAttribute('id'))!);
  }
  await expectNoPageOverflow(page);
});

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
