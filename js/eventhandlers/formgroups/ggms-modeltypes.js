$(document).ready(function() {
    // VISIBILITY HANDLING
    // First, the whole form group and the contents
    
    const modelType = $('#input-model-type').val();

    function updateGroupHeader() {
        const modelSpecificCard = $('#model-specific-card');
        // Check if the selected value is not empty
        if (modelType !== 'Choose...' && modelType.trim() !== '') {
            // If a model type is selected, show the card
            modelSpecificCard.removeClass('d-none');
        } else {
            // Otherwise, hide the card
            modelSpecificCard.addClass('d-none');
        }
    };
    
    /* Handles the conditional visibility of form sections based on the 'Model Type' selection.
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

        if (modelTypeLower === 'static') {
            staticSection.removeClass('d-none');
        } else if (modelTypeLower === 'temporal') {
            temporalSection.removeClass('d-none');
        } else if (modelTypeLower === 'topographic') {
            topographicSection.removeClass('d-none');
        }
        
    // Update the help button's data-help-section-id
        const helpButton = $('#model-specific-card .bi-question-circle-fill');
        helpButton.removeAttr('data-help-section-id');

        let helpSectionId = 'help-no-model-type'; // Default fallback
        if (modelTypeLower === 'static') {
            helpSectionId = 'help-static';
        } else if (modelTypeLower === 'temporal') {
            helpSectionId = 'help-temporal';
        } else if (modelTypeLower === 'topographic') {
            helpSectionId = 'help-topographic';
        }
        helpButton.attr('data-help-section-id', helpSectionId);
    }

    // Set up an event handler to listen for changes on the 'Model Type' dropdown.
    // Using event delegation on the document to handle dynamically added elements.
    $(document).on('change', '#input-model-type', function() {
        updateGroupHeader();
        updateModelTypeVisibility();
    });


    const modelTypeSelect = document.getElementById('input-model-type');

    if (modelTypeSelect) {
        // Define an observer to watch for when <option>s are added to the select.
        const observer = new MutationObserver(function(mutationsList, observer) {
            // Once options are added, run our visibility checks.
            updateGroupHeader();
            updateModelTypeVisibility();
            // We only need this to run once, so disconnect the observer after it fires.
            observer.disconnect();
        });

        // Start observing the select element for changes to its child nodes.
        observer.observe(modelTypeSelect, { childList: true });
    }
    // Initial call to set the correct visibility on page load.
    updateGroupHeader();
    updateModelTypeVisibility();


    // SEPARATE DENSITY FOR CRUST AND MANTLE
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

    // TEMPORAL FREQUENCY CHECKBOX AND CONTENT HANDLING
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
        
        // Event handlers
        $customFrequencyCheckbox.on('change', toggleCustomFrequencyInput);
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

    // TIME VARIABLE CHECKBOX HANDLING
    const timeVariableCheckbox = document.getElementById('checkbox-time-variable');
    const descriptionContainer = document.getElementById('time-variable-description-container');

    if (timeVariableCheckbox && descriptionContainer) {
        timeVariableCheckbox.addEventListener('change', function () {
            if (this.checked) {
                descriptionContainer.classList.remove('d-none');
                descriptionContainer.setAttribute('aria-hidden', 'false');
            } else {
                descriptionContainer.classList.add('d-none');
                descriptionContainer.setAttribute('aria-hidden', 'true');
            }
        });
    }
});