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

    newContributorRow.find("input").val("").removeClass("is-invalid is-valid");
    newContributorRow.find(".tagify").remove();
    newContributorRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    replaceHelpButtonInClonedRows(newContributorRow);
    newContributorRow.find(".row-label").hide();
    newContributorRow.find("input").removeAttr("required");

    // Completely replace the role input field container with fresh HTML
    const roleFieldContainer = newContributorRow.find("#input-contributor-personrole").closest(".input-group");
    const roleFieldHtml = `
    <div class="input-group has-validation">
      <input name="cbPersonRoles[]" id="input-contributor-personrole${uniqueSuffix}"
        class="form-control tagify--custom-dropdown input-with-help input-right-no-round-corners"
        data-translate-placeholder="general.roleLabel" />
      <span class="input-group-text"><i class="bi bi-question-circle-fill"
        data-help-section-id="help-contributor-role"></i></span>
      <div class="invalid-feedback" data-translate="general.PleaseChoose">Please choose</div>
    </div>
  `;
    roleFieldContainer.replaceWith(roleFieldHtml);

    // Also replace the affiliation input field with fresh HTML
    const affFieldContainer = newContributorRow.find("#input-contributorpersons-affiliation").closest(".input-group");
    const affFieldHtml = `
    <div class="input-group has-validation">
      <input type="text" name="cbPersonAffiliations[]" id="input-contributorpersons-affiliation${uniqueSuffix}"
        class="form-control input-with-help input-right-no-round-corners" 
        data-translate-placeholder="general.affiliation" />
      <input type="hidden" name="cbPersonRorIds[]" id="input-contributor-personrorid${uniqueSuffix}" />
      <span class="input-group-text"><i class="bi bi-question-circle-fill"
        data-help-section-id="help-contributor-affiliation"></i></span>
      <div class="invalid-feedback" data-translate="general.PleaseChoose">Please choose</div>
    </div>
  `;
    affFieldContainer.replaceWith(affFieldHtml);

    // Update remaining input IDs
    newContributorRow
      .find("#input-contributor-orcid")
      .attr("id", "input-contributor-orcid" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-lastname")
      .attr("id", "input-contributor-lastname" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-firstname")
      .attr("id", "input-contributor-firstname" + uniqueSuffix);

    // Update label references
    const labelMappings = ["orcid", "lastname", "firstname"];
    labelMappings.forEach(label => {
      newContributorRow
        .find(`label[for='input-contributor-${label}']`)
        .attr("for", `input-contributor-${label}${uniqueSuffix}`);
    });

    newContributorRow.find(".addContributorPerson").replaceWith(removeButton);
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

    newContributorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      checkMandatoryFields();
    });
  });

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

    newContributorRow.find("input").val("").removeClass("is-invalid is-valid");
    newContributorRow.find(".tagify").remove();
    newContributorRow.find(".invalid-feedback, .valid-feedback").css("display", "");
    replaceHelpButtonInClonedRows(newContributorRow);
    newContributorRow.find(".row-label").hide();
    newContributorRow.find("input").removeAttr("required");

    // Completely replace the role input field container with fresh HTML
    const roleFieldContainer = newContributorRow.find("#input-contributor-organisationrole").closest(".input-group");
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
    roleFieldContainer.replaceWith(roleFieldHtml);

    // Also replace the affiliation input field with fresh HTML
    const affFieldContainer = newContributorRow.find("#input-contributor-organisationaffiliation").closest(".input-group");
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
    affFieldContainer.replaceWith(affFieldHtml);

    // Update input field IDs
    newContributorRow
      .find("#input-contributor-name")
      .attr("id", "input-contributor-name" + uniqueSuffix);

    newContributorRow
      .find("label[for='input-contributor-name']")
      .attr("for", `input-contributor-name${uniqueSuffix}`);

    newContributorRow.find(".addContributor").replaceWith(removeButton);
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

    newContributorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      checkMandatoryFields();
    });
  });

  /**
  * Global variable to keep track of unique tsc-row-ids.
  * This ensures each row has a unique identifier.
  */
  var tscRowIdCounter = 1;

  /**
   * Creates the Remove button element.
   * @returns {jQuery} A jQuery object representing the Remove button.
   */
  function createRemoveButton() {
    return $('<button type="button" class="btn btn-danger removeButton" style="width: 36px;">-</button>');
  }

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
   * Updates the labels on the map overlays to match the current row numbering.
   */
  function updateOverlayLabels() {
    if (typeof window.updateOverlayLabels === 'function') {
      window.updateOverlayLabels();
    }
  }

  /**
   * Event handler for the "Add Related Work" button click.
   * Clones the first related work row, resets input fields, and appends it to the related work group.
   */
  $("#button-relatedwork-add").click(function () {
    var relatedworkGroup = $("#group-relatedwork");
    // First row used as a template
    var firstRelatedWorkLine = relatedworkGroup.children().first();

    // Clone the template
    var newRelatedWorkRow = firstRelatedWorkLine.clone();


    // Clear input fields
    newRelatedWorkRow.find("input").val("").removeClass("is-invalid");

    // Remove required attributes initially
    newRelatedWorkRow.find("input, select").removeAttr("required");

    // Remove help buttons
    replaceHelpButtonInClonedRows(newRelatedWorkRow);


    // Replace the add button with the remove button
    newRelatedWorkRow.find("#button-relatedwork-add").replaceWith(removeButton);

    // Append the new related work row to the DOM
    relatedworkGroup.append(newRelatedWorkRow);

    // Event handler for the remove button
    newRelatedWorkRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      // Event handler for the remove button
      newRelatedWorkRow.on("click", ".removeButton", function () {
        $(this).closest(".row").remove();
      });
    });
  });

  /**
   * Event handler for the "Add Funding Reference" button click.
   * Clones the first funding reference row, resets input fields, and appends it to the funding reference group.
   */
  $("#button-fundingreference-add").click(function () {
    var fundingreferenceGroup = $("#group-fundingreference");
    var firstFundingReferenceLine = fundingreferenceGroup.children().first();
    var newFundingReferenceRow = firstFundingReferenceLine.clone();

    // Clear input fields and remove validation feedback
    newFundingReferenceRow.find("input").val("").removeClass("is-invalid");
    newFundingReferenceRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Replace the add button with the remove button
    newFundingReferenceRow.find(".addFundingReference").replaceWith(removeButton);

    // Append the new funding reference row to the DOM
    fundingreferenceGroup.append(newFundingReferenceRow);

    // Remove help buttons
    replaceHelpButtonInClonedRows(newFundingReferenceRow);

    // Reset required attributes
    newFundingReferenceRow.find("input").removeAttr("required");

    // Event handler for the remove button
    newFundingReferenceRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      checkMandatoryFields();
    });

    // Destroy autocomplete
    const newInput = newFundingReferenceRow.find(".inputFunder");
    if (newInput.data('ui-autocomplete')) {
      newInput.autocomplete('destroy');
    }

    // Initialize autocomplete again for the new row
    setUpAutocompleteFunder(newInput[0]);
  });

  var labData;

  if ($("#group-originatinglaboratory").length) {
    // Load lab data from JSON and initialize Tagify on the first laboratory row
    $.getJSON("json/msl-labs.json", function (data) {
      labData = data;
      var firstRow = $("#group-originatinglaboratory .row").first();
      initializeTagify(firstRow, data);

      // Register event listener for translations after initial setup
      document.addEventListener('translationsLoaded', refreshLaboratoryTagifyInstances);
    });
  }

  var rowCounter = 1;

  /**
   * Event handler for the "Add Laboratory" button click.
   * Clones the first laboratory row, resets input fields, updates IDs, and appends it to the laboratory group.
   */
  $("#button-originatinglaboratory-add").click(function () {
    var laboratoryGroup = $("#group-originatinglaboratory");
    var firstOriginatingLaboratoryLine = laboratoryGroup.children().first();

    var newOriginatingLaboratoryRow = firstOriginatingLaboratoryLine.clone();

    // Clear input fields and remove validation feedback
    newOriginatingLaboratoryRow.find("input").val("").removeClass("is-invalid is-valid");
    newOriginatingLaboratoryRow.find(".invalid-feedback, .valid-feedback").hide();

    // Remove old Tagify elements
    newOriginatingLaboratoryRow.find(".tagify").remove();

    // Update IDs
    rowCounter++;
    newOriginatingLaboratoryRow.find("[id]").each(function () {
      var oldId = $(this).attr("id");
      var newId = oldId + "_" + rowCounter;
      $(this).attr("id", newId);
    });

    // Replace the add button with the remove button
    newOriginatingLaboratoryRow.find(".addLaboratory").replaceWith(removeButton);

    // Append the new laboratory row to the DOM
    laboratoryGroup.append(newOriginatingLaboratoryRow);

    // Remove help buttons
    replaceHelpButtonInClonedRows(newOriginatingLaboratoryRow);

    // Initialize Tagify for the new row
    initializeTagify(newOriginatingLaboratoryRow, labData);

    // Event handler for the remove button
    newOriginatingLaboratoryRow.on("click", ".removeButton", function () {
      // Find and remove the corresponding instance from tracking array
      const rowElement = $(this).closest(".row")[0];
      laboratoryTagifyInstances = laboratoryTagifyInstances.filter(instance =>
        instance.row[0] !== rowElement);

      // Remove the row from DOM
      $(rowElement).remove();
    });
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

  /**
   * Stores all initialized laboratory Tagify instances for later reference.
   * @type {Array<Object>}
   */
  var laboratoryTagifyInstances = [];

  /**
   * Initializes the laboratory selection and Tagify on the affiliation field.
   *
   * @param {jQuery} row - The row element containing the input fields.
   * @param {Object[]} data - The lab data array used for autocompletion.
   * @returns {Object} - An object containing the Tagify instance for the affiliation field and references.
   */
  function initializeTagify(row, data) {
    var selectName = row.find('select[name="laboratoryName[]"]')[0];
    var inputAffiliation = row.find('input[name="laboratoryAffiliation[]"]')[0];
    var hiddenRorId = row.find('input[name="laboratoryRorIds[]"]')[0];
    var hiddenLabId = row.find('input[name="LabId[]"]')[0];

    // Check if the input fields are available
    if (!selectName || !inputAffiliation) return null;

    // Check if the affiliation element is already tagified
    if (inputAffiliation.classList.contains('tagify') ||
      $(inputAffiliation).next('.tagify').length) {
      console.log('Elemente bereits tagifiziert, überspringe Initialisierung');
      return null;
    }

    /**
     * Finds a lab object by its name.
     *
     * @param {string} name - The name of the lab to find.
     * @returns {Object|undefined} - The lab object if found, otherwise undefined.
     */
    function findLabByName(name) {
      return data.find((lab) => lab.name === name);
    }

    // Populate select options with lab names
    // First, add an empty option
    var emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = translations.general.choose;
    selectName.appendChild(emptyOption);

    // Then add all lab options
    data.forEach(function (lab) {
      var option = document.createElement('option');
      option.value = lab.name;
      option.textContent = lab.name;
      selectName.appendChild(option);
    });

    // Set up event handlers for the select element
    $(selectName).on('change', function () {
      var labName = this.value;
      var lab = findLabByName(labName);

      if (lab) {
        tagifyAffiliation.removeAllTags();
        tagifyAffiliation.addTags([lab.affiliation]);
        hiddenRorId.value = lab.rorid || "";
        hiddenLabId.value = lab.id;
        tagifyAffiliation.setReadonly(true);
      } else {
        tagifyAffiliation.removeAllTags();
        hiddenRorId.value = "";
        hiddenLabId.value = "";
        tagifyAffiliation.setReadonly(false);
      }
    });

    var tagifyAffiliation = new Tagify(inputAffiliation, {
      whitelist: data.map((item) => item.affiliation),
      enforceWhitelist: true,
      maxTags: 1,
      dropdown: {
        maxItems: 20,
        closeOnSelect: true,
        highlightFirst: true,
      },
      delimiters: null,
      mode: "select",
    });

    tagifyAffiliation.on("input", function (e) {
      var value = e.detail.value;
      if (value && !tagifyAffiliation.state.readonly) {
        tagifyAffiliation.addTags([value]);
      }
    });

    // Store references to the Tagify instances and their elements
    const instance = {
      selectName,
      tagifyAffiliation,
      row: row
    };

    // Add to global tracking array
    laboratoryTagifyInstances.push(instance);

    return instance;
  }

  /**
   * Updates the placeholder text for all laboratory inputs and Tagify instances.
   * This is a lightweight alternative to completely refreshing the instances.
   * 
   * @returns {void}
   */
  function refreshLaboratoryTagifyInstances() {
    if (!laboratoryTagifyInstances.length) return;

    const labPlaceholder = translations.laboratory.name || "Lab name";

    // For each instance, update the placeholder text
    laboratoryTagifyInstances.forEach(instance => {
      // Update select placeholder (first empty option)
      if (instance.selectName) {
        const firstOption = instance.selectName.querySelector('option[value=""]');
        if (firstOption) {
          firstOption.textContent = labPlaceholder;
        }
      }

      // Update Tagify placeholders for affiliation
      if (instance.tagifyAffiliation && instance.tagifyAffiliation.DOM && instance.tagifyAffiliation.DOM.input) {
        // This part is unchanged as it wasn't in the original function
      }
    });

    console.log(`Updated placeholders for ${laboratoryTagifyInstances.length} laboratory instances`);
  }

  /////////////////////////////// HELP BUTTONS /////////////////////////////////////////////////////////////////

  /**
   * Replaces help buttons in cloned rows with invisible placeholders.
   * This helps maintain the structure and prevents changes in field sizes.
   *
   * @param {jQuery} row - The cloned row from which to replace help buttons.
   * @param {string} [roundCornersClass="input-right-with-round-corners"] - The CSS class for rounded corners.
   */
  function replaceHelpButtonInClonedRows(
    row,
    roundCornersClass = "input-right-with-round-corners"
  ) {
    // Check whether the help buttons are visible
    if ($(".input-group-text").is(":visible")) {
      // Find all span elements with the help icon
      row.find("span.input-group-text:has(i.bi-question-circle-fill)").each(function () {
        // Replace the span with an empty div that has fixed dimensions
        $(this).replaceWith('<div class="input-group-text" style="visibility: hidden; width: 42px; height: 38px;"></div>');
      });

      // Remove non-rounded corners class to keep structure intact
      row.find(".input-with-help").removeClass("input-right-no-round-corners");
      row.find(".input-with-help").addClass(roundCornersClass);
    }
  }

  let hoverCount = 0;
  let timer = null;

  /**
   * Resets the hover count to zero.
   */
  function resetHoverCount() {
    hoverCount = 0;
  }

  /**
   * Event handler for hover over help buttons.
   * Tracks hover events and opens an Easter egg if hovered over 30 times within 1 second intervals.
   */
  $("#buttonHelp, #bd-theme").hover(function () {
    hoverCount++;

    if (hoverCount === 30) {
      window.open(
        "doc/egg.html",
        "Egg",
        "width=650,height=450,scrollbars=no,resizable=no,location=no"
      );
      resetHoverCount();
    }

    clearTimeout(timer);
    timer = setTimeout(resetHoverCount, 1000); // Set timer to reset hover count after 1 second
  });

  // Check if the input group text visibility setting is saved
  if (localStorage.getItem("inputGroupTextVisible") === "false") {
    $(".input-group-text").hide();
  }

  /**
   * Event handler to show help elements when the "Help On" button is clicked.
   */
  $("#buttonHelpOn").click(function () {
    $(".input-group-text").show();
    localStorage.setItem("inputGroupTextVisible", "true");
  });

  /**
   * Event handler to hide help elements when the "Help Off" button is clicked.
   */
  $("#buttonHelpOff").click(function () {
    $(".input-group-text").hide();
    localStorage.setItem("inputGroupTextVisible", "false");
  });
});
