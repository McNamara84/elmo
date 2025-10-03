const fs = require('fs');
const path = require('path');

describe('author.js', () => {
  let $;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="group-author">
        <div class="row" data-creator-row>
          <!-- Contact Person + ORCID -->
          <div class="col-12 col-sm-12 col-md-5 col-lg-3 p-1">
            <div class="input-group has-validation">
              <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]" autocomplete="off">
              <label for="checkbox-author-contactperson">Contact Person</label>
              <div class="form-floating flex-grow-1">
                <input type="text" id="input-author-orcid" name="orcids[]" />
                <label for="input-author-orcid">ORCID</label>
              </div>
              <span class="input-group-text">
                <i class="bi bi-question-circle-fill"></i>
              </span>
            </div>
          </div>
          <!-- Lastname -->
          <div class="col-6 col-sm-6 col-md-4 col-lg-2 p-1">
            <input type="text" id="input-author-lastname" name="familynames[]" value="Doe" />
          </div>

          <!-- Firstname -->
          <div class="col-6 col-sm-6 col-md-4 col-lg-2 p-1">
            <input type="text" id="input-author-firstname" name="givennames[]" value="John" />
          </div>

          <!-- Affiliation -->
          <div class="col-10 col-sm-11 col-md-10 col-lg-4 p-1">
            <input type="text" id="input-author-affiliation" name="personAffiliation[]" value="Some Affil" />
            <input type="hidden" id="input-author-rorid" name="authorPersonRorIds[]" value="123" />
          </div>

          <!-- Add Button -->
          <div class="col-2 col-sm-1 col-md-1 col-lg-1 p-1">
            <button type="button" id="button-author-add" class="addAuthor">+</button>
          </div>
          <!-- Email -->
          <div class="col-12 col-sm-12 col-md-6 col-lg-6 p-1 contact-person-input">
            <input type="email" id="input-contactperson-email" name="cpEmail[]" value="test@example.com" />
          </div>

          <!-- Website -->
          <div class="col-12 col-sm-12 col-md-6 col-lg-5 p-1 contact-person-input">
            <input type="text" id="input-contactperson-website" name="cpOnlineResource[]" value="https://example.com" />
          </div>
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    // Mock jQuery UI sortable as No-Op in the test environment since drag-and-drop is not needed and not supported in jsdom, so that method calls do not fail.
    $.fn.sortable = jest.fn(() => $);


    // Mock functions
    window.createRemoveButton = jest.fn(() => $('<button type="button" class="removeButton"></button>'));
    window.replaceHelpButtonInClonedRows = jest.fn();
    window.autocompleteAffiliations = jest.fn();
    window.affiliationsData = [{ id: '1', name: 'Inst' }];

    // Load the script
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/formgroups/author.js'),
      'utf8'
    );
    script = script.replace(/^import.*$/gm, '');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\s*\}\);\s*$/, '\n})();');
    window.eval(script);

    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  test('fügt neue Autoren-Zeile hinzu', () => {
    $('#button-author-add').trigger('click');

    const rows = $('#group-author .row');
    expect(rows.length).toBe(2);

    const newRow = rows.last();

    // IDs correctly adjusted
    expect(newRow.find('#input-author-orcid-1').length).toBe(1);
    expect(newRow.find('#input-author-lastname-1').length).toBe(1);
    expect(newRow.find('#input-author-firstname-1').length).toBe(1);
    expect(newRow.find('#input-author-affiliation-1').length).toBe(1);
    expect(newRow.find('#input-author-rorid-1').length).toBe(1);
    expect(newRow.find('#input-contactperson-email-1').length).toBe(1);
    expect(newRow.find('#input-contactperson-website-1').length).toBe(1);
    expect(newRow.find('#checkbox-author-contactperson-1').length).toBe(1);
    expect(newRow.find("label[for='checkbox-author-contactperson-1']").length).toBe(1);
    expect(newRow.find('.removeButton').length).toBe(1);

    // Fields cleared
    expect(newRow.find('input[type="text"], input[type="email"]').filter(function () { return $(this).val(); }).length).toBe(0);
    expect(newRow.find('#input-author-rorid-1').val()).toBe('');
    expect(newRow.find('#checkbox-author-contactperson-1').prop('checked')).toBe(false);

    // Add button replaced by remove button
    expect(newRow.find('#button-author-add').length).toBe(0);

    // Helper functions called
    expect(window.replaceHelpButtonInClonedRows).toHaveBeenCalledTimes(1);
    expect(window.createRemoveButton).toHaveBeenCalledTimes(1);

    // Autocomplete initialized
    expect(window.autocompleteAffiliations).toHaveBeenCalledWith(
      'input-author-affiliation-1',
      'input-author-rorid-1',
      window.affiliationsData
    );

    // Test removal
    newRow.find('.removeButton').trigger('click');
    expect($('#group-author .row').length).toBe(1);
  });

  test('initialisiert Sortable mit Drag-Handle-Unterstützung für Buttons', () => {
    expect($.fn.sortable).toHaveBeenCalledTimes(1);
    expect($.fn.sortable.mock.calls[0][0]).toMatchObject({
      handle: '.drag-handle',
      cancel: 'input, textarea, select, option'
    });
  });
});