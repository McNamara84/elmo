/**
 * @fileOverview Provides Tagify initialization and management for the "Used Instruments" input.
 * Instruments are fetched from the ERNIE PID4INST API and displayed as autocomplete suggestions.
 * Selected instruments are stored as hidden inputs with their PIDs and PID types.
 * 
 * Display format: "Name (InstrumentType1, InstrumentType2)"
 * Storage: Each instrument creates hidden inputs for instrumentPid[] and instrumentPidType[].
 * DataCite mapping: relatedIdentifier with relationType="IsCollectedBy"
 *
 * @requires Tagify
 * @requires jQuery
 * @requires translations - A global object with loaded translation data
 */

/**
 * Main initialization function for the Used Instruments module.
 * Extracted from DOMContentLoaded listener to support both regular page load
 * and scenarios where the script loads after DOMContentLoaded has already fired
 * (e.g. Playwright route interception, dynamic script injection).
 */
function initUsedInstrumentsModule() {
    // Only initialize if the feature is enabled
    if (!window.ELMO_FEATURES || !window.ELMO_FEATURES.showUsedInstruments) {
        return;
    }

    /**
     * The HTML input element where Tagify is applied.
     * @type {HTMLInputElement|null}
     */
    var input = document.getElementById('input-usedinstruments');
    if (!input) return;

    /**
     * The Tagify instance for the Used Instruments input.
     * @type {Tagify|null}
     */
    var instrumentsTagify = null;

    /**
     * Full instrument data from ERNIE API for lookup.
     * @type {Array<{pid: string, pidType: string, name: string, instrumentTypes: string[]}>}
     */
    var instrumentData = [];

    /**
     * Whether instrument data has been loaded from the API.
     * @type {boolean}
     */
    var dataLoaded = false;

    /**
     * Whether a load request is currently in progress.
     * @type {boolean}
     */
    var loadInProgress = false;

    /**
     * Promise for the current or completed load operation.
     * @type {Promise<void>|null}
     */
    var loadPromise = null;

    /**
     * Gets a nested value from an object using dot notation.
     * 
     * @param {Object} obj - The object to search within
     * @param {string} path - The dot-notation path to the desired property
     * @returns {*} The value at the specified path or undefined if not found
     */
    function getNestedValue(obj, path) {
        return path ? path.split('.').reduce((prev, curr) => prev && prev[curr], obj) : undefined;
    }

    /**
     * Gets the current translation for the placeholder or falls back to default text.
     * 
     * @returns {string} The translated placeholder text
     */
    function getPlaceholderTranslation() {
        const translationKey = input.getAttribute('data-translate-placeholder');
        return getNestedValue(window.translations, translationKey) ||
            'Search and select instruments...';
    }

    /**
     * Formats an instrument for display in the Tagify dropdown and tag.
     * Format: "Name (Type1, Type2)" or just "Name" if no types.
     * 
     * @param {{name: string, instrumentTypes: string[]}} instrument - The instrument data
     * @returns {string} Formatted display value
     */
    function formatInstrumentDisplay(instrument) {
        var name = instrument.name || '';
        var types = instrument.instrumentTypes || [];
        if (types.length > 0) {
            return name + ' (' + types.join(', ') + ')';
        }
        return name;
    }

    /**
     * Builds the Tagify whitelist from loaded instrument data.
     * Each whitelist entry contains: value (display string), pid, pidType, name, instrumentTypes
     * 
     * @returns {Array<{value: string, pid: string, pidType: string, name: string, instrumentTypes: string[]}>}
     */
    function buildWhitelist() {
        return instrumentData.map(function (item) {
            return {
                value: formatInstrumentDisplay(item),
                pid: item.pid,
                pidType: item.pidType,
                name: item.name,
                instrumentTypes: item.instrumentTypes || []
            };
        });
    }

    /**
     * Updates hidden input fields to reflect the currently selected instruments.
     * Creates hidden inputs for instrumentPid[] and instrumentPidType[] for each tag.
     */
    function updateHiddenInputs() {
        var container = document.getElementById('usedinstruments-hidden-inputs');
        if (!container) return;

        // Clear existing hidden inputs
        container.innerHTML = '';

        if (!instrumentsTagify) return;

        var tags = instrumentsTagify.value || [];
        tags.forEach(function (tag) {
            // Create hidden input for PID
            var pidInput = document.createElement('input');
            pidInput.type = 'hidden';
            pidInput.name = 'instrumentPid[]';
            pidInput.value = tag.pid || '';
            container.appendChild(pidInput);

            // Create hidden input for PID type
            var pidTypeInput = document.createElement('input');
            pidTypeInput.type = 'hidden';
            pidTypeInput.name = 'instrumentPidType[]';
            pidTypeInput.value = tag.pidType || 'Handle';
            container.appendChild(pidTypeInput);
        });
    }

    /**
     * Initializes the Tagify instance with current translations.
     */
    function initTagify() {
        var placeholderValue = getPlaceholderTranslation();

        instrumentsTagify = new Tagify(input, {
            whitelist: buildWhitelist(),
            placeholder: placeholderValue,
            enforceWhitelist: true,
            dropdown: {
                maxItems: 50,
                closeOnSelect: true,
                highlightFirst: true,
                enabled: 1,
                searchKeys: ['value', 'name']
            },
            editTags: false,
            // Custom template for dropdown suggestions
            templates: {
                dropdownItem: function (item) {
                    return '<div ' + this.getAttributes(item) +
                        ' class="' + this.settings.classNames.dropdownItem + '" tabindex="0" role="option">' +
                        '<strong>' + (item.name || item.value) + '</strong>' +
                        (item.instrumentTypes && item.instrumentTypes.length > 0
                            ? '<br><small style="color: var(--bs-secondary-color)">' + item.instrumentTypes.join(', ') + '</small>'
                            : '') +
                        '</div>';
                }
            }
        });

        // Assign Tagify instance to input for external access (e.g. clear.js)
        input._tagify = instrumentsTagify;

        // Event: When tags are added or removed, update hidden inputs
        instrumentsTagify.on('add', updateHiddenInputs);
        instrumentsTagify.on('remove', updateHiddenInputs);

        // Event: Lazy load data when user focuses on input
        instrumentsTagify.on('focus', function () {
            if (!dataLoaded && !loadInProgress) {
                loadInstrumentsFromAPI();
            }
        });

        // Apply accessibility attributes if available
        if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
            window.applyTagifyAccessibilityAttributes(instrumentsTagify, input, {
                placeholder: placeholderValue
            });
        }
    }

    /**
     * Refreshes the Tagify instance when translations change.
     * Preserves all tags while updating the placeholder text.
     */
    function refreshTagifyInstance() {
        if (!input._tagify) return;

        // Save current tags
        var currentTags = input._tagify.value || [];

        // Update placeholder
        var placeholderValue = getPlaceholderTranslation();
        input._tagify.settings.placeholder = placeholderValue;

        if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
            window.applyTagifyAccessibilityAttributes(input._tagify, input, {
                placeholder: placeholderValue
            });
        }

        // Restore tags
        input._tagify.removeAllTags();
        if (currentTags.length > 0) {
            input._tagify.addTags(currentTags);
        }
    }

    /**
     * Fetches PID4INST instruments from the API and updates the Tagify whitelist.
     * Uses lazy loading - only called when user first interacts with the field.
     * Always resolves (never rejects) so callers don't need error handling.
     * If data is already loaded, resolves immediately.
     * 
     * @returns {Promise<{success: boolean, dataLoaded: boolean}>}
     */
    function loadInstrumentsFromAPI() {
        // If data is already loaded, resolve immediately
        if (dataLoaded) {
            return Promise.resolve({ success: true, dataLoaded: true });
        }

        // If a load is already in progress, return the existing promise
        if (loadInProgress && loadPromise) {
            return loadPromise;
        }

        loadInProgress = true;

        // Show loading indicator in dropdown
        if (instrumentsTagify) {
            instrumentsTagify.loading(true);
        }

        loadPromise = new Promise(function (resolve) {
            $.ajax({
                url: 'api/v2/vocabs/pid4inst/instruments',
                method: 'GET',
                dataType: 'json',
                timeout: 30000
            })
                .done(function (data) {
                    try {
                        if (!Array.isArray(data)) {
                            console.error('PID4INST API returned unexpected data format:', data);
                            resolve({ success: false, dataLoaded: false });
                            return;
                        }

                        if (data.length === 0) {
                            console.log('No PID4INST instruments available.');
                            resolve({ success: true, dataLoaded: false });
                            return;
                        }

                        // Store full instrument data
                        instrumentData = data;
                        dataLoaded = true;

                        // Update Tagify whitelist while preserving existing tags
                        if (instrumentsTagify) {
                            var existingTags = instrumentsTagify.value || [];
                            var whitelist = buildWhitelist();

                            // Re-add any existing tags that might not be in the API whitelist
                            existingTags.forEach(function (tag) {
                                var exists = whitelist.some(function (w) { return w.pid === tag.pid; });
                                if (!exists) {
                                    whitelist.push(tag);
                                }
                            });

                            instrumentsTagify.settings.whitelist = whitelist;
                            instrumentsTagify.whitelist = whitelist;

                            // If the dropdown is open, refilter
                            if (instrumentsTagify.dropdown.visible) {
                                instrumentsTagify.dropdown.refilter.call(instrumentsTagify);
                            }
                        }
                        resolve({ success: true, dataLoaded: true });
                    } catch (error) {
                        console.error('Error processing PID4INST instrument data:', error);
                        resolve({ success: false, dataLoaded: false });
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    console.warn('Failed to fetch PID4INST instruments:', {
                        status: jqXHR.status,
                        statusText: jqXHR.statusText,
                        error: errorThrown
                    });
                    resolve({ success: false, dataLoaded: false });
                })
                .always(function () {
                    loadInProgress = false;
                    if (instrumentsTagify) {
                        instrumentsTagify.loading(false);
                    }
                });
        });

        return loadPromise;
    }

    /**
     * Adds instruments programmatically (used by XML import).
     * Each instrument object must have: pid, pidType, name, instrumentTypes
     * 
     * @param {Array<{pid: string, pidType: string, name: string, instrumentTypes: string[]}>} instruments
     */
    function addInstrumentsByData(instruments) {
        if (!instrumentsTagify || !Array.isArray(instruments)) return;

        var tags = instruments.map(function (inst) {
            return {
                value: formatInstrumentDisplay(inst),
                pid: inst.pid,
                pidType: inst.pidType || 'Handle',
                name: inst.name || '',
                instrumentTypes: inst.instrumentTypes || []
            };
        });

        // Ensure tags are in the whitelist so enforceWhitelist doesn't reject them
        var currentWhitelist = instrumentsTagify.settings.whitelist || [];
        tags.forEach(function (tag) {
            var exists = currentWhitelist.some(function (w) { return w.pid === tag.pid; });
            if (!exists) {
                currentWhitelist.push(tag);
            }
        });
        instrumentsTagify.settings.whitelist = currentWhitelist;
        instrumentsTagify.whitelist = currentWhitelist;

        instrumentsTagify.addTags(tags);

        // Explicitly update hidden inputs in case Tagify add event is async
        updateHiddenInputs();
    }

    /**
     * Looks up instruments by their PIDs in the loaded API data and adds
     * the matched ones as Tagify tags with full metadata (name, types).
     * For PIDs not found in the API data, PID-only fallback tags are added
     * so that imported metadata is never silently lost.
     * 
     * @param {Array<{pid: string, pidType: string}>} pidList - PIDs to look up and add
     */
    function addInstrumentsByPid(pidList) {
        if (!instrumentsTagify || !Array.isArray(pidList) || pidList.length === 0) return;

        var instrumentsToAdd = [];
        pidList.forEach(function (entry) {
            var found = instrumentData.find(function (apiInst) {
                return apiInst.pid === entry.pid;
            });
            if (found) {
                instrumentsToAdd.push({
                    pid: found.pid,
                    pidType: found.pidType || entry.pidType || 'Handle',
                    name: found.name,
                    instrumentTypes: found.instrumentTypes || []
                });
            } else {
                // Fallback: add PID-only tag so imported data is not lost
                instrumentsToAdd.push({
                    pid: entry.pid,
                    pidType: entry.pidType || 'Handle',
                    name: entry.pid,
                    instrumentTypes: []
                });
            }
        });

        if (instrumentsToAdd.length > 0) {
            addInstrumentsByData(instrumentsToAdd);
        }
    }

    /**
     * Gets PIDs of all currently selected instruments.
     * 
     * @returns {Array<{pid: string, pidType: string}>}
     */
    function getSelectedInstruments() {
        if (!instrumentsTagify) return [];
        return (instrumentsTagify.value || []).map(function (tag) {
            return { pid: tag.pid, pidType: tag.pidType };
        });
    }

    // ==================== Initialization ====================

    // 1) Initialize Tagify with current translations
    initTagify();

    // 2) Register event listener for translation changes
    document.addEventListener('translationsLoaded', refreshTagifyInstance);

    // Expose API for XML import and other modules
    window.usedInstrumentsModule = {
        addInstrumentsByData: addInstrumentsByData,
        addInstrumentsByPid: addInstrumentsByPid,
        getSelectedInstruments: getSelectedInstruments,
        loadInstrumentsFromAPI: loadInstrumentsFromAPI
    };
}

// Initialize: handle both "script loaded before DOMContentLoaded" and
// "script loaded after DOMContentLoaded" (e.g. Playwright route interception)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUsedInstrumentsModule);
} else {
    initUsedInstrumentsModule();
}
