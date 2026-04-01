/**
 * @description Shared utility functions used by multiple form group modules
 * such as cloning rows, managing layout consistency, and updating overlay labels.
 * 
 * @module functions
 */

/**

* Replaces help buttons in cloned rows with invisible placeholders.
* This helps maintain the structure and prevents changes in field sizes.
*
* @param {jQuery} row - The cloned row from which to replace help buttons.
* @param {string} [roundCornersClass="input-right-with-round-corners"] - The CSS class for rounded corners.
*/
function replaceHelpButtonInClonedRows(row, roundCornersClass = "input-right-with-round-corners") {
  row.find("span.input-group-text:has(i.bi-question-circle-fill)").each(function () {
    const helpSectionId = $(this).find('i').data('help-section-id') || '';
    $(this)
      .addClass("help-placeholder")
      .attr("data-help-section-id", helpSectionId)
      .css({
        visibility: "hidden",
        width: "42px",
        height: "38px"
      });
  });
  row.find(".input-with-help")
    .removeClass("input-right-no-round-corners")
    .addClass(roundCornersClass);
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

// turn the element off by 1. adding d-none, 2. setting aria-hidden to true, and 3. disabling all form controls within it
function visibilityOFF(elementOrSelector) {
  const $el = $(elementOrSelector);
  if (!$el.length) return;

  $el.addClass('d-none').attr('aria-hidden', 'true');
  $el.find('input, select, textarea, button').prop('disabled', true);
}

// turn the element on by 1. removing d-none, 2. setting aria-hidden to false, and 3. enabling all form controls within it
function visibilityON(elementOrSelector) {
  const $el = $(elementOrSelector);
  if (!$el.length) return;

  $el.removeClass('d-none').attr('aria-hidden', 'false');
  $el.find('input, select, textarea, button').prop('disabled', false);
}
// if the element is visible, hide it; if it's hidden, show it
function visibilityToggle(elementOrSelector) {
  const $el = $(elementOrSelector);
  if (!$el.length) return;

  const isVisible = !$el.hasClass('d-none');
  if (isVisible) {
    visibilityOFF($el);
  } else {
    visibilityON($el);
  }
}

export {
  replaceHelpButtonInClonedRows,
  createRemoveButton,
  updateOverlayLabels,
  visibilityOFF,
  visibilityON,
  visibilityToggle
};

// Expose functions for both browser and Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    replaceHelpButtonInClonedRows,
    createRemoveButton,
    updateOverlayLabels,
    visibilityOFF,
    visibilityON,
    visibilityToggle
  };
}

if (typeof window !== 'undefined') {
  window.replaceHelpButtonInClonedRows = replaceHelpButtonInClonedRows;
  window.createRemoveButton = createRemoveButton;
  window.updateOverlayLabelsWrapper = updateOverlayLabels;
  window.visibilityOFF = visibilityOFF;
  window.visibilityON = visibilityON;
  window.visibilityToggle = visibilityToggle;
}