/**
 * @description Handles dynamic addition and removal of title rows in the resource information form group.
 * 
 * @module resourceInformationTitle
 */

import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {
  /**
   * Counter for the number of titles currently added.
   * @type {number}
   */
  let titlesNumber = 1;

  /**
   * Click event handler for the "Add Title" button.
   * Adds a new title row if the maximum number of titles has not been reached.
   */
  $("#button-resourceinformation-addtitle").click(function () {
    /**
     * Reference to the "Add Title" button.
     * @type {jQuery}
     */
    const $addTitleBtn = $(this);

    // Check if the current number of titles is below the allowed maximum.
    if (titlesNumber >= window.maxTitles) return;

    // Clone the existing title row and reset its input fields.
    const newTitleRow = $addTitleBtn.closest(".row").clone();
    newTitleRow.find("input").val("");

    // Rebind help button functionality for cloned rows
    replaceHelpButtonInClonedRows(newTitleRow);

    // Adjust Title Input field width
    newTitleRow.find(".col-10.col-sm-11.col-md-11.col-lg-11")
      .removeClass("col-sm-11 col-md-11 col-lg-11")
      .addClass("col-11 col-md-8 col-lg-8");

    // Adjust Title Type Dropdown width and make it visible
    newTitleRow.find("#container-resourceinformation-titletype")
      .removeClass("col-10 col-md-3 unvisible")
      .addClass("col-10 col-md-3 col-lg-3");

    // Control the visibility of the title type dropdown.
    if (titlesNumber === 0) {
      $("#container-resourceinformation-titletype").removeClass("unvisible");
    } else {
      $("#container-resourceinformation-titletype").addClass("unvisible");
    }

    // Populate the title type dropdown with options and remove the main title type.
    const $select = newTitleRow.find("select");
    $select.html(window.titleTypeOptionsHtml || "");
    if (window.mainTitleTypeId) {
      $select.find(`option[value='${window.mainTitleTypeId}']`).remove();
    }
    $select.val("");

    // Create a remove button for the new row.
    const removeBtn = $("<button/>", {
      text: "-",
      type: "button",
      class: "btn btn-danger removeTitle",
    }).css("width", "36px").click(function () {
      // Remove the current row and decrement the titles counter.
      $(this).closest(".row").remove();
      titlesNumber--;

      // Enable the "Add Title" button if below the maximum limit.
      if (titlesNumber < window.maxTitles) {
        $addTitleBtn.prop("disabled", false);
      }
    });

    // Replace the "Add Title" button in the cloned row with the remove button.
    newTitleRow.find(".addTitle").replaceWith(removeBtn);

    // Append the new title row to the DOM.
    $addTitleBtn.closest(".row").parent().append(newTitleRow);
    titlesNumber++;

    // Disable the "Add Title" button if the maximum number of titles is reached.
    if (titlesNumber == window.maxTitles) {
      $addTitleBtn.prop("disabled", true);
    }
  });
});