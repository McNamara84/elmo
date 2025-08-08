/**
 * @fileOverview This script handles the conditional visibility of reference system fields
 * in the GGMs Technical form group based on mathematical representation selection.
 */

/**
 * @description Calculate and update the radius value from mantissa and exponent
 * 
 * @module ggmstechnical
 */
function updateRadiusValue() {
    const mantissa = parseFloat($('#input-radius-mantissa').val()) || 0;
    const exponent = parseInt($('#input-radius-exponent').val()) || 6;
    
    // Calculate the actual value
    const actualValue = mantissa * Math.pow(10, exponent);
    
    // Update the hidden field (this is what gets submitted)
    $('#input-radius').val(actualValue);
    
    // Update the display
    $('#radius-display').text(actualValue.toLocaleString());
    
    // Validate the mantissa field based on the calculated value
    const mantissaField = $('#input-radius-mantissa');
    if (mantissa > 0) {
        mantissaField.removeClass('is-invalid').addClass('is-valid');
    } else {
        mantissaField.removeClass('is-valid');
    }
}

/**
 * @description Handle power adjustment buttons for exponent only
 * 
 * @module ggmstechnical
 */
function setupRadiusPowerControls() {
    // Power up button - use the correct ID from HTML
    $('#exponent-power-up').on('click', function(e) {
        e.preventDefault();
        const exponentField = $('#input-radius-exponent');
        const currentValue = parseInt(exponentField.val()) || 6;
        const newValue = Math.min(currentValue + 1, 10); // Max 10
        exponentField.val(newValue);
        updateRadiusValue();
    });
    
    // Power down button - use the correct ID from HTML
    $('#exponent-power-down').on('click', function(e) {
        e.preventDefault();
        const exponentField = $('#input-radius-exponent');
        const currentValue = parseInt(exponentField.val()) || 6;
        const newValue = Math.max(currentValue - 1, -10); // Min -10
        exponentField.val(newValue);
        updateRadiusValue();
    });
    
    // Handle direct input changes
    $('#input-radius-mantissa, #input-radius-exponent').on('input change', function() {
        updateRadiusValue();
    });
    
    // Initial calculation
    updateRadiusValue();
}

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
    $('#input-radius-mantissa').removeAttr('required');
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
        $('#input-radius-mantissa').attr('required', 'required');
        // Set up power controls when showing spherical fields
        setTimeout(setupRadiusPowerControls, 100);
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
        radiusMantissa: container.find('#input-radius-mantissa'),
        semimajorAxis: container.find('#input-semimajor-axis'),
        secondVariable: container.find('#input-second-variable'),
        secondVariableValue: container.find('#input-second-variable-value')
    };
    
    // Check if any visible field is filled
    const isAnyFieldFilled = Object.values(fields).some(field => {
        if (!field.length || !field.is(':visible')) return false;
        const value = field.val();
        return value && value.trim() !== '';
    });
    
    // Update requirements based on visibility and content
    updateReferenceSystemVisibility();
}

// Initialize when document is ready
$(document).ready(function() {
    // Set up event handlers
    $(document).on('change', '#input-mathematical-representation', function() {
        updateReferenceSystemVisibility();
        checkGGMsTechnical();
    });
    
    $(document).on('change', '#input-second-variable', function() {
        updateSecondVariableLabel();
        checkGGMsTechnical();
    });
    
    // Watch for changes on technical fields
    const technicalFieldsToWatch = [
        '#input-radius-mantissa',
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
    }, 1000);
    
    // Also listen for when the math representation dropdown is populated
    $(document).on('change', '#input-mathematical-representation', function() {
        setTimeout(updateReferenceSystemVisibility, 100);
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
}

// Export function for potential use by other modules
window.initializeTechnicalFields = initializeTechnicalFields;