/**
 * @fileOverview This script handles the conditional visibility of reference system fields
 * in the GGMs Technical form group based on mathematical representation selection.
 */

/**
 * @description Calculate and update the radius value from mantissa and exponent
 * 
 * @module ggmstechnical
 */

/**
 * @description Update the label of the second variable value field based on selection
 * 
 * @module ggmstechnical
 */
function updateSecondVariableLabel() {
    const selectedVariable = $('#input-second-variable').val();
    const valueLabel = $('label[for="input-second-variable-value"] span:first-child');
    
    if (!valueLabel.length) return; // Exit if label not found
    
    let labelText = 'Value';
    
    switch (selectedVariable) {
        case 'axis_b':
            labelText = 'Axis b value';
            break;
        case 'flattening':
            labelText = 'Flattening value';
            break;
        case 'reciprocal_flattening':
            labelText = 'Reciprocal flattening value';
            break;
    }
    
    valueLabel.text(labelText);
}

/**
 * @description Handle visibility of error handling approach field based on errors selection
 * 
 * @module ggmstechnical
 */
function updateErrorHandlingVisibility() {
    const errorsValue = $('#input-errors').val();
    const errorHandlingField = $('#input-error-handling-approach').closest('.col-12');
    const errorsField = $('#input-errors').closest('.col-12');
    const errorHandlingInput = $('#input-error-handling-approach');
    
    if (errorsValue === 'calibrated') {
        // Show error handling field and adjust widths
        errorHandlingField.show();
        errorHandlingInput.attr('required', 'required');
        // Adjust errors field to take less space when error handling is visible
        errorsField.removeClass('col-lg-6').addClass('col-lg-2');
    } else {
        // Hide error handling field and adjust widths
        errorHandlingField.hide();
        errorHandlingInput.removeAttr('required');
        // Expand errors field to take more space when error handling is hidden
        errorsField.removeClass('col-lg-2').addClass('col-lg-6');
        // Clear the error handling field value when hidden
        errorHandlingInput.val('').removeClass('is-valid is-invalid');
    }
}

/**
 * @description Handle visibility of spherical vs ellipsoidal reference system fields
 * based on mathematical representation selection
 * 
 * @module ggmstechnical
 */
function updateReferenceSystemVisibility() {
    const mathRepresentation = $('#input-mathematical-representation').val();
    const sphericalFields = $('.visibility-spherical');
    const ellipsoidalFields = $('.visibility-ellipsoidal');
    
    // Hide all fields initially
    sphericalFields.hide();
    ellipsoidalFields.hide();
    
    // Remove required attributes from conditional fields
    $('#input-radius').removeAttr('required');
    $('#input-semimajor-axis').removeAttr('required');
    $('#input-second-variable').removeAttr('required');
    $('#input-second-variable-value').removeAttr('required');
    
    // Clear validation states
    sphericalFields.find('input, select').removeClass('is-invalid is-valid');
    ellipsoidalFields.find('input, select').removeClass('is-invalid is-valid');
    
    // Determine which fields to show
    let showSpherical = false;
    let showEllipsoidal = false;
    
    if (!mathRepresentation || mathRepresentation.trim() === '') {
        // Default: show spherical (radius) when no math representation is selected
        showSpherical = true;
    } else if (mathRepresentation.toLowerCase().includes('spherical')) {
        showSpherical = true;
    } else if (mathRepresentation.toLowerCase().includes('ellipsoidal')) {
        showEllipsoidal = true;
    } else {
        // For any other mathematical representation, default to spherical
        showSpherical = true;
    }
    
    // Show appropriate fields and set requirements
    if (showSpherical) {
        sphericalFields.show();
        $('#input-radius').attr('required', 'required');
    } else if (showEllipsoidal) {
        ellipsoidalFields.show();
        $('#input-semimajor-axis').attr('required', 'required');
        $('#input-second-variable').attr('required', 'required');
        $('#input-second-variable-value').attr('required', 'required');
    }
}

/**
 * @description Real-time validation for GGMs Technical fields
 * 
 * @module ggmstechnical
 */
function checkGGMsTechnical() {
    const container = $('#group-ggmstechnical, #group-ggms-technical');
    
    if (!container.length) return;
    
    // Define technical fields
    const fields = {
        radius: container.find('#input-radius'),
        semimajorAxis: container.find('#input-semimajor-axis'),
        secondVariable: container.find('#input-second-variable'),
        secondVariableValue: container.find('#input-second-variable-value')
    };
    
    // Check if any visible field is filled
    const  s = Object.values(fields).some(field => {
        if (!field.length || !field.is(':visible')) return false;
        const value = field.val();
        return value && value.trim() !== '';
    });
    
    // Update requirements based on visibility and content
    updateReferenceSystemVisibility();
}

// Initialize when document is ready
$(document).ready(function() {
    // validate scientific notation inputs    
    $('.needs-validation').on('submit', function(event) {
        const form = $(this)[0];

        // Check form validity using the native DOM method.
        if (form.checkValidity() === false) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Add the validation class.
        $(this).addClass('was-validated');
    });
    // Set up event handlers
    $(document).on('change', '#input-mathematical-representation', function() {
        updateReferenceSystemVisibility();
        checkGGMsTechnical();
    });
    
    $(document).on('change', '#input-errors', function() {
        updateErrorHandlingVisibility();
    });
    
    $(document).on('change', '#input-second-variable', function() {
        updateSecondVariableLabel();
        checkGGMsTechnical();
    });
    
    // Watch for changes on technical fields
    const technicalFieldsToWatch = [
        '#input-radius',
        '#input-radius-exponent',
        '#input-semimajor-axis',
        '#input-second-variable',
        '#input-second-variable-value'
    ];
    
    $(document).on('change blur', technicalFieldsToWatch.join(', '), function() {
        checkGGMsTechnical();
    });
    
    // Initialize on page load - wait a bit for API data to load
    setTimeout(function() {
        updateReferenceSystemVisibility();
        updateSecondVariableLabel();
        updateErrorHandlingVisibility();
    }, 1000);
    
    // Also listen for when the math representation dropdown is populated
    $(document).on('change', '#input-mathematical-representation', function() {
        setTimeout(updateReferenceSystemVisibility, 100);
    });
    
    // Initial check
    const errorsSelect = $('#input-errors');
    const errorHandlingApproachCol = $('#input-error-handling-approach').closest('.col-12');
    
    // Hide error handling approach field initially if "Choose..." is selected
    if (errorsSelect.val() === 'calibrated') {
        errorHandlingApproachCol.show();
    } else {
        errorHandlingApproachCol.hide();
    }
    
    // Watch for changes on the errors dropdown
    errorsSelect.on('change', function() {
        const errorsValue = $(this).val();
        errorHandlingApproachCol.toggle(errorsValue === 'calibrated');
    });
});

/**
 * @description Initialize technical fields when math representation data is loaded
 * 
 * @module ggmstechnical
 */
function initializeTechnicalFields() {
    updateReferenceSystemVisibility();
    updateSecondVariableLabel();
    updateErrorHandlingVisibility();
}

// Export function for potential use by other modules
window.initializeTechnicalFields = initializeTechnicalFields;