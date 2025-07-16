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
export function replaceHelpButtonInClonedRows(row, roundCornersClass = "input-right-with-round-corners") {
  if ($(".input-group-text").is(":visible")) {
    // Find all span elements with the help icon
    row.find("span.input-group-text:has(i.bi-question-circle-fill)").each(function () {
      // Replace the span with an empty div that has fixed dimensions
      $(this).replaceWith('<div class="input-group-text" style="visibility: hidden; width: 42px; height: 38px;"></div>');
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
export function createRemoveButton() {
  return $('<button type="button" class="btn btn-danger removeButton" style="width: 36px;">-</button>');
}

/**
* Updates the labels on the map overlays to match the current row numbering.
 */
export function updateOverlayLabels() {
  if (typeof window.updateOverlayLabels === 'function') {
    window.updateOverlayLabels();
  }
}