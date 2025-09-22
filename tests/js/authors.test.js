const fs = require('fs');
const path = require('path');

describe('author.js', () => {
  let $;
  let suffix;
  const fixedTime = 1717072496000; // fixed timestamp for Date.now()

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(fixedTime));
    jest.spyOn(Date, 'now').mockReturnValue(fixedTime); // mock Date.now()
    suffix = Date.now();

    document.body.innerHTML = `
      <div id="group-author">
        <div class="row" data-creator-row>
          <div class="col p-1">
            <input type="checkbox" id="checkbox-author-contactperson" />
            <label class="btn" for="checkbox-author-contactperson">Contact Person</label>
          </div>
          <div class="col p-1">
            <input type="text" id="input-author-lastname" value="Doe" />
          </div>
          <div class="col p-1">
            <input type="text" id="input-author-firstname" value="John" />
          </div>
          <div class="col p-1">
            <input type="text" id="input-author-affiliation" value="Some Affil" />
            <input type="hidden" id="input-author-rorid" value="123" />
          </div>
          <div class="col p-1">
            <button type="button" id="button-author-add" class="addAuthor">+</button>
          </div>
          <div class="col p-1 contact-person-input">
            <input type="email" id="input-contactperson-email" value="test@example.com" />
          </div>
          <div class="col p-1 contact-person-input">
            <input type="text" id="input-contactperson-website" value="https://example.com" />
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
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  test('fügt neue Autoren-Zeile hinzu', () => {
    $('#button-author-add').trigger('click');

    const rows = $('#group-author .row');
    expect(rows.length).toBe(2);

    const newRow = rows.last();

    // IDs correctly adjusted
    expect(newRow.find(`#input-author-affiliation-${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-author-rorid-${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-contactperson-email-${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-contactperson-website-${suffix}`).length).toBe(1);
    expect(newRow.find(`#checkbox-author-contactperson-${suffix}`).length).toBe(1);

    // Fields cleared
    expect(newRow.find('input').filter(function () { return this.value; }).length).toBe(0);

    // Add button replaced by remove button
    expect(newRow.find('#button-author-add').length).toBe(0);
    expect(newRow.find('.removeButton').length).toBe(1);

    // Helper functions called
    expect(window.replaceHelpButtonInClonedRows).toHaveBeenCalledTimes(1);
    expect(window.createRemoveButton).toHaveBeenCalledTimes(1);

    // Autocomplete initialized
    expect(window.autocompleteAffiliations).toHaveBeenCalledWith(
      `input-author-affiliation-${suffix}`,
      `input-author-rorid-${suffix}`,
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