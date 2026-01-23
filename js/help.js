/**
 * Handles the display and toggle of the "Help" feature.
 * Exposes functions via CommonJS for testing while still
 * initialising automatically in the browser environment.
 */

function setHelpStatus(status) {
  localStorage.setItem('helpStatus', status);
  updateHelpStatus();
}

function updateHelpStatus() {
  var status = localStorage.getItem('helpStatus') || 'help-on';
  $('#buttonHelpOn').toggleClass('active', status === 'help-on');
  $('#bd-help-icon').toggleClass('bi bi-question-square-fill', status === 'help-on');
  $('#buttonHelpOff').toggleClass('active', status === 'help-off');
  $('#bd-help-icon').toggleClass('bi bi-question-square', status === 'help-off');
  $('.input-with-help').toggleClass('input-right-no-round-corners', status === 'help-on');
  $('.input-with-help').toggleClass('input-right-with-round-corners', status === 'help-off');
}

function getSelectedResourceType() {
  return $('#input-resourceinformation-resourcetype option:selected').text().trim();
}

/**
 * Classifies a license list item as 'software' or 'general' scope based on its content and URL
 * @param {jQuery} $li - The jQuery-wrapped list item element containing license information
 * @returns {string} Either 'software' or 'general' depending on the license scope
 */
function classifyLicenseScope($li) {
  const txt = $li.text().toLowerCase();
  const href = ($li.find('a').attr('href') || '').toLowerCase();

  if (txt.includes('(for software)')) return 'software';

  if (href.includes('gnu.org/licenses/gpl')) return 'software';
  if (href.includes('opensource.org/license/mit')) return 'software';
  if (href.includes('apache.org/licenses/license-2.0')) return 'software';
  if (href.includes('opensource.org/licenses/bsd-3-clause')) return 'software';

  if (href.includes('joinup.ec.europa.eu') || href.includes('eupl')) return 'general';
  if (href.includes('creativecommons.org/licenses/by/4.0')) return 'general';
  if (href.includes('creativecommons.org/publicdomain/zero/1.0')) return 'general';
  if (href.includes('creativecommons.org/licenses/by-nc/4.0')) return 'general';

  return 'general';
}

/**
 * Filters the help modal's licenses section based on the selected resource type
 * Shows only software licenses when resource type is 'Software', general licenses otherwise
 * @returns {void}
 */
function filterHelpRightsByResourceType() {
  const isSoftware = getSelectedResourceType() === 'Software';
  const $modal = $('#helpModal');
  const $body = $modal.find('.modal-body');

  if ($modal.data('currentSection') !== 'help-rights') return;

  const $list = $body.find('ul').first();
  if ($list.length === 0) return;

  $list.children('li').each(function () {
    const scope = classifyLicenseScope($(this));
    $(this).toggle(isSoftware ? scope === 'software' : scope === 'general');
  });
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
  $('#helpModal').data('currentSection', sectionId).modal('show');

  if (sectionId === 'help-rights') {
    filterHelpRightsByResourceType();
  }
}

function initHelp() {
  updateHelpStatus();
  $('#buttonHelpOn').click(function (event) {
    event.preventDefault();
    setHelpStatus('help-on');
  });

  $('#buttonHelpOff').click(function (event) {
    event.preventDefault();
    setHelpStatus('help-off');
  });

  $(document).on('click', '[data-help-section-id]', function () {
    var sectionId = $(this).attr('data-help-section-id');
    
    // Load HTML data and parse it here in the event handler
    loadHelpContent(function(htmlData) {
      if (htmlData) {
        displayHelpSection(sectionId, htmlData);
      }
    });
  });

  $(document).on('change', '#input-resourceinformation-resourcetype', function () {
    if ($('#helpModal').hasClass('show') && $('#helpModal').data('currentSection') === 'help-rights') {
      filterHelpRightsByResourceType();
    }
  });

  document.getElementById('buttonHelp').addEventListener('click', function (event) {
    event.preventDefault();
    window.open('doc/help.php', '_blank');
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initHelp, loadHelpContent, setHelpStatus, updateHelpStatus, displayHelpSection, getSelectedResourceType, classifyLicenseScope, filterHelpRightsByResourceType };
}

if (typeof window !== 'undefined') {
  window.loadHelpContent = loadHelpContent;
  $(document).ready(initHelp);
}
