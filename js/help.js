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

function loadHelpContent(sectionId) {
  $.get('doc/help.php', function (data) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(data, 'text/html');
    var content = $(doc).find('#' + sectionId).html();
    $('#helpModal .modal-body').html(content);
    $('#helpModal').modal('show');
  }).fail(function () {
    console.error('Error loading help content.');
  });
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
    var sectionId = $(this).data('help-section-id');
    window.loadHelpContent(sectionId);
  });

  document.getElementById('buttonHelp').addEventListener('click', function (event) {
    event.preventDefault();
    window.open('doc/help.php', '_blank');
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initHelp, loadHelpContent, setHelpStatus, updateHelpStatus };
}

if (typeof window !== 'undefined') {
  window.loadHelpContent = loadHelpContent;
  $(document).ready(initHelp);
}
