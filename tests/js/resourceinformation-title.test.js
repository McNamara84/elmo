const fs = require('fs');
const path = require('path');

describe('resourceinformation-title.js', () => {
  let $;

  beforeEach(() => {
    // Set up DOM fixture matching the structure in formgroups/resourceInformation.html
    document.body.innerHTML = `
      <div id="group-resourceinformation">
        <div class="row">
          <div class="col-10 col-sm-11 col-md-11 col-lg-11 p-1">
            <div class="input-group has-validation">
              <div class="form-floating">
                <input type="text" class="form-control input-with-help input-right-no-round-corners"
                  id="input-resourceinformation-title" name="title[]" required />
                <label for="input-resourceinformation-title">Title</label>
              </div>
              <div class="input-group-append">
                <span class="input-group-text">
                  <i class="bi bi-question-circle-fill" data-help-section-id="help-resourceinformation-title"></i>
                </span>
              </div>
            </div>
          </div>
          <div class="col-10 col-md-3 p-1 unvisible" id="container-resourceinformation-titletype">
            <div class="input-group has-validation">
              <div class="form-floating">
                <select class="form-select input-with-help input-right-no-round-corners"
                  id="input-resourceinformation-titletype" name="titleType[]" required disabled>
                </select>
                <label for="input-resourceinformation-titletype">Title Type</label>
              </div>
              <div class="input-group-append">
                <span class="input-group-text">
                  <i class="bi bi-question-circle-fill" data-help-section-id="help-resourceinformation-titletype"></i>
                </span>
              </div>
            </div>
          </div>
          <div class="col-2 col-md-1 col-lg-1 p-1 d-flex justify-content-end align-items-center">
            <button type="button" class="btn btn-primary addTitle add-button"
              id="button-resourceinformation-addtitle">Add</button>
          </div>
        </div>
      </div>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    // Mock external function imported by the module
    window.replaceHelpButtonInClonedRows = jest.fn();

    // Set up window globals that would normally be populated by select.js AJAX
    window.maxTitles = 5;
    window.mainTitleTypeId = '1';
    window.alternativeTitleTypeId = '2';
    window.titleTypeOptionsHtml =
      '<option value="">Choose...</option>' +
      '<option value="1">Main Title</option>' +
      '<option value="2">Alternative Title</option>' +
      '<option value="3">Translated Title</option>';

    // Load and eval the script — strip ES module import and wrap document.ready
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/formgroups/resourceinformation-title.js'),
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
    delete window.maxTitles;
    delete window.mainTitleTypeId;
    delete window.alternativeTitleTypeId;
    delete window.titleTypeOptionsHtml;
    delete window.replaceHelpButtonInClonedRows;
  });

  test('adds a new title row when add button is clicked', () => {
    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
  });

  test('cloned title type select is NOT disabled even when original is disabled', () => {
    // Simulate the original select being disabled (as happens during AJAX loading)
    $('#input-resourceinformation-titletype').prop('disabled', true);

    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    const $clonedSelect = newRow.find('select');
    expect($clonedSelect.length).toBe(1);

    // The cloned select must be enabled so the user can pick a title type
    expect($clonedSelect.prop('disabled')).toBe(false);
  });

  test('cloned title type select is enabled even when original is enabled', () => {
    $('#input-resourceinformation-titletype').prop('disabled', false);

    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    const $clonedSelect = newRow.find('select');
    expect($clonedSelect.length).toBe(1);

    expect($clonedSelect.prop('disabled')).toBe(false);
  });

  test('cloned title type select stays disabled when no options are available and original is disabled', () => {
    // Simulate clicking "Add" while title types are still loading (original disabled)
    window.titleTypeOptionsHtml = '';
    $('#input-resourceinformation-titletype').prop('disabled', true);

    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    const $clonedSelect = newRow.find('select');
    expect($clonedSelect.length).toBe(1);

    // Select must be disabled when there are no options to choose from
    expect($clonedSelect.prop('disabled')).toBe(true);
  });

  test('cloned title type select becomes disabled when no options are available and original is enabled', () => {
    // The template select in resourceInformation.html is not disabled by default.
    // If titleTypeOptionsHtml is empty while the original is enabled, the clone
    // must still be explicitly disabled to prevent a required empty control.
    window.titleTypeOptionsHtml = '';
    $('#input-resourceinformation-titletype').prop('disabled', false);

    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    const $clonedSelect = newRow.find('select');
    expect($clonedSelect.length).toBe(1);

    // Must be disabled even though the original was enabled — no options to pick
    expect($clonedSelect.prop('disabled')).toBe(true);
  });

  test('cloned title type select is disabled when only placeholder option exists', () => {
    // select.js always includes a placeholder option even if the API returns
    // no title types — the clone must still be disabled in this case.
    window.titleTypeOptionsHtml = '<option value="">Choose...</option>';
    $('#input-resourceinformation-titletype').prop('disabled', false);

    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    const $clonedSelect = newRow.find('select');
    expect($clonedSelect.length).toBe(1);

    // Only a placeholder with value="" — no valid option to select
    expect($clonedSelect.prop('disabled')).toBe(true);
  });

  test('cloned title type dropdown is visible (unvisible class removed)', () => {
    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    const $container = newRow.find('#container-resourceinformation-titletype');
    expect($container.length).toBe(1);

    expect($container.hasClass('unvisible')).toBe(false);
  });

  test('cloned title type dropdown does not contain main title option', () => {
    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    const $clonedSelect = newRow.find('select');
    expect($clonedSelect.length).toBe(1);

    expect($clonedSelect.find('option[value="1"]').length).toBe(0);
  });

  test('cloned title type dropdown pre-selects alternative title', () => {
    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    const $clonedSelect = newRow.find('select');
    expect($clonedSelect.length).toBe(1);

    expect($clonedSelect.val()).toBe('2');
  });

  test('new row input field is cleared', () => {
    $('#input-resourceinformation-title').val('Test Title');
    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    expect(newRow.find('input').length).toBeGreaterThan(0);

    expect(newRow.find('input').val()).toBe('');
  });

  test('new row has remove button instead of add button', () => {
    $('#button-resourceinformation-addtitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();

    expect(newRow.find('.addTitle').length).toBe(0);
    expect(newRow.find('.removeTitle').length).toBe(1);
  });

  test('add button is disabled when max titles reached', () => {
    // The handler reads window.maxTitles at click-time, no re-eval needed
    window.maxTitles = 2;

    $('#button-resourceinformation-addtitle').trigger('click');

    expect($('#button-resourceinformation-addtitle').prop('disabled')).toBe(true);
  });

  test('remove button removes the row and re-enables add button', () => {
    // The handler reads window.maxTitles at click-time, no re-eval needed
    window.maxTitles = 2;

    $('#button-resourceinformation-addtitle').trigger('click');
    expect($('#button-resourceinformation-addtitle').prop('disabled')).toBe(true);

    // Click the remove button on the new row
    $('.removeTitle').trigger('click');

    const rows = $('#group-resourceinformation .row');
    expect(rows.length).toBe(1);
    expect($('#button-resourceinformation-addtitle').prop('disabled')).toBe(false);
  });

  test('elmo:clearTitles resets counter and re-enables add button', () => {
    // The handler reads window.maxTitles at click-time, no re-eval needed
    window.maxTitles = 2;

    $('#button-resourceinformation-addtitle').trigger('click');
    expect($('#button-resourceinformation-addtitle').prop('disabled')).toBe(true);

    $(document).trigger('elmo:clearTitles');
    expect($('#button-resourceinformation-addtitle').prop('disabled')).toBe(false);
  });
});
