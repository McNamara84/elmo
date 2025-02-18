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
            jsonFile: 'json/gcmdScienceKeywords.json',
            jsTreeId: '#jstree-sciencekeyword',
            searchInputId: '#input-sciencekeyword-search',
            shouldInitialize: true // Immer initialisieren
        },
        {
            inputId: '#input-mslkeyword',
            jsonFile: 'json/msl-vocabularies.json',
            jsTreeId: '#jstree-mslkeyword',
            searchInputId: '#input-mslkeyword-thesaurussearch',
            shouldInitialize: false // Standardmäßig nicht initialisieren
        }
    ];

    fetch('settings.php?setting=all')
        .then(response => response.json())
        .then(data => {
            // MSL Keyword Konfiguration aktualisieren
            keywordConfigurations.find(config => config.inputId === '#input-mslkeyword').shouldInitialize = data.showMslLabs;

            // Initialisierung aller Keyword-Felder
            keywordConfigurations.forEach(function (config) {
                if (config.shouldInitialize) {
                    initializeKeywordInput(config);
                }
            });
        })
        .catch(error => {
            console.error('Fehler beim Abruf der Settings:', error);
        });



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

                // filter node and its children
                var selectedNode = findNodeById(data, config.rootNodeId);
                if (selectedNode) {
                    filteredData = selectedNode.children || [];
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

            /**
             * Builds a whitelist of keywords from hierarchical data for Tagify dropdown.
             *
             * @param {Array<Object>} data - Array of hierarchical data.
             * @param {Array<string>} [parentPath=[]] - The parent path for building keyword hierarchy.
             */
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
                    maxItems: 50,  // max. number of whitelist items shown
                    enabled: 3,    // show whitelist when 3 characters are typed
                    closeOnSelect: true,  //close dropdown after keyword-selection
                    classname: "thesaurus-tagify", // custom class for dropdown
                },
                editTags: false,  // tags can not be edited
            });
            // Explicitly assign the instance to input._tagify
            input._tagify = thesaurusKeywordstagify;


            // Initialise jsTree
            $(config.jsTreeId).jstree({
                core: {
                    data: processedData,
                    themes: {
                        icons: false  // do not show items
                    }
                },
                checkbox: {
                    keep_selected_style: true  // keep checkbox-style
                },
                plugins: ['search', 'checkbox'],  // activates search and checkbox plugins
                search: {
                    show_only_matches: true,  // show only nodes matching the search

                    /**
                    * Callback function used to perform a search operation on jsTree nodes.
                    * This function checks whether the search string matches the node's text or tooltip description.
                    *
                    * @param {string} str - The search string entered by the user.
                    * @param {Object} node - The node being searched.
                    * @param {string} node.text - The text content of the node.
                    * @param {Object} [node.a_attr] - The attributes of the node.
                    * @param {string} [node.a_attr.title] - The tooltip text for the node.
                    * @returns {boolean} Returns `true` if the node text or tooltip matches the search string, otherwise `false`.
                    */
                    search_callback: function (str, node) {
                        // Suchkriterium für Text oder Tooltip
                        return node.text.toLowerCase().indexOf(str.toLowerCase()) !== -1 ||
                            (node.a_attr && node.a_attr.title && node.a_attr.title.toLowerCase().indexOf(str.toLowerCase()) !== -1);
                    }
                }
            });

            /**
            * Real-time search function for filtering nodes in jsTree as the user types in the search input.
            * 
            * @param {Event} event - The input event triggered by the user typing in the search field.
            */
            $(config.searchInputId).on("input", function () {
                $(config.jsTreeId).jstree(true).search($(this).val());
            });

            /**
            * Event handler for when a node is selected in jsTree.
            * The function adds a tag to Tagify if the node's full path is not already present.
            * 
            * @param {Event} e - The event triggered by selecting a node in jsTree.
            * @param {Object} data - The data related to the selected node.
            * @param {Object} data.instance - The jsTree instance.
            * @param {Object} data.node - The selected node in jsTree.
            * @param {string} data.node.text - The text of the selected node.
            */
            $(config.jsTreeId).on("select_node.jstree", function (e, data) {
                var fullPath = data.instance.get_path(data.node, " > ");
                var existingTags = thesaurusKeywordstagify.value.map((tag) => tag.value);

                if (!existingTags.includes(fullPath)) {
                    thesaurusKeywordstagify.addTags([fullPath]);
                }
            });


            /**
            * Event handler for when a node is deselected in jsTree.
            * The function removes the corresponding tag from Tagify.
            * 
            * @param {Event} e - The event triggered by deselecting a node in jsTree.
            * @param {Object} data - The data related to the deselected node.
            * @param {Object} data.instance - The jsTree instance.
            * @param {Object} data.node - The deselected node in jsTree.
            */
            $(config.jsTreeId).on("deselect_node.jstree", function (e, data) {
                var fullPath = data.instance.get_path(data.node, " > ");
                thesaurusKeywordstagify.removeTag(fullPath);
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
                var tagText = e.detail.data.value;
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
                var tagText = e.detail.data.value;
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

            /**
            * Event handler for selecting a node in jsTree. 
            * Adds the corresponding node as a tag in the Tagify input field if it is not already present.
            * 
            * @param {Event} e - The event triggered by selecting a node in jsTree.
            * @param {Object} data - The data related to the selected node.
            * @param {Object} data.instance - The jsTree instance.
            * @param {Object} data.node - The selected node in jsTree.
            * @param {string} data.node.id - The ID of the selected node.
            * @param {string} data.node.original.scheme - The scheme associated with the node.
            * @param {string} data.node.original.schemeURI - The URI of the scheme associated with the node.
            * @param {string} data.node.original.language - The language associated with the node.
            */
            $(config.jsTreeId).on("select_node.jstree", function (e, data) {
                var fullPath = data.instance.get_path(data.node, " > ");
                var existingTags = thesaurusKeywordstagify.value.map((tag) => tag.id);

                // Only add the tag if it's not already present
                if (!existingTags.includes(data.node.id)) {
                    thesaurusKeywordstagify.addTags([{
                        value: fullPath,
                        id: data.node.id,
                        scheme: data.node.original.scheme,
                        schemeURI: data.node.original.schemeURI,
                        language: data.node.original.language
                    }]);
                }
            });
        }

        // loads JSON file
        $.getJSON(config.jsonFile, function (data) {
            loadKeywords(data);
        });
    }
});
