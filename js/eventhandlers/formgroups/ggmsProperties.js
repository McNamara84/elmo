import { parseGfcFiles, extractSections, parseRecords } from '../../fileUpload.js';

const GFC_UPLOAD_ERROR = 'Please upload a .gfc file or paste the header text into the free text field.';

function translateWithFallback(key, fallback) {
    const translate = (window.elmo && typeof window.elmo.translate === 'function')
        ? window.elmo.translate
        : null;
    return (translate && translate(key)) || fallback;
}
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
        errorHandlingField.show().attr('aria-hidden', 'false');
        errorHandlingInput.attr("required", "");
        errorHandlingInput.attr("pattern", ".*\\S.*"); // disallow only spaces input
        // Adjust errors field to take less space when error handling is visible
        errorsField.removeClass('col-lg-6').addClass('col-lg-2');
    } else {
        // Hide error handling field and adjust widths
        errorHandlingField.hide().attr('aria-hidden', 'true');
        errorHandlingInput.removeAttr('required');
        errorHandlingInput.removeAttr('pattern');
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
    sphericalFields.hide().attr('aria-hidden', 'true');
    ellipsoidalFields.hide().attr('aria-hidden', 'true');
    
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
    } else if (mathRepresentation.toLowerCase() === 'spherical harmonics') {
        showSpherical = true;
    } else if (mathRepresentation.toLowerCase() === 'ellipsoidal harmonics') {
        showEllipsoidal = true;
    } else {
        // For any other mathematical representation, default to spherical
        showSpherical = true;
    }
    
    // Show appropriate fields and set requirements
    if (showSpherical) {
        sphericalFields.show().attr('aria-hidden', 'false');
        $('#input-radius').attr('required', 'required');
    } else if (showEllipsoidal) {
        ellipsoidalFields.show().attr('aria-hidden', 'false');
        $('#input-semimajor-axis').attr('required', 'required');
        $('#input-second-variable').attr('required', 'required');
        $('#input-second-variable-value').attr('required', 'required');
    }
}


// FUNCTIONALITY FOR AUTO POPULATING this form group from a file or text

/** @param {File} file @returns {Promise<Object>} Parsed GFC header key/value map */
async function getHeaderFromFile(file) {
    try {
        const parsedData = await parseGfcFiles(file);
        return parsedData.header;
    } catch (error) {
        console.error("Error parsing GFC file:", error);
        throw error;
    }
}

/** @param {string} text @returns {Promise<Object>} Parsed GFC header key/value map */
async function getHeaderFromText(text) {
    try {
        const lines = text.split(/\r?\n/);
        const { headerLines } = extractSections(lines);
        return parseRecords(headerLines);
    } catch (error) {
        console.error("Error parsing GFC text:", error);
        throw error;
    }
}

/**
 * Merges headers from file and pasted text. Text keys overwrite file keys.
 * @param {File|null|undefined} file
 * @param {string} text
 * @returns {Promise<Object>}
 */
async function mergeGfcHeaders(file, text) {
    let header = {};
    if (file) {
        header = await getHeaderFromFile(file);
    }
    if (text) {
        header = { ...header, ...(await getHeaderFromText(text)) };
    }
    return header;
}

function showGfcUploadStatusError() {
    const message = translateWithFallback('modals.gfcUpload.errorNoInput', GFC_UPLOAD_ERROR);
    $('#ggms-gfc-upload-status').removeClass('d-none').addClass('alert alert-danger').text(message);
}

function clearGfcUploadStatus() {
    $('#ggms-gfc-upload-status').addClass('d-none').removeClass('alert alert-danger').text('');
}

function setSelectedGfcFilename(file) {
    $('#ggms-gfc-selected-filename').text(file ? file.name : '');
}

function hideGfcUploadModal() {
    const modalElement = document.getElementById('modal-ggms-gfc-upload');
    if (modalElement && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
    }
}

function handleSelectedGfcFile(file) {
    const gfcFileInput = $('#input-ggms-gfc-file');

    if (!file) {
        setSelectedGfcFilename(null);
        return;
    }

    if (!file.name.toLowerCase().endsWith('.gfc')) {
        gfcFileInput.val('');
        setSelectedGfcFilename(null);
        showGfcUploadStatusError();
        return;
    }

    clearGfcUploadStatus();
    setSelectedGfcFilename(file);
}

