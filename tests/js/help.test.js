const path = require('path');

describe('help.js', () => {
  let $, help;

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
    help = require(path.resolve(__dirname, '../../js/help.js'));
    help.initHelp();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
  });

  test('initializes to help-on by default', () => {
    expect($('#buttonHelpOn').hasClass('active')).toBe(true);
    expect($('#buttonHelpOff').hasClass('active')).toBe(false);
    expect($('#bd-help-icon').hasClass('bi-question-square-fill')).toBe(true);
    expect($('.input-with-help').hasClass('input-right-no-round-corners')).toBe(true);
  });

  test('initializes to help-off when stored', () => {
    localStorage.setItem('helpStatus', 'help-off');
    help.initHelp();
    expect($('#buttonHelpOn').hasClass('active')).toBe(false);
    expect($('#buttonHelpOff').hasClass('active')).toBe(true);
    expect($('#bd-help-icon').hasClass('bi-question-square')).toBe(true);
    expect($('.input-with-help').hasClass('input-right-with-round-corners')).toBe(true);
  });

  test('clicking Help Off stores status and updates UI', () => {
    $('#buttonHelpOff').trigger('click');
    expect(localStorage.getItem('helpStatus')).toBe('help-off');
    expect($('#buttonHelpOff').hasClass('active')).toBe(true);
    expect($('#buttonHelpOn').hasClass('active')).toBe(false);
    expect($('.input-with-help').hasClass('input-right-with-round-corners')).toBe(true);
    expect($('#bd-help-icon').hasClass('bi-question-square')).toBe(true);
  });

  test('clicking Help On stores status and updates UI', () => {
    localStorage.setItem('helpStatus', 'help-off');
    help.initHelp();
    $('#buttonHelpOn').trigger('click');
    expect(localStorage.getItem('helpStatus')).toBe('help-on');
    expect($('#buttonHelpOn').hasClass('active')).toBe(true);
    expect($('#buttonHelpOff').hasClass('active')).toBe(false);
    expect($('.input-with-help').hasClass('input-right-no-round-corners')).toBe(true);
    expect($('#bd-help-icon').hasClass('bi-question-square-fill')).toBe(true);
  });

  test('clicking help icon triggers loadHelpContent with section id', () => {
    $.get = jest.fn(() => ({ fail: jest.fn() }));
    const spy = jest.spyOn(window, 'loadHelpContent').mockImplementation(() => {});
    $('#helpIcon').trigger('click');
    expect(spy).toHaveBeenCalledWith('section1');
    spy.mockRestore();
  });

  test('loadHelpContent populates modal on success', () => {
    $.get = jest.fn((url, success) => {
      success('<div id="sec">Content</div>');
      return { fail: jest.fn() };
    });
    help.loadHelpContent('sec');
    expect($.get).toHaveBeenCalledWith('doc/help.php', expect.any(Function));
    expect($('#helpModal .modal-body').html()).toBe('Content');
    expect($.fn.modal).toHaveBeenCalledWith('show');
  });

  test('loadHelpContent logs error on failure', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    $.get = jest.fn(() => ({ fail: cb => cb() }));
    help.loadHelpContent('sec');
    expect(errorSpy).toHaveBeenCalledWith('Error loading help content.');
    errorSpy.mockRestore();
  });

  test('Help button opens help page', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});
    const btn = document.getElementById('buttonHelp');
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    btn.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(openSpy).toHaveBeenCalledWith('doc/help.php', '_blank');
    openSpy.mockRestore();
  });
});