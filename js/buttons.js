$(document).ready(function () {
  /**
   * Event handler for the "Send Feedback" button click.
   * Collects feedback data and sends it via AJAX to the server.
   */
  $("#button-feedback-send").click(function (event) {
    event.preventDefault();
    var feedbackForm = $("#form-feedback");
    var feedbackData = feedbackForm.serialize();


    // Disable the button and show a loading spinner
    $("#button-feedback-send")
      .prop("disabled", true)
      .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...');


    $.ajax({
      url: "send_feedback_mail.php",
      type: "POST",
      data: feedbackData,
      success: function (response) {

        // Formular ausblenden
        feedbackForm.hide();

        // Erfolgsmeldung und Danke-Nachricht anzeigen
        $("#panel-feedback-message").show();
        $("#panel-feedback-status").html('<div class="alert alert-success">Feedback sent successfully!</div>');

        // Modal schließen nach 3 Sekunden
        setTimeout(function () {
          $("#modal-feedback").modal("hide");
        }, 3000);


      },
      error: function (xhr, status, error) {
        // Display error message
        $("#panel-feedback-status").html(
          '<div class="alert alert-danger">Error when sending feedback: ' + error + "</div>"
        );
        // Enable the send button
        $("#button-feedback-send").prop("disabled", false).html("Send");
      },
      complete: function () {
        // Modal zurücksetzen, wenn es geschlossen wird
        $("#modal-feedback").on("hidden.bs.modal", function () {
          feedbackForm[0].reset();
          feedbackForm.show();
          $("#panel-feedback-message").hide();
          $("#panel-feedback-status").html("");
          $("#button-feedback-send").prop("disabled", false).html("Senden");
        });
      }
    });
  });


  /**
* Event listener for the clear button that resets all input fields
* @requires jQuery
* @requires Bootstrap
* 
*/
  $(document).ready(function () {
    $('#button-form-reset').on('click', function () {
      clearInputFields();
    });
  });

  // Optional: Formular zurücksetzen, wenn das Modal geöffnet wird
  $('#modal-feedback').on('show.bs.modal', function () {
    $("#form-feedback")[0].reset();
    $("#form-feedback").show();
    $("#panel-feedback-message").hide();
    $("#panel-feedback-status").html("");
    $("#button-feedback-send").prop("disabled", false).html("Senden");
  });
  // Tooltip initialisieren
  $('[data-bs-toggle="tooltip"]').tooltip();

  //////////////////////////// ADD AND REMOVE BUTTONS ///////////////////////////////////////////////////////////////
  //Remove  Button anlegen, der in Formgroups Authors, Contact Persons, Contributors genutzt wird
  var removeButton = '<button type="button" class="btn btn-danger removeButton" style="width: 36px">-</button>';
  /**
 * HTML markup for the title type options, copied from the initial dropdown.
 * @type {string}
 */

  var optionTitleTypeHTML = $("#titleType").html();

  /**
   * Counter for the number of titles currently added.
   * @type {number}
   */
  var titlesNumber = 1;

  /**
   * Stores the main title type, which is set for the first title row.
   * @type {string}
   */
  var mainTitleType = "";

  /**
   * Click event handler for the "Add Title" button.
   * Adds a new title row if the maximum number of titles has not been reached.
   */
  $("#button-resourceinformation-addtitle").click(function () {
    /**
     * Reference to the "Add Title" button.
     * @type {jQuery}
     */
    var $addTitleBtn = $(this);

    // Check if the current number of titles is below the allowed maximum.
    if (titlesNumber < maxTitles) {
      // Clone the existing title row and reset its input fields.
      var newTitleRow = $addTitleBtn.closest(".row").clone();
      $(newTitleRow).find("input").val("");


      // Rebind help button functionality for cloned rows
      $(newTitleRow).find(".bi-question-circle-fill").each(function () {
        $(this).data("help-section-id");
      });


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
        // Show the dropdown for the first title.
        // remove the unvisible class
        $("#container-resourceinformation-titletype").removeClass("unvisible");
        //$("#container-resourceinformation-titletype").show();
      } else {
        // Ensure the dropdown is visible for subsequent titles.
        // add the unvisible class
        $("#container-resourceinformation-titletype").addClass("unvisible");
        //$(newTitleRow).find("#container-resourceinformation-titletype").show();
      }

      // Capture the main title type for the first row.
      if (titlesNumber === 1) {
        mainTitleType = $(newTitleRow).find("select").val();
      }

      // Populate the title type dropdown with options and remove the main title type.
      var $select = $(newTitleRow).find("select");
      $select.html(optionTitleTypeHTML);
      $select.find("option[value='" + mainTitleType + "']").remove(); // Remove the main title type
      $select.val(""); // Reset the dropdown selection

      // Create a remove button for the new row.
      var removeBtn = $("<button/>", {
        text: "-",
        type: "button",
        class: "btn btn-danger removeTitle",
      }).css("width", "36px");

      // Event handler for the remove button.
      removeBtn.click(function () {
        // Remove the current row and decrement the titles counter.
        $(this).closest(".row").remove();
        titlesNumber--;

        // Enable the "Add Title" button if below the maximum limit.
        if (titlesNumber < maxTitles) {
          $addTitleBtn.prop("disabled", false);
        }
      });

      // Replace the "Add Title" button in the cloned row with the remove button.
      $(newTitleRow).find(".addTitle").replaceWith(removeBtn);

      // Append the new title row to the DOM.
      $addTitleBtn.closest(".row").parent().append(newTitleRow);
      titlesNumber++;

      // Disable the "Add Title" button if the maximum number of titles is reached.
      if (titlesNumber == maxTitles) {
        $addTitleBtn.prop("disabled", true);
      }
    } else {
      // Log a message if the maximum number of titles is reached.
      console.log("Maximum number of titles reached: " + maxTitles);
    }
  });

  /**
   * Sets up the toggle functionality for contact person fields in author rows.
   * When a contact person checkbox is checked, additional input fields for email and website
   * are shown. When unchecked, these fields are hidden and cleared.
   */
  function setupContactPersonToggle() {
    $("[data-creator-row]").each(function () {
      var row = $(this);
      var checkbox = row.find("[id^='checkbox-author-contactperson']");
      var contactFields = row.find(".contact-person-input");

      // Remove existing click handler to prevent duplicate bindings
      checkbox.off("click");

      function updateFields() {
        if (checkbox.prop('checked')) {
          contactFields.show();
        } else {
          contactFields.hide().find("input").val(""); // Clear input values when hiding
        }
      }

      updateFields(); // Set initial state
      checkbox.on("click", updateFields);
    });
  }

  // Initial setup of contact person toggle functionality
  setupContactPersonToggle();

  /**
  * Initialize sortable functionality for author rows
  * Allows drag and drop reordering of authors using the drag handle
  */
  $("#group-author").sortable({
    items: "[data-creator-row]",
    handle: ".drag-handle",
    axis: "y",
    tolerance: "pointer",
    containment: "parent"
  });

  // Store a clone of the original author row for later use
  const originalAuthorRow = $("#group-author").children().first().clone();

  /**
  * Handles the addition of new author rows when the add button is clicked
  * Creates a new row with unique IDs and proper event handlers
  */
  $("#button-author-add").click(function () {
    var authorGroup = $("#group-author");
    var newAuthorRow = originalAuthorRow.clone();

    // Reset validation states and clear input values
    newAuthorRow.find("input").val("").removeClass("is-invalid is-valid");
    newAuthorRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Generate unique IDs for the new row's elements using timestamp
    var uniqueSuffix = new Date().getTime();

    // Update IDs of all relevant input fields with unique suffix
    const fieldsToUpdate = [
      "input-author-affiliation",
      "input-author-rorid",
      "input-contactperson-email",
      "input-contactperson-website",
      "checkbox-author-contactperson"
    ];

    fieldsToUpdate.forEach(fieldId => {
      newAuthorRow.find(`#${fieldId}`).attr("id", `${fieldId}-${uniqueSuffix}`);
    });

    // Update label's 'for' attribute to match new checkbox ID
    newAuthorRow.find("label.btn").attr("for", `checkbox-author-contactperson-${uniqueSuffix}`);

    // Clean up and prepare new row
    newAuthorRow.find(".tagify").remove();
    newAuthorRow.find(".addAuthor").replaceWith(removeButton);
    replaceHelpButtonInClonedRows(newAuthorRow);

    // Add new row to the author group
    authorGroup.append(newAuthorRow);

    // Initialize autocomplete for affiliation field
    autocompleteAffiliations(
      `input-author-affiliation-${uniqueSuffix}`,
      `input-author-rorid-${uniqueSuffix}`,
      affiliationsData
    );

    // Add remove button functionality
    newAuthorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });

    // Initialize Bootstrap tooltips
    newAuthorRow.find('[data-bs-toggle="tooltip"]').each(function () {
      const tooltip = new bootstrap.Tooltip(this);
    });

    // Reinitialize contact person toggle functionality for all rows
    setupContactPersonToggle();
  });


  /**
  * Global variable to keep track of unique tsc-row-ids.
  * This ensures each row has a unique identifier.
  */
  var tscRowIdCounter = 1;


  /**
   * Event handler for the "Add TSC" button click.
   * Clones the last TSC row, resets input fields, updates IDs, and appends it to the TSC group.
   */
  $("#button-stc-add").click(async function () {
    var tscGroup = $("#group-stc");
    var lastTscLine = tscGroup.children().last();

    // Store the selected timezone value before cloning
    var selectedTimezone = lastTscLine.find('select[name="tscTimezone[]"]').find(':selected').text();

    // Increment the unique row counter
    tscRowIdCounter++;

    // Clone the last row
    var newTscLine = lastTscLine.clone();

    // Set the new tsc-row-id
    newTscLine.attr("tsc-row-id", tscRowIdCounter);

    // Update IDs of input fields to include the new unique tsc-row-id
    newTscLine.find("input, select, textarea").each(function () {
      var oldId = $(this).attr("id");
      if (oldId) {
        var newId = oldId.replace(/_\d+$/, "_" + tscRowIdCounter);
        $(this).attr("id", newId);
      }
    });

    // Reset only non-timezone fields and remove the required attribute
    newTscLine.find("input:not(#input-stc-timezone), textarea")
      .val("")  // Clear values
      .removeClass("is-invalid is-valid")  // Remove validation classes
      .removeAttr("required");  // Remove required attribute

    // Remove help buttons
    replaceHelpButtonInClonedRows(newTscLine);

    // Replace the Add button with a Remove button
    newTscLine.find("#button-stc-add").replaceWith(createRemoveButton());

    // Append the new TSC line
    tscGroup.append(newTscLine);

    // Update the overlay labels
    updateOverlayLabels();

    // Set the same timezone option in the new row
    const timezoneSelect = newTscLine.find('select[name="tscTimezone[]"]');
    timezoneSelect.find('option').each(function () {
      if ($(this).text() === selectedTimezone) {
        $(this).prop('selected', true);
      } else {
        $(this).prop('selected', false);
      }
    });
  });

  /**
   * Event handler for the "Remove TSC" button click.
   * Removes the TSC row and its associated map overlays.
   */
  $(document).on("click", ".removeButton", function () {
    var $row = $(this).closest("[tsc-row]");
    var rowId = $row.attr("tsc-row-id");

    // Remove the map overlays for this row
    if (typeof window.deleteDrawnOverlaysForRow === 'function') {
      window.deleteDrawnOverlaysForRow(rowId);
    }

    // Remove the row
    $row.remove();

    // Update the overlay labels
    updateOverlayLabels();

    // Update the map view
    if (typeof window.fitMapBounds === 'function') {
      window.fitMapBounds();
    }
  });

  /**
  * Event listener for the load button that opens the XML upload modal
  * @requires jQuery
  * @requires Bootstrap
  * 
  */
  $(document).ready(function () {
    $('#button-form-load').on('click', function () {
      $('#modal-uploadxml').modal('show');
    });
  });

  /**
  * Initializes the event handler once the document is fully loaded.
  */
  $(document).ready(function () {
    /**
     * Click event handler for showing the changelog modal.
     *
     * @param {Event} event - The event object associated with the click action.
     */
    $('#button-changelog-show').click(function (event) {
      event.preventDefault(); // Prevents the default behavior of the link.

      // Loads the content from 'doc/changelog.html' into the modal's content area.
      $('#panel-changelog-content').load('doc/changelog.html', function () {
        // Displays the modal after the content has been successfully loaded.
        $('#modal-changelog').modal('show');
      });
    });
  });

  /////////////////////////////// HELP BUTTONS /////////////////////////////////////////////////////////////////

});
