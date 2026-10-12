import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../utils/constants';
import { expect, test } from '@playwright/test';
import { APP_BASE_URL, registerStaticAssetRoutes, SELECTORS, simulateSubmitValidation  } from '../utils';

// Use the same templates as the application, with both feature flags enabled.
const contributorInstitutionsMarkup = readFileSync(path.join(REPO_ROOT, 'formgroups/contributors.html'), 'utf8')
  .replace(/<\?php[\s\S]*?\?>/g, '');

const roleFixtures = {
  institution: [
    { name: 'Hosting Institution' },
    { name: 'Research Infrastructure' },
    { name: 'Data Repository' }
  ],
  both: [
    { name: 'Software Provider' },
    { name: 'Funding Organisation' }
  ]
};

const affiliationFixtures = [
  { id: 'https://ror.org/019wvm592', name: 'Fraunhofer Institute for Open Communication Systems FOKUS', other: ['FOKUS'] },
  { id: 'https://ror.org/01bj3aw27', name: 'Technical University of Berlin', other: ['TU Berlin'] },
  { id: 'https://ror.org/05p8bnz29', name: 'Brown University' }
];

function buildTestPageMarkup() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Contributor Institutions Test Harness</title>
    <base href="${APP_BASE_URL}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="node_modules/@yaireo/tagify/dist/tagify.css">
  </head>
  <body>
    <main class="container py-4">
      <form id="form-mde">
        ${contributorInstitutionsMarkup}
      </form>
      <button id="buttonHelpOn" type="button" style="display:none;">Help On</button>
      <button id="buttonHelpOff" type="button" style="display:none;">Help Off</button>
    </main>
    <script>
      window.translations = {
        general: {
          roleLabel: 'Role',
          affiliation: 'Affiliation'
        }
      };
    </script>
    <script src="node_modules/jquery/dist/jquery.min.js"></script>
    <script src="node_modules/jquery-ui/dist/jquery-ui.min.js"></script>
    <script src="node_modules/@yaireo/tagify/dist/tagify.js"></script>
    <script src="js/roles.js"></script>
    <script src="js/affiliations.js"></script>
    <script src="js/checkMandatoryFields.js"></script>
    <script src="js/validation/orcidValidation.js"></script>
    <script src="js/autocomplete.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/contributorStack.js"></script>
  </body>
