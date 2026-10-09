import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../utils/constants';
import { test, expect } from '@playwright/test';
import { APP_BASE_URL, registerStaticAssetRoutes, SELECTORS } from '../utils';

// Use the same templates as the application, with both feature flags enabled.
const contributorGroupMarkup = readFileSync(path.join(REPO_ROOT, 'formgroups/contributors.html'), 'utf8')
  .replace(/<\?php[\s\S]*?\?>/g, '');

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
    <script src="js/validation/orcidValidation.js"></script>
    <script src="js/autocomplete.js"></script>
    <script type="module" src="js/eventhandlers/formgroups/contributorStack.js"></script>
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

    // Mock the new server-side affiliations search API endpoint
    await page.route('**/api/v2/affiliations/search**', async route => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q')?.toLowerCase() || '';
      
      // Filter affiliations based on search query
      const filtered = affiliationFixtures.filter((aff: any) => 
        aff.name.toLowerCase().includes(query) ||
        (aff.other || []).some((alt: string) => alt.toLowerCase().includes(query))
      );
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filtered.slice(0, 20))
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
    await page.locator('[data-contributor-add-type="person"]').click();
    await page.waitForFunction(() => {
      const roleInput: any = document.querySelector('input[id^="input-contributor-personrole-"]');
      const affiliationInput: any = document.querySelector('input[id^="input-contributorpersons-affiliation-"]');
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
    await expect(page.locator('b[data-translate="contributors.title"]')).toBeVisible();

    await expect(page.locator('input[id^="input-contributor-orcid-"]')).toBeVisible();
    await expect(page.locator('input[id^="input-contributor-orcid-"]')).toHaveAttribute('pattern', '^[0-9]{4}-[0-9]{4}-[0-9]{4}-([0-9]{4}|[0-9]{3}X)$');

    await expect(page.locator('input[id^="input-contributor-lastname-"]')).toBeVisible();
    await expect(page.locator('input[id^="input-contributor-firstname-"]')).toBeVisible();

    const roleTagify = page.locator(`${SELECTORS.formGroups.contributorPersons} .tagify`).first();
    await expect(roleTagify).toBeVisible();
    await expect(roleTagify.locator('.tagify__input')).toBeVisible();

    await expect(page.locator('[data-help-section-id="help-contributorpersons-orcid"]')).toHaveCount(1);
    await expect(page.locator('[data-help-section-id="help-contributorpersons-role"]')).toHaveCount(1);
    await expect(page.locator('[data-help-section-id="help-contributorinstitutions-affiliation"]')).toHaveCount(1);

    await expect(page.locator('input[id^="input-contributor-personrorid-"]')).toHaveAttribute('type', 'hidden');
  });

  test('populates contributor details and affiliations from a valid ORCID', async ({ page }) => {
    await page.route('**/pub.orcid.org/v3.0/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockContributorOrcidRecord)
      });
    });

    await page.locator('input[id^="input-contributor-orcid-"]').fill('0000-0003-1825-0094');
    await page.locator('input[id^="input-contributor-lastname-"]').click();

    await expect(page.locator('input[id^="input-contributor-lastname-"]')).toHaveValue('Nguyen');
    await expect(page.locator('input[id^="input-contributor-firstname-"]')).toHaveValue('Linh');

    await page.waitForFunction(() => {
      const input: any = document.querySelector('input[id^="input-contributorpersons-affiliation"]');
      return input?._tagify?.value?.length === 2;
    });

    const affiliationValues = await page.evaluate(() => {
      const input: any = document.querySelector('input[id^="input-contributorpersons-affiliation"]');
      return input._tagify.value.map((tag: { value: string }) => tag.value);
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
    const addButton = page.locator('[data-contributor-add-type="person"]');
    await addButton.click();

    const rows = page.locator('[data-contributor-card][data-contributor-type="person"]');
    await expect(rows).toHaveCount(2);

    const firstOrcidId = await rows.nth(0).locator('input[name="cbORCID[]"]').getAttribute('id');
    const secondOrcidId = await rows.nth(1).locator('input[name="cbORCID[]"]').getAttribute('id');
    expect(firstOrcidId).not.toBe(secondOrcidId);

    await expect(page.locator('[data-contributor-card]').nth(1).locator('[data-contributor-remove]')).toBeVisible();

    await rows.nth(1).locator('input[name="cbPersonLastname[]"]').fill('Rivera');
    await rows.nth(1).locator('input[name="cbPersonFirstname[]"]').fill('Elena');

    await page.locator('[data-contributor-card]').nth(1).locator('[data-contributor-remove]').click();
    await expect(rows).toHaveCount(1);

    await expect(rows.nth(0).locator('input[name="cbPersonLastname[]"]').first()).not.toHaveValue('Rivera');
  });

  test('does not trigger ORCID lookup for invalid identifiers', async ({ page }) => {
    const requests: string[] = [];

    await page.route('**/pub.orcid.org/v3.0/**', async route => {
      requests.push(route.request().url());
      await route.fulfill({ status: 200, body: '{}' });
    });

    await page.locator('input[id^="input-contributor-lastname-"]').fill('Existing');
    await page.locator('input[id^="input-contributor-firstname-"]').fill('Contributor');

    await page.locator('input[id^="input-contributor-orcid-"]').fill('1234');
    await page.locator('input[id^="input-contributor-firstname-"]').click();

    expect(requests).toHaveLength(0);
    await expect(page.locator('input[id^="input-contributor-lastname-"]')).toHaveValue('Existing');
    await expect(page.locator('input[id^="input-contributor-firstname-"]')).toHaveValue('Contributor');
  });

  test('supports selecting multiple contributor roles via Tagify', async ({ page }) => {
    await page.waitForFunction(() => {
      const input: any = document.querySelector('input[id^="input-contributor-personrole-"]');
      return !!input?._tagify && input._tagify.whitelist?.length >= 3;
    });

    await page.evaluate(() => {
      const input: any = document.querySelector('input[id^="input-contributor-personrole-"]');
      input._tagify.removeAllTags();
      input._tagify.addTags(['Data Curator', 'Software Developer']);
    });

    const roleValue = await page.locator('input[id^="input-contributor-personrole-"]').inputValue();
    expect(roleValue).toContain('Data Curator');
    expect(roleValue).toContain('Software Developer');

    const renderedTags = page.locator(SELECTORS.formGroups.contributorPersons).locator('.tagify__tag');
    await expect(renderedTags).toHaveCount(2);
    await expect(renderedTags.nth(0)).toContainText('Data Curator');
    await expect(renderedTags.nth(1)).toContainText('Software Developer');
  });

  test('affiliation dropdown displays correctly on slim screens without text overlap (Issue #686)', async ({ page }) => {
    // Set viewport to mobile size (narrow screen) to test the issue scenario
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for affiliation field to be initialized with Tagify
    // Cards expose their affiliation widget through the input element.
    await page.waitForFunction(() => {
      const input: any = document.querySelector('input[id^="input-contributorpersons-affiliation-"]');
      return !!input?.tagify || !!input?._tagify;
    });

    // Type search term to trigger server-side search and populate dropdown
    const affiliationInput = page.locator('input[id^="input-contributorpersons-affiliation-"]').locator('..').locator('.tagify__input');
    await affiliationInput.click();
    await affiliationInput.fill('University');
    
    // Wait for dropdown to appear after server search
    
    // Wait for dropdown to appear
    const dropdown = page.locator('.tagify__dropdown.affiliation');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Verify dropdown wrapper has reasonable minimum width (prevents items being too narrow)
    const dropdownWrapper = dropdown.locator('.tagify__dropdown__wrapper');
    await expect(dropdownWrapper).toBeVisible();
    
    const wrapperBox = await dropdownWrapper.boundingBox();
    expect(wrapperBox).not.toBeNull();
    if (wrapperBox) {
      // On mobile (375px viewport), dropdown should have at least 200px width (per CSS)
      expect(wrapperBox.width).toBeGreaterThanOrEqual(200);
    }

    // Check that dropdown items are visible and rendered
    // We need at least 2 items to test for overlap (hence "University" search term - returns many results)
    const dropdownItems = dropdown.locator('.tagify__dropdown__item');
    const itemCount = await dropdownItems.count();
    expect(itemCount).toBeGreaterThan(1);
    await expect(dropdownItems.first()).toBeVisible();

    // Verify items don't overlap by checking their vertical positions
    // This is the core issue from #686: items were overlapping on slim screens
    if (itemCount > 1) {
      const firstItemBox = await dropdownItems.first().boundingBox();
      const secondItemBox = await dropdownItems.nth(1).boundingBox();
      
      expect(firstItemBox).not.toBeNull();
      expect(secondItemBox).not.toBeNull();
      
      if (firstItemBox && secondItemBox) {
        // Second item should start at or below first item's bottom edge (no overlap)
        // Allow 1px tolerance for rounding
        expect(secondItemBox.y).toBeGreaterThanOrEqual(firstItemBox.y + firstItemBox.height - 1);
        
        // Items should have reasonable height (not collapsed to 0)
        expect(firstItemBox.height).toBeGreaterThan(10);
        expect(secondItemBox.height).toBeGreaterThan(10);
      }
    }
  });
});
