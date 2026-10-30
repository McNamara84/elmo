const path = require('path');

describe('help.js', () => {
  let $, help;

  beforeEach(() => {
    jest.resetModules();
    document.documentElement.removeAttribute('data-help-status');
    document.body.innerHTML = `
      <button id="buttonHelpOn"></button>
      <button id="bd-help"><i class="bi bi-question-square-fill"></i></button>
      <a id="buttonHelpheader" href="doc/help.php">Guide</a>
      <button id="buttonHelpOff"></button>
      <input class="input-with-help input-right-no-round-corners" />
      <span id="unit-addon" class="input-group-text">m</span>
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
    $(document).off('.elmoHelp');
    document.documentElement.removeAttribute('data-help-status');
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.resourceTypeDescriptions;
  });

  test('resource type modal follows selectable options and separates terms from definitions', () => {
    document.body.insertAdjacentHTML('beforeend', `<select id="input-resourceinformation-resourcetype">
      <option value="" disabled>Choose</option>
      <option value="1" title="ERNIE description">Dataset</option>
      <option value="2">Software</option>
      <option value="3" disabled>Unavailable</option>
    </select>`);
    window.resourceTypeDescriptions = require('../../js/resourceTypeDescriptions.js');
    help.displayHelpSection('help-resourceinformation-resourcetype',
      '<div id="help-resourceinformation-resourcetype"><div id="resource-type-help-list"></div></div>');
    expect($('#resource-type-help-list dt').map((_, element) => element.textContent).get())
      .toEqual(['Dataset', 'Software']);
    expect($('#resource-type-help-list dd').first().text()).toBe('ERNIE description');
    expect($('#resource-type-help-list dd').last().text()).toContain('computer program');
  });

  test('initializes to help-on by default', () => {
    expect($('#buttonHelpOn').hasClass('active')).toBe(true);
    expect($('#buttonHelpOff').hasClass('active')).toBe(false);
    expect($('#bd-help > i').hasClass('bi-question-square-fill')).toBe(true);
    expect($('.input-with-help').hasClass('input-right-no-round-corners')).toBe(true);
  });

  test('initializes to help-off when stored', () => {
    localStorage.setItem('helpStatus', 'help-off');
    help.initHelp();
    expect($('#buttonHelpOn').hasClass('active')).toBe(false);
    expect($('#buttonHelpOff').hasClass('active')).toBe(true);
    expect($('#bd-help > i').hasClass('bi-question-square')).toBe(true);
    expect(document.documentElement.dataset.helpStatus).toBe('help-off');
  });

  test('clicking Help Off stores status and updates UI', () => {
    $('#buttonHelpOff').trigger('click');
    expect(localStorage.getItem('helpStatus')).toBe('help-off');
    expect($('#buttonHelpOff').hasClass('active')).toBe(true);
    expect($('#buttonHelpOn').hasClass('active')).toBe(false);
    expect(document.documentElement.dataset.helpStatus).toBe('help-off');
    expect($('#bd-help > i').hasClass('bi-question-square')).toBe(true);
    expect($('#unit-addon').css('display')).not.toBe('none');
    expect($('#buttonHelpheader').attr('href')).toBe('doc/help.php');
  });

  test('clicking Help On stores status and updates UI', () => {
    localStorage.setItem('helpStatus', 'help-off');
    help.initHelp();
    $('#buttonHelpOn').trigger('click');
    expect(localStorage.getItem('helpStatus')).toBe('help-on');
    expect($('#buttonHelpOn').hasClass('active')).toBe(true);
    expect($('#buttonHelpOff').hasClass('active')).toBe(false);
    expect($('.input-with-help').hasClass('input-right-no-round-corners')).toBe(true);
    expect($('#bd-help > i').hasClass('bi-question-square-fill')).toBe(true);
    expect($('.help-icon-author-affiliation').hasClass('d-none')).toBe(false);
    expect($('.help-icon-author-affiliation').hasClass('bi-question-circle-fill')).toBe(true);
    expect($('span.input-group-text:has(i[data-help-section-id="help-author-orcid"])').css('display')).not.toBe('none');
  });

  test('resynchronization preserves local rules for newly created help', () => {
    $('#buttonHelpOff').trigger('click');

    const newAffiliationHelp = $('<i class="bi bi-question-circle-fill help-icon-author-affiliation d-none" data-help-section-id="help-contributorinstitutions-affiliation" data-author-affiliation-help></i>');
    const newOrcidHelp = $('<span class="input-group-text"><i class="bi bi-question-circle-fill" data-help-section-id="help-author-orcid"></i></span>');
    $(document.body).append(newAffiliationHelp, newOrcidHelp);

    help.updateHelpStatus();

    expect(newAffiliationHelp.hasClass('d-none')).toBe(true);
    expect(document.documentElement.dataset.helpStatus).toBe('help-off');
    help.setHelpStatus('help-on');
    expect(newAffiliationHelp.hasClass('d-none')).toBe(true);
    expect(newOrcidHelp.attr('style')).toBeUndefined();
  });


  test.each([
    [null, null, 'help-on'],
    [null, 'false', 'help-off'],
    [null, 'true', 'help-on'],
    [null, 'invalid', 'help-on'],
    ['invalid', 'false', 'help-off'],
    ['invalid', null, 'help-on'],
    ['help-on', 'false', 'help-on'],
    ['help-off', 'true', 'help-off'],
    ['help-off', null, 'help-off']
  ])('resolves stored status %s and legacy preference %s to %s', (status, legacy, expected) => {
    localStorage.clear();
    if (status !== null) localStorage.setItem('helpStatus', status);
    if (legacy !== null) localStorage.setItem('inputGroupTextVisible', legacy);
    help.updateHelpStatus();
    expect(localStorage.getItem('helpStatus')).toBe(expected);
    expect(localStorage.getItem('inputGroupTextVisible')).toBeNull();
    expect(document.documentElement.dataset.helpStatus).toBe(expected);
  });

  test('reinitialization binds one handler per action and preserves unrelated listeners', () => {
    const unrelated = jest.fn();
    $('#buttonHelpOff').on('click.otherFeature', unrelated);
    help.initHelp();
    help.initHelp();
    const updates = jest.fn();
    document.addEventListener('helpStatus:changed', updates);
    $('#buttonHelpOff').trigger('click');
    expect(updates).toHaveBeenCalledTimes(1);
    expect(updates.mock.calls[0][0].detail).toEqual({ status: 'help-off' });
    expect(unrelated).toHaveBeenCalledTimes(1);
    document.removeEventListener('helpStatus:changed', updates);
  });

  test('loads help once when both an icon and its wrapper carry the section ID', () => {
    $.get = jest.fn(() => ({ fail: jest.fn() }));
    $(document.body).append('<span data-help-section-id="section1"><i id="nested-help" data-help-section-id="section1"></i></span>');
    $('#nested-help').trigger('click');
    expect($.get).toHaveBeenCalledTimes(1);
  });

  test('does not open help while disabled or from a repeated-entry placeholder', () => {
    $.get = jest.fn(() => ({ fail: jest.fn() }));
    help.setHelpStatus('help-off');
    $('#helpIcon').trigger('click');
    help.setHelpStatus('help-on');
    $('#helpIcon').addClass('help-placeholder').trigger('click');
    expect($.get).not.toHaveBeenCalled();
  });

  test.each(['Enter', ' '])('keyboard key %s opens help once', key => {
    $.get = jest.fn(() => ({ fail: jest.fn() }));
    $('#helpIcon').attr('tabindex', '0').trigger($.Event('keydown', { key }));
    expect($.get).toHaveBeenCalledTimes(1);
  });

  test('other keyboard keys do not open help', () => {
    $.get = jest.fn(() => ({ fail: jest.fn() }));
    $('#helpIcon').attr('tabindex', '0').trigger($.Event('keydown', { key: 'Escape' }));
    expect($.get).not.toHaveBeenCalled();
  });

  test('renders resource type help with unavailable descriptions and incomplete DOM', () => {
    help.renderResourceTypeHelp();
    $('#helpModal .modal-body').html('<div id="resource-type-help-list"></div>');
    help.renderResourceTypeHelp();
    $(document.body).append('<select id="input-resourceinformation-resourcetype"><option value="1">Custom</option></select>');
    help.renderResourceTypeHelp();
    expect($('#resource-type-help-list dd').text()).toBe('No definition is currently available.');
    window.resourceTypeDescriptions = { getResourceTypeDescription: () => '' };
    $('#input-resourceinformation-resourcetype option').attr('title', 'Fallback description');
    help.renderResourceTypeHelp();
    expect($('#resource-type-help-list dd').text()).toBe('Fallback description');
  });

  test('shows license examples without inferring ERNIE grants from resource type', () => {
    $(document.body).append('<select id="input-resourceinformation-resourcetype"><option value="1">Dataset</option><option value="2">Software</option></select>');
    help.filterHelpRightsByResourceType(); // Other help sections remain untouched.
    $('#helpModal').data('currentSection', 'help-rights');
    help.filterHelpRightsByResourceType(); // A section without a list is valid.
    help.displayHelpSection('help-rights', '<section id="help-rights"><ul><li id="general-license">General license</li><li id="software-license">License (for software)</li></ul></section>');
    expect($('#general-license').css('display')).not.toBe('none');
    expect($('#software-license').css('display')).not.toBe('none');
    $('#helpModal').addClass('show');
    $('#input-resourceinformation-resourcetype').val('2').trigger('change');
    expect($('#general-license').css('display')).not.toBe('none');
    expect($('#software-license').css('display')).not.toBe('none');
    $('#helpModal').data('currentSection', 'section1');
    $('#input-resourceinformation-resourcetype').val('1').trigger('change');
    expect($('#software-license').css('display')).not.toBe('none');
    $('#helpModal').removeClass('show');
    $('#input-resourceinformation-resourcetype').trigger('change');
  });

  test('shows a fallback for missing or empty help sections', () => {
    help.displayHelpSection('missing', '<section id="other">Other help</section>');
    expect($('#helpModal .modal-body').text()).toBe('Help content not available for this section.');
    help.displayHelpSection('empty', '<section id="empty">  </section>');
    expect($('#helpModal .modal-body').text()).toBe('Help content not available for this section.');
  });

  test('loads and displays help on a successful request', () => {
    $.get = jest.fn((url, callback) => {
      callback('<section id="section1">Loaded help</section>');
      return { fail: jest.fn() };
    });
    $('#helpIcon').trigger('click');
    expect($('#helpModal .modal-body').text()).toBe('Loaded help');
    expect($.fn.modal).toHaveBeenCalledTimes(1);
  });

  test('leaves the current dialog untouched when a help request fails', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    $.get = jest.fn(() => ({ fail: callback => callback() }));
    $('#helpIcon').trigger('click');
    expect($.fn.modal).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('clicking help icon triggers an AJAX call', () => {
    $.get = jest.fn(() => ({ fail: jest.fn() }));
    $('#helpIcon').trigger('click');
    expect($.get).toHaveBeenCalledWith('doc/help.php', expect.any(Function));
  });

  test('keyboard opens a focusable field help icon', () => {
    $.get = jest.fn(() => ({ fail: jest.fn() }));
    const icon = $('<i data-help-section-id="help-resourceinformation-resourcetype" tabindex="0"></i>');
    $(document.body).append(icon);
    icon.trigger($.Event('keydown', { key: 'Enter' }));
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
