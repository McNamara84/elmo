/**
 * @description Handles dynamic addition and removal of contributor organisation rows in the form.
 * 
 * @module contributorOrganisation
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {

  $("#button-contributor-addorganisation").click(function () {
    const contributorGroup = $("#group-contributororganisation");
    const firstContributorRow = contributorGroup.children().first();
    const newContributorRow = firstContributorRow.clone();

    // Reset input values & validation
    newContributorRow.find("input").val("").removeClass("is-invalid is-valid").removeAttr("required");
    newContributorRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    newContributorRow.find(".tagify").remove();

    // Replace help buttons
    replaceHelpButtonInClonedRows(newContributorRow);

    // Replace add button with remove button
    newContributorRow.find(".addContributor").replaceWith(createRemoveButton());

    // Generate new IDs based on the current number of rows
    const rowIndex = contributorGroup.children().length;
    newContributorRow.find("input").each(function () {
      const oldId = $(this).attr("id");
      if (oldId) $(this).attr("id", `${oldId}-${rowIndex}`);
    });
    newContributorRow.find("label").each(function () {
      const oldFor = $(this).attr("for");
      if (oldFor) $(this).attr("for", `${oldFor}-${rowIndex}`);
    });
    newContributorRow.find("i.bi-question-circle-fill").each(function () {
      const helpId = $(this).data("help-section-id");
      if (helpId) $(this).attr("data-help-section-id", `${helpId}-${rowIndex}`);
    });

    // Append the new row
    contributorGroup.append(newContributorRow);

    // Initialize plugins
    newContributorRow.find("input[id^='input-contributor-organisationrole']").each(function () {
      setupRolesDropdown(["institution", "both"], `#${$(this).attr("id")}`);
    });
    newContributorRow.find("input[id^='input-contributor-organisationaffiliation']").each(function () {
      const affId = $(this).attr("id");
      const rorId = $(this).closest(".input-group").find("input[type='hidden']").attr("id");
      if (window.affiliationsData && Array.isArray(window.affiliationsData)) {
        autocompleteAffiliations(affId, rorId, window.affiliationsData);
      }
    });

    // Remove button handler
    newContributorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      validateAllMandatoryFields();
    });
  });

});