import { visibilityOFF, visibilityON } from '../functions.js';

$(document).ready(function() {
    // VISIBILITY HANDLING
    // First, the whole form group and the contents
    
    const modelType = $('#input-model-type').val();

    function updateGroupHeader() {
        const modelSpecificCard = $('#model-specific-card');
        // Get the CURRENT value from the dropdown every time the function is called.
        const modelType = $('#input-model-type').val();

        // Check if a valid model type is selected.
        // This covers null, undefined, and empty strings ''.
        const modelTypeLower = (modelType || '').toLowerCase();
        const isSpecialType = modelTypeLower === 'altimetry-derived';
        if (modelType && modelTypeLower !== 'choose...' && modelTypeLower !== 'simulated' && !isSpecialType) {
            // If a valid model type is selected (not 'Choose...', 'Simulated', or altimetry-derived), show the card and enable inputs.
            visibilityON(modelSpecificCard);
        } else {
            // Otherwise, hide the card and disable inputs inside.
            visibilityOFF(modelSpecificCard);
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
        visibilityOFF(staticSection);
        visibilityOFF(temporalSection);
        visibilityOFF(topographicSection);

        // If no model type is selected, do nothing further.
        if (!modelType || modelType.trim() === '') {
            return;
        }

        // Check the value and show the relevant section.
        const modelTypeLower = modelType.toLowerCase();

        if (modelTypeLower === 'static') {
            visibilityON(staticSection);
        } else if (modelTypeLower === 'temporal') {
            visibilityON(temporalSection);
        } else if (modelTypeLower === 'topographic') {
            visibilityON(topographicSection);
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
            visibilityOFF(singleDensity);
            visibilityON(separateDensity);
        } else {
            visibilityON(singleDensity);
            visibilityOFF(separateDensity);
        }
    }
    // Add event listener for the checkbox
    separateDensityCheckbox.on('change', toggleDensityInputs);
    // Initial check to set the correct visibility on page load
    toggleDensityInputs();

    // RELEASE FREQUENCY CHECKBOX AND CONTENT HANDLING
    /**
     * Handles mutual exclusivity between predefined release-frequency selection
     * and the custom days input. Shows/hides and validates based on checkbox state.
     */
    function setupReleaseFrequencyInputs() {
        const $customFrequencyCheckbox = $('#checkbox-custom-frequency');
        const $customFrequencyContainer = $('#custom-frequency-container');
        const $customFrequencyInput = $('#input-temporal-frequency');
        const $releaseFrequencySelect = $('#select-release-frequency');

        function toggleCustomFrequencyInput() {
            if ($customFrequencyCheckbox.is(':checked')) {
                visibilityON($customFrequencyContainer);
                $releaseFrequencySelect.prop('disabled', true).val('');
                $releaseFrequencySelect.removeClass('is-valid is-invalid');
                $customFrequencyContainer.addClass('required');
                $customFrequencyInput.focus();
            } else {
                visibilityOFF($customFrequencyContainer);
                $customFrequencyInput.val('').removeClass('is-valid is-invalid');
                $releaseFrequencySelect.prop('disabled', false);
                $customFrequencyContainer.find('.invalid-feedback').remove();
            }
        }

        $customFrequencyCheckbox.on('change', toggleCustomFrequencyInput);
        $releaseFrequencySelect.on('change', function() {
            if ($(this).val()) {
                $customFrequencyCheckbox.prop('checked', false);
                toggleCustomFrequencyInput();
            }
        });

        toggleCustomFrequencyInput();
    }
    setupReleaseFrequencyInputs();

    // TIME VARIABLE CHECKBOX HANDLING
    const timeVariableCheckbox = document.getElementById('checkbox-time-variable');
    const descriptionContainer = document.getElementById('time-variable-description-container');

    if (timeVariableCheckbox && descriptionContainer) {
        timeVariableCheckbox.addEventListener('change', function () {
            if (this.checked) {
                visibilityON(descriptionContainer);
            } else {
                visibilityOFF(descriptionContainer);
            }
        });
    }
});