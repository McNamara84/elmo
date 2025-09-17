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
});