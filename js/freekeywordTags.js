document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('input-freekeyword');

    // Tagify-Instanz erstellen
    var tagify = new Tagify(input, {
        whitelist: [],
        dropdown: {
            maxItems: 50,
            closeOnSelect: true,
            highlightFirst: false,
            hideOnEmpty: true,
            enabled: 3,
        }
    });
            // Explicitly assign the instance to input._tagify
            input._tagify = tagify;
    /**
    * Loads curated keywords from the API and updates the Tagify whitelist
    * 
    * This function fetches curated keywords from the API and updates the whitelist
    * of an existing Tagify instance. The whitelist is used for tag suggestions
    * and validation.
    * 
    * @requires jQuery
    * @requires Tagify - Must have a global tagify instance already initialized
    * 
    * @example
    * // Initialize Tagify first
    * const tagify = new Tagify(element, options);
    * // Then load keywords
    * loadKeywordsFromAPI();
    * 
    * @throws {Error} Logs error to console if API request fails
    * @returns {void}
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

                    // Transform API response to Tagify whitelist format
                    const whitelist = data.map(item => item.free_keyword);

                    // Update Tagify settings
                    if (typeof tagify !== 'undefined' && tagify.settings) {
                        tagify.settings.whitelist = whitelist;

                        // Optional: Update dropdown with new whitelist if it's open
                        if (tagify.dropdown.visible) {
                            tagify.dropdown.refilter.call(tagify);
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

    loadKeywordsFromAPI();
});