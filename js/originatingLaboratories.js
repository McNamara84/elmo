$(document).ready(function () {
    // Check if MSL Labs feature is enabled - skip loading if not
    const features = window.ELMO_FEATURES || {};
    if (features.showMslLabs !== true) {
        // Feature not enabled, skip initialization entirely
        return;
    }

    let labData;
    let rowCounter = 1;

    function populateAllLabSelectOptions(data) {
        if (!data || !data.length) {
            console.error('No lab data available for populating selects');
            return;
        }

        // Group all laboratories by their scientific domain.
        // Laboratories without a scientific domain are placed in the "Other"(fallback) group.
        const labsByScientificDomain = data.reduce((groups, lab) => {
            const scientificDomain = lab.scientific_domain || 'Other';

            if (!groups[scientificDomain]) {
                groups[scientificDomain] = [];
            }

            groups[scientificDomain].push(lab);

            return groups;
        }, {});

        // Sort scientific domains alphabetically before creating the option groups.
        const sortedScientificDomains = Object.keys(labsByScientificDomain)
            .sort((firstDomain, secondDomain) =>
                firstDomain.localeCompare(secondDomain)
            );

        // Populate every laboratory select, including dynamically added rows.
        $('select[name="laboratoryName[]"]').each(function () {
            const selectElement = this;

            // Remove previously rendered options and option groups.
            selectElement.innerHTML = '';

            // Add an initially empty, non-selectable option so no laboratory is selected by default.
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.hidden = true;
            emptyOption.textContent = '';
            selectElement.appendChild(emptyOption);

            sortedScientificDomains.forEach(function (scientificDomain) {
                // Create a non-selectable heading for each scientific domain.
                const optionGroup = document.createElement('optgroup');
                optionGroup.label = scientificDomain;

                // Sort laboratories alphabetically within their scientific domain.
                const sortedLabs = labsByScientificDomain[scientificDomain]
                    .sort((firstLab, secondLab) =>
                        firstLab.display_name.localeCompare(secondLab.display_name)
                    );

                sortedLabs.forEach(function (lab) {
                    const option = document.createElement('option');

                    // Store the laboratory ID as the selected value
                    option.value = lab.display_name;
                    option.textContent = lab.display_name;
                    optionGroup.appendChild(option);
                });

                // Add the complete scientific-domain group to the select field.
                selectElement.appendChild(optionGroup);
            });
        });

        attachChangeListeners();
    }

    function attachChangeListeners() {
        $('select[name="laboratoryName[]"]').off('change').on('change', function () {
            const selectedDisplayName = $(this).val();
            const row = $(this).closest('.row');

            const lab = labData.find((item) => item.display_name === selectedDisplayName );

            if (lab) {
                row.find('input[name="LabId[]"]').val(lab.id || '');
                row.find('input[name="laboratoryAffiliation[]"]').val(lab.affiliation || '');
                row.find('input[name="laboratoryRorIds[]"]').val(lab.rorid || '');
            } else {
                row.find('input[name="LabId[]"]').val('');
                row.find('input[name="laboratoryAffiliation[]"]').val('');
                row.find('input[name="laboratoryRorIds[]"]').val('');
            }
        });
    }

    function replaceHelpButtonInClonedRows(row, roundCornersClass = "input-right-with-round-corners") {
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

        attachChangeListeners();

        newRow.find(".removeButton").on("click", function () {
            const row = $(this).closest(".row");
            row.remove();
        });
    });

    if ($("#group-originatinglaboratory").length) {
        $.getJSON("json/msl-labs.json", function (data) {
            labData = data;
            populateAllLabSelectOptions(data);
        });
    }
});
