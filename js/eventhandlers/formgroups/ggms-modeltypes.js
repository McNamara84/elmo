$(document).ready(function() {

    /**
     * Handles the conditional visibility of form sections based on the 'Model Type' selection.
     * It shows or hides sections for static, temporal, or topographic models.
     */
    function updateModelTypeVisibility() {
        // Get the selected model type value. Using a class selector for better reusability.
        const modelType = $('#input-model-type').val();

        // Find the form sections related to model types.
        const staticSection = $('.visibility-modeltype-static');
        const temporalSection = $('.visibility-modeltype-temporal');
        const topographicSection = $('.visibility-modeltype-topographic');

        // Hide all sections by default.
        staticSection.addClass('d-none');
        temporalSection.addClass('d-none');
        topographicSection.addClass('d-none');

        // If no model type is selected, do nothing further.
        if (!modelType || modelType.trim() === '') {
            return;
        }

        // Check the value and show the relevant section.
        const modelTypeLower = modelType.toLowerCase();

        if (modelTypeLower.includes('static')) {
            staticSection.removeClass('d-none');
        } else if (modelTypeLower.includes('temporal')) {
            temporalSection.removeClass('d-none');
        } else if (modelTypeLower.includes('topographic')) {
            topographicSection.removeClass('d-none');
        }
    }

    // Set up an event handler to listen for changes on the 'Model Type' dropdown.
    // Using event delegation on the document to handle dynamically added elements.
    $(document).on('change', '#input-model-type', function() {
        updateModelTypeVisibility();
    });

    // Also run the function on page load in case a value is already selected.
    // A small delay can help ensure that dropdowns populated by APIs are ready.
    setTimeout(function() {
        updateModelTypeVisibility();
    }, 500);

});