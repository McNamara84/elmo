/**
 * @description Handles dynamic addition and removal of contributor organisation rows in the form.
 * 
 * @module contributorOrganisation
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {

  /**
  * Event handler for adding a new contributor organization row.
  * Clones the first contributor organization row, resets all input fields,
  * updates IDs to ensure uniqueness, and initializes all necessary components.
  * 
  * @event #button-contributor-addorganisation#click
  * @requires jQuery
  * @requires Tagify
   */
  $("#button-contributor-addorganisation").click(function () {
    const contributorGroup = $("#group-contributororganisation");
    const firstContributorRow = contributorGroup.children().first();
    const uniqueSuffix = new Date().getTime();

    const newContributorRow = firstContributorRow.clone();

    // Reset all input values and validation states
    newContributorRow.find("input").val("").removeClass("is-invalid is-valid");
    newContributorRow.find(".tagify").remove();
    newContributorRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    newContributorRow.find(".row-label").hide();
    newContributorRow.find("input").removeAttr("required");

    // Replace help buttons with placeholders
    replaceHelpButtonInClonedRows(newContributorRow);

    // Replace role field with fresh markup
    const roleFieldHtml = `
      <div class="input-group has-validation">
        <input name="cbOrganisationRoles[]" id="input-contributor-organisationrole${uniqueSuffix}"
          class="form-control tagify--custom-dropdown input-with-help input-right-no-round-corners"
          data-translate-placeholder="general.roleLabel" />
        <span class="input-group-text"><i class="bi bi-question-circle-fill"
          data-help-section-id="help-contributor-organisationrole"></i></span>
        <div class="invalid-feedback" data-translate="general.pleaseChoose"></div>
      </div>
    `;
    newContributorRow.find("#input-contributor-organisationrole").closest(".input-group").replaceWith(roleFieldHtml);

    // Replace affiliation fields
    const affFieldHtml = `
      <div class="input-group has-validation">
        <input type="text" name="cbOrganisationAffiliations[]" id="input-contributor-organisationaffiliation${uniqueSuffix}"
          class="form-control input-with-help input-right-no-round-corners" 
          data-translate-placeholder="general.affiliation" />
        <input type="hidden" name="cbOrganisationRorIds[]" id="input-contributor-organisationrorid${uniqueSuffix}" />
        <span class="input-group-text"><i class="bi bi-question-circle-fill"
          data-help-section-id="help-contributor-organisation-affiliation"></i></span>
        <div class="invalid-feedback" data-translate="general.PleaseChoose">Please choose</div>
      </div>
    `;
    newContributorRow.find("#input-contributor-organisationaffiliation").closest(".input-group").replaceWith(affFieldHtml);

    // Update label and input field ID
    newContributorRow.find("#input-contributor-name").attr("id", `input-contributor-name${uniqueSuffix}`);
    newContributorRow.find("label[for='input-contributor-name']").attr("for", `input-contributor-name${uniqueSuffix}`);
    newContributorRow.find("label[for='input-contributor-organisationrole']").attr("for", `input-contributor-organisationrole${uniqueSuffix}`);

    // Replace add button with remove button
    newContributorRow.find(".addContributor").replaceWith(createRemoveButton());

    // Append the new row to the group
    contributorGroup.append(newContributorRow);

    // Initialize Tagify for roles
    setupRolesDropdown(["institution", "both"], `#input-contributor-organisationrole${uniqueSuffix}`);

    // Check if affiliationsData is available in global scope
    if (window.affiliationsData && Array.isArray(window.affiliationsData)) {
      autocompleteAffiliations(
        `input-contributor-organisationaffiliation${uniqueSuffix}`,
        `input-contributor-organisationrorid${uniqueSuffix}`,
        window.affiliationsData
      );
    }

    // Add event listener to remove the row
    newContributorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      checkMandatoryFields();
    });
  });

});