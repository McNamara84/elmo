const fs = require('fs');
const path = require('path');
const { transformThesauriScript } = require('./utils');

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

function transformThesauriScriptForDatasources(source) {
  return transformThesauriScript(
    source,
    'getTagifyInstanceCount(configKey) { const config = THESAURUS_CONFIG[configKey]; return sharedState[config.stateKey]?.tagifyInstances?.size ?? 0; }',
  );
}

describe('ggmsDatasources.js', () => {
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
            <span class="input-group-text"><i data-help-section-id="help-datasource-type"></i></span>
          </div>
          <div class="col-md-5 visibility-datasources-basic"><textarea name="datasource_description[]"></textarea></div>
          <div class="col-md-3 visibility-datasources-details">
            <div class="input-group">
              <select name="datasource_details[]" class="input-with-help"></select>
              <span class="input-group-text"><i data-help-section-id="help-datasource-details"></i></span>
            </div>
          </div>
          <div class="col-md-12 visibility-datasources-compensation"><input name="compensation_depth[]" /></div>
          <div class="col-md-3 visibility-datasources-satellite">
            <div class="input-group">
              <input id="input-datasource-platforms-0" name="satellite_platform[]" class="form-control input-with-help input-right-no-round-corners" />
              <span class="input-group-text"><i data-help-section-id="help-gcmd-platforms-keyword"></i></span>
            </div>
            <button id="button-datasource-platforms" data-bs-target="#modal-platforms-datasource"></button>
          </div>
          <div class="col-md-6 visibility-datasources-identifier"><input id="input-datasource-modelname" name="dName[]" /></div>
          <div class="col-md-3 visibility-datasources-identifier"><input name="dIdentifier[]" /></div>
          <div class="col-md-3 visibility-datasources-identifier"><select name="dIdentifierType[]"></select></div>
          <div class="col-1 d-flex justify-content-center align-items-center">
            <button type="button" class="removeButton"></button>
          </div>
        </div>
      </div>
      <div data-datasource-add-actions>
        <button type="button" class="addDataSource" id="button-datasource-add"></button>
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
              const n = {
                id: node.id,
                text: node.text,
                parent,
                children: [],
                original: node.original,
                fullKeyword: node.fullKeyword,
              };
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
        get_node(id) {
          return this.map[id] || false;
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
    window.eval(transformThesauriScriptForDatasources(thesauriScript));

    let script = fs.readFileSync(path.resolve(__dirname, '../../js/eventhandlers/formgroups/ggmsDatasources.js'), 'utf8');
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

  test('does not mark satellite platform as required on submit', () => {
    const row = $('#group-datasources .row').first();
    const platformInput = row.find('input[name="satellite_platform[]"]');
    expect(platformInput.hasClass('js-required-on-submit')).toBe(false);
    expect(platformInput.prop('required')).toBe(false);

    row.find('select[name="datasource_type[]"]').val('G').trigger('change');
    expect(platformInput.hasClass('js-required-on-submit')).toBe(false);

    row.find('select[name="datasource_type[]"]').val('S').trigger('change');
    expect(platformInput.hasClass('js-required-on-submit')).toBe(false);
    expect(platformInput.prop('required')).toBe(false);
  });

  test('adds js-required-on-submit to model name when type is Model', () => {
    const row = $('#group-datasources .row').first();
    const modelNameInput = row.find('input[name="dName[]"]');
    expect(modelNameInput.hasClass('js-required-on-submit')).toBe(false);

    row.find('select[name="datasource_type[]"]').val('M').trigger('change');
    expect(modelNameInput.hasClass('js-required-on-submit')).toBe(true);
    expect(modelNameInput.prop('required')).toBe(false);

    row.find('select[name="datasource_type[]"]').val('S').trigger('change');
    expect(modelNameInput.hasClass('js-required-on-submit')).toBe(false);
  });

  test('clears leftover required attribute when datasource type changes', () => {
    const row = $('#group-datasources .row').first();
    const platformInput = row.find('input[name="satellite_platform[]"]');

    platformInput.attr('required', 'required');
    row.find('select[name="datasource_type[]"]').val('G').trigger('change');

    expect(platformInput.prop('required')).toBe(false);
    expect(platformInput.hasClass('js-required-on-submit')).toBe(false);
  });

  test('cloned row does not inherit required from template row', () => {
    const templateRow = $('#group-datasources .row').first();
    templateRow.find('input[name="satellite_platform[]"]').attr('required', 'required');

    $('.addDataSource').trigger('click');

    const newRow = $('#group-datasources .row').last();
    const clonedPlatformInput = newRow.find('input[name="satellite_platform[]"]');

    expect(clonedPlatformInput.prop('required')).toBe(false);
    expect(clonedPlatformInput.hasClass('js-required-on-submit')).toBe(false);
  });

  test('initializes datasource platform Tagify with datasource-specific placeholder', () => {
    const input = $('input[name="satellite_platform[]"]')[0];
    expect(input._tagify).toBeInstanceOf(MockTagify);
    expect(input._tagify.settings.placeholder).toBe('Type in the satellite name');
    expect(input.getAttribute('data-placeholder')).toBe('Type in the satellite name');
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
    $('#input-model-type').val('Topographic').trigger('change');
    row.find('select[name="datasource_type[]"]').val('T').trigger('change');
    const options = row.find('select[name="datasource_details[]"] option').map((i, el) => el.value).get();
    expect(options).toEqual(['Bathymetry', 'Isostasy', 'Digital Elevation Model (DEM/DTM)', 'Density Model']);
  });

  test('shows compensation depth when detail is Isostasy', () => {
    const row = $('#group-datasources .row').first();
    $('#input-model-type').val('Topographic').trigger('change');
    row.find('select[name="datasource_type[]"]').val('T').trigger('change');
    const detailsSelect = row.find('select[name="datasource_details[]"]');
    const compensationInput = row.find('input[name="compensation_depth[]"]');
    detailsSelect.val('Isostasy').trigger('change');
    expect(row.children('.visibility-datasources-compensation').css('display')).not.toBe('none');
    expect(compensationInput.prop('disabled')).toBe(false);
    detailsSelect.val('Bathymetry').trigger('change');
    expect(row.children('.visibility-datasources-compensation').css('display')).toBe('none');
    expect(compensationInput.prop('disabled')).toBe(true);
  });

  test('disables compensation depth on non-Isostasy rows so FormData stays sparse', () => {
    const row = $('#group-datasources .row').first();
    const compensationInput = row.find('input[name="compensation_depth[]"]');

    expect(compensationInput.prop('disabled')).toBe(true);

    $('#input-model-type').val('Topographic').trigger('change');
    row.find('select[name="datasource_type[]"]').val('T').trigger('change');
    expect(compensationInput.prop('disabled')).toBe(true);

    row.find('select[name="datasource_details[]"]').val('Isostasy').trigger('change');
    expect(compensationInput.prop('disabled')).toBe(false);
  });

  test('layout adjusts when detail Isostasy is selected', () => {
    const row = $('#group-datasources .row').first();
    $('#input-model-type').val('Topographic').trigger('change');
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
    const removeButtonCol = row.find('.removeButton').closest('div[class*="col-"]');

    // --- Assertions ---
    // Expected order: Type -> Description -> Details -> ModelName -> Identifier -> IdentifierType -> RemoveButton
    const children = row.children().toArray();
    const idxType = children.indexOf(typeCol[0]);
    const idxDesc = children.indexOf(descCol[0]);
    const idxDetails = children.indexOf(detailsCol[0]);
    const idxModelName = children.indexOf(modelNameCol[0]);
    const idxIdentifier = children.indexOf(identifierCol[0]);
    const idxIdType = children.indexOf(identifierTypeCol[0]);
    const idxRemoveBtn = children.indexOf(removeButtonCol[0]);

    expect(idxType).toBeLessThan(idxDesc);
    expect(idxDesc).toBeLessThan(idxDetails);
    expect(idxDetails).toBeLessThan(idxModelName);
    expect(idxModelName).toBeLessThan(idxIdentifier);
    expect(idxIdentifier).toBeLessThan(idxIdType);
    expect(idxIdType).toBeLessThan(idxRemoveBtn);
    expect(idxRemoveBtn).toBe(children.length - 1);

    // Now set type back to Satellite and check order/visibility resets
    typeSelect.val('S').trigger('change');

    // Optionally, check that identifier fields are hidden again
    expect(identifierCol.css('display')).toBe('none');
    expect(identifierTypeCol.css('display')).toBe('none');
  });

  describe('responsive column layout', () => {
    const colOf = (row, selector) => row.find(selector).closest('div[class*="col-"]');
    const expectCols = (col, classes) => classes.forEach(cls => expect(col.hasClass(cls)).toBe(true));

    test('places Description right after Type and the remove button last for every type', () => {
      const row = $('#group-datasources .row').first();
      $('#input-model-type').val('Topographic').trigger('change');

      ['S', 'G', 'A', 'T', 'M'].forEach(type => {
        row.find('select[name="datasource_type[]"]').val(type).trigger('change');
        const children = row.children('div[class*="col-"]').toArray();
        expect(children.indexOf(colOf(row, 'select[name="datasource_type[]"]')[0])).toBe(0);
        expect(children.indexOf(colOf(row, 'textarea[name="datasource_description[]"]')[0])).toBe(1);
        expect(children.indexOf(colOf(row, '.removeButton')[0])).toBe(children.length - 1);
      });
    });

    test('Satellite: Type/Description share the first row, satellite takes 11 columns on xs/sm', () => {
      const row = $('#group-datasources .row').first();
      expectCols(colOf(row, 'select[name="datasource_type[]"]'), ['col-6', 'col-md-3']);
      expectCols(colOf(row, 'textarea[name="datasource_description[]"]'), ['col-6', 'col-md-3']);
      expectCols(row.children('.visibility-datasources-satellite'), ['col-11', 'col-md-5']);
      expectCols(colOf(row, '.removeButton'), ['col-1']);
      expect(row.children('.visibility-datasources-satellite').hasClass('col-sm-12')).toBe(false);
    });

    test('Ground/Altimetry/Terrain: details take 11 columns on xs/sm next to the remove button', () => {
      const row = $('#group-datasources .row').first();
      row.find('select[name="datasource_type[]"]').val('G').trigger('change');
      expectCols(colOf(row, 'select[name="datasource_details[]"]'), ['col-11', 'col-md-5']);
    });

    test('Isostasy: details take the whole row and compensation depth is the last field', () => {
      const row = $('#group-datasources .row').first();
      $('#input-model-type').val('Topographic').trigger('change');
      row.find('select[name="datasource_type[]"]').val('T').trigger('change');
      row.find('select[name="datasource_details[]"]').val('Isostasy').trigger('change');

      expectCols(colOf(row, 'select[name="datasource_details[]"]'), ['col-12', 'col-md-5', 'col-lg-2']);
      expectCols(colOf(row, 'input[name="compensation_depth[]"]'), ['col-11', 'col-lg-3']);
      expectCols(colOf(row, 'textarea[name="datasource_description[]"]'), ['col-6', 'col-md-3', 'col-lg-3']);

      row.find('select[name="datasource_details[]"]').val('Bathymetry').trigger('change');
      const detailsCol = colOf(row, 'select[name="datasource_details[]"]');
      expectCols(detailsCol, ['col-11', 'col-md-5']);
      expect(detailsCol.hasClass('col-12') || detailsCol.hasClass('col-lg-2')).toBe(false);
      expect(colOf(row, 'textarea[name="datasource_description[]"]').hasClass('col-lg-3')).toBe(false);
    });

    test('Model: details full row, identifier type leaves room for the remove button', () => {
      const row = $('#group-datasources .row').first();
      row.find('select[name="datasource_type[]"]').val('M').trigger('change');

      expectCols(colOf(row, 'select[name="datasource_details[]"]'), ['col-12', 'col-md-5']);
      expectCols(colOf(row, 'input[name="dName[]"]'), ['col-12', 'col-md-4']);
      expectCols(colOf(row, 'input[name="dIdentifier[]"]'), ['col-12', 'col-sm-6', 'col-md-4']);
      expectCols(colOf(row, 'select[name="dIdentifierType[]"]'), ['col-11', 'col-sm-5', 'col-md-3']);
      expect(colOf(row, 'input[name="dName[]"]').hasClass('col-md-6')).toBe(false);
    });
  });

  test('add button lives below the entries and is not cloned into new entries', () => {
    expect($('#group-datasources .addDataSource')).toHaveLength(0);
    $('#button-datasource-add').trigger('click');
    expect($('#group-datasources .row')).toHaveLength(2);
    expect($('.addDataSource')).toHaveLength(1);
  });

  test('remove button deletes the only remaining entry', () => {
    expect($('#group-datasources .row')).toHaveLength(1);
    $('#group-datasources .row').first().find('.removeButton').trigger('click');
    expect($('#group-datasources .row')).toHaveLength(0);
  });

  describe('help icons', () => {
    const helpWrapper = (row, sectionId) => row.find(`i[data-help-section-id="${sectionId}"]`).closest('span.input-group-text');
    const isShown = wrapper => wrapper.css('display') !== 'none';

    test('shows each help icon only on the first entry where its field is visible', () => {
      $('.addDataSource').trigger('click');
      const rows = $('#group-datasources .row');

      expect(isShown(helpWrapper(rows.eq(0), 'help-datasource-type'))).toBe(true);
      expect(isShown(helpWrapper(rows.eq(1), 'help-datasource-type'))).toBe(false);
      expect(isShown(helpWrapper(rows.eq(0), 'help-gcmd-platforms-keyword'))).toBe(true);
      expect(isShown(helpWrapper(rows.eq(1), 'help-gcmd-platforms-keyword'))).toBe(false);
      expect(rows.eq(1).find('input[name="satellite_platform[]"]').hasClass('input-right-with-round-corners')).toBe(true);
    });

    test('moves a help icon to the next entry when the first one no longer shows the field', () => {
      $('.addDataSource').trigger('click');
      const rows = $('#group-datasources .row');

      rows.eq(1).find('select[name="datasource_type[]"]').val('G').trigger('change');
      expect(isShown(helpWrapper(rows.eq(1), 'help-datasource-details'))).toBe(true);

      rows.eq(0).find('select[name="datasource_type[]"]').val('G').trigger('change');
      expect(isShown(helpWrapper(rows.eq(0), 'help-datasource-details'))).toBe(true);
      expect(isShown(helpWrapper(rows.eq(1), 'help-datasource-details'))).toBe(false);
    });

    test('promotes help icons to the new first entry after the first entry is removed', () => {
      $('.addDataSource').trigger('click');
      $('#group-datasources .row').first().find('.removeButton').trigger('click');

      const row = $('#group-datasources .row').first();
      expect(isShown(helpWrapper(row, 'help-datasource-type'))).toBe(true);
    });

    test('hides all help icons when help is switched off', () => {
      localStorage.setItem('helpStatus', 'help-off');
      document.dispatchEvent(new CustomEvent('helpStatus:changed'));

      const row = $('#group-datasources .row').first();
      expect(isShown(helpWrapper(row, 'help-datasource-type'))).toBe(false);
      expect(isShown(helpWrapper(row, 'help-gcmd-platforms-keyword'))).toBe(false);
      localStorage.setItem('helpStatus', 'help-on');
    });
  });

  test('addDataSource clones row, resets values, and initializes Tagify', () => {
    $('.addDataSource').trigger('click');
    const rows = $('#group-datasources .row');
    expect(rows.length).toBe(2);
    const newRow = rows.last();
    expect(newRow.find('select[name="datasource_type[]"]').val()).toBe('S');
    expect(newRow.find('.removeButton').length).toBe(1);
    const tagifyInstance = newRow.find('input[id^="input-datasource-platforms"]')[0]._tagify;
    expect(tagifyInstance).toBeInstanceOf(MockTagify);
    expect(tagifyInstance._callbacks.add).toBeDefined();
    expect(tagifyInstance._callbacks.remove).toBeDefined();
  });

  test('uses datasource-specific placeholder for initial and cloned platform inputs', () => {
    const firstInput = $('input[name="satellite_platform[]"]')[0];
    expect(firstInput._tagify.settings.placeholder).toBe('Type in the satellite name');

    $('.addDataSource').trigger('click');
    const clonedInput = $('#group-datasources .row').last().find('input[name="satellite_platform[]"]')[0];
    expect(clonedInput._tagify.settings.placeholder).toBe('Type in the satellite name');
  });

  test('resets datasource modal search input on open and close', () => {
    $('#input-platforms-thesaurussearch-ds').val('Satellite');
    openDatasourceModal(document.getElementById('button-datasource-platforms'));
    expect($('#input-platforms-thesaurussearch-ds').val()).toBe('');

    $('#input-platforms-thesaurussearch-ds').val('Ground');
    $('#modal-platforms-datasource').trigger('hidden.bs.modal');
    expect($('#input-platforms-thesaurussearch-ds').val()).toBe('');
  });

  test('pre-opens Space-based Platforms but not Earth Observation Satellites after thesaurus load', () => {
    openDatasourceModal(document.getElementById('button-datasource-platforms'));

    const tree = $('#jstree-platforms-datasource').jstree(true);
    expect(tree).toBeTruthy();
    expect(tree.opened).toContain('https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847');
    expect(tree.opened).not.toContain('earth-obs');
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