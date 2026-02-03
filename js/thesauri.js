/**
 * Initializes all thesaurus input fields after the DOM is ready.
 * Loads configuration for each input (Tagify + jsTree setup) and defines
 * which thesaurus JSON and root nodes to use.
 *
 * Also defines MSL-specific root lists (general vs. domain) to separate vocabularies.
 * 
 * Feature-toggle aware: Only loads thesauri that are enabled via ELMO_FEATURES.
 * 
 * P1-1: Lazy Loading - JSON files are only loaded when the modal is opened for the first time.
 */
$(document).ready(function () {
    // Read feature toggles (with sensible defaults)
    const features = window.ELMO_FEATURES || {};
    const showGcmdThesauri = features.showGcmdThesauri !== false; // default: true
    const showMslVocabs = features.showMslVocabs === true; // default: false

    // Track which configs have had their JSON loaded (lazy loading)
    const loadedConfigs = new Map();

    /**
 * Configuration array for keyword input fields.
 * Each object defines one logical input group (Tagify + jsTree + Search).
 *
 * @type {Array<Object>}
 * @property {string} inputId - The ID of the input element where keywords will be entered.
 * @property {string} jsonFile - Path to the thesaurus JSON data.
 * @property {string} jsTreeId - The ID of the jsTree element associated with this input field.
 * @property {string} searchInputId - The ID of the search input field for the corresponding jsTree-modal.
 * @property {string} selectedKeywordsListId - ID of the shared selected-keywords list element. 
 * @property {string} rootNodes - URIs of root nodes to limit the loaded thesaurus.
 * @property {string} modalId - The ID of the modal that triggers lazy loading of this thesaurus.
 */


    // MSL root-Lists
    const generalRoots = [
        'https://epos-msl.uu.nl/voc/materials/1.3/',
        'https://epos-msl.uu.nl/voc/geologicalage/1.3/',
        'https://epos-msl.uu.nl/voc/porefluids/1.3/',
        'https://epos-msl.uu.nl/voc/geologicalsetting/1.3/',
        'https://epos-msl.uu.nl/voc/subsurface/1.3/'
    ];

    const domainRoots = [
        'https://epos-msl.uu.nl/voc/analoguemodelling/1.3/',
        'https://epos-msl.uu.nl/voc/geochemistry/1.3/',
        'https://epos-msl.uu.nl/voc/testbeds/1.3/',
        'https://epos-msl.uu.nl/voc/microscopy/1.3/',
        'https://epos-msl.uu.nl/voc/paleomagnetism/1.3/',
        'https://epos-msl.uu.nl/voc/rockphysics/1.3/'
    ];

    // Build keyword configurations based on active features
    var keywordConfigurations = [];

    // GCMD Keywords - only add if feature is enabled (default: true)
    if (showGcmdThesauri) {
        keywordConfigurations.push(
            {
                inputId: '#input-sciencekeyword',
                jsonFile: 'json/thesauri/gcmdScienceKeywords.json',
                jsTreeId: '#jstree-sciencekeyword',
                searchInputId: '#input-sciencekeyword-thesaurussearch',
                selectedKeywordsListId: 'selected-keywords-gcmd',
                modalId: '#modal-sciencekeyword'
            },
            {
                inputId: '#input-Platforms',
                jsonFile: 'json/thesauri/gcmdPlatformsKeywords.json',
                jsTreeId: '#jstree-Platforms',
                searchInputId: '#input-Platforms-thesaurussearch',
                selectedKeywordsListId: 'selected-keywords-Platforms-gcmd',
                modalId: '#modal-Platforms'
            },
            {
                inputId: '#input-Instruments',
                jsonFile: 'json/thesauri/gcmdInstrumentsKeywords.json',
                jsTreeId: '#jstree-instruments',
                searchInputId: '#input-instruments-thesaurussearch',
                selectedKeywordsListId: 'selected-keywords-instruments-gcmd',
                modalId: '#modal-instruments'
            }
        );
    }

    // MSL Keywords - only add if feature is enabled (default: false)
    if (showMslVocabs) {
        keywordConfigurations.push(
            {
                inputId: '#input-mslkeyword',
                jsonFile: 'json/thesauri/msl-vocabularies.json',
                jsTreeId: '#jstree-mslkeyword-general',
                searchInputId: '#input-mslkeyword-thesaurussearch',
                selectedKeywordsListId: 'selected-keywords-msl',
                rootNodes: generalRoots,
                modalId: '#modal-mslkeyword'
            },
            {
                inputId: '#input-mslkeyword',
                jsonFile: 'json/thesauri/msl-vocabularies.json',
                jsTreeId: '#jstree-mslkeyword-domain',
                searchInputId: '#input-mslkeyword-thesaurussearch',
                selectedKeywordsListId: 'selected-keywords-msl',
                rootNodes: domainRoots,
                modalId: '#modal-mslkeyword'
            }
        );
    }

    // Shared state per inputId so multiple trees can cooperate
    const sharedState = {};

    // Initialize only those configurations whose input fields exist
    document.addEventListener('translationsLoaded', function() {
        keywordConfigurations.forEach(function (config) {
            if ($(config.inputId).length) {
                initializeKeywordInputWithLazyLoading(config);
            }
        });
        // Setup lazy loading for all modals
        setupLazyLoadingForModals();
    }, { once: true });

    /**
     * Shows a loading spinner in the jsTree container.
     * @param {string} jsTreeId - The selector for the jsTree container.
     */
    function showLoadingSpinner(jsTreeId) {
        const container = $(jsTreeId);
        if (container.length && !container.find('.thesaurus-loading-spinner').length) {
            container.html(`
                <div class="thesaurus-loading-spinner d-flex justify-content-center align-items-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">${translations?.general?.loading || 'Loading thesaurus...'}</span>
                </div>
            `);
        }
    }

    /**
     * Hides the loading spinner from the jsTree container.
     * @param {string} jsTreeId - The selector for the jsTree container.
     */
    function hideLoadingSpinner(jsTreeId) {
        $(jsTreeId).find('.thesaurus-loading-spinner').remove();
    }

    /**
     * Sets up lazy loading event listeners for all thesaurus modals.
     * JSON data is loaded only when a modal is opened for the first time.
     */
    function setupLazyLoadingForModals() {
        // Group configs by modalId to handle multiple trees per modal (e.g., MSL)
        const modalConfigsMap = new Map();
        
        keywordConfigurations.forEach(config => {
            if (!config.modalId) return;
            if (!modalConfigsMap.has(config.modalId)) {
                modalConfigsMap.set(config.modalId, []);
            }
            modalConfigsMap.get(config.modalId).push(config);
        });

        // Set up show.bs.modal listener for each modal
        modalConfigsMap.forEach((configs, modalId) => {
            const modalElement = document.querySelector(modalId);
            if (!modalElement) return;

            modalElement.addEventListener('show.bs.modal', function() {
                // Load all configs associated with this modal
                configs.forEach(config => {
                    loadThesaurusOnDemand(config);
                });
            }, { once: true }); // Only trigger once per modal
        });
    }

    /**
     * Loads thesaurus JSON data on demand when modal is first opened.
     * @param {Object} config - The configuration object for the keyword input.
     */
    function loadThesaurusOnDemand(config) {
        // Check if this specific config (jsTreeId) is already loaded
        if (loadedConfigs.has(config.jsTreeId)) {
            return;
        }

        // Mark as loading to prevent duplicate requests
        loadedConfigs.set(config.jsTreeId, 'loading');

        // Show loading spinner
        showLoadingSpinner(config.jsTreeId);

        // Load JSON file
        $.getJSON(config.jsonFile, function(data) {
            loadKeywordsForConfig(config, data);
            loadedConfigs.set(config.jsTreeId, 'loaded');
            hideLoadingSpinner(config.jsTreeId);
        }).fail(function(jqxhr, textStatus, error) {
            console.error('Failed to load thesaurus:', config.jsonFile, textStatus, error);
            loadedConfigs.set(config.jsTreeId, 'error');
            $(config.jsTreeId).html(`
                <div class="alert alert-danger m-2">
                    ${translations?.general?.error || 'Error loading thesaurus data.'}
                </div>
            `);
        });
    }

    /**
     * Initializes a keyword input field with Tagify only (no JSON loading yet).
     * JSON data will be loaded lazily when the modal is opened.
     *
     * @param {Object} config - Configuration object for the keyword input field.
     */
    function initializeKeywordInputWithLazyLoading(config) {
        var input = $(config.inputId)[0];
        if (!input) return;

        // Ensure shared state exists for this input
        if (!sharedState[config.inputId]) {
            sharedState[config.inputId] = {
                whitelist: [],          // merged whitelist items ({value, id, ...})
                selectedPaths: new Set(), // central set of selected full-path strings
                tagify: null,
                jsTreeIds: []           // list of jsTree selectors associated
            };
        }
        const state = sharedState[config.inputId];

        // Ensure jsTreeIds includes this config's jsTreeId
        if (!state.jsTreeIds.includes(config.jsTreeId)) {
            state.jsTreeIds.push(config.jsTreeId);
        }

        // Initialize Tagify immediately (with empty whitelist, will be populated when modal opens)
        if (!state.tagify) {
            var thesaurusKeywordstagify = new Tagify(input, {
                whitelist: state.whitelist,
                enforceWhitelist: false, // Allow tags before whitelist is loaded
                placeholder: translations?.keywords?.thesaurus?.label || 'Thesaurus keywords',
                dropdown: {
                    maxItems: 50,
                    enabled: 3,
                    closeOnSelect: true,
                    classname: "thesaurus-tagify",
                },
                editTags: false  // tags can not be edited
            });
            input._tagify = thesaurusKeywordstagify;
            state.tagify = thesaurusKeywordstagify;

            // Apply accessibility attributes if helper function is available (for ARIA/screen readers)
            if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
                window.applyTagifyAccessibilityAttributes(thesaurusKeywordstagify, input, {
                    placeholder: translations?.keywords?.thesaurus?.label || ''
                });
            }

            // Tagify add/remove handlers: affect all jsTrees for this input
            state.tagify.on('add', function (e) {
                var tagText = e.detail?.data?.value;
                if (!tagText) return;
                // select in all trees (if node exists and tree is loaded)
                state.jsTreeIds.forEach(function (treeSelector) {
                    var tree = $(treeSelector).jstree(true);
                    if (!tree) return;
                    var node = findNodeByPath(tree, tagText);
                    if (node) tree.select_node(node.id);
                });
                // update central selected set
                state.selectedPaths.add(tagText);
            });

            state.tagify.on('remove', function (e) {
                var tagText = e.detail?.data?.value;
                if (!tagText) return;
                state.jsTreeIds.forEach(function (treeSelector) {
                    var tree = $(treeSelector).jstree(true);
                    if (!tree) return;
                    var node = findNodeByPath(tree, tagText);
                    if (node) tree.deselect_node(node.id);
                });
                // update central selected set
                state.selectedPaths.delete(tagText);
            });
        }
    }

    /**
     * Loads and processes keyword data from a JSON file, initializing jsTree.
     * Called when modal is opened for the first time (lazy loading).
     *
     * @param {Object} config - Configuration object for the keyword input field.
     * @param {Array<Object>} response - The keyword data from the JSON file.
     */
    function loadKeywordsForConfig(config, response) {
        const state = sharedState[config.inputId];
        if (!state) return;

        const data = response.data ? response.data : response;
        var filteredData = data;
        var suggestedKeywords = [];

        // helper: ensure we operate on arrays
        function ensureArray(x) {
            if (Array.isArray(x)) return x;
            if (x && Array.isArray(x.data)) return x.data;
            return [];
        }

        var availableNodes = ensureArray(data);

        // If rootNodes/rootNodeId exist, load only those subtrees (e.g., MSL general/domain)
        if (config.rootNodes || config.rootNodeId) {

            /**
            * Recursively finds a node by ID in a nested node structure.
            *
            * @param {Array<Object>} nodes - Array of nodes to search.
            * @param {string} id - The ID of the node to find.
            * @returns {Object|null} The node if found, otherwise `null`.
            */
            function findNodeById(nodes, id) {
                // defensive: nodes might not be array
                if (!Array.isArray(nodes)) return null;
                for (var i = 0; i < nodes.length; i++) {
                    if (!nodes[i]) continue;
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
            if (config.rootNodes && Array.isArray(config.rootNodes)) {
                var collected = [];
                config.rootNodes.forEach(function (rootId) {
                    var n = findNodeById(availableNodes, rootId);
                    if (n) collected.push(n);
                    else console.warn('root not found:', rootId, 'in', config.jsonFile);
                });
                if (collected.length === 0) {
                    console.error('No valid rootNodes found in', config.jsonFile);
                    return;
                }
                filteredData = collected;
            } else if (config.rootNodeId) {
                var sel = findNodeById(availableNodes, config.rootNodeId);
                if (sel) filteredData = [sel];
                else {
                    console.error('Root node with ID', config.rootNodeId, 'not found in', config.jsonFile);
                    return;
                }
            }
        }

        /**
        * Recursively processes nodes, adding tooltips and metadata for hierarchical data visualization of thesaurus.
        *
        * @param {Array<Object>} nodes - Array of nodes to process.
        * @returns {Array<Object>} Processed nodes with added attributes.
        */
        function processNodes(nodes) {
            if (!Array.isArray(nodes)) return [];
            return nodes.map(function (node) {
                if (!node) return node;
                if (node.children) {
                    node.children = processNodes(node.children);
                }
                node.a_attr = node.a_attr || { title: node.description || "" };
                node.original = node.original || {
                    scheme: node.scheme || "",
                    schemeURI: node.schemeURI || "",
                    language: node.language || ""
                };
                return node;
            });
        }

        var processedData = processNodes(filteredData);

        function buildWhitelistFromNodes(nodes, parentPath = []) {
            if (!Array.isArray(nodes)) return;
            nodes.forEach(function (item) {
                if (!item) return;
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
                    buildWhitelistFromNodes(item.children, parentPath.concat(item.text));
                }
            });
        }

        buildWhitelistFromNodes(filteredData);

        // Merge suggestedKeywords into sharedState.whitelist, avoid duplicates by value
        const existingValues = new Set(state.whitelist.map(w => w.value));
        suggestedKeywords.forEach(s => {
            if (!existingValues.has(s.value)) {
                state.whitelist.push(s);
                existingValues.add(s.value);
            }
        });

        // Update Tagify whitelist and enable enforceWhitelist now that data is loaded
        if (state.tagify) {
            state.tagify.settings.whitelist = state.whitelist;
            state.tagify.settings.enforceWhitelist = true;
        }

        // Initialize jsTree for this config (use processedData for that subtree)
        $(config.jsTreeId).jstree({
            core: {
                data: processedData,
                themes: { icons: false }
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

        // connect search input for this tree
        $(config.searchInputId).on("input", function () {
            // only search the tree we're in
            var tree = $(config.jsTreeId).jstree(true);
            if (tree) tree.search($(this).val());
        });

        // When this tree changes, update shared selectedPaths and Tagify accordingly
        $(config.jsTreeId).on("changed.jstree", function (e, data) {
            // Recompute central selectedPaths:
            // Approach: keep existing selectedPaths from other trees, replace entries that originate from this tree.
            // Simpler and robust: rebuild central selectedPaths as union of all trees' selections.

            var newCentralSet = new Set();

            // iterate all jsTreeIds known for this input and union their selected paths
            state.jsTreeIds.forEach(function (treeSelector) {
                var tree = $(treeSelector).jstree(true);
                if (!tree) return;
                var nodes = tree.get_selected(true);
                nodes.forEach(function (n) {
                    var p = tree.get_path(n, " > ");
                    if (p) newCentralSet.add(p);
                });
            });

            // apply newCentralSet to shared state
            state.selectedPaths = newCentralSet;

            // update list display(s) — we use the selectedKeywordsListId from config (same for both MSL configs)
            updateSelectedKeywordsList(config.selectedKeywordsListId, state);

            // Update Tagify tags to reflect central selection
            // removeAllTags + addTags from state.selectedPaths
            if (state.tagify) {
                state.tagify.removeAllTags();
                if (state.selectedPaths.size > 0) {
                    state.tagify.addTags(Array.from(state.selectedPaths));
                }
            }
        });

        // initial sync: if tagify already existed and had tags, select nodes accordingly
        if (state.tagify && state.tagify.value && state.tagify.value.length) {
            var currentValues = state.tagify.value.map(v => v.value);
            currentValues.forEach(function (val) {
                // try selecting corresponding nodes in this tree
                var tree = $(config.jsTreeId).jstree(true);
                if (!tree) return;
                var node = findNodeByPath(tree, val);
                if (node) tree.select_node(node.id);
            });
        }
    }

    /**
     *  
     * helper to update selected keywords list element (shared for all trees that point to same list id)
     * 
     */
    function updateSelectedKeywordsList(listId, state) {
        var selectedKeywordsList = document.getElementById(listId);
        if (!selectedKeywordsList) return;
        selectedKeywordsList.innerHTML = "";
        Array.from(state.selectedPaths).forEach(function (fullPath) {
            let listItem = document.createElement("li");
            listItem.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
            listItem.textContent = fullPath;

            let removeButton = document.createElement("button");
            removeButton.classList.add("btn", "btn-sm", "btn-danger");
            removeButton.innerHTML = "&times;";
            removeButton.onclick = function () {
                // remove tag from tagify -> triggers deselection in all trees via tagify remove handler
                if (state.tagify) state.tagify.removeTag(fullPath);
                // if tagify not present, remove from set directly
                state.selectedPaths.delete(fullPath);
                // update UI
                updateSelectedKeywordsList(listId, state);
            };

            listItem.appendChild(removeButton);
            selectedKeywordsList.appendChild(listItem);
        });
    }

    /**
     *  
     * generic find by path helper for a jsTree instance
     * 
     */
    function findNodeByPath(jsTreeInstance, path) {
        if (!jsTreeInstance) return null;
        return jsTreeInstance.get_json("#", { flat: true }).find(function (n) {
            return jsTreeInstance.get_path(n, " > ") === path;
        });
    }

    // Global listeners for search inputs (delegated)
    $(document).on('input', '[id$="-thesaurussearch"]', function () {
        const searchInputId = `#${this.id}`;
        const config = keywordConfigurations.find(c => c.searchInputId === searchInputId);
        if (config && $(config.jsTreeId).jstree(true)) {
            $(config.jsTreeId).jstree(true).search($(this).val());
        }
    });

    $(document).on('keydown', '[id$="-thesaurussearch"]', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const config = keywordConfigurations.find(c => c.searchInputId === `#${this.id}`);

            if (!config) return;

            const jsTreeInstance = $(config.jsTreeId).jstree(true);
            if (!jsTreeInstance) return;

            jsTreeInstance.search($(this).val());
            $(this).focus();
        }
    });

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

    document.addEventListener('translationsLoaded', refreshThesaurusTagifyInstances);
});
