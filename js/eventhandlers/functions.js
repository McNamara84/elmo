/**
 * @description Shared utility functions used by multiple form group modules
 * such as cloning rows, managing layout consistency, and updating overlay labels.
 * 
 * @module functions
 */

/**

* Replaces help buttons in cloned rows with invisible placeholders.
* This helps maintain the structure and prevents changes in field sizes.
* Help buttons listed in visibleHelpSectionIds remain visible.
*
* @param {jQuery} row - The cloned row from which to replace help buttons.
* @param {string} [roundCornersClass="input-right-with-round-corners"] - The CSS class for inputs whose help button is hidden.
* @param {string[]} [visibleHelpSectionIds=[]] - Help section IDs whose buttons remain visible in cloned rows.
*/
function replaceHelpButtonInClonedRows(row, roundCornersClass = "input-right-with-round-corners", visibleHelpSectionIds = []) {
  row.find("span.input-group-text:has(i.bi-question-circle-fill)").each(function () {
    const $helpButton = $(this);
    const helpSectionId = $helpButton.find("i").data("help-section-id") || '';

    // Keep configured help buttons visible in cloned rows.
    if (visibleHelpSectionIds.includes(helpSectionId)) {
      return;
    }

    // Hide other help buttons while preserving the input layout.
    $helpButton
      .addClass("help-placeholder")
      .attr("data-help-section-id", helpSectionId)
      .css({
        visibility: "hidden",
        width: "42px",
        height: "38px"
      });
  });

  // Update input border styles based on the visibility of their help buttons.
  row.find(".input-with-help").each(function () {
    const $input = $(this);
    const helpSectionId = $input
      .closest(".input-group")
      .find("i.bi-question-circle-fill")
      .data("help-section-id");

    // Round the input only when its related help button is hidden.
    if (!visibleHelpSectionIds.includes(helpSectionId)) {
      $input
        .removeClass("input-right-no-round-corners")
        .addClass(roundCornersClass);
    }
  });
}



/**
* Creates the Remove button element.
* @returns {jQuery} A jQuery object representing the Remove button.
*/
function createRemoveButton() {
  return $('<button type="button" class="btn btn-danger removeButton" style="width: 36px; margin-inline-end: 0.75rem;" aria-label="Remove entry"><span aria-hidden="true">-</span></button>');
}

/**
* Updates the labels on the map overlays to match the current row numbering.
*/
function updateOverlayLabels() {
  if (typeof window.updateOverlayLabels === 'function') {
    window.updateOverlayLabels();
  }
}

function visibilityOFF(elementOrSelector) {
  const $el = $(elementOrSelector);
  if (!$el.length) return;

  $el.addClass('d-none').attr('aria-hidden', 'true');
  $el.find('input, select, textarea, button').prop('disabled', true);
}

function visibilityON(elementOrSelector) {
  const $el = $(elementOrSelector);
  if (!$el.length) return;

  $el.removeClass('d-none').attr('aria-hidden', 'false');
  $el.find('input, select, textarea, button').prop('disabled', false);
}

/**
 * Applies the current translations to a freshly cloned row.
 * Templates captured at document-ready time contain untranslated text;
 * this function updates data-translate, data-translate-placeholder and
 * data-translate-title elements so labels, placeholders, titles and
 * aria-labels match the active language.
 *
 * @param {jQuery} row - The cloned row to translate.
 */
function translateClonedRow(row) {
  if (typeof translations === 'undefined' || !translations) return;
  const translate = window.elmo && window.elmo.translate;
  if (typeof translate !== 'function') return;

  row.find('[data-translate]').each(function () {
    const key = $(this).data('translate');
    const value = translate(key);
    if (value) {
      const icon = $(this).find('i.bi').prop('outerHTML');
      $(this).html(icon ? `${icon} ${value}` : value);
    }
  });
  row.find('[data-translate-placeholder]').each(function () {
    const key = $(this).data('translate-placeholder');
    const value = translate(key);
    if (value) {
      $(this).attr('placeholder', value);
    }
  });
  row.find('[data-translate-title]').each(function () {
    const key = $(this).data('translate-title');
    const value = translate(key);
    if (value) {
      $(this).attr('title', value);
      $(this).attr('aria-label', value);
    }
  });
}

// ...existing code...

export {
  replaceHelpButtonInClonedRows,
  createRemoveButton,
  translateClonedRow,
  updateOverlayLabels,
  visibilityOFF,
  visibilityON
};

// Expose functions for both browser and Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    replaceHelpButtonInClonedRows,
    createRemoveButton,
    translateClonedRow,
    updateOverlayLabels,
    visibilityOFF,
    visibilityON
  };
}

if (typeof window !== 'undefined') {
  window.replaceHelpButtonInClonedRows = replaceHelpButtonInClonedRows;
  window.createRemoveButton = createRemoveButton;
  window.translateClonedRow = translateClonedRow;
  window.updateOverlayLabelsWrapper = updateOverlayLabels;
  window.visibilityOFF = visibilityOFF;
  window.visibilityON = visibilityON;
}