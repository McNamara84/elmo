import { expect, test } from '@playwright/test';
import path from 'node:path';
import { completeMinimalDatasetForm, REPO_ROOT, SELECTORS } from '../utils';

type TagifyInputElement = HTMLInputElement & {
  _tagify?: {
    addTags: (tags: { value: string }[]) => void;
    value?: Array<{ value: string }>;
  };
};

type ElmoWindow = Window &
  typeof globalThis & {
    updateMapOverlay?: (rowId: string) => void;
    deleteDrawnOverlaysForRow?: (rowId: string) => void;
    __deletedRows?: string[];
    __elmoMarkers?: unknown[];
    __elmoRectangles?: unknown[];
  };

const TEST_FORM_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Metadata form reset fixture</title>
  </head>
  <body>
    <main class="container">
      <form id="form-mde" class="needs-validation">
        <section id="resource-information">
          <div>
            <label for="input-resourceinformation-publicationyear">Publication Year (YYYY)*</label>
            <input id="input-resourceinformation-publicationyear" name="year" type="text" />
          </div>
          <div>
            <label for="input-resourceinformation-resourcetype">Resource Type*</label>
            <select id="input-resourceinformation-resourcetype" name="resourcetype">
              <option value=""></option>
              <option value="5">Dataset</option>
            </select>
          </div>
          <div>
            <label for="input-resourceinformation-language">Language of dataset*</label>
            <select id="input-resourceinformation-language" name="language">
              <option value=""></option>
              <option value="1">English</option>
            </select>
          </div>
          <div>
            <label for="input-resourceinformation-title">Title*</label>
            <input id="input-resourceinformation-title" name="title[]" type="text" />
          </div>
          <div>
            <label for="input-abstract">Abstract*</label>
            <textarea id="input-abstract" name="abstract"></textarea>
          </div>
          <div>
            <label for="input-datecreated">Date created*</label>
            <input id="input-datecreated" name="dateCreated" type="text" />
          </div>
        </section>

        <section id="authors-section">
          <div id="group-author">
            <div class="author-row" data-creator-row>
              <div>
                <label>
                  <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]" />
                  ContactPerson?
                </label>
                <input type="text" id="input-author-orcid" name="orcids[]" />
              </div>
              <div>
                <label for="input-author-lastname">Last Name*</label>
                <input type="text" id="input-author-lastname" name="familynames[]" />
              </div>
              <div>
                <label for="input-author-firstname">First Name*</label>
                <input type="text" id="input-author-firstname" name="givennames[]" />
              </div>
              <div class="affiliation">
                <label for="input-author-affiliation">Affiliation</label>
                <tags>
                  <input type="text" id="input-author-affiliation" name="personAffiliation[]" />
                </tags>
                <input type="hidden" id="input-author-rorid" name="authorPersonRorIds[]" />
              </div>
              <div>
                <button type="button" id="button-author-add">Add Author</button>
              </div>
              <div class="contact-person-input">
                <label for="input-contactperson-email">Email address*</label>
                <input type="email" id="input-contactperson-email" name="cpEmail[]" />
              </div>
              <div class="contact-person-input">
                <label for="input-contactperson-website">Website</label>
                <input type="text" id="input-contactperson-website" name="cpOnlineResource[]" />
              </div>
            </div>
          </div>
        </section>

        <section id="keywords-section">
          <label for="input-freekeyword">Free Keyword</label>
          <input id="input-freekeyword" name="freekeywords[]" type="text" />
        </section>

        <section id="funding-section">
          <div id="group-fundingreference">
            <div class="row funding-row" funding-reference-row>
              <div>
                <label for="input-funder">Funder</label>
                <input id="input-funder" name="funder[]" type="text" />
              </div>
              <div>
                <label for="input-grantnumber">Grant Number</label>
                <input id="input-grantnumber" name="grantNummer[]" type="text" />
              </div>
              <div>
                <label for="input-grantname">Grant Name</label>
                <input id="input-grantname" name="grantName[]" type="text" />
              </div>
              <div>
                <label for="input-awarduri">Award URI</label>
                <input id="input-awarduri" name="awardURI[]" type="text" />
              </div>
              <div>
                <button type="button" id="button-fundingreference-add">Add Funding</button>
              </div>
            </div>
          </div>
        </section>

        <section id="stc-section">
          <div id="group-stc">
            <div class="row" tsc-row tsc-row-id="1">
              <div>
                <label for="input-stc-latmin_1">Latitude Min</label>
                <input id="input-stc-latmin_1" name="tscLatitudeMin[]" type="text" />
                <label for="input-stc-latmax_1">Latitude Max</label>
                <input id="input-stc-latmax_1" name="tscLatitudeMax[]" type="text" />
              </div>
              <div>
                <label for="input-stc-longmin_1">Longitude Min</label>
                <input id="input-stc-longmin_1" name="tscLongitudeMin[]" type="text" />
                <label for="input-stc-longmax_1">Longitude Max</label>
                <input id="input-stc-longmax_1" name="tscLongitudeMax[]" type="text" />
              </div>
              <div>
                <label for="input-stc-description">Description</label>
                <textarea id="input-stc-description" name="tscDescription[]"></textarea>
              </div>
              <div>
                <label for="input-stc-datestart">Start Date</label>
                <input id="input-stc-datestart" name="tscDateStart[]" type="date" />
                <label for="input-stc-dateend">End Date</label>
                <input id="input-stc-dateend" name="tscDateEnd[]" type="date" />
              </div>
              <div>
                <label for="input-stc-timezone">Timezone</label>
                <select id="input-stc-timezone" name="tscTimezone[]">
                  <option value=""></option>
                  <option value="+00:00">UTC+00:00</option>
                </select>
              </div>
              <div>
                <button type="button" id="button-stc-add">Add STC</button>
              </div>
            </div>
          </div>
        </section>
      </form>
      <button type="button" id="button-form-reset">Clear</button>
    </main>
  </body>
