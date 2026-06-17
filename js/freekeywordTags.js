/**
 * @fileOverview Provides Tagify initialization and management for the "Free Keyword" input.
 * This file listens for the completion of translations loading and updates the Tagify placeholder accordingly.
 * Additionally, it fetches a curated list of keywords from an API and updates the Tagify instance.
 *
 * @requires Tagify
 * @requires jQuery
 * @requires translations - A global object with loaded translation data
 */

document.addEventListener('DOMContentLoaded', function () {
    /**
     * The HTML input element where Tagify is applied.
     * @type {HTMLInputElement}
     */
    var input = document.getElementById('input-freekeyword');
    if (!input) return; // Exit if element doesn't exist

    /**
     * The Tagify instance for the Free Keyword input.
     * @type {Tagify}
     */
    var freeKeywordstagify;

    /**
     * Currently loaded whitelist for keywords
     * @type {Array}
     */
    var currentWhitelist = [];

    /**
     * Gets a nested value from an object using dot notation.
     * 
     * @function getNestedValue
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
     * @function getPlaceholderTranslation
     * @returns {string} The translated placeholder text or fallback text
     */
    function getPlaceholderTranslation() {
        const translationKey = input.getAttribute('data-translate-placeholder');
        return getNestedValue(translations, translationKey) ||
            'Please enter keywords and separate them by a comma.';
    }

    /**
     * Initializes the Tagify instance with current translations.
     *
     * @function initTagify
     * @returns {void}
     */
    function initTagify() {
        const placeholderValue = getPlaceholderTranslation();

        // Create Tagify instance
        freeKeywordstagify = new Tagify(input, {
            whitelist: currentWhitelist,
            placeholder: placeholderValue,
            dropdown: {
                maxItems: 50,
                closeOnSelect: true,
                highlightFirst: false,
                hideOnEmpty: true,
                enabled: 3
            }
        });

        // Assign the Tagify instance explicitly to the input for direct access
        input._tagify = freeKeywordstagify;

        if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
            window.applyTagifyAccessibilityAttributes(freeKeywordstagify, input, {
                placeholder: placeholderValue
            });
        }
    }

    /**
     * Completely refreshes the Tagify instance when translations change.
     * This preserves all tags while updating the placeholder text.
     *
     * @function refreshTagifyInstance
     * @returns {void}
     */
    function refreshTagifyInstance() {
        if (!input._tagify) return;
    
        // Hide the field
        input.style.display = 'none';
    
        // Save current tags
        const currentTags = input._tagify.value || [];
    
        // Update placeholder
        const placeholderValue = getPlaceholderTranslation();
        input._tagify.settings.placeholder = placeholderValue;

        // Update whitelist
        input._tagify.settings.whitelist = currentWhitelist;

        if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
            window.applyTagifyAccessibilityAttributes(input._tagify, input, {
                placeholder: placeholderValue
            });
        }

        // Remove all tags and add the new tags
        input._tagify.removeAllTags();
        input._tagify.addTags(currentTags);
    
        // Show the field again
        input.style.display = 'block';
    }

    /**
     * Fetches curated keywords from an API and updates the Tagify instance's whitelist.
     * In case the dropdown is visible, it triggers a re-filtering.
     *
     * @async
     * @function loadKeywordsFromAPI
     * @returns {void}
     * @throws {Error} Logs error to the console if the API request fails or the data format is invalid
     */
    function loadKeywordsFromAPI() {
        $.ajax({
            url: 'api/v2/vocabs/freekeywords/curated',
            method: 'GET',
            dataType: 'json'
        })
            .done((data) => {
                try {
                    // Validate response data
                    if (!Array.isArray(data)) {
                        console.error('API returned unexpected data format:', data);
                        return;
                    }

                    // Check if the array is empty
                    if (data.length === 0) {
                        return;
                    }

                    // Transform API response to a Tagify-friendly whitelist
                    currentWhitelist = data.map(item => item.free_keyword);

                    // Update Tagify settings if instance exists
                    if (input._tagify && input._tagify.settings) {
                        input._tagify.settings.whitelist = currentWhitelist;

                        // If the dropdown is open, update the visible suggestions
                        if (input._tagify.dropdown.visible) {
                            input._tagify.dropdown.refilter.call(input._tagify);
                        }
                    }
                } catch (error) {
                    console.error('Error processing keyword data:', error);
                }
            })
            .fail(() => {
                // Silently ignore – curated keywords are optional
            });
    }

    /**
     * CSV upload modal elements
     */
    var csvModalElement = document.getElementById('freeKeywordsCsvModal');
    var csvInput = document.getElementById('input-freekeywords-csv');
    var csvDropzone = document.getElementById('freekeywords-csv-dropzone');
    var csvFileName = document.getElementById('freekeywords-csv-filename');
    var csvFeedback = document.getElementById('freekeywords-csv-feedback');
    var confirmCsvButton = document.getElementById('button-confirm-csv-upload');
    var downloadCsvTestFilesButton = document.getElementById('button-download-csv-test-files');

    /**
     * Stores parsed CSV keywords until the user confirms the import
     * @type {Array}
     */
    var parsedCsvKeywords = [];

    /**
     * CSV feedback messages
     */
    var csvMessages = {
        invalidFile: 'Please select a valid CSV file.',
        noKeywords: 'No keywords found in the CSV file.',
        readError: 'The file could not be read.'
    };

    /**
     * Resets all temporary CSV-related state and UI in the modal.
     *
     * @returns {void}
     */
    function resetCsvModalState() {
        parsedCsvKeywords = [];

        if (csvInput) {
            csvInput.value = '';
        }

        if (csvFileName) {
            csvFileName.textContent = '';
        }

        if (csvFeedback) {
            csvFeedback.textContent = '';
            csvFeedback.className = 'mt-2 small';
        }

        if (confirmCsvButton) {
            confirmCsvButton.disabled = true;
        }

        if (csvDropzone) {
            csvDropzone.classList.remove('border-primary');
        }
    }

    /**
     * Parses CSV text into a flat array of keyword strings.
     * Splits on newlines, commas and semicolons and trims whitespace.
     *
     * @param {string} text
     * @returns {Array<string>}
     */
    function parseCsvText(text) {
        return text
            .split(/\r?\n|,|;/)
            .map(function (value) {
                return value.trim();
            })
            .filter(function (value) {
                return value.length > 0;
            });
    }

    /**
     * Sets the feedback message in the modal.
     *
     * @param {string} message
     * @param {boolean} isError
     * @returns {void}
     */
    function setCsvFeedback(message, isError) {
        if (!csvFeedback) {
            return;
        }

        csvFeedback.textContent = message;
        csvFeedback.className = isError
            ? 'mt-2 small text-danger'
            : 'mt-2 small text-success';
    }

    /**
     * Handles a selected or dropped CSV file:
     * - validates the file type
     * - reads it as text
     * - parses keywords
     * - updates UI and enables confirm button
     *
     * @param {File} file
     * @returns {void}
     */
    function handleCsvFile(file) {
        if (!file) {
            resetCsvModalState();
            return;
        }

        if (typeof FileReader === 'undefined') {
            setCsvFeedback(csvMessages.readError, true);
            return;
        }

        var isCsvFile = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';

        if (!isCsvFile) {
            parsedCsvKeywords = [];

            if (confirmCsvButton) {
                confirmCsvButton.disabled = true;
            }

            if (csvFileName) {
                csvFileName.textContent = file.name;
            }

            setCsvFeedback(csvMessages.invalidFile, true);
            return;
        }

        if (csvFileName) {
            csvFileName.textContent = file.name;
        }

        var reader = new FileReader();

        reader.onload = function (event) {
            var text = event.target && typeof event.target.result === 'string'
                ? event.target.result
                : '';

            var parsedKeywords = parseCsvText(text);
            var uniqueKeywords = Array.from(new Set(parsedKeywords));

            parsedCsvKeywords = uniqueKeywords;

            if (parsedCsvKeywords.length === 0) {
                if (confirmCsvButton) {
                    confirmCsvButton.disabled = true;
                }
                setCsvFeedback(csvMessages.noKeywords, true);
                return;
            }

            if (confirmCsvButton) {
                confirmCsvButton.disabled = false;
            }

            setCsvFeedback(parsedCsvKeywords.length + ' keywords ready to import.', false);
        };

        reader.onerror = function () {
            parsedCsvKeywords = [];

            if (confirmCsvButton) {
                confirmCsvButton.disabled = true;
            }

            setCsvFeedback(csvMessages.readError, true);
        };

        reader.readAsText(file);
    }

    // CSV file selection via native file input
    if (csvInput) {
        csvInput.addEventListener('change', function (event) {
            var file = event.target.files && event.target.files[0];
            handleCsvFile(file);
        });
    }

    // CSV drag and drop support
    if (csvDropzone) {
        csvDropzone.addEventListener('dragover', function (event) {
            event.preventDefault();
            csvDropzone.classList.add('border-primary');
        });

        csvDropzone.addEventListener('dragleave', function () {
            csvDropzone.classList.remove('border-primary');
        });

        csvDropzone.addEventListener('drop', function (event) {
            event.preventDefault();
            csvDropzone.classList.remove('border-primary');

            var file = event.dataTransfer && event.dataTransfer.files
                ? event.dataTransfer.files[0]
                : null;

            if (file) {
                handleCsvFile(file);
            }
        });
    }

    // Import parsed CSV keywords into Tagify
    if (confirmCsvButton) {
        confirmCsvButton.addEventListener('click', function () {
            if (!parsedCsvKeywords.length || !input._tagify) {
                return;
            }

            var existingValues = (input._tagify.value || []).map(function (tag) {
                return (tag.value || '').toLowerCase();
            });

            var keywordsToAdd = parsedCsvKeywords.filter(function (keyword) {
                return existingValues.indexOf(keyword.toLowerCase()) === -1;
            });

            if (keywordsToAdd.length) {
                input._tagify.addTags(keywordsToAdd);
            }

            if (csvModalElement && window.bootstrap && window.bootstrap.Modal) {
                bootstrap.Modal.getOrCreateInstance(csvModalElement).hide();
            }
        });
    }

    // Reset CSV modal state after closing
    if (csvModalElement) {
        csvModalElement.addEventListener('hidden.bs.modal', function () {
            resetCsvModalState();
        });
    }

    // Prevent browser from opening dropped files outside the dropzone
    window.addEventListener('dragover', function (event) {
        event.preventDefault();
    });

    window.addEventListener('drop', function (event) {
        event.preventDefault();
    });

    // 1) Initialize Tagify with current translations
    initTagify();

    // 2) Register event listener for translation changes
    if (window.ELMO_FEATURES &&
        window.ELMO_FEATURES.showMslDefaultFreeKeywords === true &&
        window.elmo && window.elmo.isNewRecord === true &&
        input._tagify) {

        input._tagify.addTags([
            { value: 'EPOS' },
            { value: 'multi-scale laboratories' }
        ]);
    }

    document.addEventListener('translationsLoaded', refreshTagifyInstance);

    // 3) Load curated keywords from the API
    loadKeywordsFromAPI();
});