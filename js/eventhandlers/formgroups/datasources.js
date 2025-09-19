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

    // --- Helper functions -------------------------------------------------

    const getJsTree = () => $(jsTreeId).jstree(true);

    /**
     * Find a jsTree node by its path.
     * @param {string} path - Full path text to search for.
     * @param {object} jsTree - jsTree instance.
     * @returns {object|undefined} Matching node if found.
     */
    function findNodeByPath(path, jsTree = getJsTree()) {
        if (!jsTree) return undefined;
        return jsTree
            .get_json('#', { flat: true })
            .find(n => jsTree.get_path(n, ' > ') === path);
    }

    /**
     * Select or deselect a node in the tree based on tag text.
     * @param {string} tagText - Tag caption.
     * @param {boolean} select - True to select, false to deselect.
     * @param {object} jsTree - jsTree instance.
     */
    function syncTagWithTree(tagText, select = true, jsTree = getJsTree()) {
        if (!jsTree) return;
        const node = findNodeByPath(tagText, jsTree);
        if (node) {
            select ? jsTree.select_node(node.id) : jsTree.deselect_node(node.id);
        }
    }

    /**
     * Split existing Tagify tags into jsTree backed tags and manual tags.
     *
     * @param {Tagify} tagifyInstance - The Tagify instance with current tags.
     * @param {object} jsTree - jsTree instance.
     * @returns {{tagsWithNode: Array, manualTags: Array}}
     */
    function separateTags(tagifyInstance, jsTree = getJsTree()) {
        if (!jsTree) return { tagsWithNode: [], manualTags: [] };
        
        const existingTags = tagifyInstance ? tagifyInstance.value.slice() : [];
        const tagsWithNode = [];
        const manualTags = [];

        existingTags.forEach(tag => {
            if (findNodeByPath(tag.value, jsTree)) {
                tagsWithNode.push(tag);
            } else {
                manualTags.push(tag);
            }
        });

        return { tagsWithNode, manualTags };
    }

    /**
     * Bind Tagify add/remove events so jsTree selections stay in sync.
     * @param {Tagify} tagifyInstance - Tagify instance to bind events to.
     */
    function bindTagifyEvents(tagifyInstance) {
        if (!tagifyInstance) return;
        
        const sync = (e, select) => {
            if (activePlatformTagify !== tagifyInstance) return;
            syncTagWithTree(e.detail.data.value, select);
        };

        tagifyInstance.on('add', e => sync(e, true));
        tagifyInstance.on('remove', e => sync(e, false));
    }

    /**
     * Populate the list of selected keywords below the tree modal.
     */
    function updateSelectedKeywordsList() {
        const selectedKeywordsList = document.getElementById('selected-keywords-platforms-ds');
        if (!selectedKeywordsList) return;

        selectedKeywordsList.innerHTML = '';
        const jsTree = getJsTree();
        if (!jsTree) return;
        
        const selectedNodes = jsTree.get_selected(true);

        selectedNodes.forEach(function (node) {
            const fullPath = jsTree.get_path(node, ' > ');
            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
            listItem.textContent = fullPath;

            const removeButton = document.createElement('button');
            removeButton.classList.add('btn', 'btn-sm', 'btn-danger');
            removeButton.innerHTML = '&times;';
            removeButton.onclick = function () {
                syncTagWithTree(fullPath, false, jsTree);
            };

            listItem.appendChild(removeButton);
            selectedKeywordsList.appendChild(listItem);
        });
    }

    document.addEventListener('translationsLoaded', function () {
        // Initialize the jsTree for platforms datasource
        if ($(jsTreeId).length && !$(jsTreeId).jstree(true)) {
            // Load the GCMD platforms data and initialize the tree
            $.getJSON('json/thesauri/gcmdPlatformsKeywords.json', function(response) {
                const data = response.data ? response.data : response;
                // this node is called Space-based Platforms. Theoretically this can be any node.
                const rootNodeId = 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847';
                
                // Find the root node for data sources platforms
                // OR: find all nodes with id and their children
                function findNodeById(nodes, id) {
                    for (var i = 0; i < nodes.length; i++) {
                        if (nodes[i].id === id) {
                            return nodes[i];
                        }
                        if (nodes[i].children) {
                            var foundNode = findNodeById(nodes[i].children, id);
                            if (foundNode) {
                                return foundNode;
                            }
                        }
                    }
                    return null;
                }

                var filteredData = data;
                var selectedNode = findNodeById(data, rootNodeId);
                if (selectedNode) {
                    filteredData = [selectedNode];
                } else {
                    console.error(`Root node with ID ${rootNodeId} not found in gcmdPlatformsKeywords.json`);
                }

                // Process nodes for jsTree
                function processNodes(nodes) {
                    return nodes.map(function (node) {
                        if (node.children) {
                            node.children = processNodes(node.children);
                        }
                        node.a_attr = {
                            title: node.description
                        };
                        node.original = {
                            scheme: node.scheme || "",
                            schemeURI: node.schemeURI || "",
                            language: node.language || ""
                        };
                        return node;
                    });
                }

                const processedData = processNodes(filteredData);

                // Initialize jsTree
                $(jsTreeId).jstree({
                    core: {
                        data: processedData,
                        themes: {
                            icons: false
                        }
                    },
                    checkbox: {
                        keep_selected_style: true,
                        three_state: false
                    },
                    plugins: ['search', 'checkbox'],
                    search: {
                        show_only_matches: true,
                        search_callback: function (str, node) {
                            return node.text.toLowerCase().indexOf(str.toLowerCase()) !== -1 ||
                                (node.a_attr && node.a_attr.title && node.a_attr.title.toLowerCase().indexOf(str.toLowerCase()) !== -1);
                        }
                    }
                });

                // Set up search input handler
                $('#input-platforms-thesaurussearch-ds').on("input", function () {
                    const tree = $(jsTreeId).jstree(true);
                    if (tree) {
                        tree.search($(this).val());
                    }
                });

                // Initialize Tagify for existing datasource platform inputs
                const platformInputs = document.querySelectorAll('input[name="satellite_platform[]"]');
                platformInputs.forEach((input, index) => {
                    if (!input._tagify && typeof Tagify !== 'undefined') {
                        // Build whitelist from the processed data
                        const suggestedKeywords = [];
                        function buildWhitelist(nodes, parentPath = []) {
                            nodes.forEach(function (item) {
                                const textToAdd = parentPath.concat(item.text).join(' > ');
                                suggestedKeywords.push({
                                    value: textToAdd,
                                    id: item.id,
                                    scheme: item.scheme,
                                    schemeURI: item.schemeURI,
                                    language: item.language
                                });

                                if (item.children) {
                                    buildWhitelist(item.children, parentPath.concat(item.text));
                                }
                            });
                        }
                        buildWhitelist(filteredData);

                        const tagifyInstance = new Tagify(input, {
                            whitelist: suggestedKeywords,
                            enforceWhitelist: true,
                            placeholder: translations?.keywords?.thesaurus?.label || 'Enter keywords...',
                            dropdown: {
                                maxItems: 50,
                                enabled: 3,
                                closeOnSelect: true,
                                classname: "thesaurus-tagify",
                            },
                            editTags: false,
                        });
                        input._tagify = tagifyInstance;
                        if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
                            window.applyTagifyAccessibilityAttributes(tagifyInstance, input, {
                                placeholder: tagifyInstance.settings.placeholder
                            });
                        }
                        bindTagifyEvents(tagifyInstance);
                    }
                });

                // Set up jsTree event handlers after the tree is initialized
                $(jsTreeId).off('changed.jstree');
                $(jsTreeId).on('changed.jstree', function (e, data) {
                    updateSelectedKeywordsList();
                    if (!activePlatformTagify) return;
                    const jsTree = $(jsTreeId).jstree(true);
                    const selectedNodes = jsTree.get_selected(true);
                    const selectedValues = selectedNodes.map(node => data.instance.get_path(node, ' > '));
                    activePlatformTagify.removeAllTags();
                    activePlatformTagify.addTags(selectedValues);
                });
            });
        }
    }, { once: true });

    $('#modal-platforms-datasource').on('show.bs.modal', function (e) {
        const button = $(e.relatedTarget);
        const row = button.closest('.row');
        // Look for the platform input within this specific row
        const inputElem = row.find('input[name="satellite_platform[]"]')[0];
        if (!inputElem) return;

        const tagifyInstance = inputElem._tagify;
        const jsTree = getJsTree();
        if (!jsTree) return;

        // Preserve current tags before manipulating the tree
        const { tagsWithNode, manualTags } = separateTags(tagifyInstance, jsTree);

        // Prevent Tagify from being cleared when deselecting nodes
        activePlatformTagify = null;
        jsTree.deselect_all();

        activePlatformTagify = tagifyInstance;
        tagsWithNode.forEach(tag => syncTagWithTree(tag.value, true, jsTree));

        if (manualTags.length && activePlatformTagify) {
            activePlatformTagify.addTags(manualTags);
        }

        updateSelectedKeywordsList();
    });

    $('#modal-platforms-datasource').on('hidden.bs.modal', function () {
        activePlatformTagify = null;
        const jsTree = getJsTree();
        if (jsTree) {
            jsTree.deselect_all();
            updateSelectedKeywordsList();
        }
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
            identifierCol.insertAfter(typeCol);
            identifierTypeCol.insertAfter(identifierCol);
            // Row 2: Model Name | Description | Button
            modelNameCol.insertAfter(identifierTypeCol);
            descCol.insertAfter(modelNameCol);
            addButtonCol.insertAfter(descCol);

        } else {
            // Restore original order: Type | Description | Details | Compensation | ModelName | Identifier | IdentifierType | Satellite | AddButton
            descCol.insertAfter(typeCol);
            detailsCol.insertAfter(descCol);
            compensationCol.insertAfter(detailsCol);
            modelNameCol.insertAfter(compensationCol);
            identifierCol.insertAfter(modelNameCol);
            identifierTypeCol.insertAfter(identifierCol);
            satelliteCol.insertAfter(identifierTypeCol);
            addButtonCol.insertAfter(satelliteCol);
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

    // --- EVENT HANDLERS (Delegated from the static parent 'datasourceGroup') ---

    // Add new data source entry.
    datasourceGroup.on("click", ".addDataSource", function () {
        const newRow = originalDataSourceRow.clone();

        newRow.find("input, textarea, select").val("");
        newRow.find(".is-invalid, .is-valid").removeClass("is-invalid is-valid");
        newRow.find(".invalid-feedback").hide();

        // Generate unique ID for the new platform input to avoid conflicts
        const rowCount = datasourceGroup.children('.row').length;
        const newPlatformInput = newRow.find('input[name="satellite_platform[]"]');
        if (newPlatformInput.length > 0) {
            const newId = `input-datasource-platforms-${rowCount}`;
            newPlatformInput.attr('id', newId);
        }

        replaceHelpButtonInClonedRows(newRow);
        newRow.find(".addDataSource").replaceWith(createRemoveButton());
        
        // Set the default value to Satellite for the new row.
        newRow.find('select[name="datasource_type[]"]').val('S');

        datasourceGroup.append(newRow);
        updateRowState(newRow); // Immediately set the correct visibility.
        restoreHelpButtons(newRow);

        // Initialize Tagify for the new platform input
        const firstInput = document.querySelector('input[name="satellite_platform[]"]');
        const newInputElem = newRow.find('input[name="satellite_platform[]"]')[0];
        if (newInputElem && typeof Tagify !== 'undefined') {
            const baseSettings = firstInput && firstInput._tagify ? { ...firstInput._tagify.settings } : {};
            const tagifyInstance = new Tagify(newInputElem, baseSettings);
            newInputElem._tagify = tagifyInstance;
            if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
                window.applyTagifyAccessibilityAttributes(tagifyInstance, newInputElem, {
                    placeholder: baseSettings.placeholder
                });
            }
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