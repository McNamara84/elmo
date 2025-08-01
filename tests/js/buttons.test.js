const fs = require('fs');
const path = require('path');

describe('buttons.js', () => {
  let $;

  function loadScript() {
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/buttons.js'),
      'utf8'
    );
    script = script.replace(/^import.*$/gm, '');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\s*\}\);\s*$/, '\n})();');
    window.eval(script);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div class="input-group-text"></div>
      <div class="input-group-text"></div>
      <button id="buttonHelpOn"></button>
      <button id="buttonHelpOff"></button>
      <button id="buttonHelp"></button>
      <button id="bd-theme"></button>
      <button id="button-form-reset"></button>
      <button id="button-form-load"></button>
      <div id="modal-uploadxml"></div>
      <a id="button-changelog-show" href="#"></a>
      <div id="panel-changelog-content"></div>
      <div id="modal-changelog"></div>
      <div data-bs-toggle="tooltip" id="tooltip-target"></div>
    `;
    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    $.fn.modal = jest.fn();
    $.fn.load = jest.fn(function (url, cb) { if (cb) cb(); return this; });
    $.fn.tooltip = jest.fn();
    window.clearInputFields = jest.fn();
    window.open = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  test('shows help icons by default', () => {
    loadScript();
    expect($('.input-group-text').first().css('display')).not.toBe('none');
  });

  test('initializes help icons based on localStorage', () => {
    localStorage.setItem('inputGroupTextVisible', 'false');
    loadScript();
    expect($('.input-group-text').first().css('display')).toBe('none');
  });

  test('buttonHelpOn shows help icons and stores preference', () => {
    localStorage.setItem('inputGroupTextVisible', 'false');
    loadScript();
    $('#buttonHelpOn').trigger('click');
    expect($('.input-group-text').first().css('display')).not.toBe('none');
    expect(localStorage.getItem('inputGroupTextVisible')).toBe('true');
  });

  test('buttonHelpOff hides help icons and stores preference', () => {
    loadScript();
    $('#buttonHelpOff').trigger('click');
    expect($('.input-group-text').first().css('display')).toBe('none');
    expect(localStorage.getItem('inputGroupTextVisible')).toBe('false');
  });

  test('hovering 30 times opens Easter egg', () => {
    loadScript();
    for (let i = 0; i < 30; i++) {
      $('#buttonHelp').trigger('mouseenter');
    }
    expect(window.open).toHaveBeenCalledWith(
      'doc/egg.html',
      'Egg',
      'width=650,height=450,scrollbars=no,resizable=no,location=no'
    );
  });

  test('hover counter resets after 1 second', () => {
    loadScript();
    for (let i = 0; i < 10; i++) {
      $('#buttonHelp').trigger('mouseenter');
    }
    jest.advanceTimersByTime(1000);
    for (let i = 0; i < 20; i++) {
      $('#buttonHelp').trigger('mouseenter');
    }
    expect(window.open).not.toHaveBeenCalled();
  });

  test('reset button clears inputs', () => {
    loadScript();
    $('#button-form-reset').trigger('click');
    expect(window.clearInputFields).toHaveBeenCalled();
  });

  test('load button shows upload modal', () => {
    loadScript();
    $('#button-form-load').trigger('click');
    expect($.fn.modal).toHaveBeenCalledWith('show');
  });

  test('changelog button loads content and shows modal', () => {
    loadScript();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('button-changelog-show').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect($.fn.load).toHaveBeenCalledWith('doc/changelog.html', expect.any(Function));
    expect($.fn.modal).toHaveBeenCalledWith('show');
  });

  test('tooltips are initialized', () => {
    loadScript();
    expect($.fn.tooltip).toHaveBeenCalled();
  });
});