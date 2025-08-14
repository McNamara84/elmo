const fs = require('fs');
const path = require('path');

describe('contributor-person.js', () => {
  let $;
  let suffix;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-05-30T12:34:56Z'));
    suffix = Date.now();

    document.body.innerHTML = `
      <div id="group-contributorperson">
        <div class="row" contributor-person-row>
          <input id="input-contributor-orcid" class="is-invalid is-valid" value="abc" required />
          <input id="input-contributor-lastname" value="lname" required />
          <input id="input-contributor-firstname" value="fname" required />
          <div class="input-group has-validation role-group">
            <input name="cbPersonRoles[]" id="input-contributor-personrole" />
            <span class="input-group-text"><i class="bi bi-question-circle-fill" data-help-section-id="help-contributor-role"></i></span>
            <div class="invalid-feedback" style="display:none"></div>
            <div class="valid-feedback" style="display:none"></div>
          </div>
          <div class="input-group has-validation aff-group">
            <input type="text" id="input-contributorpersons-affiliation" />
            <span class="input-group-text"><i class="bi bi-question-circle-fill" data-help-section-id="help-contributor-affiliation"></i></span>
            <input type="hidden" id="input-contributor-personrorid" />
            <div class="invalid-feedback" style="display:none"></div>
            <div class="valid-feedback" style="display:none"></div>
          </div>
          <div class="row-label">Label</div>
          <button type="button" class="addContributorPerson" id="button-contributor-addperson">+</button>
          <div class="tagify"></div>
          <label for="input-contributor-orcid"></label>
          <label for="input-contributor-lastname"></label>
          <label for="input-contributor-firstname"></label>
          <label for="input-contributor-personrole"></label>
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    window.createRemoveButton = jest.fn(() => $('<button type="button" class="removeButton"></button>'));
    window.replaceHelpButtonInClonedRows = jest.fn();
    window.setupRolesDropdown = jest.fn();
    window.autocompleteAffiliations = jest.fn();
    window.validateAllMandatoryFields = jest.fn();
    window.affiliationsData = [{ id: '1', name: 'Aff' }];

    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/formgroups/contributor-person.js'),
      'utf8'
    );
    // remove possible ES module import lines to allow eval in CommonJS environment
    script = script.replace(/^import.*$/m, '');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\s*\}\);\s*$/, '\n})();');
    window.eval(script);
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  test('adds contributor row and sets up handlers', () => {
    $('#button-contributor-addperson').trigger('click');

    const rows = $('#group-contributorperson .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();

    expect(window.replaceHelpButtonInClonedRows).toHaveBeenCalledTimes(1);
    expect(window.createRemoveButton).toHaveBeenCalledTimes(1);

    expect(newRow.find(`#input-contributor-orcid${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-contributor-lastname${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-contributor-firstname${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-contributor-personrole${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-contributorpersons-affiliation${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-contributor-personrorid${suffix}`).length).toBe(1);

    // inputs reset
    expect(newRow.find('input').filter(function(){ return this.value; }).length).toBe(0);
    expect(newRow.find('input[required]').length).toBe(0);

    expect(newRow.find('.addContributorPerson').length).toBe(0);
    expect(newRow.find('.removeButton').length).toBe(1);

    expect(window.setupRolesDropdown).toHaveBeenCalledWith(['person','both'], `#input-contributor-personrole${suffix}`);
    expect(window.autocompleteAffiliations).toHaveBeenCalledWith(
      `input-contributorpersons-affiliation${suffix}`,
      `input-contributor-personrorid${suffix}`,
      window.affiliationsData
    );

    newRow.find('.removeButton').trigger('click');
    expect($('#group-contributorperson .row').length).toBe(1);
    expect(window.validateAllMandatoryFields).toHaveBeenCalled();
  });
});