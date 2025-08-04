/**
 * @description Handles dynamic addition, removal, and visibility of data source rows in the form.
 * @module datasources
 */
import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {
    const datasourceGroup = $("#group-datasources");
    if (datasourceGroup.length === 0) return; // Do nothing if the form group is not on the page

    // Clone the first row to use as a template for new rows.
    const originalDataSourceRow = datasourceGroup.children(".row").first().clone();

    const jsTreeId = '#jstree-platforms-datasource';
    let activePlatformTagify = null;

    const detailsOptions = {
        'G': ['Terrestrial', 'Shipborne', 'Airborne', 'Ground data computed from GGM', 'Other'],
        'A': ['Direct observations from altimetry satellites', 'Altimetric gridded datasets'],
        'T': ['Bathymetry', 'Isostasy', 'Digital Elevation Model (DEM/DTM)', 'Density Model']
    };

    const visibilityConfig = {
        'S': { 'visibility-datasources-basic': true, 'visibility-datasources-details': false, 'visibility-datasources-satellite': true, 'visibility-datasources-identifier': false },
        'G': { 'visibility-datasources-basic': true, 'visibility-datasources-details': true, 'visibility-datasources-satellite': false, 'visibility-datasources-identifier': false },
        'A': { 'visibility-datasources-basic': true, 'visibility-datasources-details': true, 'visibility-datasources-satellite': false, 'visibility-datasources-identifier': false },
        'T': { 'visibility-datasources-basic': true, 'visibility-datasources-details': true, 'visibility-datasources-satellite': false, 'visibility-datasources-identifier': false },
        'M': { 'visibility-datasources-basic': true, 'visibility-datasources-details': false, 'visibility-datasources-satellite': false, 'visibility-datasources-identifier': true }
    };

    function bindTagifyEvents(tagifyInstance) {
        tagifyInstance.on('add', function (e) {
            if (activePlatformTagify !== tagifyInstance) return;
            const tagText = e.detail.data.value;
            const jsTree = $(jsTreeId).jstree(true);
            const node = jsTree
                .get_json('#', { flat: true })
                .find(n => jsTree.get_path(n, ' > ') === tagText);
            if (node) {
                jsTree.select_node(node.id);
            }
        });

        tagifyInstance.on('remove', function (e) {
            if (activePlatformTagify !== tagifyInstance) return;
            const tagText = e.detail.data.value;
            const jsTree = $(jsTreeId).jstree(true);
            const node = jsTree
                .get_json('#', { flat: true })
                .find(n => jsTree.get_path(n, ' > ') === tagText);
            if (node) {
                jsTree.deselect_node(node.id);
            }
        });
    }

    function updateSelectedKeywordsList() {
        const selectedKeywordsList = document.getElementById('selected-keywords-platforms-ds');
        if (!selectedKeywordsList) return;

        selectedKeywordsList.innerHTML = "";
        const selectedNodes = $(jsTreeId).jstree("get_selected", true);

        selectedNodes.forEach(function (node) {
            const fullPath = $(jsTreeId).jstree().get_path(node, " > ");
            const listItem = document.createElement("li");
            listItem.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
            listItem.textContent = fullPath;

            const removeButton = document.createElement("button");
            removeButton.classList.add("btn", "btn-sm", "btn-danger");
            removeButton.innerHTML = "&times;";
            removeButton.onclick = function () {
                $(jsTreeId).jstree("deselect_node", node.id);
            };

            listItem.appendChild(removeButton);
            selectedKeywordsList.appendChild(listItem);
        });
    }

    document.addEventListener('translationsLoaded', function () {
        $(jsTreeId).off('changed.jstree');
        $(jsTreeId).on('changed.jstree', function (e, data) {
            updateSelectedKeywordsList();
            if (!activePlatformTagify) return;
            const selectedNodes = $(jsTreeId).jstree('get_selected', true);
            const selectedValues = selectedNodes.map(node => data.instance.get_path(node, ' > '));
            activePlatformTagify.removeAllTags();
            activePlatformTagify.addTags(selectedValues);
        });

        const firstInput = document.querySelector('#input-datasource-platforms');
        if (firstInput && firstInput._tagify) {
            firstInput._tagify.off('add').off('remove');
            bindTagifyEvents(firstInput._tagify);
        }
    }, { once: true });

    $('#modal-platforms-datasource').on('show.bs.modal', function (e) {
        const button = $(e.relatedTarget);
        const row = button.closest('.row');
        const inputElem = row.find('#input-datasource-platforms')[0];
        if (!inputElem) return;

        const tagifyInstance = inputElem._tagify;
        const jsTree = $(jsTreeId).jstree(true);

        // Preserve current tags before manipulating the tree
        const existingTags = tagifyInstance ? tagifyInstance.value.slice() : [];
        const jsTreeNodes = jsTree.get_json('#', { flat: true });
        const tagsWithNode = existingTags.filter(tag =>
            jsTreeNodes.find(n => jsTree.get_path(n, ' > ') === tag.value)
        );
        const manualTags = existingTags.filter(tag =>
            !jsTreeNodes.find(n => jsTree.get_path(n, ' > ') === tag.value)
        );

        // Prevent Tagify from being cleared when deselecting nodes
        activePlatformTagify = null;
        jsTree.deselect_all();

        activePlatformTagify = tagifyInstance;
        tagsWithNode.forEach(tag => {
            const node = jsTreeNodes.find(n => jsTree.get_path(n, ' > ') === tag.value);
            if (node) {
                jsTree.select_node(node.id);
            }
        });

        if (manualTags.length && activePlatformTagify) {
            activePlatformTagify.addTags(manualTags);
        }

        updateSelectedKeywordsList();
    });

    $('#modal-platforms-datasource').on('hidden.bs.modal', function () {
        activePlatformTagify = null;
        const jsTree = $(jsTreeId).jstree(true);
        jsTree.deselect_all();
        updateSelectedKeywordsList();
    });

    function handleIsostasyField(row) {
        const typeSelect = row.find('select[name="datasource_type[]"]');
        const detailsSelect = row.find('select[name="datasource_details[]"]');
        const showField = typeSelect.val() === 'T' && detailsSelect.val() === 'Isostasy';
        row.children('.visibility-datasources-compensation').toggle(showField);
        adjustLayoutForIsostasy(row, showField);
    }

    /**
     * Adjusts column widths when the "Compensation depth" field is shown for
     * topography data sources so that all fields, including the add button,
     * fit on a single row.
     *
     * @param {jQuery} row - The row to modify.
     * @param {boolean} isIsostasy - Whether the current selection requires the
     *   compensation depth field.
     */
    function adjustLayoutForIsostasy(row, isIsostasy) {
        const descCol = row.find('textarea[name="datasource_description[]"]').closest('div[class*="col-"]');
        const compensationCol = row.find('input[name="compensation_depth[]"]').closest('div[class*="col-"]');

        if (isIsostasy) {
            descCol.removeClass('col-md-5 col-lg-5').addClass('col-md-3 col-lg-3');
            compensationCol.removeClass('col-md-12 col-lg-12').addClass('col-md-2 col-lg-2');
        } else {
            descCol.removeClass('col-md-3 col-lg-3').addClass('col-md-5 col-lg-5');
            compensationCol.removeClass('col-md-2 col-lg-2').addClass('col-md-12 col-lg-12');
        }
    }

    /**
     * Adjusts column widths so that all fields fit on one row when
     * the "Model" type is selected.
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
        const addButtonCol = row.find('.addDataSource').closest('div[class*="col-"]');

        if (isModel) {
            typeCol.removeClass('col-md-3 col-lg-3').addClass('col-md-4 col-lg-4');
            descCol.removeClass('col-md-5 col-lg-5').addClass('col-md-4 col-lg-4');
            modelNameCol.removeClass('col-md-6 col-lg-6').addClass('col-md-4 col-lg-4');
            identifierCol.removeClass('col-md-3 col-lg-3').addClass('col-md-4 col-lg-4');
            identifierTypeCol.removeClass('col-md-3 col-lg-3').addClass('col-md-4 col-lg-4');
            addButtonCol.removeClass('col-2 col-sm-2 col-md-1 col-lg-1').addClass('col-12 col-sm-12 col-md-4 col-lg-4');
        } else {
            typeCol.removeClass('col-md-4 col-lg-4').addClass('col-md-3 col-lg-3');
            descCol.removeClass('col-md-4 col-lg-4').addClass('col-md-5 col-lg-5');
            modelNameCol.removeClass('col-md-4 col-lg-4').addClass('col-md-6 col-lg-6');
            identifierCol.removeClass('col-md-4 col-lg-4').addClass('col-md-3 col-lg-3');
            identifierTypeCol.removeClass('col-md-4 col-lg-4').addClass('col-md-3 col-lg-3');
            addButtonCol.removeClass('col-12 col-sm-12 col-md-4 col-lg-4').addClass('col-2 col-sm-2 col-md-1 col-lg-1');
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
            // Use a selector that finds the direct child columns of the row
            row.children(`.${fieldClass}`).toggle(shouldBeVisible);
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
            }
        });
    }

    // --- EVENT HANDLERS (Delegated from the static parent 'datasourceGroup') ---

    // Add new data source entry.
    datasourceGroup.on("click", ".addDataSource", function () {
        const newRow = originalDataSourceRow.clone();

        newRow.find("input, textarea, select").val("");
        newRow.find(".is-invalid, .is-valid").removeClass("is-invalid is-valid");
        newRow.find(".invalid-feedback").hide();

        replaceHelpButtonInClonedRows(newRow);
        newRow.find(".addDataSource").replaceWith(createRemoveButton());
        
        // Set the default value to Satellite for the new row.
        newRow.find('select[name="datasource_type[]"]').val('S');

        datasourceGroup.append(newRow);
        updateRowState(newRow); // Immediately set the correct visibility.
        restoreHelpButtons(newRow);

        const firstInput = document.querySelector('#input-datasource-platforms');
        const newInputElem = newRow.find('#input-datasource-platforms')[0];
        if (newInputElem && typeof Tagify !== 'undefined') {
            const baseSettings =
                firstInput && firstInput._tagify ? { ...firstInput._tagify.settings } : {};
            const tagifyInstance = new Tagify(newInputElem, baseSettings);
            newInputElem._tagify = tagifyInstance;
            bindTagifyEvents(tagifyInstance);
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

    // --- INITIALIZATION ---

    // Set the correct visibility for the first row when the page loads.
    if (datasourceGroup.children(".row").length > 0) {
        updateRowState(datasourceGroup.children(".row").first());
    }
});