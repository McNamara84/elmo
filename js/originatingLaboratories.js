$(document).ready(function () {
    /**
     * Populates all laboratory name select elements with options.
     * @param {Array} data - The lab data array used for options.
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

            // Clear existing options
            selectElement.innerHTML = '';

            // Add empty option with data-translate attribute
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.hidden = true;
            emptyOption.setAttribute('data-translate', 'general.choose');
            selectElement.appendChild(emptyOption);

            // Add lab options
            data.forEach(function (lab) {
                const option = document.createElement('option');
                option.value = lab.name;
                option.textContent = lab.name;
                selectElement.appendChild(option);
            });
        });
    }

    /**
     * Replaces help buttons in cloned rows with invisible placeholders
     * to maintain layout consistency and prevent input field size changes.
     *
     * @param {jQuery} row - The cloned row.
     * @param {string} [roundCornersClass="input-right-with-round-corners"] - Class for styling input corners.
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
     * Event handler for clicking the "Add Laboratory" button.
     * Clones the first laboratory row, resets values, updates IDs,
     * and adds a remove button.
     */
    $("#button-originatinglaboratory-add").click(function () {
        const laboratoryGroup = $("#group-originatinglaboratory");
        const firstRow = laboratoryGroup.children(".row").first();
        const newRow = firstRow.clone();
        const removeButton = '<button type="button" class="btn btn-danger removeButton">-</button>';

        // Clear input/select values and remove validation feedback
        newRow.find("input").val("").removeClass("is-invalid is-valid");
        newRow.find("select").val("");
        newRow.find(".invalid-feedback, .valid-feedback").hide();

        // Update all IDs to ensure uniqueness
        rowCounter++;
        newRow.find("[id]").each(function () {
            const oldId = $(this).attr("id");
            const newId = oldId + "_" + rowCounter;
            $(this).attr("id", newId);
        });

        // Replace add button with remove button
        newRow.find(".addLaboratory").replaceWith(removeButton);

        // Append cloned row
        laboratoryGroup.append(newRow);

        // Replace help icons in the new row
        replaceHelpButtonInClonedRows(newRow);

        // Attach remove functionality directly
        newRow.find(".removeButton").on("click", function () {
            const row = $(this).closest(".row");
            row.remove();
        });
    });

    /**
     * Initializes lab data and populates select fields if the group container exists.
     */
    let labData;
    let rowCounter = 1;

    if ($("#group-originatinglaboratory").length) {
        $.getJSON("json/msl-labs.json", function (data) {
            labData = data;
            populateAllLabSelectOptions(data);
        });
    }
});
