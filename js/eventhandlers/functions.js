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
  if ($(".input-group-text").is(":visible")) {
    // Find all span elements with the help icon
    row.find("span.input-group-text:has(i.bi-question-circle-fill)").each(function () {
      const helpSectionId = $(this).find('i').data('help-section-id') || '';
      // Replace the span with an empty div that retains the help metadata
      $(this).replaceWith(
        `<div class="input-group-text help-placeholder" data-help-section-id="${helpSectionId}" style="visibility: hidden; width: 42px; height: 38px;"></div>`
      );
    });

    // Remove non-rounded corners class to keep structure intact
    row.find(".input-with-help").removeClass("input-right-no-round-corners");
    row.find(".input-with-help").addClass(roundCornersClass);
  }
}

/**
* Creates the Remove button element.
* @returns {jQuery} A jQuery object representing the Remove button.
*/
function createRemoveButton() {
  return $('<button type="button" class="btn btn-danger removeButton" style="width: 36px;" aria-label="Remove entry">-</button>');
}

/**
* Updates the labels on the map overlays to match the current row numbering.
*/
function updateOverlayLabels() {
  if (typeof window.updateOverlayLabels === 'function') {
    window.updateOverlayLabels();
  }
}

export { replaceHelpButtonInClonedRows, createRemoveButton, updateOverlayLabels };

// Expose functions for both browser and Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    replaceHelpButtonInClonedRows,
    createRemoveButton,
    updateOverlayLabels
  };
}

if (typeof window !== 'undefined') {
  window.replaceHelpButtonInClonedRows = replaceHelpButtonInClonedRows;
  window.createRemoveButton = createRemoveButton;
  // avoid clobbering potential global updateOverlayLabels implementation
  window.updateOverlayLabelsWrapper = updateOverlayLabels;
}