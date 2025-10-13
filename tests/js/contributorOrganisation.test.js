const fs = require('fs');
const path = require('path');

describe('contributor-organisation.js', () => {
  let $;
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="group-contributororganisation">
        <div class="row">
          <div class="row-label">label</div>
          <label for="input-contributor-name"></label>
          <div class="input-group has-validation">
            <input type="text" id="input-contributor-name" value="old" required />
            <div class="invalid-feedback" style="display:none"></div>
            <div class="valid-feedback" style="display:none"></div>
          </div>
          <label for="input-contributor-organisationrole"></label>
          <div class="input-group has-validation role-group">
            <input id="input-contributor-organisationrole" value="role" required />
            <span class="input-group-text"><i class="bi bi-question-circle-fill"></i></span>
            <div class="invalid-feedback"></div>
          </div>
          <label for="input-contributor-organisationaffiliation"></label>
          <div class="input-group has-validation aff-group">
            <input type="text" id="input-contributor-organisationaffiliation" value="aff" required />
            <span class="input-group-text"><i class="bi bi-question-circle-fill"></i></span>
            <input type="hidden" id="input-contributor-organisationrorid" value="1" />
            <div class="invalid-feedback"></div>
          </div>
          <div class="tagify"></div>
          <button type="button" id="button-contributor-addorganisation" class="addContributor"></button>
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    global.createRemoveButton = jest.fn(() => $('<button class="removeButton"></button>'));
    global.replaceHelpButtonInClonedRows = jest.fn();
    global.setupRolesDropdown = jest.fn();
    global.autocompleteAffiliations = jest.fn();
    global.validateAllMandatoryFields = jest.fn();

    window.affiliationsData = [{ id: '1', name: 'Org' }];

    let script = fs.readFileSync(path.resolve(__dirname, '../../js/eventhandlers/formgroups/contributor-organisation.js'), 'utf8');
    script = script.replace("import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';", 'const { createRemoveButton, replaceHelpButtonInClonedRows } = window;');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\}\);\s*$/, '\n})();');
    window.eval(script);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.createRemoveButton;
    delete global.replaceHelpButtonInClonedRows;
    delete global.setupRolesDropdown;
    delete global.autocompleteAffiliations;
    delete global.validateAllMandatoryFields;
    delete window.affiliationsData;
  });

  test('adds a new contributor organisation row with updated fields and IDs', () => {
    $('#button-contributor-addorganisation').trigger('click');

    const rows = $('#group-contributororganisation .row');
    expect(rows.length).toBe(2);

    const newRow = rows.last();
    expect(global.replaceHelpButtonInClonedRows).toHaveBeenCalled();

    const rowIndex = 1;
    expect(newRow.find(`#input-contributor-name-${rowIndex}`).length).toBe(1);
    expect(newRow.find(`label[for="input-contributor-name-${rowIndex}"]`).length).toBe(1);
    expect(newRow.find(`#input-contributor-organisationrole-${rowIndex}`).length).toBe(1);
    expect(newRow.find(`label[for="input-contributor-organisationrole-${rowIndex}"]`).length).toBe(1);
    expect(newRow.find(`#input-contributor-organisationaffiliation-${rowIndex}`).length).toBe(1);
    expect(newRow.find(`#input-contributor-organisationrorid-${rowIndex}`).length).toBe(1);

    expect(newRow.find('.removeButton').length).toBe(1);
    expect(newRow.find('.tagify').length).toBe(0);

    expect(newRow.find(`#input-contributor-name-${rowIndex}`).val()).toBe('');
    expect(newRow.find(`#input-contributor-organisationrole-${rowIndex}`).val()).toBe('');
    expect(newRow.find(`#input-contributor-organisationaffiliation-${rowIndex}`).val()).toBe('');

    expect(global.setupRolesDropdown).toHaveBeenCalledWith(['institution', 'both'], `#input-contributor-organisationrole-${rowIndex}`);
    expect(global.autocompleteAffiliations).toHaveBeenCalledWith(
      `input-contributor-organisationaffiliation-${rowIndex}`,
      `input-contributor-organisationrorid-${rowIndex}`,
      window.affiliationsData
    );
  });

  test('remove button deletes row and triggers validation', () => {
    $('#button-contributor-addorganisation').trigger('click');
    const newRow = $('#group-contributororganisation .row').last();
    newRow.find('.removeButton').trigger('click');

    expect($('#group-contributororganisation .row').length).toBe(1);
    expect(global.validateAllMandatoryFields).toHaveBeenCalled();
  });
});