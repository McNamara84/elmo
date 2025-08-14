/**
 * @description Handles dynamic addition and removal of contributor person rows in the form.
 * 
 * @module contributorPerson
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {

  /**
   * Event handler for adding a new contributor person row.
   * Clones the first contributor person row, resets all input fields,
   * updates IDs to ensure uniqueness, and initializes all necessary components.
   * 
   * @event #button-contributor-addperson#click
   * @requires jQuery
   * @requires Tagify
   */
  $("#button-contributor-addperson").click(function () {
    const contributorGroup = $("#group-contributorperson");
    const firstContributorRow = contributorGroup.children().first();
    const uniqueSuffix = new Date().getTime();

    const newContributorRow = firstContributorRow.clone();

    // Reset form fields and validation state
    newContributorRow.find("input").val("").removeClass("is-invalid is-valid");
    newContributorRow.find(".tagify").remove();
    newContributorRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    newContributorRow.find(".row-label").hide();
    newContributorRow.find("input").removeAttr("required");


    // Replace role field
    const roleFieldHtml = `
      <div class="input-group has-validation">
        <input name="cbPersonRoles[]" id="input-contributor-personrole${uniqueSuffix}"
          class="form-control tagify--custom-dropdown input-with-help input-right-no-round-corners"
          data-translate-placeholder="general.roleLabel" />
        <span class="input-group-text"><i class="bi bi-question-circle-fill" data-help-section-id="help-contributor-role"></i></span>
        <div class="invalid-feedback" data-translate="general.pleaseChoose">Please choose</div>
      </div>
    `;
    newContributorRow.find("#input-contributor-personrole").closest(".input-group").replaceWith(roleFieldHtml);

    // Replace affiliation field
    const affFieldHtml = `
      <div class="input-group has-validation">
        <input type="text" name="cbPersonAffiliations[]" id="input-contributorpersons-affiliation${uniqueSuffix}"
          class="form-control input-with-help input-right-no-round-corners" 
          data-translate-placeholder="general.affiliation" />
        <input type="hidden" name="cbPersonRorIds[]" id="input-contributor-personrorid${uniqueSuffix}" />
        <span class="input-group-text"><i class="bi bi-question-circle-fill" data-help-section-id="help-contributor-affiliation"></i></span>
        <div class="invalid-feedback" data-translate="general.pleaseChoose">Please choose</div>
      </div>
    `;
    newContributorRow.find("#input-contributorpersons-affiliation").closest(".input-group").replaceWith(affFieldHtml);

    // Replace help buttons with invisible placeholders
    replaceHelpButtonInClonedRows(newContributorRow);

    // Update remaining input IDs
    newContributorRow.find("#input-contributor-orcid").attr("id", "input-contributor-orcid" + uniqueSuffix);
    newContributorRow.find("#input-contributor-lastname").attr("id", "input-contributor-lastname" + uniqueSuffix);
    newContributorRow.find("#input-contributor-firstname").attr("id", "input-contributor-firstname" + uniqueSuffix);

    // Update label references
    const labelMappings = ["orcid", "lastname", "firstname", "personrole"];
    labelMappings.forEach(label => {
      newContributorRow
        .find(`label[for='input-contributor-${label}']`)
        .attr("for", `input-contributor-${label}${uniqueSuffix}`);
    });

    // Replace add button with remove button
    newContributorRow.find(".addContributorPerson").replaceWith(createRemoveButton());

    // Append the new row to the DOM
    contributorGroup.append(newContributorRow);

    // Initialize Tagify for roles
    setupRolesDropdown(["person", "both"], `#input-contributor-personrole${uniqueSuffix}`);

    // Check if affiliationsData is available in global scope
    if (window.affiliationsData && Array.isArray(window.affiliationsData)) {
      autocompleteAffiliations(
        `input-contributorpersons-affiliation${uniqueSuffix}`,
        `input-contributor-personrorid${uniqueSuffix}`,
        window.affiliationsData
      );
    }

    // Enable removal of the new row
    newContributorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      validateAllMandatoryFields();
    });
  });
});