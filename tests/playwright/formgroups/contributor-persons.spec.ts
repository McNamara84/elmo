import { test, expect } from '@playwright/test';
import { APP_BASE_URL, registerStaticAssetRoutes, SELECTORS } from '../utils';

const contributorGroupMarkup = String.raw`
<div class="card mb-2">
  <div class="card-header">
    <b data-translate="contributorPersons.title">Contributors</b>
    <i class="bi bi-question-circle-fill" data-help-section-id="help-contributorpersons-fg"></i>
  </div>
  <div class="card-body">
    <div id="group-contributorperson">
      <div class="row" contributor-person-row>
        <div class="col-12 col-sm-12 col-md-4 col-lg-2 p-1">
          <div class="input-group has-validation">
            <div class="form-floating">
              <input type="text" class="form-control input-with-help input-right-no-round-corners"
                id="input-contributor-orcid" name="cbORCID[]"
                pattern="^[0-9]{4}-[0-9]{4}-[0-9]{4}-([0-9]{4}|[0-9]{3}X)$" />
              <label for="input-contributor-orcid" data-translate="general.ORCID">ORCID</label>
              <div class="invalid-feedback" data-translate="general.orcidInvalid">Please enter a valid ORCID (XXXX-XXXX-XXXX-XXX(X))</div>
            </div>
            <div class="input-group-append">
              <span class="input-group-text"><i class="bi bi-question-circle-fill"
                  data-help-section-id="help-contributorpersons-orcid"></i></span>
            </div>
          </div>
        </div>
        <div class="col-6 col-sm-6 col-md-4 col-lg-2 p-1">
          <div class="input-group has-validation">
            <div class="form-floating">
              <input type="text" class="form-control" id="input-contributor-lastname" pattern="^[a-zA-ZäöéüÄÖÜß \-]*$"
                name="cbPersonLastname[]" />
              <label for="input-contributor-lastname" data-translate="general.lastName">Last Name</label>
              <div class="invalid-feedback" data-translate="general.lastNameInvalid">Please provide a lastname. Only letters are allowed.</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-sm-6 col-md-4 col-lg-2 p-1">
          <div class="input-group has-validation">
            <div class="form-floating">
              <input type="text" class="form-control" id="input-contributor-firstname" pattern="^[a-zA-ZäöéüÄÖÜß \-.]*$"
                name="cbPersonFirstname[]" />
              <label for="input-contributor-firstname" data-translate="general.firstName">First Name</label>
              <div class="invalid-feedback" data-translate="general.firstNameInvalid"></div>
            </div>
          </div>
        </div>
        <div class="col-12 col-sm-12 col-md-4 col-lg-2 p-1">
          <label for="input-contributor-personrole" class="visually-hidden" data-translate="general.roleLabel">Role</label>
          <div class="input-group has-validation">
            <input name="cbPersonRoles[]" id="input-contributor-personrole"
              class="form-control tagify--custom-dropdown input-with-help input-right-no-round-corners"
              data-translate-placeholder="general.roleLabel" />
            <span class="input-group-text"><i class="bi bi-question-circle-fill"
                data-help-section-id="help-contributorpersons-role"></i></span>
            <div class="invalid-feedback" data-translate="general.pleaseChoose">Please choose</div>
          </div>
        </div>
        <div class="col-10 col-sm-10 col-md-7 col-lg-3 p-1">
          <label for="input-contributorpersons-affiliation" class="visually-hidden">Affiliation</label>
          <div class="input-group has-validation">
            <input type="text" class="form-control input-with-help input-right-no-round-corners"
              id="input-contributorpersons-affiliation" name="cbAffiliation[]" />
            <span class="input-group-text"><i class="bi bi-question-circle-fill"
                data-help-section-id="help-contributorinstitutions-affiliation"></i></span>
            <input type="hidden" id="input-contributor-personrorid" name="cbpRorIds[]" />
          </div>
        </div>
        <div class="col-2 col-sm-2 col-md-1 col-lg-1 d-flex justify-content-center align-items-center">
          <button type="button" class="btn btn-primary addContributorPerson add-button" id="button-contributor-addperson"
            data-translate="general.add">
            +
          </button>
        </div>
      </div>
    </div>
  </div>
</div>`;

