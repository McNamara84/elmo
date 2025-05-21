/**
 * @file stc.js
 * @description Handles dynamic addition and removal of TSC (Temporal Spatial Coverage) rows.
 * 
 * @module stc
 */

import { createRemoveButton, replaceHelpButtonInClonedRows, updateOverlayLabels } from '../functions.js';

$(document).ready(function () {
  /**
  * Global variable to keep track of unique tsc-row-ids.
  * This ensures each row has a unique identifier.
  */
  let tscRowIdCounter = 1;

  /**
   * Event handler for the "Add TSC" button click.
   * Clones the last TSC row, resets input fields, updates IDs, and appends it to the TSC group.
   * @event click#button-stc-add
   */
  $("#button-stc-add").click(function () {
    const tscGroup = $("#group-stc");
    const lastTscLine = tscGroup.children().last();

    // Store the selected timezone value before cloning
    const selectedTimezone = lastTscLine.find('select[name="tscTimezone[]"]').find(':selected').text();

    // Increment the unique row counter
    tscRowIdCounter++;

    // Clone the last row
    const newTscLine = lastTscLine.clone();

    // Set the new tsc-row-id
    newTscLine.attr("tsc-row-id", tscRowIdCounter);

    // Update IDs of input fields to include the new unique tsc-row-id
    newTscLine.find("input, select, textarea").each(function () {
      const oldId = $(this).attr("id");
      if (oldId) {
        const newId = oldId.replace(/_\d+$/, "_" + tscRowIdCounter);
        $(this).attr("id", newId);
      }
    });

    // Reset only non-timezone fields and remove the required attribute
    newTscLine.find("input:not(#input-stc-timezone), textarea")
      .val("")  // Clear values
      .removeClass("is-invalid is-valid")  // Remove validation classes
      .removeAttr("required");  // Remove required attribute

    // Remove help buttons  
    replaceHelpButtonInClonedRows(newTscLine);

    // Replace the Add button with a Remove button
    newTscLine.find("#button-stc-add").replaceWith(createRemoveButton());

    // Append the new TSC line
    tscGroup.append(newTscLine);

    // Update the overlay labels
    updateOverlayLabels();

    // Set the same timezone option in the new row
    const timezoneSelect = newTscLine.find('select[name="tscTimezone[]"]');
    timezoneSelect.find('option').each(function () {
      if ($(this).text() === selectedTimezone) {
        $(this).prop('selected', true);
      } else {
        $(this).prop('selected', false);
      }
    });
  });

  /**
   * Event handler for the "Remove TSC" button click.
   * Removes the TSC row and its associated map overlays.
   */
  $(document).on("click", ".removeButton", function () {
    const row = $(this).closest("[tsc-row-id]");
    const rowId = row.attr("tsc-row-id");

   // Remove the map overlays for this row 
    if (typeof window.deleteDrawnOverlaysForRow === 'function') {
      window.deleteDrawnOverlaysForRow(rowId);
    }
    
    // Remove the row
    row.remove();

    // Update the overlay labels
    updateOverlayLabels();

    // Update the map view
    if (typeof window.fitMapBounds === 'function') {
      window.fitMapBounds();
    }
  });
});