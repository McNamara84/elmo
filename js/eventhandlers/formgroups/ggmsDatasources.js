/**
 * @description Handles dynamic addition, removal, and visibility of data source rows in the form.
 * @module datasources
 */
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
    }

    /**
     * Column order inside an entry. Type and Description always share the first row;
     * the remove button is always the last column.
     */
    const COLUMN_ORDER = ['type', 'description', 'details', 'compensation', 'modelName', 'identifier', 'identifierType', 'satellite', 'remove'];

    /**
     * Bootstrap column classes per column. On xs/sm the last visible field uses 11 columns
     * so that the remove button (1 column) ends the last row; md/lg rows also sum to 12.
     */
    const BASE_COLUMN_LAYOUT = {
        type: 'col-6 col-md-3',
        description: 'col-6 col-md-3',
        details: 'col-11 col-md-5',
        compensation: 'col-11 col-lg-3',
        modelName: 'col-12 col-md-4',
        identifier: 'col-12 col-sm-6 col-md-4',
        identifierType: 'col-11 col-sm-5 col-md-3',
        satellite: 'col-11 col-md-5',
        remove: 'col-1'
    };

    const COLUMN_LAYOUT_OVERRIDES = {
        model: { details: 'col-12 col-md-5' },
        isostasy: { description: 'col-6 col-md-3 col-lg-3', details: 'col-12 col-md-5 col-lg-2' }
    };

    const COLUMN_CLASS_PATTERN = /^col(-(xs|sm|md|lg|xl|xxl))?(-\d+)?$/;

    function getLayoutColumns(row) {
        const colOf = selector => row.find(selector).closest('div[class*="col-"]');
        return {
            type: colOf('select[name="datasource_type[]"]'),
            description: colOf('textarea[name="datasource_description[]"]'),
            details: colOf('select[name="datasource_details[]"]'),
            compensation: colOf('input[name="compensation_depth[]"]'),
            modelName: colOf('input[name="dName[]"]'),
            identifier: colOf('input[name="dIdentifier[]"]'),
            identifierType: colOf('select[name="dIdentifierType[]"]'),
            satellite: row.children('.visibility-datasources-satellite'),
            remove: colOf('.removeButton')
        };
    }

    /**
     * Puts the columns of an entry into the fixed order and applies the responsive widths
     * for the selected type.
     *
     * @param {jQuery} row - The data source entry.
     * @param {string} selectedType - Data source type code (S, G, A, T, M).
     */
    function applyRowLayout(row, selectedType) {
        const isIsostasy = selectedType === 'T'
            && row.find('select[name="datasource_details[]"]').val() === 'Isostasy';
        const layout = {
            ...BASE_COLUMN_LAYOUT,
            ...(selectedType === 'M' ? COLUMN_LAYOUT_OVERRIDES.model : {}),
            ...(isIsostasy ? COLUMN_LAYOUT_OVERRIDES.isostasy : {})
        };
        const columns = getLayoutColumns(row);

        COLUMN_ORDER.forEach(key => {
            const col = columns[key];
            if (!col || col.length === 0) return;

            const staleClasses = (col.attr('class') || '').split(/\s+/).filter(cls => COLUMN_CLASS_PATTERN.test(cls));
            col.removeClass(staleClasses.join(' ')).addClass(layout[key]);
            row.append(col);
        });
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
        applyRowLayout(row, selectedType);

        if (selectedType === 'M') {
            const idTypeSelect = row.find('select[name="dIdentifierType[]"]');
            if (idTypeSelect.children().length === 0) {
                window.setupIdentifierTypesDropdown(idTypeSelect);
            }
        }

        // Update required attributes based on type rules
        updateRequiredAttributes(row);
        resetValidationDisplay(row);
        applyDatasourceHelpStatus();
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
     * Shows each help icon only on the first entry where its field is visible, so a stack
     * of entries does not repeat the same help icon. Hidden icons give their input round corners.
     */
    function applyDatasourceHelpStatus() {
        const helpOn = (localStorage.getItem('helpStatus') || 'help-on') === 'help-on';
        const shownSectionIds = new Set();

        datasourceGroup.children('.row').each(function () {
            const row = $(this);
            row.find('i[data-help-section-id]').each(function () {
                const icon = $(this);
                const sectionId = icon.attr('data-help-section-id');
                const column = icon.parentsUntil(row).last();
                const shouldBeVisible = helpOn
                    && column.css('display') !== 'none'
                    && !shownSectionIds.has(sectionId);
                if (shouldBeVisible) shownSectionIds.add(sectionId);

                const wrapper = icon.closest('span.input-group-text');
                wrapper.css('display', shouldBeVisible ? '' : 'none')
                    .attr('aria-hidden', shouldBeVisible ? 'false' : 'true');
                wrapper.closest('.input-group').find('.input-with-help')
                    .toggleClass('input-right-no-round-corners', shouldBeVisible)
                    .toggleClass('input-right-with-round-corners', !shouldBeVisible);
            });
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

    // Add new data source entry. The add button sits below the entry stack.
    datasourceGroup.parent().find(".addDataSource").on("click", function () {
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
        updateRowState(newRow);
        initializeRowWidgets(newRow);

        datasourceGroup.append(newRow);
        applyDatasourceHelpStatus();
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
        applyDatasourceHelpStatus();
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

    document.addEventListener('helpStatus:changed', applyDatasourceHelpStatus);

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