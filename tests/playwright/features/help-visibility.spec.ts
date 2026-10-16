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
const SCIENCE_KEYWORDS = [
  ['8fb5ea8a-96ba-47cf-91cd-c7b64fbcd54a', 'Spherical harmonic models'],
  ['97576e51-28b5-4ae0-af33-fbb00fd5996b', 'Mass concentration models'],
  ['b8615aad-d2eb-45a3-98a7-4adac5bdf5a5', 'Earth science reanalyses'],
  ['5498572c-aaed-4c08-8aad-8b297057e9c9', 'Geodetics'],
  ['221386f6-ef9b-4990-82b3-f990b0fe39fa', 'Gravitational field'],
  ['ad09b215-e837-4d9f-acbc-2b45e5b81825', 'Marine gravity field'],
].map(([id, text]) => ({ id: `https://gcmd.earthdata.nasa.gov/kms/concept/${id}`, text, children: [] }));

// Reproduced with the same flow and the production files from ce8bd3ab, before
// the help fix. Exempt only these existing Firefox diagnostics; errors and other
// warnings must still fail the test. The first two originate in unchanged Tagify.
const EXISTING_FIREFOX_WARNINGS = [
  /^\[JavaScript Warning: "onmozfullscreen(?:change|error) is deprecated\." \{file: "[^"]*\/node_modules\/@yaireo\/tagify\/dist\/tagify\.js"/u,
  /^\[JavaScript Warning: "This site appears to use a scroll-linked positioning effect\.[^"]*" \{file: "[^"]*\/__help_visibility_fixture__" line: 0\}\]$/u,
];

// Use production templates, styles, modules and widgets with deterministic APIs.
// This suite needs no PHP server or changes to the user's settings.php.
async function mount(page: Page, baseURL: string | undefined, edition = 'generic', delayed = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (!['warning', 'error'].includes(message.type())) return;
    const existingWarning = page.context().browser()?.browserType().name() === 'firefox'
      && message.type() === 'warning'
      && EXISTING_FIREFOX_WARNINGS.some(pattern => pattern.test(message.text()));
    if (!existingWarning) errors.push(`${message.type()}: ${message.text()}`);
  });
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
      : pathname.endsWith('/gcmd-science-keywords') ? SCIENCE_KEYWORDS
      : [];
    await route.fulfill({ json: data });
  });
  // Context routing also covers the first navigation of the Guide popup.
  await page.context().route('**/doc/help.php', route => route.fulfill({
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
      <script src="js/footerLayout.js"></script>
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
  // The real editor measures its fixed footer, which can wrap after fonts load.
  // Keep that production behavior in the fixture so mobile controls stay usable.
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect.poll(() => page.evaluate(() => {
    const footer = document.querySelector('footer.fixed-bottom')!;
    return parseFloat(getComputedStyle(document.body).paddingBottom) - footer.getBoundingClientRect().height;
  }), { message: 'The page must reserve space above the measured fixed footer' }).toBeGreaterThanOrEqual(16);
  return { release, errors };
}

async function toggle(page: Page, on: boolean) {
  if (await page.locator('.navbar-toggler').isVisible() && !(await page.locator('#bd-help').isVisible())) {
    await page.locator('.navbar-toggler').click();
    await expect(page.locator('#headerMenuContent')).toHaveClass(/\bshow\b/u);
  }
  await page.locator('#bd-help').click();
  await page.locator(on ? '#buttonHelpOn' : '#buttonHelpOff').click();
  await expect(page.locator('html')).toHaveAttribute('data-help-status', on ? 'help-on' : 'help-off');
}

async function transitionModal(page: Page, selector: string, eventName: 'shown.bs.modal' | 'hidden.bs.modal', activate: () => Promise<void>) {
  const modal = page.locator(selector);
  // Visibility changes before Bootstrap finishes animating. During that time
  // dismiss clicks can be ignored, so wait for the public lifecycle event.
  await modal.evaluate((element, name) => {
    element.removeAttribute('data-help-test-modal-event');
    element.addEventListener(name, () => element.setAttribute('data-help-test-modal-event', name), { once: true });
  }, eventName);
  await activate();
  await expect(modal).toHaveAttribute('data-help-test-modal-event', eventName);
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
        await expect(page.locator('#collapse-description-Methods')).toHaveClass(/\bshow\b/u);
        await expect(page.locator('#input-description-Methods')).toBeVisible();
        await page.locator('[data-description-slug="CustomDescription"] .accordion-button').click();
        await expect(page.locator('#collapse-description-CustomDescription')).toHaveClass(/\bshow\b/u);
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
      // Exercise keyboard access to a form action while contextual help is off.
      await transitionModal(page, '#modal-orcid-search', 'shown.bs.modal', () => orcidSearch.press('Enter'));
      await expect(page.locator('#modal-orcid-search')).toBeVisible();
      await transitionModal(page, '#modal-orcid-search', 'hidden.bs.modal', () => page.locator('#modal-orcid-search [data-bs-dismiss="modal"]').first().click());
      await expect(page.locator('#modal-orcid-search')).toBeHidden();
      await transitionModal(page, '#modal-sciencekeyword', 'shown.bs.modal', () => page.locator('#button-science_keywords-open').click());
      await expect(page.locator('#modal-sciencekeyword')).toBeVisible();
      await expectAllHelpHidden(page);
      await page.locator('#input-sciencekeyword-thesaurussearch').fill('rock');
      await transitionModal(page, '#modal-sciencekeyword', 'hidden.bs.modal', () => page.locator('#modal-sciencekeyword [data-bs-dismiss="modal"]').click());
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
      await transitionModal(page, '#helpModal', 'shown.bs.modal', () => sectionHelp.click());
      await expect(page.locator('#helpModal')).toBeVisible();
      await expect(page.locator('#helpModal .modal-body')).toContainText('Resource Information help');
      await transitionModal(page, '#helpModal', 'hidden.bs.modal', () => page.locator('#helpModal [data-bs-dismiss="modal"]').first().click());
      await expect(page.locator('#helpModal')).toBeHidden();
      await toggle(page, false);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-help-status', 'help-off');
      await expectAllHelpHidden(page);
      expect(errors, 'Contextual help must not introduce console warnings or errors').toEqual([]);
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
  expect(errors, 'Contextual help must not introduce console warnings or errors').toEqual([]);
});
