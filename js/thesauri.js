/**
 * Recursively searches a jsTree data array for a specific node ID.
 * Returns the node (and its children) if found, otherwise returns the original data.
 */
export function filterTreeByRoot(nodes, rootId) {
    if (!rootId || !nodes) return nodes;

    function findNodeById(nodesArray, id) {
        for (let i = 0; i < nodesArray.length; i++) {
            if (nodesArray[i].id === id) {
                return nodesArray[i];
            }
            if (nodesArray[i].children && nodesArray[i].children.length > 0) {
                let foundNode = findNodeById(nodesArray[i].children, id);
                if (foundNode) {
                    return foundNode;
                }
            }
        }
        return null;
    }

    const rootNode = findNodeById(nodes, rootId);
    // jsTree expects an array of root nodes, so we wrap the result in an array
    return rootNode ? [rootNode] : nodes; 
}
export const THESAURUS_CONFIG = {
    science_keywords: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-science-keywords',
        inputName: 'gcmdScienceKeywords',
        inputId: 'input-sciencekeyword',
        modalId: 'modal-sciencekeyword',
        jsTreeId: 'jstree-sciencekeyword',
        searchInputId: 'input-sciencekeyword-thesaurussearch',
        selectedListId: 'selected-keywords-sciencekeyword',
        helpSectionId: 'help-scienceKeywords-keyword',
        stateKey: 'input-sciencekeyword'
    },
    platforms: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-platforms',
        inputName: 'platforms',
        inputId: 'input-platforms',
        modalId: 'modal-platforms',
        jsTreeId: 'jstree-platforms',
        searchInputId: 'input-platforms-thesaurussearch',
        selectedListId: 'selected-keywords-platforms',
        helpSectionId: 'help-gcmd-platforms-keyword',
        stateKey: 'input-platforms'
    },
    instruments: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-instruments',
        inputName: 'instruments',
        inputId: 'input-instruments',
        modalId: 'modal-instruments',
        jsTreeId: 'jstree-instruments',
        searchInputId: 'input-instruments-thesaurussearch',
        selectedListId: 'selected-keywords-instruments',
        helpSectionId: 'help-gcmd-instruments-keyword',
        stateKey: 'input-instruments'
    },
    chronostratigraphy: {
        apiEndpoint: 'api/v2/vocabs/thesauri/chronostrat-timescale',
        inputName: 'chronostratKeywords',
        inputId: 'input-chronostratigraphy',
        modalId: 'modal-chronostratigraphy',
        jsTreeId: 'jstree-chronostratigraphy',
        searchInputId: 'input-chronostratigraphy-thesaurussearch',
        selectedListId: 'selected-keywords-chronostratigraphy',
        helpSectionId: 'help-chronostratigraphy-keyword',
        stateKey: 'input-chronostratigraphy'
    },
    gemet: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gemet',
        inputName: 'gemetKeywords',
        inputId: 'input-gemet',
        modalId: 'modal-gemet',
        jsTreeId: 'jstree-gemet',
        searchInputId: 'input-gemet-thesaurussearch',
        selectedListId: 'selected-keywords-gemet',
        helpSectionId: 'help-gemet-keyword',
        stateKey: 'input-gemet'
    },
    satellitePlatforms: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-platforms',
        rootNodeId: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
        // Datasource controls are pre-rendered outside the generic thesauri generator, so this dynamic config keeps selectors.
        modalId: '#modal-platforms-datasource',
        jsTreeId: '#jstree-platforms-datasource',
        searchInputId: '#input-platforms-thesaurussearch-ds',
        selectedListId: 'selected-keywords-platforms-ds',
        stateKey: 'satellitePlatforms',
        dynamicOnly: true
    }
};

export let currentActiveInput = null;

const loadedConfigs = new Map();
const sharedState = {};
let keywordConfigurations = [];

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
 * Loads thesaurus vocabulary data on demand.
 * Triggered when a modal is opened for the first time OR when
 * a Tagify input field receives focus.
 * Fetches from the ELMO API proxy endpoint (ERNIE-backed) or local JSON for MSL.
 *
 * @param {Object} config - The configuration object for the keyword input.
 */
