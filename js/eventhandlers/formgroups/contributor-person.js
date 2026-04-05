/**
 * @description Handles dynamic addition and removal of contributor person rows in the form.
 * 
 * @module contributorPerson
 */

import { createRemoveButton, replaceHelpButtonInClonedRows, translateClonedRow } from '../functions.js';

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
  let personIndex = 1; // Start bei 1, Originalzeile = 0

  const contributorPersonGroup = $("#group-contributorperson");

  // Store a clean clone of the original row before any user interaction
  // to avoid double-suffixed IDs after drag-and-drop reorder
  const originalContributorPersonRow = contributorPersonGroup.children().first().clone();

  $("#button-contributor-addperson").click(function () {
    const newContributorRow = originalContributorPersonRow.clone();

    // Reset input fields & validation
    newContributorRow.find("input").val("").removeClass("is-invalid is-valid").removeAttr("required");
    newContributorRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    newContributorRow.find(".tagify").remove();
    newContributorRow.find(".row-label").hide();

    // Replace help buttons
    replaceHelpButtonInClonedRows(newContributorRow);

    // Apply translations to the cloned row
    translateClonedRow(newContributorRow);

    // Replace Add button with Remove button
    newContributorRow.find(".addContributorPerson").replaceWith(createRemoveButton());

    // Generate new IDs based on row index
    const nameId = `input-contributor-firstname-${personIndex}`;
    const lastnameId = `input-contributor-lastname-${personIndex}`;
    const orcidId = `input-contributor-orcid-${personIndex}`;
    const roleId = `input-contributor-personrole-${personIndex}`;
    const affId = `input-contributorpersons-affiliation-${personIndex}`;
    const rorId = `input-contributor-personrorid-${personIndex}`;

    // Update input IDs
    newContributorRow.find("#input-contributor-firstname").attr("id", nameId);
    newContributorRow.find("#input-contributor-lastname").attr("id", lastnameId);
    newContributorRow.find("#input-contributor-orcid").attr("id", orcidId);
    newContributorRow.find("#input-contributor-personrole").attr("id", roleId);
    newContributorRow.find("#input-contributorpersons-affiliation").attr("id", affId);
    newContributorRow.find("#input-contributor-personrorid").attr("id", rorId);

    // Update label references
    newContributorRow.find("label[for='input-contributor-firstname']").attr("for", nameId);
    newContributorRow.find("label[for='input-contributor-lastname']").attr("for", lastnameId);
    newContributorRow.find("label[for='input-contributor-orcid']").attr("for", orcidId);
    newContributorRow.find("label[for='input-contributor-personrole']").attr("for", roleId);
    newContributorRow.find("label[for='input-contributorpersons-affiliation']").attr("for", affId);

    // Append the new row
    contributorPersonGroup.append(newContributorRow);

    // Initialize Tagify for roles
    setupRolesDropdown(["person", "both"], `#${roleId}`);
    if (window.affiliationsData && Array.isArray(window.affiliationsData)) {
      autocompleteAffiliations(affId, rorId, window.affiliationsData);
    }

    // Remove button handler
    newContributorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      validateAllMandatoryFields();
    });
    
    // Increment index for next addition
    personIndex++;
  });
});