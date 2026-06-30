const fs = require('fs');
const path = require('path');

class MockTagify {
  constructor(el, settings) {
    this.el = el;
    this.settings = settings;
    this.value = [];
    this._callbacks = {};
    this.destroyed = false;
  }
  on(event, cb) {
    this._callbacks[event] = cb;
  }
  addTags(items) {
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach(item => {
      const tag = typeof item === 'string' ? { value: item } : item;
      if (!this.value.some(existing => existing.value === tag.value)) {
        this.value.push(tag);
      }
    });
  }
  removeAllTags() {
    this.value = [];
  }
  removeTag(tag) {
    this.value = this.value.filter(item => item.value !== tag);
  }
  destroy() {
    this.destroyed = true;
    if (this._callbacks.destroy) {
      this._callbacks.destroy();
    }
  }
}

function transformThesauriScript(source) {
  let script = source;
  script = script.replace('export function filterTreeByRoot', 'function filterTreeByRoot');
  script = script.replace('export const THESAURUS_CONFIG =', 'const THESAURUS_CONFIG =');
  script = script.replace('export let currentActiveInput = null;', 'let currentActiveInput = null;');
  script = script.replace('export function cleanupTagifyForInput', 'function cleanupTagifyForInput');
  script = script.replace('export function initTagifyForInput', 'function initTagifyForInput');
  script = script.replace('export function ensureThesaurusLoaded', 'function ensureThesaurusLoaded');
  script += '\nwindow.__thesauriTestExports = { filterTreeByRoot, THESAURUS_CONFIG, cleanupTagifyForInput, initTagifyForInput, ensureThesaurusLoaded, getTagifyInstanceCount(configKey) { const config = THESAURUS_CONFIG[configKey]; return sharedState[config.stateKey]?.tagifyInstances?.size ?? 0; } };';
  return script;
}

