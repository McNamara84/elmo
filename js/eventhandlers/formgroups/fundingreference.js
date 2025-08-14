/**
 * @description Handles dynamic addition and removal of funding reference entries in the form.
 * 
 * @module fundingreference
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {
  $("#button-fundingreference-add").click(function () {
    const fundingreferenceGroup = $("#group-fundingreference");
    const firstFundingReferenceLine = fundingreferenceGroup.children().first();
    const newFundingReferenceRow = firstFundingReferenceLine.clone();

    // Clear input fields and remove validation feedback
    newFundingReferenceRow.find("input").val("").removeClass("is-invalid");
    newFundingReferenceRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    // Reset required attributes
    newFundingReferenceRow.find("input").removeAttr("required");
    // Replace the add button with the remove button
    newFundingReferenceRow.find(".addFundingReference").replaceWith(createRemoveButton());
    // Remove help buttons
    replaceHelpButtonInClonedRows(newFundingReferenceRow);
    // Append the new funding reference row to the DOM
    fundingreferenceGroup.append(newFundingReferenceRow);
    // Destroy autocomplete
    const newInput = newFundingReferenceRow.find(".inputFunder");
    if (newInput.data('ui-autocomplete')) {
      newInput.autocomplete('destroy');
    }

    // Initialize autocomplete again for the new row
    setUpAutocompleteFunder(newInput[0]);

    // Event handler for the remove button
    newFundingReferenceRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      if (typeof validateAllMandatoryFields === 'function') {
        validateAllMandatoryFields();
      }
    });
  });
});
