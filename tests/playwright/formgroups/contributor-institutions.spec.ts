import { expect, test } from '@playwright/test';
import { APP_BASE_URL, registerStaticAssetRoutes, SELECTORS } from '../utils';

const contributorInstitutionsMarkup = String.raw`
<div class="card mb-2">
  <div class="card-header">
    <b data-translate="contributorInstitutions.title">Contributor Institution(s)</b>
    <i class="bi bi-question-circle-fill" data-help-section-id="help-contributorinstitutions-fg"></i>
  </div>
  <div class="card-body">
    <div id="group-contributorperson">
      <div id="group-contributororganisation">
        <div class="row" contributors-row>
          <div class="col-12 col-sm-12 col-md-12 col-lg-4 p-1">
            <div class="input-group has-validation">
              <div class="form-floating">
                <input type="text" class="form-control input-with-help input-right-no-round-corners"
                  id="input-contributor-name" name="cbOrganisationName[]" />
                <label for="input-contributor-name" data-translate="contributorInstitutions.organization">Organisation name</label>
                <div class="invalid-feedback" data-translate="contributorInstitutions.organizationInvalid">Please enter a valid organization name.</div>
              </div>
              <div class="input-group-append">
                <span class="input-group-text"><i class="bi bi-question-circle-fill"
                    data-help-section-id="help-contributorinstitutions-organisationname"></i></span>
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-12 col-md-4 col-lg-2 p-1">
            <label for="input-contributor-organisationrole" class="visually-hidden" data-translate="general.roleLabel">Role</label>
            <div class="input-group has-validation">
              <input name="cbOrganisationRoles[]" id="input-contributor-organisationrole"
                class="form-control tagify--custom-dropdown input-with-help input-right-no-round-corners"
                data-translate-placeholder="general.roleLabel" />
              <span class="input-group-text"><i class="bi bi-question-circle-fill"
                  data-help-section-id="help-contributorinstitutions-organisationrole"></i></span>
              <div class="invalid-feedback" data-translate="general.pleaseChoose">Please choose</div>
            </div>
          </div>
          <div class="col-10 col-sm-10 col-md-7 col-lg-5 p-1">
            <label for="input-contributor-organisationaffiliation" class="visually-hidden">Affiliation</label>
            <div class="input-group has-validation">
              <input type="text" class="form-control input-with-help input-right-no-round-corners"
                id="input-contributor-organisationaffiliation" name="OrganisationAffiliation[]" />
              <span class="input-group-text"><i class="bi bi-question-circle-fill"
                  data-help-section-id="help-contributorinstitutions-affiliation"></i></span>
              <input type="hidden" id="input-contributor-organisationrorid" name="hiddenOrganisationRorId[]" />
            </div>
          </div>
          <div class="col-2 col-sm-2 col-md-1 col-lg-1 d-flex justify-content-center align-items-center">
            <button type="button" class="btn btn-primary addContributor add-button" id="button-contributor-addorganisation" data-translate="general.add">
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

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
    <script src="js/autocomplete.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/contributor-organisation.js"></script>
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
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const roleInput: any = document.querySelector('#input-contributor-organisationrole');
      const affiliationInput: any = document.querySelector('#input-contributor-organisationaffiliation');
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

    const heading = page.locator('b[data-translate="contributorInstitutions.title"]');
    await expect(heading).toHaveText('Contributor Institution(s)');

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

    const affiliationLabel = formGroup.locator('label[for="input-contributor-organisationaffiliation"]');
    await expect(affiliationLabel).toHaveClass(/visually-hidden/);

    const affiliationHelpIcon = formGroup.locator('[data-help-section-id="help-contributorinstitutions-affiliation"]');
    await expect(affiliationHelpIcon).toHaveCount(1);

    await expect(page.locator('#input-contributor-organisationrorid')).toHaveAttribute('type', 'hidden');
    await expect(page.locator('#button-contributor-addorganisation')).toHaveAttribute('data-translate', 'general.add');
  });

  test('supports selecting multiple institution roles through Tagify', async ({ page }) => {
    await page.waitForFunction(() => {
      const input: any = document.querySelector('#input-contributor-organisationrole');
      return !!(input && input._tagify && input._tagify.whitelist?.length >= 3);
    });

    await page.evaluate(() => {
      const input: any = document.querySelector('#input-contributor-organisationrole');
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

    const roleInputValue = await page.locator('#input-contributor-organisationrole').inputValue();
    expect(roleInputValue).toContain('Hosting Institution');
    expect(roleInputValue).toContain('Software Provider');
  });

  test('updates hidden ROR identifier when affiliations change', async ({ page }) => {
    await page.evaluate(() => {
      const affiliationInput: any = document.querySelector('#input-contributor-organisationaffiliation');
      affiliationInput.tagify.removeAllTags();
      affiliationInput.tagify.addTags([
        { value: 'Fraunhofer Institute for Open Communication Systems FOKUS', id: 'https://ror.org/019wvm592' },
        { value: 'Brown University', id: 'https://ror.org/05p8bnz29' }
      ]);
    });

    await expect(page.locator('#input-contributor-organisationrorid')).toHaveValue('https://ror.org/019wvm592,https://ror.org/05p8bnz29');

    await page.evaluate(() => {
      const affiliationInput: any = document.querySelector('#input-contributor-organisationaffiliation');
      affiliationInput.tagify.removeAllTags();
    });

    await expect(page.locator('#input-contributor-organisationrorid')).toHaveValue('');
  });

  test('toggles required attributes when contributor institution data is provided', async ({ page }) => {
    const nameInput = page.locator('#input-contributor-name');
    const roleInput = page.locator('#input-contributor-organisationrole');

    await expect(nameInput).not.toHaveAttribute('required', 'required');
    await expect(roleInput).not.toHaveAttribute('required', 'required');

    await page.evaluate(() => {
      const affiliationInput: any = document.querySelector('#input-contributor-organisationaffiliation');
      affiliationInput.tagify.addTags([{ value: 'Technical University of Berlin', id: 'https://ror.org/01bj3aw27' }]);
      (window as any).checkMandatoryFields();
    });

    await expect(nameInput).toHaveAttribute('required', 'required');
    await expect(roleInput).toHaveAttribute('required', 'required');

    await page.evaluate(() => {
      const affiliationInput: any = document.querySelector('#input-contributor-organisationaffiliation');
      affiliationInput.tagify.removeAllTags();
      (window as any).checkMandatoryFields();
    });

    await expect(nameInput).not.toHaveAttribute('required', 'required');
    await expect(roleInput).not.toHaveAttribute('required', 'required');
  });

  test('adds and removes organisation rows with unique, accessible controls', async ({ page }) => {
    const addButton = page.locator('#button-contributor-addorganisation');
    await addButton.click();

    const rows = page.locator(`${SELECTORS.formGroups.contributorInstitutions} .row[contributors-row]`);
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

    const secondRoleInput = secondRow.locator('input[name="cbOrganisationRoles[]"]');
    const secondRoleId = await secondRoleInput.getAttribute('id');
    expect(secondRoleId).not.toBeNull();

    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[name="cbOrganisationRoles[]"]');
      const second: any = inputs[1];
      return !!(second && second._tagify && second._tagify.whitelist?.length);
    });

    const secondAffiliationInput = secondRow.locator('input[name="cbOrganisationAffiliations[]"]');
    const secondAffiliationId = await secondAffiliationInput.getAttribute('id');
    expect(secondAffiliationId).not.toBeNull();

    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[name="cbOrganisationAffiliations[]"]');
      const second: any = inputs[0];
      return !!(second && (second.tagify || second._tagify));
    });

    const hiddenRorId = await secondRow.locator('input[name="cbOrganisationRorIds[]"]').getAttribute('id');
    expect(hiddenRorId).not.toBeNull();

    await expect(secondRow.locator('.help-placeholder')).toHaveCount(1);
    await expect(secondRow.locator('[data-help-section-id="help-contributor-organisationrole"]')).toHaveCount(1);
    await expect(secondRow.locator('[data-help-section-id="help-contributor-organisation-affiliation"]')).toHaveCount(1);
    await expect(secondRow.locator('.removeButton')).toBeVisible();

    await secondRow.locator('.removeButton').click();
    await expect(rows).toHaveCount(1);
    await expect(addButton).toBeVisible();
  });
});