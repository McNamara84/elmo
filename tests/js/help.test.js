const fs = require('fs');
const path = require('path');

describe('help.js', () => {
  let $;

  const loadScript = () => {
    const script = fs.readFileSync(path.resolve(__dirname, '../../js/help.js'), 'utf8');
    const match = script.match(/\$\(document\)\.ready\(function \(\) {([\s\S]*)}\);/);
    if (match) {
      const fn = new Function(match[1]);
      fn();
    } else {
      throw new Error('Unable to parse help.js');
    }
  };

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="buttonHelpOn"></button>
      <i id="bd-help-icon"></i>
      <button id="buttonHelpOff"></button>
      <input class="input-with-help" />
      <div id="helpModal"><div class="modal-body"></div></div>
      <button id="buttonHelp"></button>
      <div id="helpIcon" data-help-section-id="section1"></div>
    `;
    localStorage.clear();
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    $.fn.modal = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
  });

  test('initializes to help-on by default', () => {
    loadScript();
    expect($('#buttonHelpOn').hasClass('active')).toBe(true);
    expect($('#buttonHelpOff').hasClass('active')).toBe(false);
    expect($('#bd-help-icon').hasClass('bi-question-square-fill')).toBe(true);
    expect($('.input-with-help').hasClass('input-right-no-round-corners')).toBe(true);
  });

  test('initializes to help-off when stored', () => {
    localStorage.setItem('helpStatus', 'help-off');
    loadScript();
    expect($('#buttonHelpOn').hasClass('active')).toBe(false);
    expect($('#buttonHelpOff').hasClass('active')).toBe(true);
    expect($('#bd-help-icon').hasClass('bi-question-square')).toBe(true);
    expect($('.input-with-help').hasClass('input-right-with-round-corners')).toBe(true);
  });

  test('clicking Help Off stores status and updates UI', () => {
    loadScript();
    $('#buttonHelpOff').trigger('click');
    expect(localStorage.getItem('helpStatus')).toBe('help-off');
    expect($('#buttonHelpOff').hasClass('active')).toBe(true);
    expect($('#buttonHelpOn').hasClass('active')).toBe(false);
    expect($('.input-with-help').hasClass('input-right-with-round-corners')).toBe(true);
    expect($('#bd-help-icon').hasClass('bi-question-square')).toBe(true);
  });

  test('clicking Help On stores status and updates UI', () => {
    localStorage.setItem('helpStatus', 'help-off');
    loadScript();
    $('#buttonHelpOn').trigger('click');
    expect(localStorage.getItem('helpStatus')).toBe('help-on');
    expect($('#buttonHelpOn').hasClass('active')).toBe(true);
    expect($('#buttonHelpOff').hasClass('active')).toBe(false);
    expect($('.input-with-help').hasClass('input-right-no-round-corners')).toBe(true);
    expect($('#bd-help-icon').hasClass('bi-question-square-fill')).toBe(true);
  });
});
