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

    /**
     * The Tagify instance for the Free Keyword input.
     * @type {Tagify}
     */
    var freeKeywordstagify;

    /**
     * Initializes the Tagify instance with a fallback placeholder if translations are not yet loaded.
     *
     * @function initTagify
     * @returns {void}
     */
    function initTagify() {
        // Fallback for the placeholder in case translations.header.on is not yet defined
        var placeholderValue = (
            window.translations &&
            window.translations.header &&
            window.translations.header.on
        )
            ? window.translations.header.on
            : 'Please enter keywords and separate them by a comma.'; // Fallback text

        freeKeywordstagify = new Tagify(input, {
            whitelist: [],
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
     * Updates the Tagify placeholder once translations have been loaded successfully.
     *
     * @function updateTagifyPlaceholder
     * @fires translationsLoaded
     * @returns {void}
     */
    function updateTagifyPlaceholder() {
        if (freeKeywordstagify && freeKeywordstagify.settings) {
            var newPlaceholder = (
                window.translations &&
                window.translations.header &&
                window.translations.header.on
            )
                ? window.translations.header.on
                : freeKeywordstagify.settings.placeholder;

            freeKeywordstagify.settings.placeholder = newPlaceholder;
            // Reflect the new placeholder in the actual input element
            freeKeywordstagify.DOM.input.placeholder = newPlaceholder;
        }
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
                    const whitelist = data.map(item => item.free_keyword);

                    // Update Tagify settings
                    if (typeof freeKeywordstagify !== 'undefined' && freeKeywordstagify.settings) {
                        freeKeywordstagify.settings.whitelist = whitelist;

                        // If the dropdown is open, update the visible suggestions
                        if (freeKeywordstagify.dropdown.visible) {
                            freeKeywordstagify.dropdown.refilter.call(freeKeywordstagify);
                        }
                    } else {
                        console.error('Tagify instance not found or not properly initialized');
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

    // 1) Initialize Tagify with a fallback placeholder
    initTagify();

    /**
     * Event listener for the custom "translationsLoaded" event.
     * This event is dispatched from language.js once the translation JSON is loaded.
     */
    document.addEventListener('translationsLoaded', updateTagifyPlaceholder);

    // 2) Load curated keywords from the API
    loadKeywordsFromAPI();
});
