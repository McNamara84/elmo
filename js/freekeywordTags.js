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
        return getNestedValue(window.translations, translationKey) ||
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

        // Store current tags and whitelist
        const currentTags = input._tagify.value || [];

        // Destroy current instance
        input._tagify.destroy();

        // Reinitialize with current translations
        initTagify();

        // Restore tags
        if (currentTags.length > 0) {
            setTimeout(() => {
                if (input._tagify) {
                    input._tagify.addTags(currentTags);
                }
            }, 50);
        }

        // Log completion for debugging
        console.log("Free keyword Tagify refreshed with new translations");
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
            .fail((jqXHR, textStatus, errorThrown) => {
                console.error('Failed to fetch keywords:', {
                    status: jqXHR.status,
                    statusText: jqXHR.statusText,
                    responseText: jqXHR.responseText,
                    error: errorThrown
                });
            });
    }

    // 1) Initialize Tagify with current translations
    initTagify();

    // 2) Register event listener for translation changes
    document.addEventListener('translationsLoaded', refreshTagifyInstance);

    // 3) Load curated keywords from the API
    loadKeywordsFromAPI();
});
