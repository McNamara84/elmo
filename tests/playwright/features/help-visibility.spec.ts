import { test, expect, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { registerStaticAssetRoutes, REPO_ROOT } from '../utils';

const HELP = '[data-help-section-id], [data-contextual-help], .help-placeholder';
const TYPES = [
  { id: 1, name: 'Abstract', slug: 'Abstract' },
  { id: 2, name: 'Methods', slug: 'Methods' },
  { id: 99, name: 'Custom description', slug: 'CustomDescription' },
];

// Use production templates, styles, modules and widgets with deterministic APIs.
// This suite needs no PHP server or changes to the user's settings.php.
async function mount(page: Page, baseURL: string | undefined, edition = 'generic', delayed = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const gem = edition === 'gem';
  const msl = edition === 'msl';
  const files = [
    'header.php', 'footer.html', 'modals.html', 'formgroups/resource-information.html',
    'formgroups/authors.html', 'formgroups/contributors.html', 'formgroups/relatedwork.html',
    'formgroups/thesaurus-keywords.html',
    gem ? 'formgroups/GGMsDescriptions.html' : 'formgroups/descriptions.html',
    ...(msl ? ['formgroups/originatingLaboratory.html'] : []),
    ...(gem ? ['formgroups/ggms-definition.html', 'formgroups/ggms-properties.html', 'formgroups/ggms-data-sources.html'] : []),
  ];
  const [header, footer, modals, ...groups] = await Promise.all(files.map(file => fs.readFile(path.join(REPO_ROOT, file), 'utf8')));
  const clean = (html: string) => html.replace(/<\?php[\s\S]*?\?>/gu, '');
  const headerMarkup = clean(header.slice(header.indexOf('<header '), header.indexOf('</header>') + 9)
    .replace(/<\?php foreach \(\$langCodes as \$code\): \?>[\s\S]*?<\?php endforeach; \?>/u, ''));
  const footerMarkup = clean(footer.slice(footer.indexOf('<footer '), footer.indexOf('</footer>') + 9));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  if (!delayed) release();
  await registerStaticAssetRoutes(page);
  await page.route('**/api/v2/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/descriptiontypes') || pathname.endsWith('/availability')) await pending;
    const data = pathname.endsWith('/descriptiontypes') ? TYPES
      : pathname.endsWith('/availability') ? { science_keywords: { available: true, displayName: 'Science keywords' } }
      : pathname.endsWith('/msl-laboratories') ? { data: [{ display_name: 'Test laboratory', scientific_domain: 'Geology' }] }
      : [];
    await route.fulfill({ json: data });
  });
  await page.route('**/doc/help.php', route => route.fulfill({
    contentType: 'text/html', body: '<section id="help-resourceinformation-fg">Resource Information help</section>',
  }));
  const url = new URL('__help_visibility_fixture__', baseURL ?? 'http://localhost:8080/');
  await page.route('**/__help_visibility_fixture__', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <base href="${new URL('./', url).href}"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
      <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.min.css">
      <link rel="stylesheet" href="node_modules/@yaireo/tagify/dist/tagify.css">
      <link rel="stylesheet" href="css/gfz-cd.css"><link rel="stylesheet" href="css/tagify-adj.css">
    </head><body>${headerMarkup}${groups.map(clean).join('\n')}</form></main>${clean(modals)}${footerMarkup}
      <span class="input-group-text" id="unit-addon">m</span>
      <script>window.ELMO_FEATURES = { showGGMsProperties: ${gem}, showMslLabs: ${msl}, showThesauri: true };
        window.translations = { general: {}, keywords: {} }; window.maxTitles = 4;
        window.titleTypeOptionsHtml = '<option value="2">Alternative Title</option>';
        // Supply the identifier vocabulary normally loaded by select.js.
        document.querySelectorAll('select[name="dIdentifierType[]"]').forEach(select => select.add(new Option('DOI', 'DOI')));</script>
      <script src="node_modules/jquery/dist/jquery.min.js"></script>
      <script src="node_modules/jquery-ui/dist/jquery-ui.min.js"></script>
      <script src="node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
      <script src="node_modules/@yaireo/tagify/dist/tagify.js"></script>
      <script src="node_modules/jstree/dist/jstree.min.js"></script>
      <script type="module" src="js/help.js"></script>
      <script type="module" src="js/eventhandlers/formgroups/authorStack.js"></script>
      <script src="js/eventhandlers/formgroups/contributorStack.js"></script>
      <script type="module" src="js/eventhandlers/formgroups/relatedwork.js"></script>
      <script type="module" src="js/eventhandlers/formgroups/resourceInformationTitle.js"></script>
      <script type="module" src="js/thesauri.js"></script>
      <script type="module" src="js/eventhandlers/formgroups/ggmsDatasources.js"></script>
      <script src="js/originatingLaboratories.js"></script>
      <script src="js/services/doiLookupService.js"></script>
      <script src="js/eventhandlers/doiPrefillHandler.js"></script>
      <script src="js/descriptionTypes.js"></script>
    </body></html>`,
  }));
  await page.goto(url.href);
  await expect(page.locator('html')).toHaveAttribute('data-help-status', /help-(on|off)/u);
  await page.waitForFunction(() => Boolean((window as any).authorStack && (window as any).relatedWorkStack));
  return { release, errors };
}

async function toggle(page: Page, on: boolean) {
  if (await page.locator('.navbar-toggler').isVisible() && !(await page.locator('#bd-help').isVisible())) {
    await page.locator('.navbar-toggler').click();
  }
  await page.locator('#bd-help').click();
  await page.locator(on ? '#buttonHelpOn' : '#buttonHelpOff').click();
  await expect(page.locator('html')).toHaveAttribute('data-help-status', on ? 'help-on' : 'help-off');
}

async function expectAllHelpHidden(page: Page) {
  // Inspect every match, including wrappers. Unlike counting :visible alone,
  // this fails if all semantic help markers accidentally disappear from the DOM.
  const help = page.locator(HELP);
  expect(await help.count()).toBeGreaterThan(15);
  for (const element of await help.all()) await expect(element).toBeHidden();
  await expect(page.locator('.input-group-text:has([data-help-section-id])').first()).toBeHidden();
  await expect(page.locator('#unit-addon')).toBeVisible();
  await expect(page.locator('#button-resourceinformation-edit-doi')).toBeVisible();
}

for (const edition of ['generic', 'msl', 'igsn', 'gem']) {
  for (const width of [1280, 375]) {
    test(`${edition} at ${width}px hides static and late help, preserves actions and restores eligible help`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 900 });
      const { release, errors } = await mount(page, baseURL, edition, true);
      const sectionHelp = page.locator('i[data-help-section-id="help-resourceinformation-fg"]');
      await expect(sectionHelp).toBeVisible();
      await toggle(page, false);
      release();
      await page.waitForFunction(() => Boolean((window as any).descriptionTypesReady && (window as any).thesauriReady));
      await page.evaluate(async () => { await (window as any).descriptionTypesReady; await (window as any).thesauriReady; });
      await page.locator('#button-resourceinformation-addtitle').click();
      await page.evaluate(() => {
        const app = window as any;
        app.authorStack.addPerson();
        app.contributorStack.addPerson();
        app.relatedWorkStack.setRelatedWorks([
          { entryKey: 'one', identifier: 'first', identifierType: 'DOI' },
          { entryKey: 'two', identifier: 'second', identifierType: 'URL' },
        ]);
      });
      if (edition === 'msl') await page.locator('#button-originatinglaboratory-add').click();
      if (edition === 'gem') {
        await page.locator('select[name="datasource_type[]"]').first().selectOption('M');
      } else {
        await page.locator('[data-description-slug="Methods"] .accordion-button').click();
        await expect(page.locator('#input-description-Methods')).toBeVisible();
        await page.locator('[data-description-slug="CustomDescription"] .accordion-button').click();
        await expect(page.locator('[data-description-slug="CustomDescription"] [data-contextual-help]')).toBeHidden();
      }
      await expectAllHelpHidden(page);
      await expect(page.locator('#input-resourceinformation-publicationyear')).toHaveCSS('border-top-right-radius', '6px');
      await expect(page.locator('#input-resourceinformation-doi')).toHaveCSS('border-top-right-radius', '0px');
      await expect(page.locator('#button-resourceinformation-edit-doi')).toHaveCSS('border-top-right-radius', '6px');
      await page.locator('#button-resourceinformation-edit-doi').click();
      await expect(page.locator('#input-resourceinformation-doi')).toBeEditable();
      const orcidSearch = page.locator('.orcid-search-btn').first();
      await expect(orcidSearch).toBeVisible();
      await expect(orcidSearch).toHaveCSS('border-top-right-radius', '6px');
      await orcidSearch.click();
      await expect(page.locator('#modal-orcid-search')).toBeVisible();
      await page.locator('#modal-orcid-search [data-bs-dismiss="modal"]').first().click();
      await expect(page.locator('#modal-orcid-search')).toBeHidden();
      await page.locator('#button-science_keywords-open').click();
      await expect(page.locator('#modal-sciencekeyword')).toBeVisible();
      await expectAllHelpHidden(page);
      await page.locator('#input-sciencekeyword-thesaurussearch').fill('rock');
      await page.locator('#modal-sciencekeyword [data-bs-dismiss="modal"]').click();
      await expect(page.locator('#modal-sciencekeyword')).toBeHidden();

      // A hidden focusable field-help icon must not remain in keyboard navigation.
      const focusableHelp = page.locator('[data-help-section-id][tabindex="0"]').first();
      await focusableHelp.evaluate(element => (element as HTMLElement).focus());
      expect(await focusableHelp.evaluate(element => element === document.activeElement)).toBe(false);
      await toggle(page, true);
      await expect(sectionHelp).toBeVisible();
      const relatedCards = page.locator('[data-related-work-entry]');
      await expect(relatedCards.first().locator('i[data-help-section-id]').first()).toBeVisible();
      await expect(relatedCards.nth(1).locator('i[data-help-section-id]').first()).toBeHidden();
      await relatedCards.first().locator('[data-related-work-remove]').click();
      await expect(relatedCards.first().locator('i[data-help-section-id]').first()).toBeVisible();
      // CSS must not have forced cloned title and laboratory placeholders visible.
      for (const placeholder of await page.locator('.help-placeholder').all()) await expect(placeholder).toBeHidden();
      await sectionHelp.click();
      await expect(page.locator('#helpModal')).toBeVisible();
      await expect(page.locator('#helpModal .modal-body')).toContainText('Resource Information help');
      await page.locator('#helpModal [data-bs-dismiss="modal"]').first().click();
      await expect(page.locator('#helpModal')).toBeHidden();
      await toggle(page, false);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-help-status', 'help-off');
      await expectAllHelpHidden(page);
      expect(errors).toEqual([]);
    });
  }
}

test('migrates a legacy preference, preserves local hiding and keeps the Guide reachable', async ({ page, baseURL }) => {
  await page.addInitScript(() => localStorage.setItem('inputGroupTextVisible', 'false'));
  const { errors } = await mount(page, baseURL);
  await expectAllHelpHidden(page);
  expect(await page.evaluate(() => localStorage.getItem('inputGroupTextVisible'))).toBeNull();
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<i id="local-help" data-help-section-id="local" class="d-none"></i>');
  });
  await toggle(page, true);
  await expect(page.locator('#local-help')).toBeHidden();
  await expect(page.locator('#bd-help')).toBeVisible();
  const popup = page.waitForEvent('popup');
  await page.locator('#buttonHelpheader').click();
  await expect(await popup).toHaveURL(/doc\/help\.php$/u);
  expect(errors).toEqual([]);
});
