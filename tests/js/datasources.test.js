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
          <div class="visibility-datasources-basic">
            <select name="datasource_type[]">
              <option value="S" selected>Satellite</option>
              <option value="G">Ground</option>
              <option value="A">Altimetry</option>
              <option value="T">Terrain</option>
              <option value="M">Model</option>
            </select>
          </div>
          <div class="visibility-datasources-details"><select name="datasource_details[]"></select></div>
          <div class="visibility-datasources-satellite">sat</div>
          <div class="visibility-datasources-identifier"><select name="dIdentifierType[]"></select></div>
          <div class="input-group">
            <input class="input-with-help" />
            <div class="help-placeholder" data-help-section-id="ds"></div>
          </div>
          <input id="input-datasource-platforms" />
          <button class="addDataSource"></button>
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
});