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

    /**
     * Toggles the visibility of density input sections based on the checkbox state.
     */
    const separateDensityCheckbox = $('#checkbox-separate-density');
    const singleDensity = $('#single-density-container');
    const separateDensity = $('#separate-density-container');
    
    function toggleDensityInputs() {
        if (separateDensityCheckbox.is(':checked')) {
            singleDensity.addClass('d-none');
            separateDensity.removeClass('d-none');
        } else {
            singleDensity.removeClass('d-none');
            separateDensity.addClass('d-none');
        }
    }

    // Add event listener for the checkbox
    separateDensityCheckbox.on('change', toggleDensityInputs);

    // Initial check to set the correct visibility on page load
    toggleDensityInputs();
        /**
     * Handles the mutual exclusivity between predefined frequency selection and custom frequency input.
     * Shows/hides and validates the custom input based on checkbox state.
     */
    function setupTemporalFrequencyInputs() {
        // Cache jQuery selectors for better performance
        const $customFrequencyCheckbox = $('#checkbox-custom-frequency');
        const $customFrequencyContainer = $('#custom-frequency-container');
        const $customFrequencyInput = $('#input-temporal-frequency');
        const $predefinedFrequencySelect = $('#select-temporal-frequency-predef');
        
        /**
         * Toggles visibility of custom input based on checkbox state
         */
        function toggleCustomFrequencyInput() {
            if ($customFrequencyCheckbox.is(':checked')) {
                // Enable custom input, disable dropdown
                $customFrequencyContainer.removeClass('d-none');
                $predefinedFrequencySelect.prop('disabled', true).val('');
                $predefinedFrequencySelect.removeClass('is-valid is-invalid');
                $customFrequencyContainer.addClass('required');
                $customFrequencyInput.focus();
            } else {
                // Disable custom input, enable dropdown
                $customFrequencyContainer.addClass('d-none');
                $customFrequencyInput.val('').removeClass('is-valid is-invalid');
                $predefinedFrequencySelect.prop('disabled', false);
                
                // Remove any validation messages
                $customFrequencyContainer.find('.invalid-feedback').remove();
            }
        }
        
        /**
         * Validates that the custom input contains only numeric values
         */
        function validateCustomFrequencyInput() {
            const value = $customFrequencyInput.val();
            const isValid = /^\d*$/.test(value);
            
            if (!isValid && value !== '') {
                $customFrequencyInput.removeClass('is-valid').addClass('is-invalid');
            } else {
                $customFrequencyInput.removeClass('is-invalid');
            }
        }
        
        // Event handlers
        $customFrequencyCheckbox.on('change', toggleCustomFrequencyInput);
        $customFrequencyInput.on('input', validateCustomFrequencyInput);
        $predefinedFrequencySelect.on('change', function() {
            if ($(this).val()) {
                $customFrequencyCheckbox.prop('checked', false);
                toggleCustomFrequencyInput();
            }
        });
        
        // Initialize state
        toggleCustomFrequencyInput();
    }
    
    // Initialize the temporal frequency functionality
    setupTemporalFrequencyInputs();
});