</html>`;
}

test.describe('Contributor (Institutions) form group', () => {
  test.beforeEach(async ({ page }) => {
    await registerStaticAssetRoutes(page);
    await page.route('**/api/v2/vocabs/roles?type=**', async route => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get('type') as keyof typeof roleFixtures | null;
      const body = roleFixtures[type ?? 'institution'] ?? roleFixtures.institution;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
    });

    await page.route('**/json/affiliations.json', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(affiliationFixtures)
      });
    });

    await page.route('**/test-harness', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: buildTestPageMarkup()
      });
    });

    await page.goto(`${APP_BASE_URL}test-harness`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).contributorStack));
    await page.locator('[data-contributor-add-type="institution"]').click();
    await page.waitForFunction(() => {
      const roleInput: any = document.querySelector('input[id^="input-contributor-organisationrole-"]');
      const affiliationInput: any = document.querySelector('input[id^="input-contributor-organisationaffiliation-"]');
      const roleReady = !!(roleInput && (roleInput._tagify || roleInput.tagify));
      const affiliationReady = !!(affiliationInput && (affiliationInput.tagify || affiliationInput._tagify));
      return roleReady && affiliationReady;
    });

    await page.evaluate(() => {
      document.querySelectorAll('.input-group-text').forEach(element => {
        const el = element as HTMLElement;
        el.style.display = 'flex';
        el.style.visibility = 'visible';
      });
    });
  });

  test('renders contributor institution fields with accessible helpers', async ({ page }) => {
    const formGroup = page.locator(SELECTORS.formGroups.contributorInstitutions);
    await expect(formGroup).toBeVisible();

    const heading = page.locator('b[data-translate="contributors.title"]');
    await expect(heading).toHaveText('Contributors');

    await expect(page.getByLabel('Organisation name')).toBeVisible();
    const nameHelpIcon = formGroup.locator('[data-help-section-id="help-contributorinstitutions-organisationname"]');
    await expect(nameHelpIcon).toHaveCount(1);

    const roleTagify = formGroup.locator('.tagify').first();
    await expect(roleTagify).toBeVisible();
    await expect(roleTagify.locator('.tagify__input')).toHaveAttribute('data-placeholder', 'Role');

    const roleHelpIcon = formGroup.locator('[data-help-section-id="help-contributorinstitutions-organisationrole"]');
    await expect(roleHelpIcon).toHaveCount(1);

    const affiliationTagify = formGroup.locator('.tagify').nth(1);
    await expect(affiliationTagify).toBeVisible();
    await expect(affiliationTagify.locator('.tagify__input')).toHaveAttribute('data-placeholder', 'Affiliation');

    const affiliationLabel = formGroup.locator('label[for^="input-contributor-organisationaffiliation-"]');
    await expect(affiliationLabel).toHaveClass(/visually-hidden/);

    const affiliationHelpIcon = formGroup.locator('[data-help-section-id="help-contributorinstitutions-affiliation"]');
    await expect(affiliationHelpIcon).toHaveCount(1);

    await expect(page.locator('input[id^="input-contributor-organisationrorid-"]')).toHaveAttribute('type', 'hidden');
    await expect(page.locator('[data-contributor-add-type="institution"]')).toBeVisible();
  });

  test('supports selecting multiple institution roles through Tagify', async ({ page }) => {
    await page.waitForFunction(() => {
      const input: any = document.querySelector('input[id^="input-contributor-organisationrole-"]');
      return !!(input && input._tagify && input._tagify.whitelist?.length >= 3);
    });

    await page.evaluate(() => {
      const input: any = document.querySelector('input[id^="input-contributor-organisationrole-"]');
      input._tagify.removeAllTags();
      input._tagify.addTags(['Hosting Institution', 'Software Provider']);
    });

    const renderedTags = page
      .locator(`${SELECTORS.formGroups.contributorInstitutions} .tagify`)
      .first()
      .locator('.tagify__tag');
    await expect(renderedTags).toHaveCount(2);
    await expect(renderedTags.nth(0)).toContainText('Hosting Institution');
    await expect(renderedTags.nth(1)).toContainText('Software Provider');

    const roleInputValue = await page.locator('input[id^="input-contributor-organisationrole-"]').inputValue();
    expect(roleInputValue).toContain('Hosting Institution');
    expect(roleInputValue).toContain('Software Provider');
  });

  test('updates hidden ROR identifier when affiliations change', async ({ page }) => {
    await page.evaluate(() => {
      const affiliationInput: any = document.querySelector('input[id^="input-contributor-organisationaffiliation-"]');
      affiliationInput._tagify.removeAllTags();
      affiliationInput._tagify.addTags([
        { value: 'Fraunhofer Institute for Open Communication Systems FOKUS', id: 'https://ror.org/019wvm592' },
        { value: 'Brown University', id: 'https://ror.org/05p8bnz29' }
      ]);
    });

    await expect(page.locator('input[id^="input-contributor-organisationrorid-"]')).toHaveValue('019wvm592,05p8bnz29');

    await page.evaluate(() => {
      const affiliationInput: any = document.querySelector('input[id^="input-contributor-organisationaffiliation-"]');
      affiliationInput._tagify.removeAllTags();
    });

    await expect(page.locator('input[id^="input-contributor-organisationrorid-"]')).toHaveValue('');
  });

  test('toggles required attributes when contributor institution data is provided', async ({ page }) => {
    const nameInput = page.locator('input[id^="input-contributor-name-"]');
    const roleInput = page.locator('input[id^="input-contributor-organisationrole-"]');

    await expect(nameInput).not.toHaveAttribute('required', 'required');
    await expect(roleInput).not.toHaveAttribute('required', 'required');

    await page.evaluate(() => {
      const affiliationInput: any = document.querySelector('input[id^="input-contributor-organisationaffiliation-"]');
      affiliationInput._tagify.addTags([{ value: 'Technical University of Berlin', id: 'https://ror.org/01bj3aw27' }]);
      (window as any).validateAllMandatoryFields();
    });

    await expect(nameInput).toHaveClass(/js-required-on-submit/);
    await simulateSubmitValidation(page);

    await expect(nameInput).toHaveAttribute('required', 'required');
    await expect(roleInput).toHaveAttribute('required', 'required');

    await page.evaluate(() => {
      const affiliationInput: any = document.querySelector('input[id^="input-contributor-organisationaffiliation-"]');
      affiliationInput._tagify.removeAllTags();
      (window as any).validateAllMandatoryFields();
    });

    await expect(nameInput).not.toHaveClass(/js-required-on-submit/);
    await simulateSubmitValidation(page);

    await expect(nameInput).not.toHaveAttribute('required', 'required');
    await expect(roleInput).not.toHaveAttribute('required', 'required');
  });

  test('adds and removes organisation rows with unique, accessible controls', async ({ page }) => {
    const addButton = page.locator('[data-contributor-add-type="institution"]');
    await addButton.click();

    const rows = page.locator('[data-contributor-card][data-contributor-type="institution"]');
    await expect(rows).toHaveCount(2);

    const firstRow = rows.nth(0);
    const secondRow = rows.nth(1);

    const firstNameId = await firstRow.locator('input[name="cbOrganisationName[]"]').getAttribute('id');
    const secondNameInput = secondRow.locator('input[name="cbOrganisationName[]"]');
    const secondNameId = await secondNameInput.getAttribute('id');

    expect(firstNameId).not.toBeNull();
    expect(secondNameId).not.toBeNull();
    expect(secondNameId).not.toBe(firstNameId);

    const secondNameLabel = secondRow.locator("label[for^='input-contributor-name']");
    await expect(secondNameLabel).toHaveAttribute('for', secondNameId!);

    const secondRoleInput = secondRow.locator('input[id^="input-contributor-organisationrole"]');
    const secondRoleId = await secondRoleInput.getAttribute('id');
    expect(secondRoleId).not.toBeNull();

    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[name="cbOrganisationRoles[]"]');
      const second: any = inputs[1];
      return !!(second && second._tagify && second._tagify.whitelist?.length);
    });

    const secondAffiliationInput = secondRow.locator('input[id^="input-contributor-organisationaffiliation"]');
    const secondAffiliationId = await secondAffiliationInput.getAttribute('id');
    expect(secondAffiliationId).not.toBeNull();

    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[name="OrganisationAffiliation[]"]');
      const second: any = inputs[0];
      return !!(second && (second.tagify || second._tagify));
    });

    
    const helpNameCount = await secondRow.locator('[data-help-section-id^="help-contributorinstitutions-organisationname"]').count();
    expect(helpNameCount).toBeGreaterThan(0);

    const helpRoleCount = await secondRow.locator('[data-help-section-id^="help-contributorinstitutions-organisationrole"]').count();
    expect(helpRoleCount).toBeGreaterThan(0);

    const helpAffiliationCount = await secondRow.locator('[data-help-section-id^="help-contributorinstitutions-affiliation"]').count();
    expect(helpAffiliationCount).toBeGreaterThan(0);


    const hiddenRorId = await secondRow.locator('input[name="hiddenOrganisationRorId[]"]').getAttribute('id');
    expect(hiddenRorId).not.toBeNull();

    await expect(page.locator('[data-contributor-card]').nth(1).locator('[data-contributor-remove]')).toBeVisible();

    await page.locator('[data-contributor-card]').nth(1).locator('[data-contributor-remove]').click();
    await expect(rows).toHaveCount(1);
    await expect(addButton).toBeVisible();

  });
});