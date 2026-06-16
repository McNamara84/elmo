const fs = require('fs');
const path = require('path');

describe('authorStack institution authors', () => {
  let $;

  function loadAuthorStackScript() {
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/formgroups/authorStack.js'),
      'utf8'
    );
    script = script.replace(/^import.*$/gm, '');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\s*\}\);\s*$/, '\n})();');
    window.eval(script);
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <span data-author-summary-count>0 entries</span>
      <span data-author-contact-summary>at least 1 contact required</span>
      <input type="hidden" id="authors-payload" name="authorsPayload" value="[]">
      <div id="group-author" data-author-stack-shell>
        <div id="group-author-stack" data-author-stack>
          <div class="row" data-author-entry-row data-author-entry-type="person" data-author-entry-key="author-person-0" data-creator-row>
            <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]">
            <label for="checkbox-author-contactperson">Contact Person</label>
            <input id="input-author-orcid" name="orcids[]">
            <label for="input-author-orcid">ORCID</label>
            <input id="input-author-lastname" name="familynames[]">
            <label for="input-author-lastname">Last Name</label>
            <input id="input-author-firstname" name="givennames[]">
            <label for="input-author-firstname">First Name</label>
            <input id="input-author-affiliation" name="personAffiliation[]">
            <input id="input-author-rorid" name="authorPersonRorIds[]">
            <button type="button" class="drag-handle"></button>
            <button type="button" id="button-author-add" class="addAuthor" data-author-add-type="person">+</button>
            <div class="contact-person-input">
              <input id="input-contactperson-email" name="cpEmail[]">
              <label for="input-contactperson-email">Email</label>
            </div>
            <div class="contact-person-input">
              <input id="input-contactperson-website" name="cpOnlineResource[]">
              <label for="input-contactperson-website">Website</label>
            </div>
          </div>
          <div class="row" data-author-entry-row data-author-entry-type="institution" data-author-entry-key="author-institution-0" data-authorinstitution-row>
            <input id="input-authorinstitution-name" name="authorinstitutionName[]" value="GFZ Data Services">
            <label for="input-authorinstitution-name">Institution</label>
            <input id="input-authorinstitution-affiliation" name="institutionAffiliation[]" value='[{"value":"Helmholtz Association"}]'>
            <label for="input-authorinstitution-affiliation">Affiliation</label>
            <input id="input-author-institutionrorid" name="authorInstitutionRorIds[]" value="https://ror.org/0281dp749">
            <button type="button" class="drag-handle"></button>
            <button type="button" id="button-authorinstitution-add" class="addauthorinstitution" data-author-add-type="institution">+</button>
          </div>
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    $.fn.sortable = jest.fn(function () {
      return this;
    });

    window.createRemoveButton = jest.fn(() => $('<button type="button" class="removeButton"></button>'));
    window.replaceHelpButtonInClonedRows = jest.fn();
    window.translateClonedRow = jest.fn();
    window.autocompleteAffiliations = jest.fn();
    window.affiliationsData = [{ id: '0281dp749', name: 'Helmholtz Association' }];
    window.bootstrap = { Tooltip: jest.fn() };

    loadAuthorStackScript();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.elmo;
  });

  function payload() {
    return JSON.parse(document.querySelector('input[name="authorsPayload"]').value);
  }

  test('keeps an existing institution author and serializes it through authorsPayload', () => {
    expect($('[data-author-card]').length).toBe(1);
    expect(payload()).toEqual([
      expect.objectContaining({
        type: 'institution',
        institutionname: 'GFZ Data Services'
      })
    ]);
    expect(payload()[0].affiliations).toEqual([
      { label: 'Helmholtz Association', rorId: '0281dp749' }
    ]);
    expect($('[data-author-card]').first().find('[data-author-contact-toggle]').length).toBe(0);
  });

  test('adds a clean institution author card from the combined stack', () => {
    $('#button-authorinstitution-add').trigger('click');

    const rows = $('[data-authorinstitution-row]');
    expect(rows.length).toBe(2);

    const newRow = rows.last();
    expect(newRow.find('input[name="authorinstitutionName[]"]').attr('id')).toMatch(/^input-authorinstitution-name-\d+$/);
    expect(newRow.find('input[name="institutionAffiliation[]"]').attr('id')).toMatch(/^input-authorinstitution-affiliation-\d+$/);
    expect(newRow.find('input[name="authorInstitutionRorIds[]"]').attr('id')).toMatch(/^input-author-institutionrorid-\d+$/);
    expect(newRow.find('label[for^="input-authorinstitution-name-"]').length).toBe(1);
    expect(newRow.find('[data-author-remove]').length).toBe(1);
    expect(newRow.find('#button-authorinstitution-add').length).toBe(0);
    expect(newRow.find('input[name="authorinstitutionName[]"]').val()).toBe('');
    expect(newRow.find('[data-author-contact-toggle]').length).toBe(0);
    expect(newRow.find('[data-author-affiliation-editor]').length).toBe(1);

    newRow.find('input[name="authorinstitutionName[]"]').val('European Plate Observatory').trigger('input');

    expect(payload().map((author) => author.institutionname)).toEqual([
      'GFZ Data Services',
      'European Plate Observatory'
    ]);
    expect(window.replaceHelpButtonInClonedRows).toHaveBeenCalled();
    expect($.fn.sortable).toHaveBeenCalledWith('refresh');
  });

  test('removing a new institution card preserves the original institution values', () => {
    $('#button-authorinstitution-add').trigger('click');
    $('[data-authorinstitution-row]').last().find('[data-author-remove]').trigger('click');

    const originalRow = $('[data-authorinstitution-row]').first();
    expect($('[data-authorinstitution-row]').length).toBe(1);
    expect(originalRow.find('input[name="authorinstitutionName[]"]').val()).toBe('GFZ Data Services');
    expect(originalRow.find('input[name="institutionAffiliation[]"]').val()).toBe('[{"value":"Helmholtz Association"}]');
    expect(payload()).toHaveLength(1);
  });
});