function loadThesaurusOnDemand(config) {
    const currentState = loadedConfigs.get(config.jsTreeId);
    if (currentState === 'loading' || currentState === 'loaded') return;

    loadedConfigs.set(config.jsTreeId, 'loading');
    showLoadingSpinner(config.jsTreeId);

    $.getJSON(config.apiEndpoint, function (data) {
        loadKeywordsForConfig(config, data);
        loadedConfigs.set(config.jsTreeId, 'loaded');
        hideLoadingSpinner(config.jsTreeId);
    }).fail(function (jqxhr, textStatus, error) {
        console.error('Failed to load thesaurus:', config.apiEndpoint, textStatus, error);
        loadedConfigs.set(config.jsTreeId, 'error');
        $(config.jsTreeId).html(`
            <div class="alert alert-danger m-2">
                ${translations?.keywords?.thesaurus?.unavailable || 'Error loading thesaurus data.'}
            </div>
        `);
    });
}

/**
 * Loads and processes keyword data, initializing jsTree.
 * Called when modal is opened for the first time (lazy loading).
 *
 * @param {Object} config - Configuration object for the keyword input field.
 * @param {Array<Object>|Object} response - The keyword data from the API / JSON file.
 */
function loadKeywordsForConfig(config, response) {
    const state = ensureSharedState(config);

    const data = response.data ? response.data : response;
    var filteredData = data;
    var suggestedKeywords = [];

    function ensureArray(x) {
        if (Array.isArray(x)) return x;
        if (x && Array.isArray(x.data)) return x.data;
        return [];
    }

    var availableNodes = ensureArray(data);

    // If rootNodes/rootNodeId exist, load only those subtrees (e.g., MSL general/domain)
    if (config.rootNodes || config.rootNodeId) {
        function findNodeById(nodes, id) {
            if (!Array.isArray(nodes)) return null;
            for (var i = 0; i < nodes.length; i++) {
                if (!nodes[i]) continue;
                if (nodes[i].id === id) return nodes[i];
                if (nodes[i].children) {
                    var foundNode = findNodeById(nodes[i].children, id);
                    if (foundNode) return foundNode;
                }
            }
            return null;
        }

        if (config.rootNodes && Array.isArray(config.rootNodes)) {
            var collected = [];
            config.rootNodes.forEach(function (rootId) {
                var n = findNodeById(availableNodes, rootId);
                if (n) collected.push(n);
                else console.warn('root not found:', rootId, 'in', config.apiEndpoint);
            });
            if (collected.length === 0) {
                console.error('No valid rootNodes found in', config.apiEndpoint);
                return;
            }

            // Remove any collected node that is already reachable as a descendant of
            // another collected node (e.g. both GEODETICS and its child ELLIPSOID
            // CHARACTERISTICS are listed). Keeping a child as a separate top-level
            // entry would make it appear twice in the tree — once inside its parent
            // and once as a peer — producing duplicate breadcrumb paths in the whitelist.
            function isDescendantInSubtree(nodeId, subtreeChildren) {
                if (!Array.isArray(subtreeChildren)) return false;
                for (var i = 0; i < subtreeChildren.length; i++) {
                    if (subtreeChildren[i].id === nodeId) return true;
                    if (isDescendantInSubtree(nodeId, subtreeChildren[i].children)) return true;
                }
                return false;
            }
            collected = collected.filter(function (candidate) {
                return !collected.some(function (other) {
                    return other !== candidate && isDescendantInSubtree(candidate.id, other.children || []);
                });
            });

            filteredData = collected;
        } else if (config.rootNodeId) {
            var sel = findNodeById(availableNodes, config.rootNodeId);
            if (sel) filteredData = [sel];
            else {
                console.error('Root node with ID', config.rootNodeId, 'not found in', config.apiEndpoint);
                return;
            }
        }
    }

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

    function buildWhitelistFromNodes(nodes, parentPath) {
        parentPath = parentPath || [];
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
            if (item.children) {
                buildWhitelistFromNodes(item.children, parentPath.concat(item.text));
            }
        });
    }

    buildWhitelistFromNodes(filteredData);

    // Merge suggestedKeywords into sharedState.whitelist, avoid duplicates
    const existingValues = new Set(state.whitelist.map(w => w.value));
    suggestedKeywords.forEach(s => {
        if (!existingValues.has(s.value)) {
            state.whitelist.push(s);
            existingValues.add(s.value);
        }
    });

    state.tagifyInstances.forEach(function (tagifyInstance) {
        tagifyInstance.settings.whitelist = state.whitelist;
        tagifyInstance.settings.enforceWhitelist = true;
    });

    // Initialize jsTree
    $(config.jsTreeId).jstree({
        core: {
            data: processedData,
            themes: {
                icons: false,
                dots: false
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

    $(config.searchInputId).on("input", function () {
        var tree = $(config.jsTreeId).jstree(true);
        if (tree) tree.search($(this).val());
    });

    $(config.jsTreeId).on("changed.jstree", function (e, data) {
        if (state.isSyncingTree) return;

        var newCentralSet = new Set();

        state.jsTreeIds.forEach(function (treeSelector) {
            var tree = $(treeSelector).jstree(true);
            if (!tree) return;
            var nodes = tree.get_selected(true);
            nodes.forEach(function (n) {
                var p = tree.get_path(n, " > ");
                if (p) newCentralSet.add(p);
            });
        });

        state.selectedPaths = newCentralSet;
        updateSelectedKeywordsList(config.selectedKeywordsListId, state);

        const activeTagify = getActiveTagifyForState(state);
        if (activeTagify) {
            // Replace the active row's tags from tree state to keep modal selection authoritative.
            activeTagify.removeAllTags();
            if (state.selectedPaths.size > 0) {
                activeTagify.addTags(Array.from(state.selectedPaths));
            }
        }
    });

    // Initial sync: if the active input already has tags, select corresponding nodes
    const activeTagify = getActiveTagifyForState(state);
    if (activeTagify && activeTagify.value && activeTagify.value.length) {
        var currentValues = activeTagify.value.map(v => v.value);
        currentValues.forEach(function (val) {
            var tree = $(config.jsTreeId).jstree(true);
            if (!tree) return;
            var node = findNodeByPath(tree, val);
            if (node) tree.select_node(node.id);
        });
    }
}

/** Returns the shared state key for a thesaurus config. */
function getStateKey(config) {
    return config.stateKey || config.inputId || config.jsTreeId;
}

/**
 * Returns the shared thesaurus state bucket for a config, creating it on first use.
 *
 * @param {Object} config - Thesaurus configuration for a generic or datasource-backed input.
 * @returns {{whitelist: Array, selectedPaths: Set<string>, tagify: Object|null, tagifyInstances: Set<Object>, jsTreeIds: Array<string>, isSyncingTree: boolean}} Shared mutable state for the config.
 */
function ensureSharedState(config) {
    const stateKey = getStateKey(config);
    if (!sharedState[stateKey]) {
        sharedState[stateKey] = {
            whitelist: [],
            selectedPaths: new Set(),
            tagify: null,
            tagifyInstances: new Set(),
            jsTreeIds: [],
            isSyncingTree: false
        };
    }
    return sharedState[stateKey];
}

/**
 * Registers a dynamic-only config in the runtime keyword configuration list.
 *
 * @param {string} configKey - Key from THESAURUS_CONFIG.
 * @returns {Object|undefined} Existing or newly registered config, or undefined when the key is unknown.
 */
function ensureConfigRegistered(configKey) {
    const config = THESAURUS_CONFIG[configKey];
    if (!config || !config.dynamicOnly) return config;

    const existing = keywordConfigurations.find(function (entry) {
        return entry.stateKey === config.stateKey;
    });
    if (existing) return existing;

    const registeredConfig = {
        apiEndpoint: config.apiEndpoint,
        rootNodeId: config.rootNodeId,
        modalId: config.modalId,
        jsTreeId: config.jsTreeId,
        searchInputId: config.searchInputId,
        selectedKeywordsListId: config.selectedListId,
        stateKey: config.stateKey,
        dynamicOnly: true
    };
    keywordConfigurations.push(registeredConfig);
    return registeredConfig;
}

/**
 * Clears the current selection of a jsTree instance using the best available API.
 *
 * @param {Object} tree - Active jsTree instance.
 * @returns {void}
 */
function clearTreeSelection(tree) {
    if (!tree) return;

    if (typeof tree.deselect_all === 'function') {
        tree.deselect_all();
        return;
    }

    const selectedNodes = typeof tree.get_selected === 'function' ? tree.get_selected(true) : [];
    selectedNodes.forEach(function (node) {
        const nodeId = typeof node === 'string' ? node : node.id;
        if (nodeId && typeof tree.deselect_node === 'function') {
            tree.deselect_node(nodeId);
        }
    });
}

/** Returns the Tagify instance currently driving the shared tree state. */
function getActiveTagifyForState(state) {
    return currentActiveInput || state.tagify;
}

/**
 * Renders the selected-keywords sidebar for the active thesaurus modal.
 *
 * @param {string} listId - DOM id of the selected-keywords list element.
 * @param {{selectedPaths: Set<string>, jsTreeIds: Array<string>, tagify: Object|null}} state - Shared thesaurus state for the current config.
 * @returns {void}
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
            const activeTagify = getActiveTagifyForState(state);
            if (activeTagify && typeof activeTagify.removeTag === 'function') {
                activeTagify.removeTag(fullPath);
            }

            state.jsTreeIds.forEach(function (treeSelector) {
                const tree = $(treeSelector).jstree(true);
                if (!tree) return;
                const node = findNodeByPath(tree, fullPath);
                if (node) tree.deselect_node(node.id);
            });

            state.selectedPaths.delete(fullPath);
            updateSelectedKeywordsList(listId, state);
        };

        listItem.appendChild(removeButton);
        selectedKeywordsList.appendChild(listItem);
    });
}

/**
 * Finds a jsTree node by its rendered breadcrumb path.
 *
 * @param {Object} jsTreeInstance - Active jsTree instance.
 * @param {string} path - Full breadcrumb path using ` > ` separators.
 * @returns {Object|null} Matching jsTree node, or null when no match exists.
 */
function findNodeByPath(jsTreeInstance, path) {
    if (!jsTreeInstance) return null;
    return jsTreeInstance.get_json("#", { flat: true }).find(function (n) {
        return jsTreeInstance.get_path(n, " > ") === path;
    });
}

/**
 * Synchronizes the shared jsTree selection to the active Tagify input before a modal opens.
 *
 * @param {Object} config - Thesaurus configuration associated with the input.
 * @param {Object} tagifyInstance - Tagify instance whose values should be reflected in the tree.
 * @returns {void}
 */
function syncTreeSelectionFromTagify(config, tagifyInstance) {
    if (!tagifyInstance) return;

    const state = ensureSharedState(config);
    const tagValues = tagifyInstance.value ? tagifyInstance.value.map(function (tag) {
        return tag.value;
    }) : [];

    state.selectedPaths = new Set(tagValues);
    state.isSyncingTree = true;

    state.jsTreeIds.forEach(function (treeSelector) {
        const tree = $(treeSelector).jstree(true);
        if (!tree) return;

        // Rebuild the modal tree from the active row's current tags before user interaction.
        clearTreeSelection(tree);
        tagValues.forEach(function (value) {
            const node = findNodeByPath(tree, value);
            if (node && typeof tree.select_node === 'function') {
                tree.select_node(node.id);
            }
        });
    });

    state.isSyncingTree = false;
    updateSelectedKeywordsList(config.selectedListId || config.selectedKeywordsListId, state);
}

/**
 * Rebinds the datasource-specific tree button so it activates the correct Tagify instance.
 *
 * @param {HTMLInputElement} inputElement - Raw input element enhanced by Tagify.
 * @param {Object} config - Dynamic thesaurus configuration for the input.
 * @returns {void}
 */
function bindDynamicTreeButton(inputElement, config) {
    const row = inputElement.closest('.row');
    if (!row || !config.modalId) return;

    const treeButton = row.querySelector(`.open-thesaurus-tree-btn, [data-bs-target="${config.modalId}"]`);
    if (!treeButton) return;

    const newTreeButton = treeButton.cloneNode(true);
    treeButton.parentNode.replaceChild(newTreeButton, treeButton);

    newTreeButton.addEventListener('click', function () {
        // The datasource modal is shared across rows, so we must mark which Tagify owns the next sync.
        currentActiveInput = inputElement._tagify;
        syncTreeSelectionFromTagify(config, inputElement._tagify);
    });
}

/**
 * Removes a Tagify instance from shared thesaurus state when its owning input is destroyed.
 *
 * @param {Object} config - Thesaurus configuration for the input.
 * @param {HTMLInputElement} inputElement - Input element that owns the Tagify instance.
 * @returns {void}
 */
export function cleanupTagifyForInput(inputElement, configKey) {
    if (!inputElement) return;

    const config = ensureConfigRegistered(configKey) || THESAURUS_CONFIG[configKey];
    if (!config) return;

    const tagifyInstance = inputElement._tagify;
    if (!tagifyInstance) return;

    const state = ensureSharedState(config);
    state.tagifyInstances.delete(tagifyInstance);

    if (state.tagify === tagifyInstance) {
        state.tagify = null;
    }

    if (currentActiveInput === tagifyInstance) {
        currentActiveInput = null;
    }
}

// 3. The Function to hook up new inputs
export function initTagifyForInput(inputElement, configKey) {
    const config = ensureConfigRegistered(configKey) || THESAURUS_CONFIG[configKey];
    if (!config) {
        console.error(`Config for ${configKey} not found.`);
        return;
    }

    const state = ensureSharedState(config);

    // Dynamic datasource rows rely on this registration so shared tree updates can see their modal tree.
    if (config.jsTreeId && !state.jsTreeIds.includes(config.jsTreeId)) {
        state.jsTreeIds.push(config.jsTreeId);
    }

    // Initialize Tagify if it hasn't been already
    if (!inputElement._tagify) {
        inputElement._tagify = new Tagify(inputElement, {
            whitelist: state.whitelist,
            enforceWhitelist: state.whitelist.length > 0,
            placeholder: translations?.keywords?.thesaurus?.label || 'Thesaurus keywords',
            dropdown: {
                maxItems: 50,
                enabled: 3,
                closeOnSelect: true,
                classname: 'thesaurus-tagify',
            },
            editTags: false
        });

        // Trigger whitelist fetch on first focus/input so users who type before
        // opening the modal still get autocomplete suggestions.
        const tagifyWrapper = inputElement._tagify.DOM?.scope;
        if (tagifyWrapper) {
            tagifyWrapper.addEventListener('focus', function () {
                loadThesaurusOnDemand(config);
            }, { once: true, capture: true });
        }
    }
    state.tagifyInstances.add(inputElement._tagify);

    if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
        window.applyTagifyAccessibilityAttributes(inputElement._tagify, inputElement, {
            placeholder: inputElement._tagify.settings.placeholder
        });
    }

    if (!inputElement.dataset.thesaurusEventsBound) {
        inputElement.dataset.thesaurusEventsBound = 'true';

        inputElement._tagify.on('add', function (e) {
            if (currentActiveInput !== inputElement._tagify) return;

            const tagText = e.detail?.data?.value;
            if (!tagText) return;

            state.selectedPaths.add(tagText);
            state.jsTreeIds.forEach(function (treeSelector) {
                const tree = $(treeSelector).jstree(true);
                if (!tree) return;
                const node = findNodeByPath(tree, tagText);
                if (node) tree.select_node(node.id);
            });
        });

        inputElement._tagify.on('remove', function (e) {
            if (currentActiveInput !== inputElement._tagify) return;

            const tagText = e.detail?.data?.value;
            if (!tagText) return;

            state.selectedPaths.delete(tagText);
            state.jsTreeIds.forEach(function (treeSelector) {
                const tree = $(treeSelector).jstree(true);
                if (!tree) return;
                const node = findNodeByPath(tree, tagText);
                if (node) tree.deselect_node(node.id);
            });
        });

        inputElement._tagify.on('destroy', function () {
            cleanupTagifyForInput(inputElement, configKey);
        });
    }

    bindDynamicTreeButton(inputElement, config);
}
/**
 * Initializes thesaurus keyword input fields dynamically based on ERNIE availability.
 *
 * Flow:
 * 1. Check master toggle (ELMO_FEATURES.showThesauri)
 * 2. Fetch thesauri availability from ELMO API (ERNIE proxy)
 * 3. For each available thesaurus: generate accordion + modal HTML, init Tagify, register lazy loading
 * 4. Show form group if at least one thesaurus is available
 *
 * Also handles MSL keywords (static config, separate feature toggle).
 *
 * P1-1: Lazy Loading — vocabulary data is loaded only when the modal is opened for the first time.
 */
$(document).ready(function () {
    const features = window.ELMO_FEATURES || {};
    const showThesauri = features.showThesauri !== false;
    const showMslVocabs = features.showMslVocabs === true;
    const showGGMsProperties = features.showGGMsProperties === true;

    /**
     * GGMs-specific root node constraints that narrow each thesaurus tree
     * when ELMO_FEATURES.showGGMsProperties is enabled.
     * Set to null to keep a thesaurus unrestricted; set to a concept URI to
     * limit it to that subtree.
     */
    const GGM_THESAURUS_ROOT_NODES = {
        science_keywords: [
            'https://gcmd.earthdata.nasa.gov/kms/concept/8fb5ea8a-96ba-47cf-91cd-c7b64fbcd54a', // EARTH SCIENCE SERVICES > MODELS > SPHERICAL HARMONIC MODELS
            'https://gcmd.earthdata.nasa.gov/kms/concept/97576e51-28b5-4ae0-af33-fbb00fd5996b', // EARTH SCIENCE SERVICES > MODELS > MASS CONCENTRATION (MASCON) MODELS
            'https://gcmd.earthdata.nasa.gov/kms/concept/b8615aad-d2eb-45a3-98a7-4adac5bdf5a5', // EARTH SCIENCE SERVICES > MODELS > EARTH SCIENCE REANALYSES/ASSIMILATION MODELS
            'https://gcmd.earthdata.nasa.gov/kms/concept/5498572c-aaed-4c08-8aad-8b297057e9c9', // EARTH SCIENCE > SOLID EARTH > GEODETICS
            'https://gcmd.earthdata.nasa.gov/kms/concept/221386f6-ef9b-4990-82b3-f990b0fe39fa', // EARTH SCIENCE > SOLID EARTH > GRAVITY/GRAVITATIONAL FIELD
            'https://gcmd.earthdata.nasa.gov/kms/concept/ad09b215-e837-4d9f-acbc-2b45e5b81825'  // EARTH SCIENCE > OCEANS > MARINE GEOPHYSICS > MARINE GRAVITY FIELD
        ]
        // platforms: null,
        // instruments: null,
    };

    // MSL root-Lists (unchanged, separate feature)
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

    ensureConfigRegistered('satellitePlatforms');

    // Wait for translations, then initialize everything
    document.addEventListener('translationsLoaded', function () {
        initThesauri();
        initMslKeywords();
    }, { once: true });

    /**
     * Main initialization for ERNIE-based thesauri.
     * Fetches availability, generates HTML, and sets up Tagify + lazy loading.
     */
    function initThesauri() {
        if (!showThesauri) return;

        $.getJSON('api/v2/vocabs/thesauri/availability')
            .done(function (availability) {
                const availableThesauri = filterAvailableThesauri(availability);

                if (availableThesauri.length === 0) return;

                const accordionContainer = document.getElementById('accordionThesauri');
                const modalContainer = document.getElementById('thesaurusModalsContainer');
                if (!accordionContainer || !modalContainer) return;

                let isFirst = true;
                availableThesauri.forEach(function (item) {
                    const config = THESAURUS_CONFIG[item.key];
                    if (!config) return;

                    accordionContainer.innerHTML += generateThesaurusInputItem(item.key, config, item.displayName, isFirst);
                    modalContainer.innerHTML += generateModal(item.key, config, item.displayName);
                    isFirst = false;

                    // Build keywordConfigurations entry for this thesaurus.
                    // GGMs overrides (array → rootNodes, string → rootNodeId) take priority
                    // over any static values in THESAURUS_CONFIG when the feature is active.
                    const ggmsOverride = showGGMsProperties
                        ? GGM_THESAURUS_ROOT_NODES[item.key]
                        : undefined;

                    const entry = {
                        inputId: '#' + config.inputId,
                        apiEndpoint: config.apiEndpoint,
                        jsTreeId: '#' + config.jsTreeId,
                        searchInputId: '#' + config.searchInputId,
                        selectedKeywordsListId: config.selectedListId,
                        modalId: '#' + config.modalId,
                    };

                    if (Array.isArray(ggmsOverride)) {
                        entry.rootNodes = ggmsOverride;
                    } else if (typeof ggmsOverride === 'string') {
                        entry.rootNodeId = ggmsOverride;
                    } else {
                        // No GGMs override — fall back to static config values.
                        if (config.rootNodes) entry.rootNodes = config.rootNodes;
                        if (config.rootNodeId) entry.rootNodeId = config.rootNodeId;
                    }

                    keywordConfigurations.push(entry);
                });

                // Initialize Tagify for each configuration
                keywordConfigurations.forEach(function (kc) {
                    if ($(kc.inputId).length) {
                        initializeKeywordInputWithLazyLoading(kc);
                    }
                });

                // Setup lazy loading for modals and input fields
                setupLazyLoadingForModals();
                setupLazyLoadingForInputs();

                // Show the form group
                const formGroup = document.getElementById('thesaurusKeywordsFormGroup');
                if (formGroup) formGroup.style.display = '';
            })
            .fail(function (jqxhr, textStatus, error) {
                console.error('Failed to fetch thesauri availability:', textStatus, error);
            });
    }

    /**
     * Filters availability response to return only thesauri that are available.
     *
     * @param {Object} availability - Response from the availability endpoint.
     * @returns {Array<{key: string, displayName: string}>} Available thesauri.
     */
    function filterAvailableThesauri(availability) {
        const result = [];
        Object.keys(THESAURUS_CONFIG).forEach(function (key) {
            if (THESAURUS_CONFIG[key].dynamicOnly) return;

            if (availability[key] && availability[key].available) {
                result.push({
                    key: key,
                    displayName: availability[key].displayName || key,
                });
            }
        });
        return result;
    }

    /**
     * Generates HTML for a thesaurus input field and its modal trigger button.
     *
     * @param {string} key - The thesaurus key (e.g. 'science_keywords').
     * @param {Object} config - THESAURUS_CONFIG entry for the thesaurus.
     * @param {string} displayName - Display name from ERNIE availability.
     * @returns {string} HTML string for the thesaurus input item.
     */
    function generateThesaurusInputItem(key, config, displayName) {
        return `
        <div class="thesaurus-input-item mb-3">
            <div class="input-group has-validation input-margin-top-bottom">
                <label for="${config.inputId}" class="visually-hidden">${escapeHtml(displayName)}</label>
                <div class="form-floating flex-grow-1"> 
                    <div class="input-group has-validation">
                        <input type="text" class="form-control input-with-help input-right-no-round-corners"
                            id="${config.inputId}" name="${config.inputName}" />
                        <span class="input-group-text"><i class="bi bi-question-circle-fill"
                               data-help-section-id="${config.helpSectionId}"></i></span>
                    </div>
                </div>
                <div class="col-auto p-2">
                    <button type="button" class="btn btn-primary" data-bs-toggle="modal"
                        data-bs-target="#${config.modalId}" id="button-${key}-open">
                        <i class="bi bi-diagram-3" aria-hidden="true"></i>
                        <span class="visually-hidden">${translations?.keywords?.thesaurus?.label || 'Open thesaurus'}</span>
                    </button>
                </div>
            </div>
        </div>`;
    }

    /**
     * Generates Bootstrap modal HTML for a thesaurus.
     *
     * @param {string} key - The thesaurus key.
     * @param {Object} config - THESAURUS_CONFIG entry.
     * @param {string} displayName - Display name from ERNIE availability.
     * @returns {string} HTML string for the modal.
     */
    function generateModal(key, config, displayName) {
        const searchPlaceholder = translations?.keywords?.searchPlaceholder || 'Search for keywords...';
        const selectedKeywordsLabel = translations?.keywords?.selectedKeywords || 'Selected Keywords';

        return `
        <div class="modal fade" id="${config.modalId}" tabindex="-1"
            aria-labelledby="label-${key}-modal" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="label-${key}-modal">
                            ${escapeHtml(displayName)}
                        </h5>
                        <span class="input-group-text"><i class="bi bi-question-circle-fill"
                            data-help-section-id="help-keywords-keywordviewer"></i></span>
                    </div>
                    <div class="modal-body d-flex">
                        <div id="panel-${key}-thesaurus" class="w-50 pe-3 border-end">
                            <label for="${config.searchInputId}" class="visually-hidden">${searchPlaceholder}</label>
                            <input type="text" class="form-control mb-3" id="${config.searchInputId}"
                                placeholder="${escapeHtml(searchPlaceholder)}" aria-label="${escapeHtml(searchPlaceholder)}">
                            <div id="${config.jsTreeId}"></div>
                        </div>
                        <div class="w-50 ps-3">
                            <h6>${escapeHtml(selectedKeywordsLabel)}</h6>
                            <ul id="${config.selectedListId}" class="list-group"></ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Escapes HTML special characters to prevent XSS when inserting dynamic text.
     *
     * @param {string} str - The input string.
     * @returns {string} Escaped string safe for HTML insertion.
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /**
     * Initializes MSL keywords configurations (unchanged, uses static local JSON).
     */
    function initMslKeywords() {
        if (!showMslVocabs) return;

        keywordConfigurations.push(
            {
                inputId: '#input-mslkeyword',
                apiEndpoint: 'json/thesauri/msl-vocabularies.json',
                jsTreeId: '#jstree-mslkeyword-general',
                searchInputId: '#input-mslkeyword-thesaurussearch',
                selectedKeywordsListId: 'selected-keywords-msl',
                rootNodes: generalRoots,
                modalId: '#modal-mslkeyword'
            },
            {
                inputId: '#input-mslkeyword',
                apiEndpoint: 'json/thesauri/msl-vocabularies.json',
                jsTreeId: '#jstree-mslkeyword-domain',
                searchInputId: '#input-mslkeyword-thesaurussearch',
                selectedKeywordsListId: 'selected-keywords-msl',
                rootNodes: domainRoots,
                modalId: '#modal-mslkeyword'
            }
        );

        keywordConfigurations.forEach(function (config) {
            if ($(config.inputId).length) {
                initializeKeywordInputWithLazyLoading(config);
            }
        });

        setupLazyLoadingForModals();
        setupLazyLoadingForInputs();
    }

    /**
     * Sets up lazy loading event listeners for all thesaurus modals.
     * Vocabulary data is loaded only when a modal is opened for the first time.
     */
    function setupLazyLoadingForModals() {
        const modalConfigsMap = new Map();

        keywordConfigurations.forEach(config => {
            if (!config.modalId) return;
            if (!modalConfigsMap.has(config.modalId)) {
                modalConfigsMap.set(config.modalId, []);
            }
            modalConfigsMap.get(config.modalId).push(config);
        });

        modalConfigsMap.forEach((configs, modalId) => {
            const modalElement = document.querySelector(modalId);
            if (!modalElement) return;

            modalElement.addEventListener('show.bs.modal', function () {
                configs.forEach(config => {
                    loadThesaurusOnDemand(config);
                });
            }, { once: true });

            modalElement.addEventListener('hidden.bs.modal', function () {
                // Prevent selections in a reused shared modal from updating a row that is no longer active.
                currentActiveInput = null;
            });
        });
    }

    /**
     * Sets up lazy loading triggered by focusing a Tagify input field.
     * This ensures the autocomplete whitelist is populated even when the
     * user starts typing without opening the jsTree modal first.
     * The loadedConfigs guard inside loadThesaurusOnDemand prevents
     * duplicate network requests.
     */
    function setupLazyLoadingForInputs() {
        const inputConfigsMap = new Map();

        keywordConfigurations.forEach(config => {
            if (!config.inputId) return;
            if (!inputConfigsMap.has(config.inputId)) {
                inputConfigsMap.set(config.inputId, []);
            }
            inputConfigsMap.get(config.inputId).push(config);
        });

        inputConfigsMap.forEach((configs, inputId) => {
            const inputElement = document.querySelector(inputId);
            if (!inputElement) return;

            const tagifyWrapper = inputElement.closest('.tagify') || inputElement.parentElement?.querySelector('.tagify') || inputElement;

            tagifyWrapper.addEventListener('focus', function () {
                configs.forEach(config => {
                    loadThesaurusOnDemand(config);
                });
            }, { once: true, capture: true });
        });
    }

    /**
     * Initializes a keyword input field with Tagify only (no data loading yet).
     * Vocabulary data will be loaded lazily when the modal is opened.
     *
     * @param {Object} config - Configuration object for the keyword input field.
     */
    function initializeKeywordInputWithLazyLoading(config) {
        var input = $(config.inputId)[0];
        if (!input) return;

        const state = ensureSharedState(config);

        if (!state.jsTreeIds.includes(config.jsTreeId)) {
            state.jsTreeIds.push(config.jsTreeId);
        }

        if (!state.tagify) {
            var thesaurusKeywordstagify = new Tagify(input, {
                whitelist: state.whitelist,
                enforceWhitelist: false,
                placeholder: translations?.keywords?.thesaurus?.label || 'Thesaurus keywords',
                dropdown: {
                    maxItems: 50,
                    enabled: 3,
                    closeOnSelect: true,
                    classname: "thesaurus-tagify",
                },
                editTags: false
            });
            input._tagify = thesaurusKeywordstagify;
            state.tagify = thesaurusKeywordstagify;
            state.tagifyInstances.add(thesaurusKeywordstagify);

            if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
                window.applyTagifyAccessibilityAttributes(thesaurusKeywordstagify, input, {
                    placeholder: translations?.keywords?.thesaurus?.label || ''
                });
            }

            state.tagify.on('add', function (e) {
                var tagText = e.detail?.data?.value;
                if (!tagText) return;
                state.jsTreeIds.forEach(function (treeSelector) {
                    var tree = $(treeSelector).jstree(true);
                    if (!tree) return;
                    var node = findNodeByPath(tree, tagText);
                    if (node) tree.select_node(node.id);
                });
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
                state.selectedPaths.delete(tagText);
            });
        }
    }

    // Delegated search input listeners
    $(document).on('input', '[id$="-thesaurussearch"]', function () {
        const searchInputId = '#' + this.id;
        const config = keywordConfigurations.find(c => c.searchInputId === searchInputId);
        if (config && $(config.jsTreeId).jstree(true)) {
            $(config.jsTreeId).jstree(true).search($(this).val());
        }
    });

    $(document).on('keydown', '[id$="-thesaurussearch"]', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const config = keywordConfigurations.find(c => c.searchInputId === '#' + this.id);
            if (!config) return;

            const jsTreeInstance = $(config.jsTreeId).jstree(true);
            if (!jsTreeInstance) return;

            jsTreeInstance.search($(this).val());
            $(this).focus();
        }
    });

    /**
     * Refreshes Tagify placeholder texts when translations change.
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