</html>`;

const FIXTURE_SETUP_SCRIPT = `(() => {
  function hideContactInputs(row) {
    var nodes = row.querySelectorAll('.contact-person-input');
    nodes.forEach(function (element) {
      element.style.display = 'none';
    });
  }

  function setupContactToggle(row) {
    hideContactInputs(row);
    var checkbox = row.querySelector("input[id^='checkbox-author-contactperson']");
    if (!checkbox) {
      return;
    }
    checkbox.addEventListener('change', function () {
      var contactNodes = row.querySelectorAll('.contact-person-input');
      contactNodes.forEach(function (element) {
        if (checkbox.checked) {
          element.style.display = '';
        } else {
          element.style.display = 'none';
          element.querySelectorAll('input').forEach(function (input) {
            input.value = '';
          });
        }
      });
    });
  }

  document.querySelectorAll('[data-creator-row]').forEach(function (row) {
    setupContactToggle(row);
  });

  var authorAdd = document.getElementById('button-author-add');
  if (authorAdd) {
    authorAdd.addEventListener('click', function () {
      var group = document.getElementById('group-author');
      var template = group.querySelector('[data-creator-row]');
      var clone = template.cloneNode(true);
      clone.querySelectorAll('input').forEach(function (input) {
        if (input.type === 'checkbox') {
          input.checked = false;
        } else {
          input.value = '';
        }
      });
      clone.querySelectorAll('.contact-person-input').forEach(function (element) {
        element.style.display = 'none';
      });
      group.appendChild(clone);
      setupContactToggle(clone);
    });
  }

  var fundingAdd = document.getElementById('button-fundingreference-add');
  if (fundingAdd) {
    fundingAdd.addEventListener('click', function () {
      var group = document.getElementById('group-fundingreference');
      var template = group.querySelector('[funding-reference-row]');
      var clone = template.cloneNode(true);
      clone.querySelectorAll('input').forEach(function (input) {
        input.value = '';
      });
      group.appendChild(clone);
    });
  }

  var stcAdd = document.getElementById('button-stc-add');
  if (stcAdd) {
    stcAdd.addEventListener('click', function () {
      var group = document.getElementById('group-stc');
      var template = group.querySelector('[tsc-row]');
      var clone = template.cloneNode(true);
      var existing = group.querySelectorAll('[tsc-row]').length + 1;
      clone.setAttribute('tsc-row-id', String(existing));
      clone.querySelectorAll('input, textarea').forEach(function (input) {
        input.value = '';
      });
      var addButton = clone.querySelector('#button-stc-add');
      if (addButton) {
        addButton.removeAttribute('id');
        addButton.textContent = 'Remove STC';
        addButton.addEventListener('click', function () {
          group.removeChild(clone);
        });
      }
      group.appendChild(clone);
    });
  }

  var keywordInput = document.getElementById('input-freekeyword');
  if (keywordInput && !keywordInput._tagify) {
    keywordInput.tagify = keywordInput._tagify = {
      value: [],
      addTags: function (tags) {
        var entries = Array.isArray(tags) ? tags : [tags];
        for (var i = 0; i < entries.length; i += 1) {
          var entry = entries[i];
          this.value.push(typeof entry === 'string' ? { value: entry } : entry);
        }
      },
      removeAllTags: function () {
        this.value = [];
      },
    };
  }

  window.__elmoMarkers = [];
  window.__elmoRectangles = [];
  window.updateMapOverlay = function (rowId) {
    window.__elmoMarkers.push(String(rowId));
  };
  window.deleteDrawnOverlaysForRow = function (rowId) {
    window.__deletedRows = window.__deletedRows || [];
    window.__deletedRows.push(String(rowId));
    window.__elmoMarkers = window.__elmoMarkers.filter(function (id) {
      return id !== String(rowId);
    });
    window.__elmoRectangles = [];
  };
  window.updateOverlayLabels = function () {};
  window.fitMapBounds = function () {};

  var resetButton = document.getElementById('button-form-reset');
  if (resetButton) {
    resetButton.addEventListener('click', function () {
      if (typeof window.clearInputFields === 'function') {
        window.clearInputFields();
      }
    });
  }
})();`;

test.describe('Metadata form reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(TEST_FORM_HTML);
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'node_modules/jquery/dist/jquery.min.js') });
    await page.addScriptTag({ path: path.join(REPO_ROOT, 'js/clear.js') });
    await page.addScriptTag({ content: FIXTURE_SETUP_SCRIPT });
  });

  test('clears populated form groups and restores a pristine state', async ({ page }) => {
    await completeMinimalDatasetForm(page);

    const authorRows = page.locator(`${SELECTORS.formGroups.authors} [data-creator-row]`);
    const firstAuthorRow = authorRows.first();
    const firstContactEmail = firstAuthorRow.locator('input[name="cpEmail[]"]');
    const firstContactWebsite = firstAuthorRow.locator('input[name="cpOnlineResource[]"]');

    await firstContactEmail.fill('alice@example.com');
    await firstContactWebsite.fill('https://example.com/alice');

    await page.locator('#button-author-add').click();
    await expect(authorRows).toHaveCount(2);

    const secondAuthorRow = authorRows.nth(1);
    await secondAuthorRow.locator('input[name="familynames[]"]').fill('Doe');
    await secondAuthorRow.locator('input[name="givennames[]"]').fill('Charlie');
    await secondAuthorRow.locator('input[name="personAffiliation[]"]').fill('Institute of Metadata');

    const secondContactEmail = secondAuthorRow.locator('input[name="cpEmail[]"]');
    await secondAuthorRow.locator("input[id^='checkbox-author-contactperson']").check();
    await secondContactEmail.fill('charlie@example.com');
    await secondAuthorRow.locator('input[name="cpOnlineResource[]"]').fill('https://example.com/charlie');

    await page.evaluate(() => {
      const input = document.getElementById('input-freekeyword') as TagifyInputElement | null;
      if (input && input._tagify) {
        input.value = 'Ocean Data, Climate Models';
        input._tagify.addTags([{ value: 'Ocean Data' }, { value: 'Climate Models' }]);
      }
    });

    const fundingRows = page.locator(`${SELECTORS.formGroups.fundingReference} [funding-reference-row]`);
    await fundingRows.first().locator('input[name="funder[]"]').fill('Global Science Foundation');
    await fundingRows.first().locator('input[name="grantNummer[]"]').fill('GSF-2025-01');
    await fundingRows.first().locator('input[name="grantName[]"]').fill('Ocean Observations');
    await fundingRows.first().locator('input[name="awardURI[]"]').fill('https://example.com/grants/ocean');

    await page.locator('#button-fundingreference-add').click();
    await expect(fundingRows).toHaveCount(2);
    const secondFundingRow = fundingRows.nth(1);
    await secondFundingRow.locator('input[name="funder[]"]').fill('Climate Research Fund');
    await secondFundingRow.locator('input[name="grantNummer[]"]').fill('CRF-42');
    await secondFundingRow.locator('input[name="grantName[]"]').fill('Atmospheric Studies');
    await secondFundingRow.locator('input[name="awardURI[]"]').fill('https://example.com/grants/atmosphere');

    const stcRows = page.locator(`${SELECTORS.formGroups.spatialTemporalCoverages} [tsc-row]`);
    const firstStcRow = stcRows.first();
    await firstStcRow.locator('input[name="tscLatitudeMin[]"]').fill('10');
    await firstStcRow.locator('input[name="tscLatitudeMax[]"]').fill('20');
    await firstStcRow.locator('input[name="tscLongitudeMin[]"]').fill('30');
    await firstStcRow.locator('input[name="tscLongitudeMax[]"]').fill('40');
    await firstStcRow.locator('textarea[name="tscDescription[]"]').fill('Northern observation window');
    await firstStcRow.locator('input[name="tscDateStart[]"]').fill('2024-01-01');
    await firstStcRow.locator('input[name="tscDateEnd[]"]').fill('2024-12-31');
    await firstStcRow.locator('select[name="tscTimezone[]"]').selectOption('+00:00');

    await page.locator('#button-stc-add').click();
    await expect(stcRows).toHaveCount(2);
    const secondStcRow = stcRows.nth(1);
    await secondStcRow.locator('input[name="tscLatitudeMin[]"]').fill('-5');
    await secondStcRow.locator('input[name="tscLongitudeMin[]"]').fill('55');
    await secondStcRow.locator('textarea[name="tscDescription[]"]').fill('Equatorial station');

    await page.evaluate(() => {
      const elmoWindow = window as ElmoWindow;
      if (typeof elmoWindow.updateMapOverlay === 'function') {
        elmoWindow.updateMapOverlay('1');
        elmoWindow.updateMapOverlay('2');
      }
      elmoWindow.__deletedRows = [];
      const originalDelete = elmoWindow.deleteDrawnOverlaysForRow;
      elmoWindow.deleteDrawnOverlaysForRow = (rowId: string) => {
        const rows = elmoWindow.__deletedRows ?? [];
        rows.push(String(rowId));
        elmoWindow.__deletedRows = rows;
        if (typeof originalDelete === 'function') {
          originalDelete(rowId);
        }
      };
      if (typeof elmoWindow.deleteDrawnOverlaysForRow === 'function') {
        elmoWindow.deleteDrawnOverlaysForRow('1');
        elmoWindow.deleteDrawnOverlaysForRow('2');
      }
    });

    await page.evaluate(() => {
      var titleField = document.getElementById('input-resourceinformation-title');
      var yearField = document.getElementById('input-resourceinformation-publicationyear');
      if (titleField) {
        titleField.classList.add('is-valid');
      }
      if (yearField) {
        yearField.classList.add('is-invalid');
      }
    });

    await page.locator('#button-form-reset').click();

    const titleField = page.locator('#input-resourceinformation-title');
    await expect(titleField).toHaveValue('');
    await expect(page.locator('#input-resourceinformation-publicationyear')).toHaveValue('');
    await expect(page.locator('#input-resourceinformation-language')).toHaveValue('');

    await expect(firstContactEmail).toHaveValue('');
    await expect(firstContactWebsite).toHaveValue('');
    await expect(authorRows).toHaveCount(1);

    const contactInputs = firstAuthorRow.locator('.contact-person-input');
    await expect(contactInputs.nth(0)).toBeHidden();
    await expect(contactInputs.nth(1)).toBeHidden();
    await expect(firstAuthorRow.locator('input[name="contacts[]"]').first()).not.toBeChecked();

    await page.waitForFunction(() => {
      const input = document.getElementById('input-freekeyword') as TagifyInputElement | null;
      return (
        !!input &&
        !!input._tagify &&
        Array.isArray(input._tagify.value) &&
        input._tagify.value.length === 0
      );
    });

    await expect(fundingRows).toHaveCount(1);
    await expect(fundingRows.first().locator('input[name="funder[]"]')).toHaveValue('');
    await expect(fundingRows.first().locator('input[name="grantNummer[]"]')).toHaveValue('');
    await expect(fundingRows.first().locator('input[name="grantName[]"]')).toHaveValue('');
    await expect(fundingRows.first().locator('input[name="awardURI[]"]')).toHaveValue('');

    await expect(stcRows).toHaveCount(1);
    await expect(firstStcRow.locator('input[name="tscLatitudeMin[]"]')).toHaveValue('');
    await expect(firstStcRow.locator('textarea[name="tscDescription[]"]')).toHaveValue('');
    await expect(firstStcRow.locator('select[name="tscTimezone[]"]')).toHaveValue('');

    const deletedRows = await page.evaluate(() => {
      const elmoWindow = window as ElmoWindow;
      return elmoWindow.__deletedRows || [];
    });
    if (deletedRows.length > 0) {
      expect(deletedRows).toContain('2');
    }

    const overlayState = await page.evaluate(() => {
      const elmoWindow = window as ElmoWindow;
      return {
        markers: Array.isArray(elmoWindow.__elmoMarkers) ? elmoWindow.__elmoMarkers.length : 0,
        rectangles: Array.isArray(elmoWindow.__elmoRectangles)
          ? elmoWindow.__elmoRectangles.length
          : 0,
      };
    });
    expect(overlayState.markers).toBe(0);
    expect(overlayState.rectangles).toBe(0);

    await page.locator('#button-author-add').click();
    await expect(authorRows).toHaveCount(2);
    await authorRows.nth(1).locator('input[name="familynames[]"]').fill('Newman');
    await expect(authorRows.nth(1).locator('input[name="familynames[]"]')).toHaveValue('Newman');
  });
});