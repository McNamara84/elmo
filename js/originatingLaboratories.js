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

            // Skip if options are already populated (more than one option)
            if (selectElement.options.length > 1) {
                return;
            }

            // Clear existing options
            selectElement.innerHTML = '';

            // Add empty option as placeholder
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = translations.laboratory.name || "Lab name";
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

            // Even if we skip full initialization, ensure select has options
            if (selectName.options.length <= 1) {
                // Populate the select element even when skipping tagify initialization
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = translations.laboratory.name || "Lab name";
                selectName.appendChild(emptyOption);

                data.forEach(function (lab) {
                    const option = document.createElement('option');
                    option.value = lab.name;
                    option.textContent = lab.name;
                    selectName.appendChild(option);
                });
            }

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

        // Remove old Tagify elements
        newOriginatingLaboratoryRow.find(".tagify").remove();

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

        // Initialize Tagify for the new row
        initializeTagify(newOriginatingLaboratoryRow, labData);

        // Direktes Event-Binding statt Delegation
        newOriginatingLaboratoryRow.find(".removeButton").on("click", function () {
            console.log("Remove button clicked");
            const row = $(this).closest(".row");

            // Find and remove the corresponding instance from tracking array
            laboratoryTagifyInstances = laboratoryTagifyInstances.filter(instance =>
                instance.row[0] !== row[0]);

            // Remove the row from DOM
            row.remove();
        });
    });

    /**
     * Stores all initialized laboratory Tagify instances for later reference.
     */
    var laboratoryTagifyInstances = [];
    var labData;
    var rowCounter = 1;

    if ($("#group-originatinglaboratory").length) {
        // Load lab data from JSON
        $.getJSON("json/msl-labs.json", function (data) {
            labData = data;

            // Explizit alle vorhandenen Select-Elemente befüllen
            populateAllLabSelectOptions(data);

            // Dann Tagify für die erste Zeile initialisieren
            var firstRow = $("#group-originatinglaboratory .row").first();
            initializeTagify(firstRow, data);

            // Register event listener for translations after initial setup
            document.addEventListener('translationsLoaded', refreshLaboratoryTagifyInstances);
        });
    }
});
