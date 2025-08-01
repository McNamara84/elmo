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

        const firstInput = document.querySelector('#input-datasource-platforms');
        const newInputElem = newRow.find('#input-datasource-platforms')[0];
        if (newInputElem && typeof Tagify !== 'undefined') {
            const baseSettings =
                firstInput && firstInput._tagify ? { ...firstInput._tagify.settings } : {};
            const tagifyInstance = new Tagify(newInputElem, baseSettings);
            newInputElem._tagify = tagifyInstance;

            const jsTreeId = '#jstree-platforms-datasource';
            $(jsTreeId).on('changed.jstree', function (e, data) {
                const selectedNodes = $(jsTreeId).jstree('get_selected', true);
                const selectedValues = selectedNodes.map(node =>
                    data.instance.get_path(node, ' > ')
                );
                tagifyInstance.removeAllTags();
                tagifyInstance.addTags(selectedValues);
            });

            tagifyInstance.on('add', function (e) {
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
    });

    // Remove a data source entry.
    datasourceGroup.on("click", ".removeButton", function () {
        $(this).closest(".row").remove();
    });

    // Update fields when the data source type changes.
    datasourceGroup.on('change', 'select[name="datasource_type[]"]', function () {
        const row = $(this).closest('.row');
        updateRowState(row);
    });

    // --- INITIALIZATION ---

    // Set the correct visibility for the first row when the page loads.
    if (datasourceGroup.children(".row").length > 0) {
        updateRowState(datasourceGroup.children(".row").first());
    }
});