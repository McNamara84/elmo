/**
 * @description Handles dynamic addition and removal of author-institution entries in the form.
 * 
 * @module authorInstitution
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {

  let authorInstitutionIndex = 1; // Start index for new rows

  $("#button-authorinstitution-add").click(function () {
    const authorInstitutionGroup = $("#group-authorinstitution");
    const firstAuthorInstitutionLine = authorInstitutionGroup.children().first();
    const newAuthorInstitutionRow = firstAuthorInstitutionLine.clone();

    // Reset input values and remove validation classes
    newAuthorInstitutionRow.find("input").val("").removeClass("is-invalid is-valid");
    newAuthorInstitutionRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Remove 'required' attributes so the new row doesn't force validation immediately
    newAuthorInstitutionRow.find("input, select").removeAttr("required");

    // Remove Tagify markup
    newAuthorInstitutionRow.find(".tagify").remove();

    // Update IDs and labels to ensure uniqueness
    const fieldsToUpdate = [
      "input-authorinstitution-name",
      "input-authorinstitution-affiliation",
      "input-author-institutionrorid"
    ];

    fieldsToUpdate.forEach(fieldId => {
      const newId = `${fieldId}-${authorInstitutionIndex}`;

      // Adjust input ID
      newAuthorInstitutionRow.find(`#${fieldId}`).attr("id", newId);

      // Adjust label 'for' attribute
      newAuthorInstitutionRow.find(`label[for='${fieldId}']`).attr("for", newId);

    });

    authorInstitutionIndex++; // Increment index for next addition

    // Replace help icons and format properly
    replaceHelpButtonInClonedRows(newAuthorInstitutionRow);

    // Replace the add button in the new row with a remove button
    newAuthorInstitutionRow.find("#button-authorinstitution-add").replaceWith(createRemoveButton());

    // Append the cloned row
    authorInstitutionGroup.append(newAuthorInstitutionRow);

    /**
     * Initialize sortable drag-and-drop behavior for author-Institution rows.
     */
    $("#group-authorinstitution").sortable({
      items: "[data-authorinstitution-row]",
      handle: ".drag-handle",
      axis: "y",
      tolerance: "pointer",
      containment: "parent"
    });

    /**
     * Initialize autocomplete
     */
    if (window.affiliationsData && Array.isArray(window.affiliationsData)) {
      autocompleteAffiliations(
        `input-authorinstitution-affiliation-${authorInstitutionIndex - 1}`,
        `input-author-institutionrorid-${authorInstitutionIndex - 1}`,
        window.affiliationsData
      );
    }

    /**
     * Attach click handler to the remove button of this newly added row.
     */
    newAuthorInstitutionRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });
  });
});
