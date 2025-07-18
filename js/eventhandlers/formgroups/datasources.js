/**
 * @description Handles dynamic addition, removal, and visibility of data source rows in the form.
 * @module datasources
 */
import { createRemoveButton, replaceHelpButtonInClonedRows } from '../functions.js';

$(document).ready(function () {
    const datasourceGroup = $("#group-datasources");
    if (datasourceGroup.length === 0) return; // Do nothing if the form group is not on the page

    const originalDataSourceRow = datasourceGroup.children(".row").first().clone();

    const detailsOptions = {
        'G': ['Terrestrial', 'Shipborne', 'Airborne', 'Ground data computed from GGM', 'Other'],
        'A': ['Altimetry radar dataset', 'Altimetry dataset', 'Gravity data determined from Altimetry grid data', 'Data produced from radar altimeters'],
        'T': ['Bathymetry', 'Isostasy', 'Digital Elevation Model (DEM/DTM)', 'Density Model']
    };

    const visibilityConfig = {
        'S': { // Satellite
            'visibility-datasources-basic': true,
            'visibility-datasources-details': false,
            'visibility-datasources-satellite': true,
            'visibility-datasources-identifier': false
        },
        'G': { // Ground data
            'visibility-datasources-basic': true,
            'visibility-datasources-details': true,
            'visibility-datasources-satellite': false,
            'visibility-datasources-identifier': false
        },
        'A': { // Altimetry
            'visibility-datasources-basic': true,
            'visibility-datasources-details': true,
            'visibility-datasources-satellite': false,
            'visibility-datasources-identifier': false
        },
        'T': { // Topography
            'visibility-datasources-basic': true,
            'visibility-datasources-details': true,
            'visibility-datasources-satellite': false,
            'visibility-datasources-identifier': false
        },
        'M': { // Model
            'visibility-datasources-basic': true,
            'visibility-datasources-details': false,
            'visibility-datasources-satellite': false,
            'visibility-datasources-identifier': true
        }
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
            row.find(`.${fieldClass}`).toggle(shouldBeVisible);
        }

        // If the details dropdown should be visible, populate it.
        if (config['visibility-datasources-details']) {
            const detailsSelect = row.find('select[name="datasource_details[]"]');
            detailsSelect.empty(); // Clear existing options

            const options = detailsOptions[selectedType] || [];
            detailsSelect.append($('<option>', { value: '', text: 'Choose...', disabled: true, selected: true, hidden: true }));
            options.forEach(detail => {
                detailsSelect.append($('<option>', { value: detail, text: detail }));
            });
        }
    }

    // Add new data source entry
    datasourceGroup.on("click", ".addDataSource", function () {
        const newRow = originalDataSourceRow.clone();

        newRow.find("input, textarea, select").val("");
        newRow.find(".is-invalid, .is-valid").removeClass("is-invalid is-valid");
        newRow.find(".invalid-feedback").hide();

        replaceHelpButtonInClonedRows(newRow);
        newRow.find(".addDataSource").replaceWith(createRemoveButton());

        datasourceGroup.append(newRow);
        updateRowState(newRow); // Set initial visibility for the new row
    });

    // Event handler for the remove button
    datasourceGroup.on("click", ".removeButton", function () {
        $(this).closest(".row").remove();
    });

    // Update fields when the data source type changes
    datasourceGroup.on('change', 'select[name="datasource_type[]"]', function () {
        const row = $(this).closest('.row');
        updateRowState(row);
    });

    // Set initial state for the first row on page load
    updateRowState(datasourceGroup.children(".row").first());
});