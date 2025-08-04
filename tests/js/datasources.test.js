const fs = require('fs');
const path = require('path');

class MockTagify {
  constructor(el, settings) {
    this.el = el;
    this.settings = settings;
    this._callbacks = {};
  }
  on(event, cb) {
    this._callbacks[event] = cb;
  }
  addTags() {}
  removeAllTags() {}
}

describe('datasources.js', () => {
  let $;
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="group-datasources">
        <div class="row">
          <div class="col-md-3 visibility-datasources-basic">
            <select name="datasource_type[]">
              <option value="S" selected>Satellite</option>
              <option value="G">Ground</option>
              <option value="A">Altimetry</option>
              <option value="T">Terrain</option>
              <option value="M">Model</option>
            </select>
          </div>
          <div class="col-md-5 visibility-datasources-basic"><textarea name="datasource_description[]"></textarea></div>
          <div class="col-md-3 visibility-datasources-details"><select name="datasource_details[]"></select></div>
          <div class="col-md-12 visibility-datasources-compensation"><input name="compensation_depth[]" /></div>
          <div class="col-md-3 visibility-datasources-satellite">sat</div>
          <div class="col-md-6 visibility-datasources-identifier"><input name="dName[]" /></div>
          <div class="col-md-3 visibility-datasources-identifier"><input name="dIdentifier[]" /></div>
          <div class="col-md-3 visibility-datasources-identifier"><select name="dIdentifierType[]"></select></div>
          <div class="input-group">
            <input class="input-with-help" />
            <div class="help-placeholder" data-help-section-id="ds"></div>
          </div>
          <input id="input-datasource-platforms" />
          <div class="col-2 col-sm-2 col-md-1 col-lg-1 d-flex justify-content-center align-items-center visibility-datasources-basic">
            <button class="addDataSource"></button>
          </div>
        </div>
      </div>
      <div id="jstree-platforms-datasource"></div>
      <ul id="selected-keywords-platforms-ds"></ul>
      <div id="modal-platforms-datasource"></div>
    `;
    localStorage.setItem('helpStatus', 'help-on');

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    const originalIs = $.fn.is;
    $.fn.is = function(selector) {
      if (selector === ':visible') {
        return this.css('display') !== 'none';
      }
      return originalIs.call(this, selector);
    };

    global.createRemoveButton = jest.fn(() => $('<button class="removeButton"></button>'));
    global.replaceHelpButtonInClonedRows = jest.fn();
    global.setupIdentifierTypesDropdown = jest.fn(select => {
      select.append('<option value="id">id</option>');
    });
    global.Tagify = MockTagify;

    let script = fs.readFileSync(path.resolve(__dirname, '../../js/eventhandlers/formgroups/datasources.js'), 'utf8');
    script = script.replace("import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';", 'const { createRemoveButton, replaceHelpButtonInClonedRows } = window;');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\}\);$/, '\n})();');
    window.eval(script);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.createRemoveButton;
    delete global.replaceHelpButtonInClonedRows;
    delete global.setupIdentifierTypesDropdown;
    delete global.Tagify;
  });

  test('initial row visibility is correct for type S', () => {
    const row = $('#group-datasources .row').first();
    expect(row.children('.visibility-datasources-details').css('display')).toBe('none');
    expect(row.children('.visibility-datasources-satellite').css('display')).not.toBe('none');
    expect(row.children('.visibility-datasources-identifier').css('display')).toBe('none');
  });

  test('changing type to G shows details and populates options', () => {
    const row = $('#group-datasources .row').first();
    row.find('select[name="datasource_type[]"]').val('G').trigger('change');
    expect(row.children('.visibility-datasources-details').css('display')).not.toBe('none');
    expect(row.children('.visibility-datasources-satellite').css('display')).toBe('none');
    expect(row.children('.visibility-datasources-identifier').css('display')).toBe('none');
    const options = row.find('select[name="datasource_details[]"] option').map((i, el) => el.value).get();
    expect(options).toEqual(['Terrestrial', 'Shipborne', 'Airborne', 'Ground data computed from GGM', 'Other']);
    expect(row.find('select[name="datasource_details[]"]').val()).toBe('Terrestrial');
  });

  test('changing type to A populates altimetry options', () => {
    const row = $('#group-datasources .row').first();
    row.find('select[name="datasource_type[]"]').val('A').trigger('change');
    const options = row.find('select[name="datasource_details[]"] option').map((i, el) => el.value).get();
    expect(options).toEqual(['Direct observations from altimetry satellites', 'Altimetric gridded datasets']);
  });

  test('changing type to T populates terrain options', () => {
    const row = $('#group-datasources .row').first();
    row.find('select[name="datasource_type[]"]').val('T').trigger('change');
    const options = row.find('select[name="datasource_details[]"] option').map((i, el) => el.value).get();
    expect(options).toEqual(['Bathymetry', 'Isostasy', 'Digital Elevation Model (DEM/DTM)', 'Density Model']);
  });

  test('shows compensation depth when detail is Isostasy', () => {
    const row = $('#group-datasources .row').first();
    row.find('select[name="datasource_type[]"]').val('T').trigger('change');
    const detailsSelect = row.find('select[name="datasource_details[]"]');
    detailsSelect.val('Isostasy').trigger('change');
    expect(row.children('.visibility-datasources-compensation').css('display')).not.toBe('none');
    detailsSelect.val('Bathymetry').trigger('change');
    expect(row.children('.visibility-datasources-compensation').css('display')).toBe('none');
  });

  test('layout adjusts when detail Isostasy is selected', () => {
    const row = $('#group-datasources .row').first();
    row.find('select[name="datasource_type[]"]').val('T').trigger('change');
    const detailsSelect = row.find('select[name="datasource_details[]"]');
    const descCol = row.find('textarea[name="datasource_description[]"]').closest('div');
    const compCol = row.find('input[name="compensation_depth[]"]').closest('div');

    detailsSelect.val('Isostasy').trigger('change');
    expect(descCol.hasClass('col-md-3')).toBe(true);
    expect(compCol.hasClass('col-md-2')).toBe(true);

    detailsSelect.val('Bathymetry').trigger('change');
    expect(descCol.hasClass('col-md-5')).toBe(true);
    expect(compCol.hasClass('col-md-12')).toBe(true);
  });

  test('changing type to M shows identifier field and only initializes dropdown once', () => {
    const row = $('#group-datasources .row').first();
    const select = row.find('select[name="datasource_type[]"]');
    select.val('M').trigger('change');
    expect(row.children('.visibility-datasources-identifier').css('display')).not.toBe('none');
    expect(global.setupIdentifierTypesDropdown).toHaveBeenCalledTimes(1);
    select.val('S').trigger('change');
    select.val('M').trigger('change');
    expect(global.setupIdentifierTypesDropdown).toHaveBeenCalledTimes(1);
  });

  test('layout adjusts when type is set to M', () => {
    const row = $('#group-datasources .row').first();
    const typeCol = row.find('select[name="datasource_type[]"]').closest('div');
    const descCol = row.find('textarea[name="datasource_description[]"]').closest('div');
    const modelNameCol = row.find('input[name="dName[]"]').closest('div');
    const identifierCol = row.find('input[name="dIdentifier[]"]').closest('div');
    const idTypeCol = row.find('select[name="dIdentifierType[]"]').closest('div');
    const addBtnCol = row.find('.addDataSource').closest('div');

    row.find('select[name="datasource_type[]"]').val('M').trigger('change');

    expect(typeCol.hasClass('col-md-4')).toBe(true);
    expect(descCol.hasClass('col-md-4')).toBe(true);
    expect(modelNameCol.hasClass('col-md-4')).toBe(true);
    expect(identifierCol.hasClass('col-md-4')).toBe(true);
    expect(idTypeCol.hasClass('col-md-4')).toBe(true);
    expect(addBtnCol.hasClass('col-md-4')).toBe(true);

    row.find('select[name="datasource_type[]"]').val('S').trigger('change');

    expect(typeCol.hasClass('col-md-3')).toBe(true);
    expect(descCol.hasClass('col-md-5')).toBe(true);
    expect(modelNameCol.hasClass('col-md-6')).toBe(true);
    expect(identifierCol.hasClass('col-md-3')).toBe(true);
    expect(idTypeCol.hasClass('col-md-3')).toBe(true);
    expect(addBtnCol.hasClass('col-md-1')).toBe(true);
  });

  test('addDataSource clones row, resets values, and restores help button', () => {
    $('.addDataSource').trigger('click');
    const rows = $('#group-datasources .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    expect(global.replaceHelpButtonInClonedRows).toHaveBeenCalled();
    expect(newRow.find('select[name="datasource_type[]"]').val()).toBe('S');
    expect(newRow.find('.removeButton').length).toBe(1);
    expect(newRow.find('.help-placeholder').length).toBe(0);
    expect(newRow.find('span.input-group-text i[data-help-section-id="ds"]').length).toBe(1);
    const tagifyInstance = newRow.find('#input-datasource-platforms')[0]._tagify;
    expect(tagifyInstance).toBeInstanceOf(MockTagify);
    expect(tagifyInstance._callbacks.add).toBeDefined();
    expect(tagifyInstance._callbacks.remove).toBeDefined();
  });

  test('remove button deletes row', () => {
    $('.addDataSource').trigger('click');
    const newRow = $('#group-datasources .row').last();
    newRow.find('.removeButton').trigger('click');
    expect($('#group-datasources .row').length).toBe(1);
  });
});