function initGfcUploadHandlers() {
    $(document).on('click', '#button-ggms-gfc-fill-metadata', async function () {
        const gfcFileInput = $('#input-ggms-gfc-file');
        const file = gfcFileInput[0]?.files?.[0];
        const text = $('#textarea-ggms-gfc-header-text').val().trim();

        if (file && !file.name.toLowerCase().endsWith('.gfc')) {
            showGfcUploadStatusError();
            return;
        }

        if (!file && !text) {
            showGfcUploadStatusError();
            return;
        }

        clearGfcUploadStatus();

        try {
            const header = await mergeGfcHeaders(file, text);
            populateParsedFields(header);
            hideGfcUploadModal();
        } catch (error) {
            console.error('Error filling metadata from GFC:', error);
            showGfcUploadStatusError();
        }
    });

    $(document).on('dragover', '#panel-ggms-gfc-dropfile', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $('#panel-ggms-gfc-dropfile').addClass('border-primary');
    });

    $(document).on('dragleave', '#panel-ggms-gfc-dropfile', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $('#panel-ggms-gfc-dropfile').removeClass('border-primary');
    });

    $(document).on('drop', '#panel-ggms-gfc-dropfile', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $('#panel-ggms-gfc-dropfile').removeClass('border-primary');

        const dataTransfer = event.originalEvent?.dataTransfer;
        const file = dataTransfer?.files?.[0];
        if (!file) {
            return;
        }

        if (!file.name.toLowerCase().endsWith('.gfc')) {
            showGfcUploadStatusError();
            return;
        }

        const gfcFileInput = $('#input-ggms-gfc-file')[0];
        if (gfcFileInput) {
            const dataTransferForInput = new DataTransfer();
            dataTransferForInput.items.add(file);
            gfcFileInput.files = dataTransferForInput.files;
        }
        handleSelectedGfcFile(file);
    });

    $(document).on('change', '#input-ggms-gfc-file', function () {
        const file = this.files?.[0] || null;
        handleSelectedGfcFile(file);
    });

    $(document).on('hidden.bs.modal', '#modal-ggms-gfc-upload', function () {
        $('#input-ggms-gfc-file').val('');
        setSelectedGfcFilename(null);
        $('#textarea-ggms-gfc-header-text').val('');
        clearGfcUploadStatus();
        $('#panel-ggms-gfc-dropfile').removeClass('border-primary');
    });
}

/**
 * Fills GGMs Properties inputs from a parsed GFC header map.
 *
 * Header keyword             → Form field
 * --------------------------   --------------------------------
 * tide_system                → #input-tide-system
 *                              (zero_tide|tide_free|mean_tide,
 *                               hyphens or underscores)
 * max_degree | degree        → #input-degree
 * errors                     → #input-errors
 *                              (n/a ignored;
 *                               calibrated_and_formal → calibrated)
 * radius                     → #input-radius
 * earth_gravity_constant     → #input-earth-gravity-constant
 *
 * Not mapped here: product_type, modelname, format, norm,
 * begin_of_head / end_of_head (section markers only).
 *
 * @param {Object} dict Parsed GFC header key/value map
 */
async function populateParsedFields(dict) {
    if (dict.tide_system) {
        const tideMap = { zero_tide: 'Zero-tide', tide_free: 'Tide-free', mean_tide: 'Mean-tide' };
        const tideKey = dict.tide_system.trim().toLowerCase().replace(/-/g, '_');
        $('#input-tide-system').val(tideMap[tideKey] || '');
    }
    $('#input-degree').val(dict.max_degree || dict.degree || '');
    const errors = (dict.errors || '').trim().toLowerCase();
    if (errors && errors !== 'n/a') {
        $('#input-errors').val(errors === 'calibrated_and_formal' ? 'calibrated' : errors).trigger('change');
    }
    $('#input-radius').val(dict.radius || '');
    $('#input-earth-gravity-constant').val(dict.earth_gravity_constant || '');
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
    });
    
    $(document).on('change', '#input-errors', function() {
        updateErrorHandlingVisibility();
    });
    
    $(document).on('change', '#input-second-variable', function() {
        updateSecondVariableLabel();
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
        updateReferenceSystemVisibility();
    });
    
    // Initialize on page load - wait a bit for API data to load
    setTimeout(function() {
        updateReferenceSystemVisibility();
        updateSecondVariableLabel();
        updateErrorHandlingVisibility();
    }, 1000);
    
    // Also listen for when the math representation dropdown is populated
    $(document).on('change', '#input-mathematical-representation', function() {
        updateReferenceSystemVisibility();
    });

    initGfcUploadHandlers();
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
window.getHeaderFromFile = getHeaderFromFile;
window.getHeaderFromText = getHeaderFromText;
window.mergeGfcHeaders = mergeGfcHeaders;
window.populateParsedFields = populateParsedFields;