const roleFixtures = {
  person: [
    { name: 'Data Curator' },
    { name: 'Researcher' },
    { name: 'Principal Investigator' }
  ],
  both: [
    { name: 'Software Developer' },
    { name: 'Project Manager' }
  ]
};

const affiliationFixtures = [
  { id: 'https://ror.org/019wvm592', name: 'Fraunhofer Institute for Open Communication Systems FOKUS', other: ['FOKUS'] },
  { id: 'https://ror.org/01bj3aw27', name: 'Technical University of Berlin', other: ['TU Berlin'] },
  { id: 'https://ror.org/05p8bnz29', name: 'Brown University' }
];

const mockContributorOrcidRecord = {
  person: {
    name: {
      'family-name': { value: 'Nguyen' },
      'given-names': { value: 'Linh' }
    }
  },
  'activities-summary': {
    employments: {
      'affiliation-group': [
        {
          summaries: [
            {
              'employment-summary': {
                organization: {
                  name: 'Fraunhofer Institute for Open Communication Systems FOKUS',
                  'disambiguated-organization': {
                    'disambiguation-source': 'ROR',
                    'disambiguated-organization-identifier': 'https://ror.org/019wvm592'
                  }
                },
                'end-date': null
              }
            }
          ]
        }
      ]
    },
    educations: {
      'affiliation-group': [
        {
          summaries: [
            {
              'education-summary': {
                organization: {
                  name: 'Technical University of Berlin',
                  'disambiguated-organization': {
                    'disambiguation-source': 'ROR',
                    'disambiguated-organization-identifier': '01bj3aw27'
                  }
                },
                'end-date': null
              }
            }
          ]
        }
      ]
    }
  }
};

function buildTestPageMarkup() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Contributor Persons Test Harness</title>
    <base href="${APP_BASE_URL}">
    <link rel="stylesheet" href="node_modules/bootstrap/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="node_modules/@yaireo/tagify/dist/tagify.css">
  </head>
  <body>
    <main class="container py-4">
      <form id="form-mde">
        ${contributorGroupMarkup}
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
    <script type="module" src="js/eventhandlers/formgroups/contributor-person.js"></script>
  </body>
