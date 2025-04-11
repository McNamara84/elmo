$(document).ready(function () {
    /**
     * Ensures all laboratory name select elements are populated with options
     * @param {Array} data - The lab data array used for options
     * @returns {void}
     */
    function populateAllLabSelectOptions(data) {
        if (!data || !data.length) {
            console.error('No lab data available for populating selects');
            return;
        }

        // Find all lab name select elements
        $('select[name="laboratoryName[]"]').each(function () {
            const selectElement = $(this)[0];

            // Clear existing options (außer der leeren Option)
            selectElement.innerHTML = '';

            // Leere Option mit data-translate hinzufügen
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.hidden = true;
            emptyOption.setAttribute('data-translate', 'general.choose');
            selectElement.appendChild(emptyOption);

            // Lab-Optionen hinzufügen
            data.forEach(function (lab) {
                const option = document.createElement('option');
                option.value = lab.name;
                option.textContent = lab.name;
                selectElement.appendChild(option);
            });
        });
    }


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

    /**
     * Event handler for the "Add Laboratory" button click.
     */
    $("#button-originatinglaboratory-add").click(function () {
        var laboratoryGroup = $("#group-originatinglaboratory");
        var firstOriginatingLaboratoryLine = laboratoryGroup.children(".row").first();
        var removeButton = '<button type="button" class="btn btn-danger removeButton">-</button>';
        var newOriginatingLaboratoryRow = firstOriginatingLaboratoryLine.clone();

        // Clear input fields and remove validation feedback
        newOriginatingLaboratoryRow.find("input").val("").removeClass("is-invalid is-valid");
        newOriginatingLaboratoryRow.find("select").val(""); // Reset select elements too
        newOriginatingLaboratoryRow.find(".invalid-feedback, .valid-feedback").hide();


        // Update IDs
        rowCounter++;
        newOriginatingLaboratoryRow.find("[id]").each(function () {
            var oldId = $(this).attr("id");
            var newId = oldId + "_" + rowCounter;
            $(this).attr("id", newId);
        });

        newOriginatingLaboratoryRow.find(".addLaboratory").replaceWith(removeButton);

        // Append the new laboratory row to the DOM
        laboratoryGroup.append(newOriginatingLaboratoryRow);

        // Remove help buttons
        replaceHelpButtonInClonedRows(newOriginatingLaboratoryRow);


        // Direktes Event-Binding statt Delegation
        newOriginatingLaboratoryRow.find(".removeButton").on("click", function () {
            console.log("Remove button clicked");
            const row = $(this).closest(".row");

            // Remove the row from DOM
            row.remove();
        });
    });

    /**
     * Stores all initialized laboratory Tagify instances for later reference.
     */
    var labData;
    var rowCounter = 1;

    if ($("#group-originatinglaboratory").length) {
        // Load lab data from JSON
        $.getJSON("json/msl-labs.json", function (data) {
            labData = data;

            // Explizit alle vorhandenen Select-Elemente befüllen
            populateAllLabSelectOptions(data);

        });
    }
});
