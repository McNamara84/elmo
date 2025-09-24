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

  const authorGroup = $("#group-author");

  // Store a clean clone of the original author row
  const originalAuthorRow = authorGroup.children().first().clone();

  function escapeSelector(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/[\0-\x1F\x7F"'\\#.:;,!?+*~=<>^$\[\](){}|\/\s-]/g, '\\$&');
  }

  function addAuthorRow() {
    const newAuthorRow = originalAuthorRow.clone();
    const uniqueSuffix = Date.now();

    // Reset form inputs and validation
    newAuthorRow.find("input").val("").removeClass("is-invalid is-valid");
    newAuthorRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Update all relevant field IDs to ensure uniqueness
    [
      "input-author-orcid",
      "input-author-lastname",
      "input-author-firstname",
      "input-author-affiliation",
      "input-author-rorid",
      "input-contactperson-email",
      "input-contactperson-website",
      "checkbox-author-contactperson"
    ].forEach(fieldId => {
      const newId = `${fieldId}-${uniqueSuffix}`;
      const field = newAuthorRow.find(`#${fieldId}`);
      if (field.length) {
        field.attr("id", newId);
      }

      const labels = newAuthorRow.find(`label[for='${fieldId}']`);
      if (labels.length) {
        labels.attr("for", newId);
      }
    });

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
    return newAuthorRow;
  }

  /**
   * Handles the addition of new author rows.
   * Clones the original row, updates all IDs and labels to be unique,
   * and initializes autocomplete, tooltips, and toggle logic.
   * 
   * @event click#button-author-add
   */
  $("#button-author-add").click(function () {
    addAuthorRow();
  });

  const authorFieldNames = new Set([
    'orcids[]',
    'familynames[]',
    'givennames[]',
    'personAffiliation[]',
    'authorPersonRorIds[]',
    'contacts[]',
    'cpEmail[]',
    'cpOnlineResource[]'
  ]);

  document.addEventListener('autosave:ensure-array-field', (event) => {
    const { detail, target } = event;
    const { name, requiredCount } = detail || {};

    if (!name || !authorFieldNames.has(name) || !requiredCount || requiredCount <= 1) {
      return;
    }

    if (!authorGroup.length) {
      return;
    }

    if (target && !authorGroup[0].contains(target)) {
      return;
    }

    const selector = `[name="${escapeSelector(name)}"]`;
    let currentCount = authorGroup.find(selector).length;

    while (currentCount < requiredCount) {
      const row = addAuthorRow();
      if (!row) {
        break;
      }
      currentCount = authorGroup.find(selector).length;
    }
  });
});