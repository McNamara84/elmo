const fs = require('fs');
const path = require('path');

describe('authorStack person authors', () => {
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
            <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]" checked>
            <label for="checkbox-author-contactperson">Contact Person</label>
            <input id="input-author-orcid" name="orcids[]" value="0000-0001-2345-6789">
            <label for="input-author-orcid">ORCID</label>
            <input id="input-author-lastname" name="familynames[]" value="Doe">
            <label for="input-author-lastname">Last Name</label>
            <input id="input-author-firstname" name="givennames[]" value="Jane">
            <label for="input-author-firstname">First Name</label>
            <input id="input-author-affiliation" name="personAffiliation[]" value='[{"value":"GFZ"}]'>
            <input id="input-author-rorid" name="authorPersonRorIds[]" value="https://ror.org/04z8jg394">
            <button type="button" class="drag-handle"></button>
            <button type="button" id="button-author-add" class="addAuthor" data-author-add-type="person">+</button>
            <div class="contact-person-input">
              <input id="input-contactperson-email" name="cpEmail[]" value="jane@example.org">
              <label for="input-contactperson-email">Email</label>
            </div>
            <div class="contact-person-input">
              <input id="input-contactperson-website" name="cpOnlineResource[]" value="https://example.org/jane">
              <label for="input-contactperson-website">Website</label>
            </div>
          </div>
          <div class="row" data-author-entry-row data-author-entry-type="institution" data-author-entry-key="author-institution-0" data-authorinstitution-row>
            <input id="input-authorinstitution-name" name="authorinstitutionName[]">
            <label for="input-authorinstitution-name">Institution</label>
            <input id="input-authorinstitution-affiliation" name="institutionAffiliation[]">
            <input id="input-author-institutionrorid" name="authorInstitutionRorIds[]">
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
    window.affiliationsData = [{ id: '04z8jg394', name: 'GFZ' }];
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

  test('keeps an existing person author and serializes it through authorsPayload', () => {
    expect($('[data-author-card]').length).toBe(1);
    expect(payload()).toEqual([
      expect.objectContaining({
        type: 'person',
        familyname: 'Doe',
        givenname: 'Jane',
        orcid: '0000-0001-2345-6789',
        isContact: true,
        email: 'jane@example.org',
        website: 'https://example.org/jane'
      })
    ]);
    expect(payload()[0].affiliations).toEqual([{ label: 'GFZ', rorId: '04z8jg394' }]);
    expect($('[data-author-summary-count]').text()).toBe('1 entry');
  });

  test('adds a clean person author card from the combined stack', () => {
    $('#button-author-add').trigger('click');

    const rows = $('[data-creator-row]');
    expect(rows.length).toBe(2);

    const newRow = rows.last();
    expect(newRow.find('input[name="familynames[]"]').attr('id')).toMatch(/^input-author-lastname-\d+$/);
    expect(newRow.find('input[name="givennames[]"]').attr('id')).toMatch(/^input-author-firstname-\d+$/);
    expect(newRow.find('input[name="cpEmail[]"]').attr('id')).toMatch(/^input-contactperson-email-\d+$/);
    expect(newRow.find('label[for^="input-author-lastname-"]').length).toBe(1);
    expect(newRow.find('label[for^="input-author-firstname-"]').length).toBe(1);
    expect(newRow.find('[data-author-remove]').length).toBe(1);
    expect(newRow.find('#button-author-add').length).toBe(0);
    expect(newRow.find('input[name="familynames[]"]').val()).toBe('');
    expect(newRow.find('input[name="givennames[]"]').val()).toBe('');
    expect(newRow.find('input[name="contacts[]"]').prop('checked')).toBe(false);
    expect(newRow.find('[data-author-affiliation-editor]').length).toBe(1);

    newRow.find('input[name="familynames[]"]').val('Curie').trigger('input');
    newRow.find('input[name="givennames[]"]').val('Marie').trigger('input');

    expect(payload().map((author) => author.familyname)).toEqual(['Doe', 'Curie']);
    expect(window.replaceHelpButtonInClonedRows).toHaveBeenCalled();
    expect($.fn.sortable).toHaveBeenCalledWith('refresh');
  });

  test('removing a new person card preserves the original author values', () => {
    $('#button-author-add').trigger('click');
    $('[data-creator-row]').last().find('[data-author-remove]').trigger('click');

    const originalRow = $('[data-creator-row]').first();
    expect($('[data-creator-row]').length).toBe(1);
    expect(originalRow.find('input[name="familynames[]"]').val()).toBe('Doe');
    expect(originalRow.find('input[name="givennames[]"]').val()).toBe('Jane');
    expect(originalRow.find('input[name="personAffiliation[]"]').val()).toBe('[{"value":"GFZ"}]');
    expect(payload()).toHaveLength(1);
  });
});
