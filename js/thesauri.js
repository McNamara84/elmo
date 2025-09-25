/**
 * Initializes thesaurus input fields with data from JSON files, integrates jsTree for hierarchical 
 * navigation, and enables tag management with Tagify.
 */
$(document).ready(function () {
    /**
 * Configuration array for keyword input fields.
 * Each object in the array defines the settings for a specific keyword input and associated components.
 *
 * @type {Array<Object>}
 * @property {string} inputId - The ID of the input element where keywords will be entered.
 * @property {string} jsonFile - The path to the JSON file containing the thesaurus.
 * @property {string} jsTreeId - The ID of the jsTree element associated with this input field.
 * @property {string} searchInputId - The ID of the search input field for the corresponding jsTree-modal.
 */
    var keywordConfigurations = [
        {
            inputId: '#input-sciencekeyword',
            jsonFile: 'json/thesauri/gcmdScienceKeywords.json',
            jsTreeId: '#jstree-sciencekeyword',
            searchInputId: '#input-sciencekeyword-thesaurussearch',
            selectedKeywordsListId: 'selected-keywords-gcmd'
        },
        {
            inputId: '#input-Platforms',
            jsonFile: 'json/thesauri/gcmdPlatformsKeywords.json',
            jsTreeId: '#jstree-Platforms',
            searchInputId: '#input-Platforms-thesaurussearch',
            selectedKeywordsListId: 'selected-keywords-Platforms-gcmd'
        },
        {
            inputId: '#input-Instruments',
            jsonFile: 'json/thesauri/gcmdInstrumentsKeywords.json',
            jsTreeId: '#jstree-instruments',
            searchInputId: '#input-instruments-thesaurussearch',
            selectedKeywordsListId: 'selected-keywords-instruments-gcmd'
        },
        {
            inputId: '#input-mslkeyword',
            jsonFile: 'json/thesauri/msl-vocabularies.json',
            jsTreeId: '#jstree-mslkeyword',
            searchInputId: '#input-mslkeyword-thesaurussearch',
            selectedKeywordsListId: 'selected-keywords-msl'
        }
    ];

    // Initialisiere nur die Konfigurationen, deren Eingabefelder existieren
    document.addEventListener('translationsLoaded', function() {
        keywordConfigurations.forEach(function (config) {
            if ($(config.inputId).length) {
                initializeKeywordInput(config);
            }
        });
    }, { once: true });

    /**
     * Refreshes all Tagify instances for thesaurus inputs when translations are changed.
     * This function updates the placeholder text for existing Tagify instances without
     * destroying them, preserving all selected values and functionality.
     * 
     * @returns {void}
     */
    function refreshThesaurusTagifyInstances() {
        keywordConfigurations.forEach(config => {
            const inputElement = document.querySelector(config.inputId);
            if (!inputElement || !inputElement._tagify) return;

            if (translations?.keywords?.thesaurus) {
                inputElement._tagify.settings.placeholder = translations.keywords.thesaurus.label;
                const placeholderElement = inputElement.parentElement.querySelector('.tagify__input');
                if (placeholderElement) {
                    placeholderElement.setAttribute('data-placeholder', translations.keywords.thesaurus.label);
                }
                if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
                    window.applyTagifyAccessibilityAttributes(inputElement._tagify, inputElement, {
                        placeholder: translations.keywords.thesaurus.label
                    });
                }
            }
        });
    }

    /**
     * Initializes a keyword input field with tag management and hierarchical tree data and search capabilities used in modal.
     *
     * @param {Object} config - Configuration object for the keyword input field.
     * @param {string} config.inputId - The ID of the input element.
     * @param {string} config.jsonFile - The JSON file path for the data source.
     * @param {string} config.jsTreeId - The ID of the jsTree element for hierarchical data visualization.
     * @param {string} config.searchInputId - The ID of the search field for filtering jsTree nodes.
     */
    function initializeKeywordInput(config) {
        var input = $(config.inputId)[0];
        var suggestedKeywords = [];

        /**
         * Loads and processes keyword data from a JSON file, initializing jsTree and Tagify.
         *
         * @param {Array<Object>} data - The keyword data array from the JSON file.
         */
        function loadKeywords(response) {
            const data = response.data ? response.data : response;
            var filteredData = data;


            if (config.rootNodeId) {

                /**
                * Recursively finds a node by ID in a nested node structure.
                *
                * @param {Array<Object>} nodes - Array of nodes to search.
                * @param {string} id - The ID of the node to find.
                * @returns {Object|null} The node if found, otherwise `null`.
                */
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

                // restrict to the specified node and its descendants
                var selectedNode = findNodeById(data, config.rootNodeId);
                if (selectedNode) {
                    filteredData = [selectedNode];
                } else {
                    console.error(`Root node with ID ${config.rootNodeId} not found in ${config.jsonFile}`);
                    return;
                }
            }

            /**
            * Recursively processes nodes, adding tooltips and metadata for hierarchical data visualization of thesaurus.
            *
            * @param {Array<Object>} nodes - Array of nodes to process.
            * @returns {Array<Object>} Processed nodes with added attributes.
            */
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

            var processedData = processNodes(filteredData);

            function buildWhitelist(data, parentPath = []) {
                data.forEach(function (item) {
                    var textToAdd = parentPath.concat(item.text).join(' > ');
                    suggestedKeywords.push({
                        value: textToAdd,
                        id: item.id,
                        scheme: item.scheme,
                        schemeURI: item.schemeURI,
                        language: item.language
                    });

                    // recursive processing of child-nodes
                    if (item.children) {
                        buildWhitelist(item.children, parentPath.concat(item.text));
                    }
                });
            }

            buildWhitelist(filteredData);

            // Initialise Tagify
            var thesaurusKeywordstagify = new Tagify(input, {
                whitelist: suggestedKeywords,
                enforceWhitelist: true,
                placeholder: translations.keywords.thesaurus.label,
                dropdown: {
                    maxItems: 50,
                    enabled: 3,
                    closeOnSelect: true,
                    classname: "thesaurus-tagify",
                },
                editTags: false,  // tags can not be edited
            });
            // Explicitly assign the instance to input._tagify
            input._tagify = thesaurusKeywordstagify;

            if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
                window.applyTagifyAccessibilityAttributes(thesaurusKeywordstagify, input, {
                    placeholder: translations.keywords.thesaurus.label
                });
            }

            // Initialize jsTree
            $(config.jsTreeId).jstree({
                core: {
                    data: processedData,
                    themes: {
                        icons: false  // do not show items
                    }
                },
                checkbox: {
                    keep_selected_style: true,
                    three_state: false // Disables cascading selection
                },
                plugins: ['search', 'checkbox'],  // activates search and checkbox plugins
                search: {
                    show_only_matches: true,
                    search_callback: function (str, node) {
                        return node.text.toLowerCase().indexOf(str.toLowerCase()) !== -1 ||
                            (node.a_attr && node.a_attr.title && node.a_attr.title.toLowerCase().indexOf(str.toLowerCase()) !== -1);
                    }
                }
            });

            $(config.searchInputId).on("input", function () {
                $(config.jsTreeId).jstree(true).search($(this).val());
            });

            function updateSelectedKeywordsList() {
                let selectedKeywordsList = document.getElementById(config.selectedKeywordsListId);
                if (!selectedKeywordsList) return;

                selectedKeywordsList.innerHTML = "";
                var selectedNodes = $(config.jsTreeId).jstree("get_selected", true);

                selectedNodes.forEach(function (node) {
                    let fullPath = $(config.jsTreeId).jstree().get_path(node, " > ");
                    let listItem = document.createElement("li");
                    listItem.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
                    listItem.textContent = fullPath;

                    let removeButton = document.createElement("button");
                    removeButton.classList.add("btn", "btn-sm", "btn-danger");
                    removeButton.innerHTML = "&times;";
                    removeButton.onclick = function () {
                        $(config.jsTreeId).jstree("deselect_node", node.id);
                    };

                    listItem.appendChild(removeButton);
                    selectedKeywordsList.appendChild(listItem);
                });
            }

            // Event handler for 'changed.jstree'
            $(config.jsTreeId).on("changed.jstree", function (e, data) {
                updateSelectedKeywordsList();

                // Updates the Tagify tags based on the jsTree selection
                var selectedNodes = $(config.jsTreeId).jstree("get_selected", true);
                var selectedValues = selectedNodes.map(function (node) {
                    return data.instance.get_path(node, " > ");
                });

                thesaurusKeywordstagify.removeAllTags();
                thesaurusKeywordstagify.addTags(selectedValues);
            });

            /**
            * Event handler for when a tag is added to Tagify.
            * The function selects the corresponding node in jsTree based on the tag text.
            *
            * @param {Event} e - The event triggered by adding a tag to Tagify.
            * @param {Object} e.detail - The details of the event.
            * @param {Object} e.detail.data - The data of the added tag.
            * @param {string} e.detail.data.value - The value of the added tag.
            */
            thesaurusKeywordstagify.on('add', function (e) {
                var tagText = e.detail?.data?.value;
                if (!tagText) return;
                var jsTree = $(config.jsTreeId).jstree(true);
                var node = findNodeByPath(jsTree, tagText);
                if (node) {
                    jsTree.select_node(node.id);
                }
            });

            /**
            * Event handler for when a tag is removed from Tagify.
            * The function deselects the corresponding node in jsTree based on the removed tag.
            *
            * @param {Event} e - The event triggered by removing a tag from Tagify.
            * @param {Object} e.detail - The details of the event.
            * @param {Object} e.detail.data - The data of the removed tag.
            * @param {string} e.detail.data.value - The value of the removed tag.
            */
            thesaurusKeywordstagify.on('remove', function (e) {
                var tagText = e.detail && e.detail.data ? e.detail.data.value : null;
                if (!tagText) return;
                var jsTree = $(config.jsTreeId).jstree(true);
                var node = findNodeByPath(jsTree, tagText);
                if (node) {
                    jsTree.deselect_node(node.id);
                }
            });

            /**
            * Finds a node in the jsTree by its full path.
            * This function searches through all the nodes in the jsTree and returns the node that matches the provided path.
            *
            * @param {Object} jsTree - The jsTree instance to search through.
            * @param {string} path - The full path of the node to find, formatted as a string with " > " separators.
            * @returns {Object|null} The node object if found, or `null` if no node matches the path.
            */
            function findNodeByPath(jsTree, path) {
                return jsTree.get_json("#", { flat: true }).find(function (n) {
                    return jsTree.get_path(n, " > ") === path;
                });
            }
        }

        // loads JSON file
        $.getJSON(config.jsonFile, function (data) {
            loadKeywords(data);
        });
    }

    // Event listener for search input           
    // the search event is delegated to the highest level. the input will be propagated, and we can formulate the event handler at this place.
    $(document).on('input', '[id$="-thesaurussearch"]', function() {
            const searchInputId = `#${this.id}`;
            // Find the corresponding config
            const config = keywordConfigurations.find(c => c.searchInputId === searchInputId);
            if (config && $(config.jsTreeId).jstree(true)) {
                $(config.jsTreeId).jstree(true).search($(this).val());
            }
        });
    // Event listener for Enter key in the modal           
    // Handle Enter in modal search. We don't want it to remove any elements
    $(document).on('keydown', '[id$="-thesaurussearch"]', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            
            const searchInput = $(this);
            const config = keywordConfigurations.find(c => c.searchInputId === `#${this.id}`);

            if (!config) return;

            const jsTreeInstance = $(config.jsTreeId).jstree(true);
            if (!jsTreeInstance) return;

            // Explicitly trigger the search. OPTIONAL
            jsTreeInstance.search(searchInput.val());

            searchInput.focus();
        }
    });

    document.addEventListener('translationsLoaded', refreshThesaurusTagifyInstances);
});
