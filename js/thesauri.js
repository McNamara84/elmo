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
        },
        {
            inputId: '#input-mslkeyword',
            jsonFile: 'json/thesauri/msl-vocabularies.json',
            jsTreeId: '#jstree-mslkeyword',
            searchInputId: '#input-mslkeyword-thesaurussearch',
            selectedKeywordsListId: 'selected-keywords-msl',
            modalId: '#modal-mslkeyword'
        }
    ];

    var keywordDataCache = {};
    var keywordInitializationState = {};

    var defaultMessages = {
        loading: 'Loading thesaurus…',
        error: 'Unable to load thesaurus. Please try again.'
    };

    function resolveMessage(key) {
        if (key === 'loading') {
            return translations?.keywords?.thesaurus?.loading ?? defaultMessages.loading;
        }
        if (key === 'error') {
            return translations?.keywords?.thesaurus?.error ?? defaultMessages.error;
        }
        return '';
    }

    function getModalElement(config) {
        if (!config.modalId) {
            return null;
        }
        return document.querySelector(config.modalId);
    }

    function getOrCreateStatusElement(modalElement) {
        if (!modalElement) {
            return null;
        }

        var existing = modalElement.querySelector('.thesaurus-loading-status');
        if (existing) {
            return existing;
        }

        var statusElement = document.createElement('div');
        statusElement.className = 'thesaurus-loading-status alert alert-info visually-hidden';
        statusElement.setAttribute('role', 'status');
        statusElement.setAttribute('aria-live', 'polite');
        statusElement.setAttribute('aria-atomic', 'true');

        var modalBody = modalElement.querySelector('.modal-body');
        if (modalBody) {
            modalBody.prepend(statusElement);
        } else {
            modalElement.prepend(statusElement);
        }

        return statusElement;
    }

    function updateStatusElement(statusElement, type, message) {
        if (!statusElement) {
            return;
        }

        statusElement.classList.remove('alert-info', 'alert-danger', 'visually-hidden');
        statusElement.textContent = message;

        if (type === 'loading') {
            statusElement.classList.add('alert-info');
        } else if (type === 'error') {
            statusElement.classList.add('alert-danger');
        }

        if (!message) {
            statusElement.classList.add('visually-hidden');
        }
    }

    function hideStatusElement(statusElement) {
        if (!statusElement) {
            return;
        }
        statusElement.textContent = '';
        statusElement.classList.add('visually-hidden');
        statusElement.classList.remove('alert-info', 'alert-danger');
    }

    function isElementInViewport(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') {
            return false;
        }

        var rect = element.getBoundingClientRect();
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;

        var hasSize = (rect.width || rect.height);
        if (!hasSize) {
            return false;
        }

        return (
            rect.top < viewportHeight &&
            rect.bottom > 0 &&
            rect.left < viewportWidth &&
            rect.right > 0
        );
    }

    function fetchThesaurusData(config) {
        var cacheKey = config.jsonFile;
        if (keywordDataCache[cacheKey]) {
            return keywordDataCache[cacheKey];
        }

        var loader;
        if (typeof window.fetch === 'function') {
            loader = window.fetch(config.jsonFile).then(function (response) {
                if (!response.ok) {
                    throw new Error('Failed to fetch thesaurus: ' + response.status);
                }
                return response.json();
            });
        } else if ($ && typeof $.getJSON === 'function') {
            loader = new Promise(function (resolve, reject) {
                $.getJSON(config.jsonFile)
                    .done(resolve)
                    .fail(function (jqXHR, textStatus, errorThrown) {
                        reject(new Error(errorThrown || textStatus || 'Failed to load thesaurus JSON.'));
                    });
            });
        } else {
            loader = Promise.reject(new Error('No fetch implementation available for thesaurus.'));
        }

        keywordDataCache[cacheKey] = loader.then(function (data) {
            return data;
        }).catch(function (error) {
            delete keywordDataCache[cacheKey];
            throw error;
        });

        return keywordDataCache[cacheKey];
    }

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
        if (!input) {
            return;
        }

        keywordInitializationState[config.inputId] = keywordInitializationState[config.inputId] || {
            initializationPromise: null,
            visibilityObserver: null,
            scrollHandler: null,
            footerButtonsBound: false,
            footerButtons: null,
            footerButtonHandler: null
        };

        var state = keywordInitializationState[config.inputId];

        function detachVisibilityTriggers() {
            if (state.visibilityObserver && typeof state.visibilityObserver.disconnect === 'function') {
                state.visibilityObserver.disconnect();
            }
            state.visibilityObserver = null;

            if (state.scrollHandler) {
                window.removeEventListener('scroll', state.scrollHandler, true);
            }
            state.scrollHandler = null;
        }

        function detachFooterButtonListeners() {
            if (!state.footerButtons || !state.footerButtonHandler) {
                return;
            }

            state.footerButtons.forEach(function (button) {
                button.removeEventListener('click', state.footerButtonHandler);
            });

            state.footerButtons = null;
            state.footerButtonHandler = null;
            state.footerButtonsBound = false;
        }

        function attachFooterButtonListeners(modalElement) {
            if (!modalElement || state.footerButtonsBound) {
                return;
            }

            var footer = modalElement.querySelector('.modal-footer');
            if (!footer) {
                return;
            }

            var buttons = footer.querySelectorAll('button, .btn');
            if (!buttons.length) {
                return;
            }

            var buttonList = Array.prototype.slice.call(buttons);
            var handler = function () {
                ensureKeywordsInitialized();
            };

            buttonList.forEach(function (button) {
                button.addEventListener('click', handler);
            });

            state.footerButtonsBound = true;
            state.footerButtons = buttonList;
            state.footerButtonHandler = handler;
        }

        function setupLazyLoadTriggers(modalElement) {
            attachFooterButtonListeners(modalElement);

            if ('IntersectionObserver' in window) {
                var observer = new window.IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) {
                            ensureKeywordsInitialized();
                        }
                    });
                }, {
                    root: null,
                    rootMargin: '64px 0px'
                });

                observer.observe(input);
                state.visibilityObserver = observer;
            } else {
                var scrollHandler = function () {
                    if (!isElementInViewport(input)) {
                        return;
                    }
                    if (state.initializationPromise) {
                        return;
                    }
                    ensureKeywordsInitialized();
                };

                state.scrollHandler = scrollHandler;
                window.addEventListener('scroll', scrollHandler, true);

                scrollHandler();
            }
        }

        function loadKeywords(responseData, statusElement) {
            var data = responseData && responseData.data ? responseData.data : responseData;
            var filteredData = data;
            var suggestedKeywords = [];

            if (config.rootNodeId) {
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

                var selectedNode = findNodeById(data, config.rootNodeId);
                if (selectedNode) {
                    filteredData = [selectedNode];
                } else {
                    console.error('Root node with ID ' + config.rootNodeId + ' not found in ' + config.jsonFile);
                    hideStatusElement(statusElement);
                    return Promise.reject(new Error('Root node not found.'));
                }
            }

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

            function buildWhitelist(list, parentPath) {
                var currentPath = parentPath || [];
                list.forEach(function (item) {
                    var textToAdd = currentPath.concat(item.text).join(' > ');
                    suggestedKeywords.push({
                        value: textToAdd,
                        id: item.id,
                        scheme: item.scheme,
                        schemeURI: item.schemeURI,
                        language: item.language
                    });

                    if (item.children) {
                        buildWhitelist(item.children, currentPath.concat(item.text));
                    }
                });
            }

            buildWhitelist(filteredData);

            var placeholder = translations?.keywords?.thesaurus?.label || '';
            var thesaurusKeywordstagify = new Tagify(input, {
                whitelist: suggestedKeywords,
                enforceWhitelist: true,
                placeholder: placeholder,
                dropdown: {
                    maxItems: 50,
                    enabled: 3,
                    closeOnSelect: true,
                    classname: "thesaurus-tagify",
                },
                editTags: false,
            });
            input._tagify = thesaurusKeywordstagify;

            if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
                window.applyTagifyAccessibilityAttributes(thesaurusKeywordstagify, input, {
                    placeholder: placeholder
                });
            }

            var processedData = processNodes(filteredData);

            $(config.jsTreeId).off('.thesaurus');
            $(config.jsTreeId).jstree({
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

            $(config.searchInputId).off('.thesaurus');
            $(config.searchInputId).on('input.thesaurus', function () {
                var treeInstance = $(config.jsTreeId).jstree(true);
                if (treeInstance) {
                    treeInstance.search($(this).val());
                }
            });

            function updateSelectedKeywordsList() {
                var selectedKeywordsList = document.getElementById(config.selectedKeywordsListId);
                if (!selectedKeywordsList) return;

                selectedKeywordsList.innerHTML = "";
                var selectedNodes = $(config.jsTreeId).jstree("get_selected", true);

                selectedNodes.forEach(function (node) {
                    var fullPath = $(config.jsTreeId).jstree().get_path(node, " > ");
                    var listItem = document.createElement("li");
                    listItem.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
                    listItem.textContent = fullPath;

                    var removeButton = document.createElement("button");
                    removeButton.classList.add("btn", "btn-sm", "btn-danger");
                    removeButton.innerHTML = "&times;";
                    removeButton.onclick = function () {
                        $(config.jsTreeId).jstree("deselect_node", node.id);
                    };

                    listItem.appendChild(removeButton);
                    selectedKeywordsList.appendChild(listItem);
                });
            }

            $(config.jsTreeId).on("changed.jstree.thesaurus", function (e, data) {
                updateSelectedKeywordsList();

                var selectedNodes = $(config.jsTreeId).jstree("get_selected", true);
                var selectedValues = selectedNodes.map(function (node) {
                    return data.instance.get_path(node, " > ");
                });

                thesaurusKeywordstagify.removeAllTags();
                thesaurusKeywordstagify.addTags(selectedValues);
            });

            thesaurusKeywordstagify.on('add', function (e) {
                var tagText = e.detail?.data?.value;
                if (!tagText) return;
                var jsTree = $(config.jsTreeId).jstree(true);
                if (!jsTree) return;
                var node = findNodeByPath(jsTree, tagText);
                if (node) {
                    jsTree.select_node(node.id);
                }
            });

            thesaurusKeywordstagify.on('remove', function (e) {
                var tagText = e.detail && e.detail.data ? e.detail.data.value : null;
                if (!tagText) return;
                var jsTree = $(config.jsTreeId).jstree(true);
                if (!jsTree) return;
                var node = findNodeByPath(jsTree, tagText);
                if (node) {
                    jsTree.deselect_node(node.id);
                }
            });

            $(config.jsTreeId).one('ready.jstree.thesaurus', function () {
                var jsTree = $(config.jsTreeId).jstree(true);
                if (!jsTree) return;

                var existingTags = Array.isArray(input._tagify?.value) ? input._tagify.value.map(function (tag) {
                    return tag.value;
                }) : [];

                existingTags.forEach(function (value) {
                    var node = findNodeByPath(jsTree, value);
                    if (node) {
                        jsTree.select_node(node.id);
                    }
                });

                updateSelectedKeywordsList();
            });

            function findNodeByPath(jsTree, path) {
                if (!jsTree) return null;
                return jsTree.get_json("#", { flat: true }).find(function (n) {
                    return jsTree.get_path(n, " > ") === path;
                });
            }

            return {
                tagify: thesaurusKeywordstagify,
                suggestedKeywords: suggestedKeywords
            };
        }

        function ensureKeywordsInitialized() {
            if (input._tagify && $(config.jsTreeId).data('jstree')) {
                return Promise.resolve({
                    tagify: input._tagify,
                    jsTree: $(config.jsTreeId).jstree(true)
                });
            }

            var state = keywordInitializationState[config.inputId];
            if (state.initializationPromise) {
                return state.initializationPromise;
            }

            var modalElement = getModalElement(config);
            var statusElement = getOrCreateStatusElement(modalElement);
            updateStatusElement(statusElement, 'loading', resolveMessage('loading'));

            var promise = fetchThesaurusData(config)
                .then(function (response) {
                    return loadKeywords(response, statusElement);
                })
                .then(function (result) {
                    hideStatusElement(statusElement);
                    detachVisibilityTriggers();
                    detachFooterButtonListeners();
                    return result;
                })
                .catch(function (error) {
                    updateStatusElement(statusElement, 'error', resolveMessage('error'));
                    console.error('Failed to initialize thesaurus', config.jsonFile, error);
                    state.initializationPromise = null;
                    input._thesaurusInitPromise = null;
                    throw error;
                });

            state.initializationPromise = promise;
            input._thesaurusInitPromise = promise;

            return promise;
        }

        var modalElement = getModalElement(config);
        if (modalElement) {
            modalElement.addEventListener('show.bs.modal', function () {
                ensureKeywordsInitialized();
            });
        }

        setupLazyLoadTriggers(modalElement);

        input.addEventListener('focus', function () {
            ensureKeywordsInitialized();
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Tab') {
                ensureKeywordsInitialized();
            }
        });

        input._ensureThesaurusInitialized = ensureKeywordsInitialized;
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
