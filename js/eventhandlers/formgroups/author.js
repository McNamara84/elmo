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

    const sourceRow = authorGroup.children().first();
    if (!sourceRow || sourceRow.length === 0) return null;

    // New row by cloning the first template
    // false = do not clone event handlers
    const newAuthorRow = sourceRow.clone(false);

    // Each new row is assigned a sequential number (index)
    // Example: 1 = first copy, 2 = second copy, etc.
    const index = authorGroup.children().length;

    // 1. Reset input fields + assign new IDs
    newAuthorRow.find("input, select").each(function () {
      const $el = $(this);

      // Make IDs unique: old ID + -<index>
      // Example: input-author-orcid → input-author-orcid-1
      const oldId = $el.attr("id");
      if (oldId) {
        $el.attr("id", `${oldId}-${index}`);
      }

      // Clear values
      if ($el.is(":checkbox") || $el.is(":radio")) {
        $el.prop("checked", false); // Deselect checkbox/radio button
      } else {
        $el.val(""); // Clear all other fields
      }

      // Reset validation status
      $el.removeClass("is-invalid is-valid").removeAttr("aria-invalid");
    });

    // 2. Customize labels
    newAuthorRow.find("label[for]").each(function () {
      const $label = $(this);
      const oldFor = $label.attr("for");
      if (oldFor) {
        // Label refers to new ID
        $label.attr("for", `${oldFor}-${index}`);
      }
    });

    // 3. Reset feedback & visual elements
    newAuthorRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    newAuthorRow.find(".tagify").remove();
    newAuthorRow.find(".row-label").hide();

    // 4.Add button replaced by Remove button
    newAuthorRow.find(".addAuthor").replaceWith(createRemoveButton());

    // 5. Customize help buttons
    replaceHelpButtonInClonedRows(newAuthorRow);

    // 6. Insert new row in DOM
    authorGroup.append(newAuthorRow);

    // 7. Start autocomplete for affiliations
    const affId = `input-author-affiliation-${index}`;
    const rorId = `input-author-rorid-${index}`;
    if (newAuthorRow.find(`#${affId}`).length && newAuthorRow.find(`#${rorId}`).length) {
      autocompleteAffiliations(affId, rorId, window.affiliationsData);
    }

    // 8. Activate Bootstrap tooltips
    if (window.bootstrap && typeof window.bootstrap.Tooltip === "function") {
      newAuthorRow.find('[data-bs-toggle="tooltip"]').each(function () {
        new window.bootstrap.Tooltip(this);
      });
    }

    // 9. Activate remove button
    newAuthorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });

    // 10. Re-establish contact person toggle
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