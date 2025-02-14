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
        .removeClass("col-10 col-md-3")
        .addClass("col-10 col-md-3 col-lg-3")
        .show();

      // Control the visibility of the title type dropdown.
      if (titlesNumber === 0) {
        // Show the dropdown for the first title.
        $("#container-resourceinformation-titletype").show();
      } else {
        // Ensure the dropdown is visible for subsequent titles.
        $(newTitleRow).find("#container-resourceinformation-titletype").show();
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
   * Event handler for drag & drop sorting of author rows.
   */
  $("#group-author").sortable({
    items: "[data-creator-row]",
    handle: ".drag-handle",
    axis: "y",
    tolerance: "pointer",
    containment: "parent"
  });

  /**
   * Event handler for the "Add Author" button click.
   * Clones the first author row, resets input fields, and appends it to the author group.
   */
  const originalAuthorRow = $("#group-author").children().first().clone();
  $("#button-author-add").click(function () {
    var authorGroup = $("#group-author");
    var newAuthorRow = originalAuthorRow.clone();

    // Clear input fields and remove validation feedback
    newAuthorRow.find("input").val("").removeClass("is-invalid is-valid");
    newAuthorRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Generate unique IDs for cloned input elements
    var uniqueSuffix = new Date().getTime();
    newAuthorRow
      .find("#input-author-affiliation")
      .attr("id", "input-author-affiliation" + uniqueSuffix);
    newAuthorRow.find("#input-author-rorid").attr("id", "input-author-rorid" + uniqueSuffix);

    // Remove old Tagify elements (will be re-initialized in autocompleteAffiliation)
    newAuthorRow.find(".tagify").remove();

    // Replace the add button with the remove button
    newAuthorRow.find(".addAuthor").replaceWith(removeButton);

    // Remove help buttons
    replaceHelpButtonInClonedRows(newAuthorRow);

    // Append the new author row to the DOM
    authorGroup.append(newAuthorRow);

    // Apply Tagify to the new Author Affiliations field
    autocompleteAffiliations(
      "input-author-affiliation" + uniqueSuffix,
      "input-author-rorid" + uniqueSuffix,
      affiliationsData
    );

    // Event handler for the remove button
    newAuthorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
    });

    // Reinitialize tooltips for the new row
    newAuthorRow.find('[data-bs-toggle="tooltip"]').each(function () {
      const tooltip = new bootstrap.Tooltip(this);
    });
  });

  /**
   * Event handler for the "Add Contact Person" button click.
   * Clones the first contact person row, resets input fields, and appends it to the contact persons group.
   */
  $("#button-contactperson-add").click(function () {
    var CPGroup = $("#group-contactperson");

    // First row to be used as a template
    var firstCPLine = CPGroup.children().first();

    // Clone the template
    var newCPRow = firstCPLine.clone();

    // Clear input fields and remove validation feedback
    newCPRow.find("input").val("").removeClass("is-invalid is-valid");
    newCPRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Reset required attributes
    newCPRow.find("input").removeAttr("required");

    var uniqueSuffix = new Date().getTime();
    newCPRow.find("#input-contactperson-affiliation").attr("id", "input-contactperson-affiliation" + uniqueSuffix);
    newCPRow.find("#input-contactperson-rorid").attr("id", "input-contactperson-rorid" + uniqueSuffix);

    // Remove old Tagify elements (will be re-initialized in autocompleteAffiliation)
    newCPRow.find(".tagify").remove();

    // Replace the add button with the remove button
    newCPRow.find(".addCP").replaceWith(removeButton);

    // Remove help buttons
    replaceHelpButtonInClonedRows(newCPRow);

    CPGroup.append(newCPRow);

    // Apply autocomplete to the Affiliation field
    autocompleteAffiliations(
      "input-contactperson-affiliation" + uniqueSuffix,
      "input-contactperson-rorid" + uniqueSuffix,
      affiliationsData
    );

    // Event handler for the remove button
    newCPRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      checkMandatoryFields();
    });
  });

  /**
  * Event handler for the "Add Contributor Person" button click.
  * Clones the first contributor person row, resets input fields,
  * updates IDs and labels to ensure uniqueness,
  * and appends it to the contributors group.
  */
  $("#button-contributor-addperson").click(function () {
    /**
     * The contributors group where new contributor person rows are appended.
     * @type {jQuery}
     */
    var contributorGroup = $("#group-contributorperson");

    /**
     * The first contributor person row used as a template for cloning.
     * @type {jQuery}
     */
    var firstContributorRow = contributorGroup.children().first();

    // Clone the template
    var newContributorRow = firstContributorRow.clone();

    // Reset values and validation feedback in the cloned element
    newContributorRow.find("input").val("").removeClass("is-invalid is-valid");
    newContributorRow.find(".tagify").remove();
    newContributorRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Remove help buttons
    replaceHelpButtonInClonedRows(newContributorRow);

    // Hide the row label in cloned rows
    newContributorRow.find(".row-label").hide();

    // Reset required attributes
    newContributorRow.find("input").removeAttr("required");

    /**
     * Unique suffix to avoid duplicate IDs.
     * @type {number}
     */
    var uniqueSuffix = new Date().getTime();

    // Update the IDs of input fields to ensure uniqueness
    newContributorRow
      .find("#input-contributor-personaffiliation")
      .attr("id", "input-contributor-personaffiliation" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-personrorid")
      .attr("id", "input-contributor-personrorid" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-personrole")
      .attr("id", "input-contributor-personrole" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-orcid")
      .attr("id", "input-contributor-orcid" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-lastname")
      .attr("id", "input-contributor-lastname" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-firstname")
      .attr("id", "input-contributor-firstname" + uniqueSuffix);

    // Update the corresponding 'for' attributes in labels
    newContributorRow
      .find("label[for='input-contributor-orcid']")
      .attr("for", "input-contributor-orcid" + uniqueSuffix);
    newContributorRow
      .find("label[for='input-contributor-lastname']")
      .attr("for", "input-contributor-lastname" + uniqueSuffix);
    newContributorRow
      .find("label[for='input-contributor-firstname']")
      .attr("for", "input-contributor-firstname" + uniqueSuffix);

    // Replace the add button with the remove button
    newContributorRow.find(".addContributorPerson").replaceWith(removeButton);

    // Append the new contributor row to the DOM
    contributorGroup.append(newContributorRow);

    // Apply Tagify to the new Contributor Affiliations field
    autocompleteAffiliations(
      "input-contributor-personaffiliation" + uniqueSuffix,
      "input-contributor-personrorid" + uniqueSuffix,
      affiliationsData
    );

    // Initialize Tagify for the new Roles field
    setupRolesDropdown(["person", "both"], "#input-contributor-personrole" + uniqueSuffix);

    // Event handler for the remove button in the new row
    newContributorRow.on("click", ".removeButton", function () {
      $(this).closest(".row").remove();
      checkMandatoryFields();
    });
  });


  /**
 * Event handler for the "Add Contributor Organization" button click.
 * Clones the first contributor organization row, resets input fields,
 * updates IDs and labels to ensure uniqueness,
 * and appends it to the contributor organization group.
 */
  $("#button-contributor-addorganisation").click(function () {
    /**
     * The contributor organization group where new contributor organization rows are appended.
     * @type {jQuery}
     */
    var contributorGroup = $("#group-contributororganisation");

    /**
     * The first contributor organization row used as a template for cloning.
     * @type {jQuery}
     */
    var firstContributorRow = contributorGroup.children().first();

    // Clone the template
    var newContributorRow = firstContributorRow.clone();

    // Reset values and validation feedback in the cloned element
    newContributorRow.find("input").val("").removeClass("is-invalid is-valid");
    newContributorRow.find(".tagify").remove();
    newContributorRow.find(".invalid-feedback, .valid-feedback").css("display", "");

    // Remove help buttons
    replaceHelpButtonInClonedRows(newContributorRow);

    // Hide the row label in cloned rows
    newContributorRow.find(".row-label").hide();

    // Reset required attributes
    newContributorRow.find("input").removeAttr("required");

    /**
     * Unique suffix to avoid duplicate IDs.
     * @type {number}
     */
    var uniqueSuffix = new Date().getTime();

    // Update the IDs of input fields to ensure uniqueness
    newContributorRow
      .find("#input-contributor-organisationaffiliation")
      .attr("id", "input-contributor-organisationaffiliation" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-organisationrorid")
      .attr("id", "input-contributor-organisationrorid" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-organisationrole")
      .attr("id", "input-contributor-organisationrole" + uniqueSuffix);
    newContributorRow
      .find("#input-contributor-name")
      .attr("id", "input-contributor-name" + uniqueSuffix);

    // Update the corresponding 'for' attributes in labels
    newContributorRow
      .find("label[for='input-contributor-name']")
      .attr("for", "input-contributor-name" + uniqueSuffix);

    // Replace the add button with the remove button
    newContributorRow.find(".addContributor").replaceWith(removeButton);

    // Append the new contributor row to the DOM
    contributorGroup.append(newContributorRow);

    // Apply Tagify to the new Organization Affiliations field
    autocompleteAffiliations(
      "input-contributor-organisationaffiliation" + uniqueSuffix,
      "hiddenOrganisationRorId" + uniqueSuffix,
      affiliationsData
    );

    // Initialize Tagify for the new Roles field
    setupRolesDropdown(["institution", "both"], "#input-contributor-organisationrole" + uniqueSuffix);

    // Event handler for the remove button in the new row
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
      $(this).closest(".row").remove();
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
   * Initializes Tagify on the laboratory name and affiliation fields.
   *
   * @param {jQuery} row - The row element containing the input fields.
   * @param {Object[]} data - The lab data array used for autocompletion.
   * @returns {Object} - An object containing the Tagify instances for name and affiliation fields.
   */
  function initializeTagify(row, data) {
    var inputName = row.find('input[name="laboratoryName[]"]')[0];
    var inputAffiliation = row.find('input[name="laboratoryAffiliation[]"]')[0];
    var hiddenRorId = row.find('input[name="laboratoryRorIds[]"]')[0];
    var hiddenLabId = row.find('input[name="LabId[]"]')[0];

    /**
     * Finds a lab object by its name.
     *
     * @param {string} name - The name of the lab to find.
     * @returns {Object|undefined} - The lab object if found, otherwise undefined.
     */
    function findLabByName(name) {
      return data.find((lab) => lab.name === name);
    }

    var tagifyName = new Tagify(inputName, {
      whitelist: data.map((item) => item.name),
      enforceWhitelist: true,
      placeholder: translations.laboratory.name,
      maxTags: 1,
      dropdown: {
        maxItems: 90,
        closeOnSelect: true,
        highlightFirst: true,
      },
      delimiters: null,
      mode: "select",
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

    tagifyName.on("add", function (e) {
      var labName = e.detail.data.value;
      var lab = findLabByName(labName);
      if (lab) {
        tagifyAffiliation.removeAllTags();
        tagifyAffiliation.addTags([lab.affiliation]);
        hiddenRorId.value = lab.ror_id || "";
        hiddenLabId.value = lab.id;
        tagifyAffiliation.setReadonly(true);
      } else {
        tagifyAffiliation.removeAllTags();
        hiddenRorId.value = "";
        hiddenLabId.value = "";
        tagifyAffiliation.setReadonly(false);
      }
    });

    tagifyName.on("remove", function () {
      tagifyAffiliation.removeAllTags();
      hiddenRorId.value = "";
      hiddenLabId.value = "";
      tagifyAffiliation.setReadonly(false);
    });

    tagifyName.on("input", function (e) {
      var value = e.detail.value;
      if (value) {
        var lab = findLabByName(value);
        if (!lab) {
          tagifyAffiliation.removeAllTags();
          hiddenRorId.value = "";
          tagifyAffiliation.setReadonly(false);
        }
      }
    });

    tagifyAffiliation.on("input", function (e) {
      var value = e.detail.value;
      if (value && !tagifyAffiliation.state.readonly) {
        tagifyAffiliation.addTags([value]);
      }
    });

    return { tagifyName, tagifyAffiliation };
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


  /**
   * Automatically sets the language based on the browser's language settings.
   */
  function setAutoLanguage() {
    var userLang = navigator.language || navigator.userLanguage;
    userLang = userLang.substring(0, 2);
    if (userLang !== "en" && userLang !== "de") {
      userLang = "en"; // Default to English if the language is not supported
    }
    localStorage.setItem("userLanguage", userLang);
  }

  // Check if a language is set in localStorage; if not, default to English
  if (!localStorage.getItem("userLanguage")) {
    localStorage.setItem("userLanguage", "en");
  }

  /**
   * Event handler for clicks on language selection buttons.
   * Sets the language or auto-detects it based on browser settings.
   */
  $("[data-bs-language-value]").click(function (event) {
    event.preventDefault();
    var language = $(this).data("bs-language-value");
    if (language === "auto") {
      setAutoLanguage();
    } else {
      localStorage.setItem("userLanguage", language);
    }
  });


  // Initialize tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  const tooltipList = [...tooltipTriggerList].map(
    (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
  );
});