describe('ggms-datasources.js', () => {
  let $;
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="thesaurusKeywordsFormGroup" style="display: none;">
        <div id="accordionThesauri"></div>
      </div>
      <div id="thesaurusModalsContainer"></div>
      <div id="group-ggmspropertiesessential">
        <input id="input-model-type" value="Choose..." />
      </div>
      <div id="group-datasources">
        <div class="row">
          <div class="col-md-3 visibility-datasources-basic">
            <select name="datasource_type[]">
              <option value="S" selected>Satellite</option>
              <option value="G">Ground</option>
              <option value="A">Altimetry</option>
              <option value="T">Elevation/Terrain</option>
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
          <input id="input-datasource-platforms-0" name="satellite_platform[]" class="form-control input-with-help input-right-no-round-corners" />
          <button id="button-datasource-platforms" data-bs-target="#modal-platforms-datasource"></button>
          <div class="col-2 col-sm-2 col-md-1 col-lg-1 d-flex justify-content-center align-items-center visibility-datasources-basic">
            <button class="addDataSource"></button>
          </div>
        </div>
      </div>
      <input id="input-platforms-thesaurussearch-ds" />
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

    $.getJSON = jest.fn((file, cb) => {
      const availabilityDeferred = {
        done: jest.fn(function(fn) { fn(this._data); return this; }),
        fail: jest.fn().mockReturnThis(),
        _data: {
          science_keywords: { available: true, displayName: 'GCMD Science Keywords' },
          platforms: { available: true, displayName: 'GCMD Platforms' },
          instruments: { available: false, displayName: 'GCMD Instruments' },
          chronostratigraphy: { available: false, displayName: 'ICS Chronostratigraphy' },
          gemet: { available: false, displayName: 'GEMET Thesaurus' },
        },
      };

      if (file === 'api/v2/vocabs/thesauri/availability') {
        return availabilityDeferred;
      }

      if (file === 'api/v2/vocabs/thesauri/gcmd-platforms') {
        cb({ data: [
          {
            id: 'platforms',
            text: 'Platforms',
            children: [
              {
                id: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
                text: 'Space-based Platforms',
                children: [
                  { id: 'earth-obs', text: 'Earth Observation Satellites', children: [ { id: 'sat', text: 'GRACE' } ] }
                ]
              },
              { id: 'ground', text: 'Ground-based Platforms' }
            ]
          }
        ] });
        return { fail: jest.fn().mockReturnThis() };
      }

      if (typeof cb === 'function') {
        cb({ data: [ { id: 'root', text: 'Root', children: [ { id: 'child', text: 'Child' } ] } ] });
      }
      return { fail: jest.fn().mockReturnThis() };
    });
    // Mock jstree plugin
    (function ($) {
      class JsTreeMock {
        constructor($el, opts) {
          this.$el = $el;
          this.data = opts.core.data;
          this.map = {};
          const build = (nodes, parent) => {
            nodes.forEach(node => {
              const n = { id: node.id, text: node.text, parent, children: [] };
              this.map[node.id] = n;
              if (node.children) {
                n.children = build(node.children, n);
              }
            });
          };
          build(this.data, null);
          this.selected = [];
          this.opened = [];
        }
        get_node(id) {
          const node = this.map[id];
          if (!node) return { id, parents: [] };
          const parents = [];
          let cur = node.parent;
          while (cur) {
            parents.unshift(cur.id);
            cur = cur.parent;
          }
          return { id: node.id, text: node.text, parents: ['#'].concat(parents) };
        }
        open_node(id, callback) {
          if (!this.opened.includes(id)) {
            this.opened.push(id);
          }
          if (typeof callback === 'function') {
            callback();
          }
        }
        get_selected() {
          return this.selected;
        }
        get_path(node, sep) {
          let cur = node;
          const parts = [];
          while (cur) {
            parts.unshift(cur.text);
            cur = cur.parent;
          }
          return parts.join(sep);
        }
        get_json(root, opts) {
          if (opts && opts.flat) {
            return Object.values(this.map);
          }
          return this.data;
        }
        select_node(id) {
          const node = this.map[id];
          if (node && !this.selected.includes(node)) {
            this.selected.push(node);
            this.$el.trigger('changed.jstree', [{ instance: this }]);
          }
        }
        deselect_node(id) {
          const node = this.map[id];
          this.selected = this.selected.filter(n => n !== node);
          this.$el.trigger('changed.jstree', [{ instance: this }]);
        }
        search(str) {
          this.lastSearch = str;
        }
        deselect_all() {
          this.selected = [];
          this.$el.trigger('changed.jstree', [{ instance: this }]);
        }
      }
      $.fn.jstree = function(arg, arg2) {
        if (arg === undefined || arg === true) {
          return this.data('jstree');
        }
        if (typeof arg === 'string') {
          const inst = this.data('jstree');
          if (arg === 'get_selected') return inst.get_selected(arg2);
          if (arg === 'deselect_node') { inst.deselect_node(arg2); return this; }
          if (arg === 'select_node') { inst.select_node(arg2); return this; }
          if (arg === 'open_node') { inst.open_node(arg2); return this; }
        } else if (typeof arg === 'object') {
          const inst = new JsTreeMock(this, arg);
          this.data('jstree', inst);
          this.trigger('ready.jstree');
          return this;
        }
        return this;
      };
    })($);

    global.Tagify = MockTagify;
    global.translations = { keywords: { thesaurus: { label: 'initial' } } };
    window.ELMO_FEATURES = { showThesauri: true, showMslVocabs: false };

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
    window.applyTagifyAccessibilityAttributes = jest.fn((tagifyInstance, inputElement, options = {}) => {
      const interactiveInput = inputElement.parentElement?.querySelector('.tagify__input');
      if (interactiveInput && options.placeholder) {
        interactiveInput.setAttribute('data-placeholder', options.placeholder);
      }
    });

    const thesauriScript = fs.readFileSync(path.resolve(__dirname, '../../js/thesauri.js'), 'utf8');
    window.eval(transformThesauriScript(thesauriScript));

    let script = fs.readFileSync(path.resolve(__dirname, '../../js/eventhandlers/formgroups/ggms-datasources.js'), 'utf8');
    script = script.replace("import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';", 'const { createRemoveButton, replaceHelpButtonInClonedRows } = window;');
    script = script.replace("import { cleanupTagifyForInput, initTagifyForInput, ensureThesaurusLoaded } from '../../thesauri.js';", 'const { cleanupTagifyForInput, initTagifyForInput, ensureThesaurusLoaded } = window.__thesauriTestExports;');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\}\);$/, '\n})();');
    window.eval(script);

    $(document).ready(() => {
      document.dispatchEvent(new Event('translationsLoaded'));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.createRemoveButton;
    delete global.replaceHelpButtonInClonedRows;
    delete global.setupIdentifierTypesDropdown;
    delete global.Tagify;
    delete window.ELMO_FEATURES;
    delete window.applyTagifyAccessibilityAttributes;
    delete window.__thesauriTestExports;
  });

  function openDatasourceModal(buttonElement) {
    const event = $.Event('show.bs.modal');
    event.relatedTarget = buttonElement;
    $('#modal-platforms-datasource').trigger(event);
    document.getElementById('modal-platforms-datasource').dispatchEvent(new Event('show.bs.modal'));
  }

  test('initial row visibility is correct for type S', () => {
    const row = $('#group-datasources .row').first();
    expect(row.children('.visibility-datasources-details').css('display')).toBe('none');
    expect(row.children('.visibility-datasources-satellite').css('display')).not.toBe('none');
    expect(row.children('.visibility-datasources-identifier').css('display')).toBe('none');
  });

  test('adds js-required-on-submit to platform input when type is Satellite', () => {
    const row = $('#group-datasources .row').first();
    const platformInput = row.find('input[name="satellite_platform[]"]');
    expect(platformInput.hasClass('form-control')).toBe(true);
    expect(platformInput.hasClass('js-required-on-submit')).toBe(true);
    expect(platformInput.prop('required')).toBe(false);

    row.find('select[name="datasource_type[]"]').val('G').trigger('change');
    expect(platformInput.hasClass('js-required-on-submit')).toBe(false);

    row.find('select[name="datasource_type[]"]').val('S').trigger('change');
    expect(platformInput.hasClass('form-control')).toBe(true);
    expect(platformInput.hasClass('js-required-on-submit')).toBe(true);
  });

  test('initializes datasource platform Tagify with datasource-specific placeholder', () => {
    const input = $('input[name="satellite_platform[]"]')[0];
    expect(input._tagify).toBeInstanceOf(MockTagify);
    expect(input._tagify.settings.placeholder).toBe('Choose the satellite');
    expect(input.getAttribute('data-placeholder')).toBe('Choose the satellite');
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
    const compField = row.children('.visibility-datasources-compensation');

    // Set to Isostasy and check visible
    detailsSelect.val('Isostasy').trigger('change');
    expect(compField.css('display')).not.toBe('none');

    // Set to something else and check hidden
    detailsSelect.val('Bathymetry').trigger('change');
    expect(compField.css('display')).toBe('none');
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
    // --- Setup: Select 'Model' and trigger the change ---
    const row = $('#group-datasources .row').first();
    const typeSelect = row.find('select[name="datasource_type[]"]');
    typeSelect.val('M').trigger('change');

    // --- Get elements to check their order ---
    const typeCol = row.find('select[name="datasource_type[]"]').closest('div[class*="col-"]');
    const detailsCol = row.find('select[name="datasource_details[]"]').closest('div[class*="col-"]');
    const modelNameCol = row.find('input[name="dName[]"]').closest('div[class*="col-"]');
    const identifierCol = row.find('input[name="dIdentifier[]"]').closest('div[class*="col-"]');
    const identifierTypeCol = row.find('select[name="dIdentifierType[]"]').closest('div[class*="col-"]');
    const descCol = row.find('textarea[name="datasource_description[]"]').closest('div[class*="col-"]');
    const addButtonCol = row.find('.addDataSource, .removeButton').closest('div[class*="col-"]');

    // --- Assertions ---
    // Expected order: Type -> Details -> ModelName -> Identifier -> IdentifierType -> Description -> AddButton
    const children = row.children().toArray();
    const idxType = children.indexOf(typeCol[0]);
    const idxDetails = children.indexOf(detailsCol[0]);
    const idxModelName = children.indexOf(modelNameCol[0]);
    const idxIdentifier = children.indexOf(identifierCol[0]);
    const idxIdType = children.indexOf(identifierTypeCol[0]);
    const idxDesc = children.indexOf(descCol[0]);
    const idxAddBtn = children.indexOf(addButtonCol[0]);

    expect(idxType).toBeLessThan(idxDetails);
    expect(idxDetails).toBeLessThan(idxModelName);
    expect(idxModelName).toBeLessThan(idxIdentifier);
    expect(idxIdentifier).toBeLessThan(idxIdType);
    expect(idxIdType).toBeLessThan(idxDesc);
    expect(idxDesc).toBeLessThan(idxAddBtn);

    // Now set type back to Satellite and check order/visibility resets
    typeSelect.val('S').trigger('change');

    // Optionally, check that identifier fields are hidden again
    expect(identifierCol.css('display')).toBe('none');
    expect(identifierTypeCol.css('display')).toBe('none');
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
    const tagifyInstance = newRow.find('input[id^="input-datasource-platforms"]')[0]._tagify;
    expect(tagifyInstance).toBeInstanceOf(MockTagify);
    expect(tagifyInstance._callbacks.add).toBeDefined();
    expect(tagifyInstance._callbacks.remove).toBeDefined();
  });

  test('uses datasource-specific placeholder for initial and cloned platform inputs', () => {
    const firstInput = $('input[name="satellite_platform[]"]')[0];
    expect(firstInput._tagify.settings.placeholder).toBe('Choose the satellite');

    $('.addDataSource').trigger('click');
    const clonedInput = $('#group-datasources .row').last().find('input[name="satellite_platform[]"]')[0];
    expect(clonedInput._tagify.settings.placeholder).toBe('Choose the satellite');
  });

  test('resets datasource modal search input on open and close', () => {
    $('#input-platforms-thesaurussearch-ds').val('Satellite');
    openDatasourceModal(document.getElementById('button-datasource-platforms'));
    expect($('#input-platforms-thesaurussearch-ds').val()).toBe('');

    $('#input-platforms-thesaurussearch-ds').val('Ground');
    $('#modal-platforms-datasource').trigger('hidden.bs.modal');
    expect($('#input-platforms-thesaurussearch-ds').val()).toBe('');
  });

  test('pre-opens Space-based Platforms and Earth Observation Satellites after thesaurus load', () => {
    openDatasourceModal(document.getElementById('button-datasource-platforms'));

    const tree = $('#jstree-platforms-datasource').jstree(true);
    expect(tree).toBeTruthy();
    expect(tree.opened).toContain('https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847');
    expect(tree.opened).toContain('earth-obs');
  });

  test('remove button deletes row', () => {
    $('.addDataSource').trigger('click');
    const newRow = $('#group-datasources .row').last();
    newRow.find('.removeButton').trigger('click');
    expect($('#group-datasources .row').length).toBe(1);
  });

  test('remove button cleans orphaned datasource Tagify instances from shared thesaurus state', () => {
    $('.addDataSource').trigger('click');

    const rows = $('#group-datasources .row');
    const clonedInput = rows.last().find('input[name="satellite_platform[]"]')[0];
    expect(window.__thesauriTestExports.getTagifyInstanceCount('satellitePlatforms')).toBe(2);

    rows.last().find('.removeButton').trigger('click');

    expect(window.__thesauriTestExports.getTagifyInstanceCount('satellitePlatforms')).toBe(1);
    expect(clonedInput._tagify).toBeUndefined();
  });

  test('has "Elevation/Terrain" option when model type becomes Topographic', () => {
    const modelTypeInput = $('#input-model-type');
    modelTypeInput.val('Topographic').trigger('change');
    const typeSelect = $('select[name="datasource_type[]"]');
    
    // 1. Verify initial state: 'Elevation/Terrain' option does not exist
    expect(typeSelect.find('option[value="T"]').length).toBe(1);
    });

  test('removes "Elevation/Terrain" option when model type is not Topographic', () => {
    const modelTypeInput = $('#input-model-type');
    modelTypeInput.val('Static').trigger('change');
    const typeSelect = $('select[name="datasource_type[]"]');
    
    // 1. Verify initial state: 'Elevation/Terrain' option does not exist
    expect(typeSelect.find('option[value="T"]').length).toBe(0);
    });

  test('resets datasource type to S if "Elevation/Terrain" was selected when removed', () => {
    const modelTypeInput = $('#input-model-type');
    modelTypeInput.val('Topographic').trigger('change');

    // Create a new datasource row to selsct Elevation/Terrain
    $('.addDataSource').trigger('click');
    const newRow = $('#group-datasources .row').last();
    const newTypeSelect = newRow.find('select[name="datasource_type[]"]');
    newTypeSelect.val('T').trigger('change');
    expect(newTypeSelect.find('option[value="T"]').length).toBe(1);

    // Now change model type to something else and trigger the event
    modelTypeInput.val('Temporal').trigger('change');
    // The option to select T is no longer present
    expect(newTypeSelect.find('option[value="T"]').length).toBe(0);
    // The datasource type should have been reset to S
    expect(newTypeSelect.val()).toBe('S');
    });
});