const path = require('path');

describe('eventhandlers/functions.js', () => {
  let $, funcs;

  beforeEach(() => {
    document.body.innerHTML = '';
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    const originalIs = $.fn.is;
    $.fn.is = function(selector) {
      if (selector === ':visible') {
        for (let i = 0; i < this.length; i++) {
          if (this[i].style && this[i].style.display === 'none') {
            return false;
          }
        }
        return true;
      }
      return originalIs.call(this, selector);
    };
    $.fn.is.__original = originalIs;

    funcs = require(path.resolve(__dirname, '../../js/eventhandlers/functions.js'));
  });

  afterEach(() => {
    delete global.$;
    delete global.jQuery;
    $.fn.is = $.fn.is.__original;
  });

  test('replaceHelpButtonInClonedRows replaces help buttons with placeholders', () => {
    document.body.innerHTML = `
      <div class="input-group-text" style="display:block;width:10px;height:10px"></div>
      <div id="row">
        <span class="input-group-text"><i class="bi-question-circle-fill" data-help-section-id="abc"></i></span>
        <input class="input-with-help input-right-no-round-corners" />
      </div>`;
    const row = $('#row');

    funcs.replaceHelpButtonInClonedRows(row);

    const placeholder = row.find('span.help-placeholder');
    expect(placeholder.length).toBe(1);
    expect(placeholder.attr('data-help-section-id')).toBe('abc');
    expect(placeholder.css('width')).toBe('42px');
    expect(row.find('span.input-group-text').length).toBe(1);
    expect(placeholder.attr('style')).toContain('width: 42px');
    expect(row.find('span.input-group-text').length).toBe(1);
    const input = row.find('.input-with-help');
    expect(input.hasClass('input-right-no-round-corners')).toBe(false);
    expect(input.hasClass('input-right-with-round-corners')).toBe(true);
  });

  test('replaceHelpButtonInClonedRows handles missing help section id', () => {
    document.body.innerHTML = `
      <div class="input-group-text" style="display:block;width:10px;height:10px"></div>
      <div id="row">
        <span class="input-group-text"><i class="bi-question-circle-fill"></i></span>
        <input class="input-with-help input-right-no-round-corners" />
      </div>`;
    const row = $('#row');

    funcs.replaceHelpButtonInClonedRows(row);

    const placeholder = row.find('span.help-placeholder');
    expect(placeholder.length).toBe(1);
    expect(placeholder.attr('data-help-section-id')).toBe('');
  });

  test('replaceHelpButtonInClonedRows does nothing when input-group-text hidden', () => {
    document.body.innerHTML = `
      <div id="row">
        <span class="input-group-text" style="display:none"><i class="bi-question-circle-fill" data-help-section-id="abc"></i></span>
        <input class="input-with-help input-right-no-round-corners" />
      </div>`;
    const row = $('#row');

    funcs.replaceHelpButtonInClonedRows(row);

    expect(row.find('span.help-placeholder').length).toBe(1);
    expect(row.find('span.input-group-text').length).toBe(1);
    const input = row.find('.input-with-help');
    expect(input.hasClass('input-right-no-round-corners')).toBe(false);
    expect(input.hasClass('input-right-with-round-corners')).toBe(true);
  });

  test('replaceHelpButtonInClonedRows uses custom roundCornersClass', () => {
    document.body.innerHTML = `
      <div class="input-group-text" style="display:block;width:10px;height:10px"></div>
      <div id="row">
        <span class="input-group-text"><i class="bi-question-circle-fill" data-help-section-id="abc"></i></span>
        <input class="input-with-help input-right-no-round-corners" />
      </div>`;
    const row = $('#row');

    funcs.replaceHelpButtonInClonedRows(row, 'custom-class');

    const input = row.find('.input-with-help');
    expect(input.hasClass('custom-class')).toBe(true);
    expect(input.hasClass('input-right-with-round-corners')).toBe(false);
  });

  test('replaceHelpButtonInClonedRows updates classes even without help icon', () => {
    document.body.innerHTML = `
      <div class="input-group-text" style="display:block;width:10px;height:10px"></div>
      <div id="row">
        <span class="input-group-text"></span>
        <input class="input-with-help input-right-no-round-corners" />
      </div>`;
    const row = $('#row');

    funcs.replaceHelpButtonInClonedRows(row);

    expect(row.find('div.help-placeholder').length).toBe(0);
    expect(row.find('span.input-group-text').length).toBe(1);
    const input = row.find('.input-with-help');
    expect(input.hasClass('input-right-no-round-corners')).toBe(false);
    expect(input.hasClass('input-right-with-round-corners')).toBe(true);
  });

  test('createRemoveButton returns correct button', () => {
    const btn = funcs.createRemoveButton();
    expect(btn.is('button')).toBe(true);
    expect(btn.attr('type')).toBe('button');
    expect(btn.hasClass('btn-danger')).toBe(true);
    expect(btn.hasClass('removeButton')).toBe(true);
    expect(btn.text()).toBe('-');
    expect(btn.attr('style')).toContain('width: 36px');
  });

  test('updateOverlayLabels calls global updateOverlayLabels if present', () => {
    const spy = jest.fn();
    window.updateOverlayLabels = spy;
    funcs.updateOverlayLabels();
    expect(spy).toHaveBeenCalled();
  });

  test('updateOverlayLabels does nothing when global function absent', () => {
    window.updateOverlayLabels = undefined;
    expect(() => funcs.updateOverlayLabels()).not.toThrow();
  });

  describe('translateClonedRow', () => {
    beforeEach(() => {
      global.translations = { some: 'value' };
      window.elmo = {
        translate: jest.fn((key) => {
          const map = {
            'label.name': 'Name',
            'placeholder.search': 'Search…',
            'title.orcidSearch': 'Search ORCID by name'
          };
          return map[key] || null;
        })
      };
    });

    afterEach(() => {
      delete global.translations;
      delete window.elmo;
    });

    test('translates data-translate elements', () => {
      document.body.innerHTML = `
        <div id="row">
          <label data-translate="label.name">Untranslated</label>
        </div>`;
      funcs.translateClonedRow($('#row'));
      expect($('[data-translate]').html()).toBe('Name');
    });

    test('preserves icon inside data-translate element', () => {
      document.body.innerHTML = `
        <div id="row">
          <label data-translate="label.name"><i class="bi bi-search" aria-hidden="true"></i> Untranslated</label>
        </div>`;
      funcs.translateClonedRow($('#row'));
      const label = $('[data-translate]');
      expect(label.find('i.bi').length).toBe(1);
      expect(label.text().trim()).toBe('Name');
    });

    test('translates data-translate-placeholder attributes', () => {
      document.body.innerHTML = `
        <div id="row">
          <input data-translate-placeholder="placeholder.search" placeholder="Old" />
        </div>`;
      funcs.translateClonedRow($('#row'));
      expect($('input').attr('placeholder')).toBe('Search…');
    });

    test('translates data-translate-title and sets aria-label', () => {
      document.body.innerHTML = `
        <div id="row">
          <button data-translate-title="title.orcidSearch" title="Old title" aria-label="Old label">
            <i class="bi bi-search" aria-hidden="true"></i>
          </button>
        </div>`;
      funcs.translateClonedRow($('#row'));
      const btn = $('button');
      expect(btn.attr('title')).toBe('Search ORCID by name');
      expect(btn.attr('aria-label')).toBe('Search ORCID by name');
    });

    test('does nothing when translations global is undefined', () => {
      delete global.translations;
      document.body.innerHTML = `
        <div id="row">
          <label data-translate="label.name">Untranslated</label>
        </div>`;
      funcs.translateClonedRow($('#row'));
      expect($('[data-translate]').html()).toBe('Untranslated');
    });

    test('does nothing when elmo.translate is not a function', () => {
      window.elmo = {};
      document.body.innerHTML = `
        <div id="row">
          <label data-translate="label.name">Untranslated</label>
        </div>`;
      funcs.translateClonedRow($('#row'));
      expect($('[data-translate]').html()).toBe('Untranslated');
    });

    test('skips elements when translate returns null', () => {
      document.body.innerHTML = `
        <div id="row">
          <label data-translate="unknown.key">Original</label>
          <input data-translate-placeholder="unknown.key" placeholder="Old" />
          <button data-translate-title="unknown.key" title="Old">X</button>
        </div>`;
      funcs.translateClonedRow($('#row'));
      expect($('label').html()).toBe('Original');
      expect($('input').attr('placeholder')).toBe('Old');
      expect($('button').attr('title')).toBe('Old');
    });
  });
});