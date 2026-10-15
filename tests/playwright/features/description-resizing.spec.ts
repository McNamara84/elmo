import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { registerStaticAssetRoutes, REPO_ROOT } from '../utils';

const test = base.extend<{ checkBrowserConsole: void }>({
  checkBrowserConsole: [async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));

    // Capture problems from the initial navigation through the last resize.
    await use();
    expect(problems, 'Description fields must not cause browser warnings or errors').toEqual([]);
  }, { auto: true }],
});

const DESCRIPTION_TYPES = [
  { id: 1, name: 'Abstract', slug: 'Abstract' },
  { id: 2, name: 'Methods', slug: 'Methods' },
  { id: 3, name: 'Technical Information', slug: 'TechnicalInfo' },
  { id: 4, name: 'Other', slug: 'Other' },
  { id: 5, name: 'Series Information', slug: 'SeriesInformation' },
  { id: 6, name: 'Table of Contents', slug: 'TableOfContents' },
];

// Standard, MSL and IGSN share the first template and its dynamic descriptions.
const LAYOUTS = [
  {
    name: 'standard',
    template: 'formgroups/descriptions.html',
    gem: false,
    fields: ['input-abstract', ...DESCRIPTION_TYPES.slice(1).map(type => `input-description-${type.slug}`)],
  },
  {
    name: 'GEM',
    template: 'formgroups/GGMsDescriptions.html',
    gem: true,
    fields: [
      'input-abstract', 'input-general-model-description', 'input-input-data',
      'input-processing-procedures', 'input-specific-features', 'input-other',
    ],
  },
];

async function dragResize(page: Page, field: Locator, deltaX: number, deltaY: number) {
  await field.scrollIntoViewIfNeeded();
  const box = await field.boundingBox();
  if (!box) throw new Error('The description field is not visible');
  // Start just inside the bottom-right corner to grab the native resize handle.
  const x = box.x + box.width - 5;
  const y = box.y + box.height - 5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 12 });
  await page.mouse.up();
}

async function dimensions(field: Locator) {
  return field.evaluate(element => ({
    height: element.getBoundingClientRect().height,
    width: element.getBoundingClientRect().width,
  }));
}

for (const layout of LAYOUTS) {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    test.describe(`${layout.name} descriptions at ${viewport.width}px`, () => {
      test.use({ viewport });

      test.beforeEach(async ({ page, baseURL }) => {
        await registerStaticAssetRoutes(page);
        await page.route('**/api/v2/vocabs/descriptiontypes', route => route.fulfill({
          json: DESCRIPTION_TYPES,
        }));
        const template = await fs.readFile(path.join(REPO_ROOT, layout.template), 'utf8');
        const fixtureURL = new URL('__description_resizing_fixture__', baseURL ?? 'http://localhost:8080/');
        await page.route('**/__description_resizing_fixture__', route => route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: `<!doctype html><html lang="en"><head>
            <meta charset="utf-8"><base href="${new URL('./', fixtureURL).href}">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
            <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.min.css">
            <link rel="stylesheet" href="css/gfz-cd.css">
            <link rel="stylesheet" href="css/tagify-adj.css">
            <link rel="stylesheet" href="css/darkmode.css">
          </head><body>
            <main class="container-fluid p-2"><form id="form-mde">${template}</form>
              <p id="following-content">Following form content</p>
            </main>
            <script>window.ELMO_FEATURES = { showGGMsProperties: ${layout.gem} };</script>
            <script src="node_modules/jquery/dist/jquery.min.js"></script>
            <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
            <script src="js/descriptionTypes.js"></script>
            <script>$(function () {
              window.descriptionTypesReady.then(function () {
                document.documentElement.dataset.descriptionsReady = 'true';
              });
            });</script>
          </body></html>`,
        }));
        await page.goto(fixtureURL.href);
        await expect(page.locator('html')).toHaveAttribute('data-descriptions-ready', 'true');
        await expect(page.locator('#accordion-description textarea')).toHaveCount(layout.fields.length);
      });

      for (const id of layout.fields) {
        test(`${id} supports manual vertical resizing without changing its content`, async ({ page }) => {
          const field = page.locator(`#${id}`);
          const item = field.locator('xpath=ancestor::div[contains(@class,"accordion-item")]');
          const button = item.locator('.accordion-button');
          const panel = item.locator('.accordion-collapse');
          if (await button.getAttribute('aria-expanded') === 'false') await button.click();
          await expect(panel).toHaveClass(/\bshow\b/);
          await expect(field).toBeVisible();
          const initial = await dimensions(field);
          expect(initial.height).toBeCloseTo(100, 0);
          await expect(field).toHaveCSS('resize', 'vertical');

          const text = Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1}: A long dataset description.`).join('\n\n');
          await field.fill(text);
          expect(await dimensions(field)).toEqual(initial);
          expect(await field.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);

          // A diagonal drag also verifies that the responsive width stays fixed.
          await dragResize(page, field, 40, 140);
          const grown = await dimensions(field);
          expect(grown.height).toBeGreaterThan(initial.height + 100);
          expect(grown.width).toBeCloseTo(initial.width, 0);
          await field.press('ControlOrMeta+End');
          await field.press('Enter');
          await field.pressSequentially('Another paragraph.');
          const edited = `${text}\nAnother paragraph.`;
          await expect(field).toHaveValue(edited);
          expect(await dimensions(field)).toEqual(grown);

          await button.click();
          await expect(panel).toBeHidden();
          await button.click();
          await expect(panel).toHaveClass(/\bshow\b/);
          expect(await dimensions(field)).toEqual(grown);

          await dragResize(page, field, 0, -170);
          const shrunk = await dimensions(field);
          expect(shrunk.height).toBeLessThan(initial.height - 10);
          expect(shrunk.width).toBeCloseTo(initial.width, 0);
          await dragResize(page, field, 0, -80);
          const minimum = await dimensions(field);
          const minHeight = await field.evaluate(element => parseFloat(getComputedStyle(element).minHeight));
          expect(minimum.height).toBeGreaterThanOrEqual(minHeight - 1);
          expect(minimum.height).toBeLessThan(initial.height);
          expect(await field.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
          await expect(field).toHaveValue(edited);
          expect(await field.evaluate(element => {
            const textarea = element as HTMLTextAreaElement;
            return new FormData(textarea.form!).get(textarea.name);
          })).toBe(edited);

          const help = item.locator('.input-group-text');
          await expect(help).toBeVisible();
          const fieldBox = await field.boundingBox();
          const helpBox = await help.boundingBox();
          const followingBox = await page.locator('#following-content').boundingBox();
          expect(helpBox!.x).toBeGreaterThanOrEqual(fieldBox!.x + fieldBox!.width - 1);
          expect(followingBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        });
      }
    });
  }
}
