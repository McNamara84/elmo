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
      <i class="bi bi-question-circle-fill help-icon-author-affiliation"
         data-help-section-id="help-contributorinstitutions-affiliation"
         data-author-affiliation-help></i>
      <span class="input-group-text"><i class="bi bi-question-circle-fill" data-help-section-id="help-author-orcid"></i></span>
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
    expect($('.help-icon-author-affiliation').hasClass('d-none')).toBe(true);
    expect($('span.input-group-text:has(i[data-help-section-id="help-author-orcid"])').css('display')).toBe('none');
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
    expect($('.help-icon-author-affiliation').hasClass('d-none')).toBe(false);
    expect($('.help-icon-author-affiliation').hasClass('bi-question-circle-fill')).toBe(true);
    expect($('span.input-group-text:has(i[data-help-section-id="help-author-orcid"])').css('display')).not.toBe('none');
  });

  test('updateHelpStatus reapplies visibility to newly created author help icons', () => {
    $('#buttonHelpOff').trigger('click');

    const newAffiliationHelp = $('<i class="bi bi-question-circle-fill help-icon-author-affiliation" data-help-section-id="help-contributorinstitutions-affiliation" data-author-affiliation-help></i>');
    const newOrcidHelp = $('<span class="input-group-text"><i class="bi bi-question-circle-fill" data-help-section-id="help-author-orcid"></i></span>');
    $(document.body).append(newAffiliationHelp, newOrcidHelp);

    help.updateHelpStatus();

    expect(newAffiliationHelp.hasClass('d-none')).toBe(true);
    expect(newOrcidHelp.css('display')).toBe('none');
  });

  test('clicking help icon triggers an AJAX call', () => {
    $.get = jest.fn(() => ({ fail: jest.fn() }));
    $('#helpIcon').trigger('click');
    expect($.get).toHaveBeenCalledWith('doc/help.php', expect.any(Function));
  });

  test('displayHelpSection populates modal on success', () => {
    const htmlData = '<div id="section1">Help Content</div>';
    help.displayHelpSection('section1', htmlData);
    expect($('#helpModal .modal-body').html()).toBe('Help Content');
    expect($.fn.modal).toHaveBeenCalledWith('show');
  });

  test('loadHelpContent calls back with null on failure', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    $.get = jest.fn(() => ({ fail: cb => cb() }));
    const callback = jest.fn();
    help.loadHelpContent(callback);
    expect(callback).toHaveBeenCalledWith(null);
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