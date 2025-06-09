/**
 * @description Handles dynamic addition and removal of author-institution entries in the form.
 * 
 * @module authorInstitution
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {

  $("#button-authorinstitution-add").click(function () {
    const authorInstitutionGroup = $("#group-authorinstitution");
    const firstauthorInstitutionLine = authorInstitutionGroup.children().first();
    const uniqueSuffix = new Date().getTime();

    // Clone the first row as a template for the new row
    const newauthorInstitutionRow = firstauthorInstitutionLine.clone();

    // Reset all input fields and remove validation classes
    newauthorInstitutionRow.find("input").val("").removeClass("is-invalid is-valid");
    newauthorInstitutionRow.find("input, select").removeAttr("required");

    // Update IDs and names to ensure uniqueness for accessibility and plugin compatibility
    newauthorInstitutionRow.find("#input-authorinstitution-name")
      .attr("id", `input-authorinstitution-name-${uniqueSuffix}`)
      .attr("name", "authorinstitutionName[]");
    newauthorInstitutionRow.find("label[for='input-authorinstitution-name']")
      .attr("for", `input-authorinstitution-name-${uniqueSuffix}`);

    // Replace the affiliation field with a new input group containing unique IDs
    const affFieldHtml = `
      <div class="input-group has-validation">
        <input type="text" class="form-control input-with-help input-right-no-round-corners"
          id="input-authorinstitution-affiliation-${uniqueSuffix}" name="affiliation[]"
          data-translate-placeholder="general.affiliation" />
        <span class="input-group-text"><i class="bi bi-question-circle-fill"
            data-help-section-id="help-authorinstitution-affiliation"></i></span>
        <input type="hidden" id="input-author-institutionrorid-${uniqueSuffix}" name="authorinstitutionRorIds[]" />
      </div>
    `;
    newauthorInstitutionRow.find("#input-authorinstitution-affiliation").closest(".input-group").replaceWith(affFieldHtml);

    // Replace help buttons in the cloned row, if necessary
    replaceHelpButtonInClonedRows(newauthorInstitutionRow);

    // Replace the add button with a remove button in the new row
    newauthorInstitutionRow.find("#button-authorinstitution-add").replaceWith(createRemoveButton());

    // Append the new row to the group
    authorInstitutionGroup.append(newauthorInstitutionRow);

    // Initialize autocomplete for the new affiliation input, if data is available
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
    newauthorInstitutionRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });
  });
});