</html>`;
}

test.describe('Contributor (Persons) form group', () => {
  test.beforeEach(async ({ page }) => {
    await registerStaticAssetRoutes(page);
    await page.route('**/api/v2/vocabs/roles?type=**', async route => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get('type') as keyof typeof roleFixtures | null;
      const body = roleFixtures[type ?? 'person'] ?? roleFixtures.person;
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
      const roleInput: any = document.querySelector('#input-contributor-personrole');
      const affiliationInput: any = document.querySelector('#input-contributorpersons-affiliation');
      return roleInput?._tagify || roleInput?.tagify || (affiliationInput && affiliationInput.tagify);
    });

    await page.evaluate(() => {
      document.querySelectorAll('.input-group-text').forEach(element => {
        const el = element as HTMLElement;
        el.style.display = 'flex';
        el.style.visibility = 'visible';
      });
    });
  });

  test('renders contributor person fields with accessible helpers', async ({ page }) => {
    await expect(page.locator(SELECTORS.formGroups.contributorPersons)).toBeVisible();
    await expect(page.locator('b[data-translate="contributorPersons.title"]')).toBeVisible();

    await expect(page.locator('#input-contributor-orcid')).toBeVisible();
    await expect(page.locator('#input-contributor-orcid')).toHaveAttribute('pattern', '^[0-9]{4}-[0-9]{4}-[0-9]{4}-([0-9]{4}|[0-9]{3}X)$');

    await expect(page.locator('#input-contributor-lastname')).toBeVisible();
    await expect(page.locator('#input-contributor-firstname')).toBeVisible();

    const roleTagify = page.locator(`${SELECTORS.formGroups.contributorPersons} .tagify`).first();
    await expect(roleTagify).toBeVisible();
    await expect(roleTagify.locator('.tagify__input')).toBeVisible();

    await expect(page.locator('[data-help-section-id="help-contributorpersons-orcid"]')).toHaveCount(1);
    await expect(page.locator('[data-help-section-id="help-contributorpersons-role"]')).toHaveCount(1);
    await expect(page.locator('[data-help-section-id="help-contributorinstitutions-affiliation"]')).toHaveCount(1);

    await expect(page.locator('#input-contributor-personrorid')).toHaveAttribute('type', 'hidden');
  });

  test('populates contributor details and affiliations from a valid ORCID', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockContributorOrcidRecord)
      });
    });

    await page.locator('#input-contributor-orcid').fill('0000-0003-1825-0097');
    await page.locator('#input-contributor-lastname').click();

    await expect(page.locator('#input-contributor-lastname')).toHaveValue('Nguyen');
    await expect(page.locator('#input-contributor-firstname')).toHaveValue('Linh');

    await page.waitForFunction(() => {
      const input: any = document.querySelector('input[id^="input-contributorpersons-affiliation"]');
      return input?.tagify?.value?.length === 2;
    });

    const affiliationValues = await page.evaluate(() => {
      const input: any = document.querySelector('input[id^="input-contributorpersons-affiliation"]');
      return input.tagify.value.map((tag: { value: string }) => tag.value);
    });

    expect(affiliationValues).toEqual([
      'Fraunhofer Institute for Open Communication Systems FOKUS',
      'Technical University of Berlin'
    ]);

    await expect(page.locator('input[id^="input-contributor-personrorid"]')).toHaveValue(
      'https://ror.org/019wvm592,https://ror.org/01bj3aw27'
    );
  });

  test('allows adding and removing multiple contributor person rows independently', async ({ page }) => {
    const addButton = page.locator('#button-contributor-addperson');
    await addButton.click();

    const rows = page.locator(`${SELECTORS.formGroups.contributorPersons} [contributor-person-row]`);
    await expect(rows).toHaveCount(2);

    const firstOrcidId = await rows.nth(0).locator('input[name="cbORCID[]"]').getAttribute('id');
    const secondOrcidId = await rows.nth(1).locator('input[name="cbORCID[]"]').getAttribute('id');
    expect(firstOrcidId).not.toBe(secondOrcidId);

    await expect(rows.nth(1).locator('.removeButton')).toBeVisible();

    await rows.nth(1).locator('input[name="cbPersonLastname[]"]').fill('Rivera');
    await rows.nth(1).locator('input[name="cbPersonFirstname[]"]').fill('Elena');

    await rows.nth(1).locator('.removeButton').click();
    await expect(rows).toHaveCount(1);

    await expect(rows.nth(0).locator('input[name="cbPersonLastname[]"]').first()).not.toHaveValue('Rivera');
  });

  test('does not trigger ORCID lookup for invalid identifiers', async ({ page }) => {
    const requests: string[] = [];

    await page.route('**/pub.orcid.org/v3.0/**', async route => {
      requests.push(route.request().url());
      await route.fulfill({ status: 200, body: '{}' });
    });

    await page.locator('#input-contributor-lastname').fill('Existing');
    await page.locator('#input-contributor-firstname').fill('Contributor');

    await page.locator('#input-contributor-orcid').fill('1234');
    await page.locator('#input-contributor-firstname').click();
    await page.waitForTimeout(400);

    expect(requests).toHaveLength(0);
    await expect(page.locator('#input-contributor-lastname')).toHaveValue('Existing');
    await expect(page.locator('#input-contributor-firstname')).toHaveValue('Contributor');
  });

  test('supports selecting multiple contributor roles via Tagify', async ({ page }) => {
    await page.waitForFunction(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      return !!input?._tagify && input._tagify.whitelist?.length >= 3;
    });

    await page.evaluate(() => {
      const input: any = document.querySelector('#input-contributor-personrole');
      input._tagify.removeAllTags();
      input._tagify.addTags(['Data Curator', 'Software Developer']);
    });

    const roleValue = await page.locator('#input-contributor-personrole').inputValue();
    expect(roleValue).toContain('Data Curator');
    expect(roleValue).toContain('Software Developer');

    const renderedTags = page.locator(SELECTORS.formGroups.contributorPersons).locator('.tagify__tag');
    await expect(renderedTags).toHaveCount(2);
    await expect(renderedTags.nth(0)).toContainText('Data Curator');
    await expect(renderedTags.nth(1)).toContainText('Software Developer');
  });
});