/**
 * @description Handles dynamic addition, removal, and visibility of data source rows in the form.
 * @module datasources
 */
import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';
import { initTagifyForInput } from '../../thesauri.js';

$(document).ready(function () {
    const datasourceGroup = $("#group-datasources");
    if (datasourceGroup.length === 0) return; // Do nothing if the form group is not on the page
    const datasourcePlatformsModal = $('#modal-platforms-datasource');
    const datasourcePlatformsSearch = $('#input-platforms-thesaurussearch-ds');
    const datasourcePlatformsTree = $('#jstree-platforms-datasource');

    // Clone the first row to use as a template for new rows.
    const originalDataSourceRow = datasourceGroup.children(".row").first().clone();

    // CONTENTS OF THE DROPDOWNS
    const detailsOptions = {
        'G': ['Terrestrial', 'Shipborne', 'Airborne', 'Ground data computed from GGM', 'Other'],
        'A': ['Direct observations from altimetry satellites', 'Altimetric gridded datasets'],
        'T': ['Bathymetry', 'Isostasy', 'Digital Elevation Model (DEM/DTM)', 'Density Model'],
        'M': ['Global Gravitational Model', 'Topographic gravity model']
    };

    const visibilityConfig = {
        'S': { 'visibility-datasources-basic': true, 'visibility-datasources-details': false, 'visibility-datasources-satellite': true, 'visibility-datasources-identifier': false },
        'G': { 'visibility-datasources-basic': true, 'visibility-datasources-details': true, 'visibility-datasources-satellite': false, 'visibility-datasources-identifier': false },
        'A': { 'visibility-datasources-basic': true, 'visibility-datasources-details': true, 'visibility-datasources-satellite': false, 'visibility-datasources-identifier': false },
        'T': { 'visibility-datasources-basic': true, 'visibility-datasources-details': true, 'visibility-datasources-satellite': false, 'visibility-datasources-identifier': false },
        'M': { 'visibility-datasources-basic': true, 'visibility-datasources-details': true, 'visibility-datasources-satellite': false, 'visibility-datasources-identifier': true }
    };

    /**
     * Defines which fields are required based on datasource type
     */
    const validationRules = {
        'S': { required: [] },
        'G': { required: [] },
        'A': { required: [] },
        'T': { required: [] },
        'M': { required: ['dName'] }
    };

    /**
     * Updates required attributes on form fields based on datasource type
     * @param {jQuery} row - The data source row to process
     */
    function updateRequiredAttributes(row) {
        const typeSelect = row.find('select[name="datasource_type[]"]');
        const selectedType = typeSelect.val();
        const rules = validationRules[selectedType];

        if (!rules) return;

        // Get all input/select/textarea elements in the row
        const allFields = row.find('input, select, textarea');

        allFields.each(function() {
            const fieldName = $(this).attr('name');
            if (!fieldName) return;

            // Extract the base field name (without [])
            const baseFieldName = fieldName.replace('[]', '');

            // Check if this field is in the required list
            if (rules.required.includes(baseFieldName)) {
                $(this).prop('required', true).addClass('required-field');
            } else {
                $(this).prop('required', false).removeClass('required-field');
            }
        });
    }

    // --- Core functionality -------------------------------------------------
    /**
     * Iterates through all data source rows and updates the 'Type' dropdown.
     * It adds or removes the 'Elevation/Terrain' option based on the main 'Model Type' selection.
     * If 'Elevation/Terrain' is selected and the model type changes, it defaults the selection to 'Satellite'.
     */
    function updateAllDatasourceTypeOptions() {
        const modelType = $('#input-model-type').val();
        const isTopoModel = (modelType === 'Topographic');

        // Iterate over each data source type dropdown
        $('select[name="datasource_type[]"]').each(function() {
            const typeSelect = $(this);
            const hasTopoOption = typeSelect.find('option[value="T"]').length > 0;

            if (isTopoModel && !hasTopoOption) {
                // If the model is Topographic and the option doesn't exist, add it.
                typeSelect.append($('<option>', { value: 'T', text: 'Elevation/Terrain' }));
            } else if (!isTopoModel && hasTopoOption) {
                // If the model is NOT Topographic and the option exists, remove it.
                // First, check if it's the currently selected option.
                if (typeSelect.val() === 'T') {
                    // If it is, change the selection to a default value (e.g., 'S' for Satellite).
                    typeSelect.val('S');
                    // Trigger the change event to update the rest of the row's UI.
                    typeSelect.trigger('change');
                }
                // Now, remove the option from the dropdown.
                typeSelect.find('option[value="T"]').remove();
            }
        });
    }

    function handleIsostasyField(row) {
        const typeSelect = row.find('select[name="datasource_type[]"]');
        const detailsSelect = row.find('select[name="datasource_details[]"]');
        // show/hide field and not forget about aria-hidden
        const showField = typeSelect.val() === 'T' && detailsSelect.val() === 'Isostasy';
        const compensationField = row.children('.visibility-datasources-compensation');
        compensationField.toggle(showField);
        compensationField.attr('aria-hidden', !showField);
        adjustLayoutForIsostasy(row, showField);
    }

    /**
     * Adjusts column widths when the "Compensation depth" field is shown for
     * Elevation/Terrain data sources so that all fields, including the add button,
     * fit on a single row.
     *
     * @param {jQuery} row - The row to modify.
     * @param {boolean} isIsostasy - Whether the current selection requires the
     *   compensation depth field.
     */
    function adjustLayoutForIsostasy(row, isIsostasy) {
        const descCol = row.find('textarea[name="datasource_description[]"]').closest('div[class*="col-"]');
        const compensationCol = row.find('input[name="compensation_depth[]"]').closest('div[class*="col-"]');
        const detailsCol = row.find('select[name="datasource_details[]"]').closest('div[class*="col-"]');

        if (isIsostasy) {
            descCol.removeClass('col-md-5 col-lg-5').addClass('col-md-3 col-lg-3');
            compensationCol.removeClass('col-md-12 col-lg-12').addClass('col-md-3 col-lg-3');
            detailsCol.removeClass('col-md-6 col-lg-3').addClass('col-md-5 col-lg-2');
        } else {
            descCol.removeClass('col-md-3 col-lg-3').addClass('col-md-5 col-lg-5');
            compensationCol.removeClass('col-md-3 col-lg-3').addClass('col-md-12 col-lg-12');
            detailsCol.removeClass('col-md-5 col-lg-2').addClass('col-md-6 col-lg-3');
        }
    }

    /**
     * Adjusts column order and widths for the "Model" data source type.
     * Row 1: Type, Identifier, Identifier Type
     * Row 2: Model Name, Description, Button
     *
     * @param {jQuery} row - The row to modify.
     * @param {boolean} isModel - Whether the selected type is "Model".
     */
    function adjustLayoutForModel(row, isModel) {
        const typeCol = row.find('select[name="datasource_type[]"]').closest('div[class*="col-"]');
        const descCol = row.find('textarea[name="datasource_description[]"]').closest('div[class*="col-"]');
        const modelNameCol = row.find('input[name="dName[]"]').closest('div[class*="col-"]');
        const identifierCol = row.find('input[name="dIdentifier[]"]').closest('div[class*="col-"]');
        const identifierTypeCol = row.find('select[name="dIdentifierType[]"]').closest('div[class*="col-"]');
        const addButtonCol = row.find('.addDataSource, .removeButton').closest('div[class*="col-"]');
        const detailsCol = row.find('select[name="datasource_details[]"]').closest('div[class*="col-"]');
        const compensationCol = row.find('input[name="compensation_depth[]"]').closest('div[class*="col-"]');
        const satelliteCol = row.find('.visibility-datasources-satellite');

        if (isModel) {
            // Row 1: Type | Identifier | Identifier Type
            detailsCol.insertAfter(typeCol);
            modelNameCol.insertAfter(detailsCol);

            // Row 2: Model Name | Description | Button
            identifierCol.insertAfter(modelNameCol);
            identifierTypeCol.insertAfter(identifierCol);
            descCol.insertAfter(identifierTypeCol);
            addButtonCol.insertAfter(descCol);

            // Adjust column widths for the new layout
            identifierCol.removeClass('col-md-5 col-lg-5').addClass('col-md-3 col-lg-3');
        }
        // Restore original order: Type | Description | Details | Compensation | ModelName | Identifier | IdentifierType | Satellite | AddButton
        else {
            // Clear the row and stack fields in the desired order
            row.append(typeCol);          // Type
            row.append(detailsCol);       // Details
            row.append(compensationCol);  // Compensation
            row.append(modelNameCol);     // Model Name
            row.append(identifierCol);    // Identifier
            row.append(identifierTypeCol);// Identifier Type
            row.append(satelliteCol);     // Satellite
            row.append(descCol);          // Description (always after detalisation)
            row.append(addButtonCol);     // Add Button
        }
    }

    /**
     * Updates the visibility of fields and populates dropdowns for a given data source row.
     * @param {jQuery} row - The jQuery object for the data source row.
     */
    function updateRowState(row) {
        const typeSelect = row.find('select[name="datasource_type[]"]');
        const selectedType = typeSelect.val();
        const config = visibilityConfig[selectedType];

        if (!config) return;

        for (const fieldClass in config) {
            const shouldBeVisible = config[fieldClass];
            const fieldElement = row.children(`.${fieldClass}`);
            fieldElement.toggle(shouldBeVisible);
            fieldElement.attr('aria-hidden', !shouldBeVisible);

            // CRITICAL: Disable/enable form fields based on visibility
            const formFields = fieldElement.find('input, select, textarea');
            formFields.prop('disabled', !shouldBeVisible);
        }

        const detailsContainer = row.children('.visibility-datasources-details');
        if (detailsContainer.is(':visible')) {
            const detailsSelect = detailsContainer.find('select[name="datasource_details[]"]');
            detailsSelect.empty();
            const options = detailsOptions[selectedType] || [];

            options.forEach(detail => {
                detailsSelect.append($('<option>', { value: detail, text: detail }));
            });
            // If there are options, select the first one by default
            if(options.length > 0) {
                detailsSelect.val(options[0]);
            }
        }

        handleIsostasyField(row);
        adjustLayoutForModel(row, selectedType === 'M');

        if (selectedType === 'M') {
            const idTypeSelect = row.find('select[name="dIdentifierType[]"]');
            if (idTypeSelect.children().length === 0) {
                window.setupIdentifierTypesDropdown(idTypeSelect);
            }
        }

        // Update required attributes based on type rules
        updateRequiredAttributes(row);
    }

    /**
     * Restores help buttons that were replaced with placeholders during cloning.
     * Ensures the associated input field has the correct corner styling.
     *
     * @param {jQuery} row - The data source row to process.
     */
    function restoreHelpButtons(row) {
        const helpStatus = localStorage.getItem('helpStatus') || 'help-on';
        
        row.find('div.help-placeholder').each(function () {
            const placeholder = $(this);
            const helpSectionId = placeholder.data('help-section-id') || '';

            if (helpStatus === 'help-on') {
                const inputGroup = placeholder.closest('.input-group');
                placeholder.replaceWith(
                    `<span class="input-group-text"><i class="bi bi-question-circle-fill" data-help-section-id="${helpSectionId}"></i></span>`
                );
                inputGroup.find('.input-with-help')
                    .addClass('input-right-no-round-corners')
                    .removeClass('input-right-with-round-corners');
            } else {
                // If help is off, remove the placeholder and adjust input styling
                const inputGroup = placeholder.closest('.input-group');
                placeholder.remove();
                inputGroup.find('.input-with-help')
                    .addClass('input-right-with-round-corners')
                    .removeClass('input-right-no-round-corners');
            }
        });
        
        // Also handle input-group-append containers that might be empty
        row.find('.input-group-append').each(function() {
            if ($(this).is(':empty') || $(this).children().length === 0) {
                const inputGroup = $(this).closest('.input-group');
                $(this).remove();
                inputGroup.find('.input-with-help')
                    .addClass('input-right-with-round-corners')
                    .removeClass('input-right-no-round-corners');
            }
        });
    }

    function resetDatasourcePlatformSearch() {
        if (!datasourcePlatformsSearch.length) return;

        datasourcePlatformsSearch.val('');
        const jsTree = datasourcePlatformsTree.jstree(true);
        if (jsTree) {
            jsTree.search('');
        }
    }

    // --- EVENT HANDLERS (Delegated from the static parent 'datasourceGroup') ---

    // Add new data source entry.
    datasourceGroup.on("click", ".addDataSource", function () {
        const newRow = originalDataSourceRow.clone();

        newRow.find("input, textarea, select").val("");
        newRow.find(".is-invalid, .is-valid").removeClass("is-invalid is-valid");
        newRow.find(".invalid-feedback").hide();

        // Generate unique IDs for all elements and update their corresponding labels
        const rowCount = datasourceGroup.children('.row').length;
        newRow.find('[id]').each(function() {
            const oldId = $(this).attr('id');
            if (!oldId) return;

            const newId = `${oldId}-${rowCount}`;
            $(this).attr('id', newId);

            // Find any label associated with the old ID and update its 'for' attribute
            newRow.find(`label[for="${oldId}"]`).attr('for', newId);
        });

        replaceHelpButtonInClonedRows(newRow);
        newRow.find(".addDataSource").replaceWith(createRemoveButton());
        
        // Set the default value to Satellite for the new row.
        newRow.find('select[name="datasource_type[]"]').val('S');

        datasourceGroup.append(newRow);
        updateRowState(newRow); // Immediately set the correct visibility.
        restoreHelpButtons(newRow);

        const newInputElem = newRow.find('input[name="satellite_platform[]"]')[0];
        if (newInputElem) {
            initTagifyForInput(newInputElem, 'gcmdPlatforms');
        }
    });

    // Remove a data source entry.
    datasourceGroup.on("click", ".removeButton", function () {
        $(this).closest(".row").remove();
    });

    // Update fields when the data source type changes.
    datasourceGroup.on('change', 'select[name="datasource_type[]"]', function () {
        const row = $(this).closest('.row');
        updateRowState(row);
        restoreHelpButtons(row);
    });

    datasourceGroup.on('change', 'select[name="datasource_details[]"]', function () {
        const row = $(this).closest('.row');
        handleIsostasyField(row);
    });

    datasourcePlatformsModal.on('show.bs.modal', function () {
        resetDatasourcePlatformSearch();
    });

    datasourcePlatformsModal.on('hidden.bs.modal', function () {
        resetDatasourcePlatformSearch();
    });
    
    $(document).on('change', '#input-model-type', function() {
        updateAllDatasourceTypeOptions();
    });

    // --- INITIALIZATION ---

    document.querySelectorAll('input[name="satellite_platform[]"]').forEach(function (input) {
        initTagifyForInput(input, 'gcmdPlatforms');
    });

    // Set the correct visibility for the first row when the page loads.
    if (datasourceGroup.children(".row").length > 0) {
        updateRowState(datasourceGroup.children(".row").first());
    }
});