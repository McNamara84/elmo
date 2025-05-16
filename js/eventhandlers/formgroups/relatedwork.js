/**
 * @file relatedwork.js
 * @description Handles dynamic addition and removal of related work entries in the form.
 * 
 * @module relatedwork
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';


$(document).ready(function () {

  $("#button-relatedwork-add").click(function () {
    const relatedworkGroup = $("#group-relatedwork");
    const firstRelatedWorkLine = relatedworkGroup.children().first();
    const newRelatedWorkRow = firstRelatedWorkLine.clone();

    // Reset input values and remove validation classes
    newRelatedWorkRow.find("input").val("").removeClass("is-invalid");

    // Remove 'required' attributes so the new row doesn't force validation immediately
    newRelatedWorkRow.find("input, select").removeAttr("required");

    // Replace the help icons and format properly
    replaceHelpButtonInClonedRows(newRelatedWorkRow);

    // Replace the add button in the new row with a remove button
    newRelatedWorkRow.find("#button-relatedwork-add").replaceWith(createRemoveButton());

    // Append the cloned row to the form group
    relatedworkGroup.append(newRelatedWorkRow);

    /**
     * Attach click handler to the remove button of this newly added row.
     */
    newRelatedWorkRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });
  });
});
