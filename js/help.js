/**
 * Handles the display and toggle of the "Help" feature.
 * Exposes functions via CommonJS for testing while still
 * initialising automatically in the browser environment.
 */

/**
 * Saves the help preference and synchronizes the editor and its form groups.
 * @param {'help-on'|'help-off'} status - Whether contextual help is enabled.
 * @returns {void}
 */
function setHelpStatus(status) {
  localStorage.setItem('helpStatus', status);
  updateHelpStatus();
}

/**
 * Applies the stored preference, migrating the legacy setting when necessary.
 * A valid helpStatus takes precedence; otherwise the legacy value or help-on is
 * used. Emits helpStatus:changed so form groups can restore their eligible help.
 * @returns {void}
 */
function updateHelpStatus() {
  let status = localStorage.getItem('helpStatus');
  if (status !== 'help-on' && status !== 'help-off') {
    status = localStorage.getItem('inputGroupTextVisible') === 'false' ? 'help-off' : 'help-on';
  }
  localStorage.setItem('helpStatus', status);
  localStorage.removeItem('inputGroupTextVisible');
  const helpOn = status === 'help-on';

  // CSS also covers help inserted later by API responses, clones and imports.
  // Local form-group rules still decide which help is eligible when enabled.
  document.documentElement.dataset.helpStatus = status;
  $('#buttonHelpOn').toggleClass('active', helpOn);
  $('#buttonHelpOff').toggleClass('active', !helpOn);
  $('#bd-help > i.bi').toggleClass('bi-question-square-fill', helpOn)
    .toggleClass('bi-question-square', !helpOn);

  // Notify form groups to reapply their local first-entry visibility rules.
  document.dispatchEvent(new CustomEvent('helpStatus:changed', { detail: { status } }));
}

function getSelectedResourceType() {
  return $('#input-resourceinformation-resourcetype option:selected').text().trim();
}

/** Render definitions from exactly the options currently available in this edition. */
function renderResourceTypeHelp() {
  const target = document.querySelector('#helpModal #resource-type-help-list');
  const select = document.getElementById('input-resourceinformation-resourcetype');
  if (!target || !select) return;
  const options = Array.from(select.options).filter(option => option.value && !option.disabled);
  const list = document.createElement('dl');
  list.className = 'resource-types-list';
  options.forEach(option => {
    const term = document.createElement('dt');
    term.textContent = option.textContent.trim();
    const definition = document.createElement('dd');
    definition.textContent = window.resourceTypeDescriptions?.getResourceTypeDescription(
      term.textContent, option.title) || option.title || 'No definition is currently available.';
    list.append(term, definition);
  });
  target.replaceChildren(list);
}

/** License examples in the guide do not determine ERNIE availability. */
function filterHelpRightsByResourceType() {
  $('#helpModal .modal-body ul').first().children('li').show();
}

function loadHelpContent(callback) {
  $.get('doc/help.php', function (data) {
    // Return the HTML data via callback
    callback(data);
  }).fail(function () {
    console.error('Error loading help content.');
    callback(null);
  });
}

function displayHelpSection(sectionId, htmlData) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(htmlData, 'text/html');
  var content = $(doc).find('#' + sectionId).html();
  
  if (!content || content.trim() === '') {
    content = '<p>Help content not available for this section.</p>';
  }
  
  $('#helpModal .modal-body').html(content);
  if (sectionId === 'help-resourceinformation-resourcetype') renderResourceTypeHelp();
  $('#helpModal').data('currentSection', sectionId).modal('show');

  if (sectionId === 'help-rights') {
    filterHelpRightsByResourceType();
  }
}

/**
 * Applies the preference and binds help controls without duplicating handlers.
 * @returns {void}
 */
function initHelp() {
  updateHelpStatus();
  $('#buttonHelpOn').off('click.elmoHelp').on('click.elmoHelp', function (event) {
    event.preventDefault();
    setHelpStatus('help-on');
  });

  $('#buttonHelpOff').off('click.elmoHelp').on('click.elmoHelp', function (event) {
    event.preventDefault();
    setHelpStatus('help-off');
  });

  $(document).off('.elmoHelp');
  $(document).on('click.elmoHelp', '[data-help-section-id]', function (event) {
    if (document.documentElement.dataset.helpStatus === 'help-off' || $(this).closest('.help-placeholder').length) return;
    // Cloned wrappers can carry the same help ID as their child icon.
    event.stopPropagation();
    var sectionId = $(this).attr('data-help-section-id');
    
    // Load HTML data and parse it here in the event handler
    loadHelpContent(function(htmlData) {
      if (htmlData) {
        displayHelpSection(sectionId, htmlData);
      }
    });
  });

  $(document).on('keydown.elmoHelp', '[data-help-section-id][tabindex]', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    $(this).trigger('click');
  });

  $(document).on('change.elmoHelp', '#input-resourceinformation-resourcetype', function () {
    if ($('#helpModal').hasClass('show') && $('#helpModal').data('currentSection') === 'help-rights') {
      filterHelpRightsByResourceType();
    }
  });

  $('#buttonHelp').off('click.elmoHelp').on('click.elmoHelp', function (event) {
    event.preventDefault();
    window.open('doc/help.php', '_blank');
  });
}

export { initHelp, loadHelpContent, setHelpStatus, updateHelpStatus, displayHelpSection, getSelectedResourceType, filterHelpRightsByResourceType, renderResourceTypeHelp };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initHelp, loadHelpContent, setHelpStatus, updateHelpStatus, displayHelpSection, getSelectedResourceType, filterHelpRightsByResourceType, renderResourceTypeHelp };
}

if (typeof window !== 'undefined') {
  window.loadHelpContent = loadHelpContent;
  window.updateHelpStatus = updateHelpStatus;
  $(document).ready(initHelp);
}
