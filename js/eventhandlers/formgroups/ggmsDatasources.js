/**
 * @description Handles dynamic addition, removal, and visibility of data source rows in the form.
 * @module datasources
 */
import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';
import { cleanupTagifyForInput, initTagifyForInput, ensureThesaurusLoaded } from '../../thesauri.js';

$(document).ready(function () {
    const datasourceGroup = $("#group-datasources");
    if (datasourceGroup.length === 0) return; // Do nothing if the form group is not on the page
    const datasourcePlatformsModal = $('#modal-platforms-datasource');
    const datasourcePlatformsSearch = $('#input-platforms-thesaurussearch-ds');
    const datasourcePlatformsTree = $('#jstree-platforms-datasource');
    const datasourcePlatformPlaceholder = 'Choose the satellite';

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
        'M': { required: ['input-datasource-modelname'] }
    };

    function makeSpecificFieldsRequired(row, selectedType) {
        const rules = validationRules[selectedType];
        if (!rules) return;

        for (const requiredFieldId of rules.required) {
            row.find(`[id^="${requiredFieldId}"]:enabled`).addClass('js-required-on-submit');
        }
    }

    function clearRequiredAttributes(row) {
        row.find('input, select, textarea').removeAttr('required');
    }

    function clearSubmitRequiredMarkers(row) {
        row.find('.js-required-on-submit').removeClass('js-required-on-submit');
    }

    /**
     * Updates js-required-on-submit markers on form fields based on datasource type.
     * Clears stale required attributes so cloned or retyped rows do not keep hidden required fields.
     * @param {jQuery} row - The data source row to process
     */
    function updateRequiredAttributes(row) {
        const typeSelect = row.find('select[name="datasource_type[]"]');
        const selectedType = typeSelect.val();

        clearRequiredAttributes(row);
        clearSubmitRequiredMarkers(row);
        makeSpecificFieldsRequired(row, selectedType);
    }

    // --- Core functionality -------------------------------------------------
    /**
     * Iterates through all data source rows and updates the 'Type' dropdown.
     * It adds or removes the 'Elevation/Terrain' option based on the main 'Model Type' selection.
     * If 'Elevation/Terrain' is selected and the model type changes, it defaults the selection to 'Satellite'.
     */
    function updateTypeOptionsTopographicModels() {
        datasourceGroup.children('.row').each(function () {
            updateTypeOptionsTopographicModelsRow(this);
        });
    }

    function updateTypeOptionsTopographicModelsRow(row) {
        const $row = $(row);
        const modelType = $('#input-model-type').val();
        const isTopoModel = (modelType === 'Topographic');
        const typeSelect = $row.find('select[name="datasource_type[]"]');
        const hasTopoOption = typeSelect.find('option[value="T"]').length > 0;

        if (isTopoModel && !hasTopoOption) {
            typeSelect.append($('<option>', { value: 'T', text: 'Elevation/Terrain' }));
            return;
        }

        if (!isTopoModel && hasTopoOption) {
            if (typeSelect.val() === 'T') {
                typeSelect.val('S');
                typeSelect.trigger('change');
            }
            typeSelect.find('option[value="T"]').remove();
        }
    }

    function handleIsostasyField(row) {
        const typeSelect = row.find('select[name="datasource_type[]"]');
        const detailsSelect = row.find('select[name="datasource_details[]"]');
        // show/hide field and not forget about aria-hidden
        const showField = typeSelect.val() === 'T' && detailsSelect.val() === 'Isostasy';
        const compensationField = row.children('.visibility-datasources-compensation');
        compensationField.toggle(showField);
        compensationField.attr('aria-hidden', !showField);
        // FormData omits disabled controls. The backend consumes compensation_depth[]
        // as a sparse queue (Isostasy rows only), so hidden rows must not submit "".
        compensationField.find('input, select, textarea').prop('disabled', !showField);
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
     * A collector function that controls the visibility and layout. called for type updates and new rows.
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
            const options = detailsOptions[selectedType] || [];
            const currentValue = detailsSelect.val();
            const existingValues = detailsSelect.find('option').map((_, option) => option.value).get();
            const needsRepopulate = existingValues.length !== options.length
                || options.some(option => !existingValues.includes(option));

            if (needsRepopulate) {
                detailsSelect.empty();
                options.forEach(detail => {
                    detailsSelect.append($('<option>', { value: detail, text: detail }));
                });
                if (options.includes(currentValue)) {
                    detailsSelect.val(currentValue);
                } else if (options.length > 0) {
                    detailsSelect.val(options[0]);
                }
            }
        }
        updateTypeOptionsTopographicModelsRow(row);
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
        resetValidationDisplay(row);
        restoreHelpButtons(row);
    }

    /**
     * Clears stale validation styling so Bootstrap can show feedback again on submit.
     *
     * @param {jQuery} row
     */
    function resetValidationDisplay(row) {
        row.find('.is-invalid, .is-valid').removeClass('is-invalid is-valid');
        row.find('.tagify.is-invalid, .tagify.is-valid').removeClass('is-invalid is-valid');
        row.find('.invalid-feedback').removeAttr('style');
    }

    /**
     * Restores help buttons that were replaced with placeholders during cloning.
     * Ensures the associated input field has the correct corner styling.
     *
     * @param {jQuery} row - The data source row to process.
     */
    function restoreHelpButtons(row) {
        const helpStatus = localStorage.getItem('helpStatus') || 'help-on';
        
        row.find('.help-placeholder').each(function () {
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

    /** Resets the shared datasource modal search input so cloned rows do not inherit stale searches. */
    function resetDatasourcePlatformSearch() {
        if (!datasourcePlatformsSearch.length) return;

        datasourcePlatformsSearch.val('');
        const jsTree = datasourcePlatformsTree.jstree(true);
        if (jsTree) {
            jsTree.search('');
        }
    }

    /**
     * One-time widget setup for a row (Tagify on platform input).
     *
     * @param {jQuery} row
     */
    function initializeRowWidgets(row) {
        const platformInput = row.find('input[name="satellite_platform[]"]')[0];
        if (!platformInput) return;

        initTagifyForInput(platformInput, 'satellitePlatforms');
        applyDatasourcePlatformPlaceholder(platformInput);
    }

    /**
     * Applies the datasource-specific placeholder to a platform input and its Tagify UI.
     *
     * @param {HTMLInputElement} inputElement - Datasource platform input enhanced by Tagify.
     * @returns {void}
     */
    function applyDatasourcePlatformPlaceholder(inputElement) {
        if (!inputElement) return;

        inputElement.setAttribute('data-placeholder', datasourcePlatformPlaceholder);
        inputElement.setAttribute('placeholder', datasourcePlatformPlaceholder);

        const tagifyInstance = inputElement._tagify;
        if (!tagifyInstance) return;

        // Datasource rows use a dedicated prompt so cloned rows match the modal workflow language.
        tagifyInstance.settings.placeholder = datasourcePlatformPlaceholder;

        const placeholderElement = inputElement.parentElement?.querySelector('.tagify__input');
        if (placeholderElement) {
            placeholderElement.setAttribute('data-placeholder', datasourcePlatformPlaceholder);
        }

        if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
            window.applyTagifyAccessibilityAttributes(tagifyInstance, inputElement, {
                placeholder: datasourcePlatformPlaceholder
            });
        }
    }

    // --- EVENT HANDLERS  ---

    // Add new data source entry.
    datasourceGroup.on("click", ".addDataSource", function () {
        const newRow = originalDataSourceRow.clone();

        newRow.find("input, textarea, select").val("").removeAttr("required");

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
        newRow.find('select[name="datasource_type[]"]').val('S');

        resetDatasourcePlatformSearch();
        replaceHelpButtonInClonedRows(newRow);
        newRow.find(".addDataSource").replaceWith(createRemoveButton());
        updateRowState(newRow);
        initializeRowWidgets(newRow);

        datasourceGroup.append(newRow);
    });

    // Remove a data source entry.
    datasourceGroup.on("click", ".removeButton", function () {
        const row = $(this).closest('.row');
        const platformInput = row.find('input[name="satellite_platform[]"]')[0];

        if (platformInput?._tagify) {
            cleanupTagifyForInput(platformInput, 'satellitePlatforms');
            if (typeof platformInput._tagify.destroy === 'function') {
                platformInput._tagify.destroy();
            }
            delete platformInput._tagify;
        }

        row.remove();
    });

    // Update row when type or details selection changes.
    datasourceGroup.on('change', 'select[name="datasource_type[]"], select[name="datasource_details[]"]', function () {
        updateRowState($(this).closest('.row'));
    });
    // Load keywords when a search modal is loaded
    datasourcePlatformsModal.on('show.bs.modal', function () {
        resetDatasourcePlatformSearch();
        ensureThesaurusLoaded('satellitePlatforms');
    });

    datasourcePlatformsModal.on('hidden.bs.modal', function () {
        resetDatasourcePlatformSearch();
    });
    
    $(document).on('change', '#input-model-type', function() {
        updateTypeOptionsTopographicModels();
    });

    // --- INITIALIZATION ---

    function initializeAllDatasourceRows() {
        datasourceGroup.children('.row').each(function () {
            const row = $(this);
            updateRowState(row);
            initializeRowWidgets(row);
        });
    }

    initializeAllDatasourceRows();
});