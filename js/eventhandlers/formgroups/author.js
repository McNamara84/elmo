/**
 * @description Handles dynamic addition, removal, and interaction of author rows in the form.
 * 
 * @module author
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {
  /**
   * Sets up the toggle functionality for contact person fields in author rows.
   * When a contact person checkbox is checked, additional input fields for email and website
   * are shown. When unchecked, these fields are hidden and cleared.
   */
  function setupContactPersonToggle() {
    $("[data-creator-row]").each(function () {
      const row = $(this);
      const checkbox = row.find("[id^='checkbox-author-contactperson']");
      const contactFields = row.find(".contact-person-input");

      // Remove previous click handler to avoid duplicates
      checkbox.off("click");

      function updateFields() {
        if (checkbox.prop('checked')) {
          contactFields.show();
        } else {
          contactFields.hide().find("input").val("");
        }
      }

      updateFields();
      checkbox.on("click", updateFields);
    });
  }

  // Initial setup of toggle functionality for contact person fields
  setupContactPersonToggle();

  /**
   * Initialize sortable drag-and-drop behavior for author rows.
   */
  $("#group-author").sortable({
    items: "[data-creator-row]",
    handle: ".drag-handle",
    cancel: "input, textarea, select, option",
    axis: "y",
    tolerance: "pointer",
    containment: "parent"
  });

  // Store a clean clone of the original author row
  const originalAuthorRow = $("#group-author").children().first().clone();

  /**
   * Handles the addition of new author rows.
   * Clones the original row, updates all IDs and labels to be unique,
   * and initializes autocomplete, tooltips, and toggle logic.
   * 
   * @event click#button-author-add
   */
  $("#button-author-add").click(function () {
    const authorGroup = $("#group-author");
    const newAuthorRow = originalAuthorRow.clone();
    const uniqueSuffix = new Date().getTime();

    // Reset form inputs and validation
    newAuthorRow.find("input").val("").removeClass("is-invalid is-valid");
    newAuthorRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Update all relevant field IDs to ensure uniqueness
    [
      "input-author-affiliation",
      "input-author-rorid",
      "input-contactperson-email",
      "input-contactperson-website",
      "checkbox-author-contactperson"
    ].forEach(fieldId => {
      newAuthorRow.find(`#${fieldId}`).attr("id", `${fieldId}-${uniqueSuffix}`);
    });

    // Update label to match new checkbox ID
    newAuthorRow.find("label.btn").attr("for", `checkbox-author-contactperson-${uniqueSuffix}`);

    // Clean cloned row
    newAuthorRow.find(".tagify").remove();
    newAuthorRow.find(".addAuthor").replaceWith(createRemoveButton());
    replaceHelpButtonInClonedRows(newAuthorRow);

    // Append new author row
    authorGroup.append(newAuthorRow);

    // Initialize autocomplete for affiliation field
    autocompleteAffiliations(
      `input-author-affiliation-${uniqueSuffix}`,
      `input-author-rorid-${uniqueSuffix}`,
      window.affiliationsData
    );

    // Enable row removal
    newAuthorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });

    // Initialize Bootstrap tooltips for new row
    const tooltipContainer = window.getTooltipContainer ? window.getTooltipContainer() : document.body;
    newAuthorRow.find('[data-bs-toggle="tooltip"]').each(function () {
      new bootstrap.Tooltip(this, { container: tooltipContainer });
    });

    // Setup toggle behavior for contact person fields
    setupContactPersonToggle();
  });
});