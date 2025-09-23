/**
 * @description Handles dynamic addition and removal of author-institution entries in the form.
 * 
 * @module authorInstitution
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {
  // Clone original line
  const originalAuthorInstitutionRow = $("#group-authorinstitution").children().first().clone();

  /**
   * Initialize sortable drag-and-drop behavior for author-institution rows.
   */
  $("#group-authorinstitution").sortable({
    items: "[data-authorinstitution-row]",
    handle: ".drag-handle",
    cancel: "input, textarea, select, option",
    axis: "y",
    tolerance: "pointer",
    containment: "parent"
  });

  // Click handler for adding
  $("#button-authorinstitution-add").click(function () {
    const authorInstitutionGroup = $("#group-authorinstitution");
    const newRow = originalAuthorInstitutionRow.clone();

    // Clear fields & reset validation
    newRow.find("input").val("").removeClass("is-invalid is-valid");
    newRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Generate unique IDs (using timestamps)
    const uniqueSuffix = new Date().getTime();

    const fieldsToUpdate = [
      "input-authorinstitution-name",
      "input-authorinstitution-affiliation",
      "input-author-institutionrorid"
    ];

    fieldsToUpdate.forEach(fieldId => {
      newRow.find(`#${fieldId}`).attr("id", `${fieldId}-${uniqueSuffix}`);
    });

    // Link labels to new IDs
    newRow.find("label[for='input-authorinstitution-name']")
      .attr("for", `input-authorinstitution-name-${uniqueSuffix}`);

    newRow.find("label[for='input-authorinstitution-affiliation']")
      .attr("for", `input-authorinstitution-affiliation-${uniqueSuffix}`);

    // Remove Tagify
    newRow.find(".tagify").remove();

    // Add-Button → Remove-Button
    newRow.find("#button-authorinstitution-add").replaceWith(createRemoveButton());

    replaceHelpButtonInClonedRows(newRow);

    // Add new line
    authorInstitutionGroup.append(newRow);

    // Initialize autocomplete
    if (window.affiliationsData && Array.isArray(window.affiliationsData)) {
      autocompleteAffiliations(
        `input-authorinstitution-affiliation-${uniqueSuffix}`,
        `input-author-institutionrorid-${uniqueSuffix}`,
        window.affiliationsData
      );
    }

    /**
     * Attach click handler to the remove button of this newly added row.
     */
    newRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });
  });
});
