/**
 * @fileOverview This script handles the setup of dropdowns for ICGEM file formats, model types, and mathematical representations,
 * as well as real-time validation for essential properties in the GGMs form group.
 * This isolates JavaScript functions for the ICGEM implementation from the rest of the application.
 */

/**
 * @description Poplates the dropdowns with ICGEM file formats 
 * 
 * @module ggmspropertiesessential
 */
function setupICGEMFileFormats() {
    /**
     * accesses the select element for the ICGEM file formats
     * populates this with id name and description accessible at the dedicated endpoint 
     * if the error occurs, the message is added to the select element
    */
    const selectId = "#input-file-format";
    var selectElement = $(selectId).closest(".row").find('select[name="file_format"]');
    const endpoint = "/vocabs/icgemformats";
    
    // Use a single AJAX call
    $.ajax({
        url: `api/v2${endpoint}`,
        method: "GET",
        dataType: "json",
        
        beforeSend: function () {
            selectElement.prop('disabled', true);
            selectElement.empty().append(
                $("<option>", {
                    value: "",
                    text: "Loading...",
                })
            );
        },
        
        success: function (response) {
            selectElement.empty();
            
            // Placeholder option
            selectElement.append(
                $("<option>", {
                    value: "",
                    text: "Choose...",
                    "data-translate": "general.choose"
                })
            );
            
            // The response is directly an array of format objects
            if (response && response.length > 0) {
                response.forEach(function (format) {
                        selectElement.append(
                            $("<option>", {
                                value: format.name,
                                text: format.name,
                                title: format.description
                            })
                        );
                    });
            } else {
                selectElement.append(
                    $("<option>", {
                        value: "",
                        text: "No ICGEM file formats available"
                    })
                );
            }
        },
        
        error: function (jqXHR, textStatus, errorThrown) {
            console.error("Error loading file formats:", textStatus, errorThrown);
            selectElement.empty().append(
                $("<option>", {
                    value: "",
                    text: "Error loading ICGEM file formats"
                })
            );
        },
        
        complete: function () {
            selectElement.prop('disabled', false);
        }
    });
}

/**
 * @description Poplates the dropdowns with ICGEM model types
 * 
 * @module ggmspropertiesessential
 */

function setupModelTypes() {
  /**
   * accesses the select element for the ICGEM file formats 
   * populates this with id name and description accessible at the dedicated endpoint
   * if the error occurs, the message is added to the select element
   */
    const selectId = "#input-model-type" ;
    var selectElement = $(selectId).closest(".row").find('select[name="model_type"]');
    const endpoint = "/vocabs/modeltypes";
    
    $.ajax({
        url: `api/v2${endpoint}`,
        method: "GET",
        dataType: "json",
        
        beforeSend: function () {
            selectElement.prop('disabled', true);
            selectElement.empty().append(
                $("<option>", {
                    value: "",
                    text: "Loading...",
                })
            );
        },
        
        success: function (response) {
            selectElement.empty();
            
            // Placeholder option
            selectElement.append(
                $("<option>", {
                    value: "",
                    text: "Choose...",
                    "data-translate": "general.choose"
                })
            );
            
            // The response is directly an array of format objects
            if (response && response.length > 0) {
                response.forEach(function (format) {
                        selectElement.append(
                            $("<option>", {
                                value: format.name,
                                text: format.name,
                                title: format.description
                            })
                        );
                    });
            } else {
                selectElement.append(
                    $("<option>", {
                        value: "",
                        text: "No ICGEM model types available"
                    })
                );
            }
        },
        
        error: function (jqXHR, textStatus, errorThrown) {
            console.error("Error loading file formats:", textStatus, errorThrown);
            selectElement.empty().append(
                $("<option>", {
                    value: "",
                    text: "Error loading ICGEM model types"
                })
            );
        },
        
        complete: function () {
            selectElement.prop('disabled', false);
        }
    });
}
/**
 * @description Poplates the dropdowns with ICGEM mathematical representations
 * 
 * @module ggmspropertiesessential
 */

function setupMathReps() {
    /**
   * accesses the select element for the ICGEM file formats 
   * populates this with id name and description accessible at the dedicated endpoint
   * if the error occurs, the message is added to the select element
   */
    const selectId = "#input-mathematical-representation" ;
    var selectElement = $(selectId).closest(".row").find('select[name="mathematical_representation"]');
    const endpoint = "/vocabs/mathreps";
    
    $.ajax({
        url: `api/v2${endpoint}`,
        method: "GET",
        dataType: "json",
        
        beforeSend: function () {
            selectElement.prop('disabled', true);
            selectElement.empty().append(
                $("<option>", {
                    value: "",
                    text: "Loading...",
                })
            );
        },
        
        success: function (response) {
            selectElement.empty();
            
            // Placeholder option
            selectElement.append(
                $("<option>", {
                    value: "",
                    text: "Choose...",
                    "data-translate": "general.choose"
                })
            );
            
            // The response is directly an array of format objects
            if (response && response.length > 0) {
                response.forEach(function (format) {
                        selectElement.append(
                            $("<option>", {
                                value: format.name,
                                text: format.name,
                                title: format.description
                            })
                        );
                    });
            } else {
                // otherwise, an error message is added to the select element
                selectElement.append(
                    $("<option>", {
                        value: "",
                        text: "No ICGEM mathematical representations available"
                    })
                );
            }
        },
        
        error: function (jqXHR, textStatus, errorThrown) {
            console.error("Error loading file formats:", textStatus, errorThrown);
            selectElement.empty().append(
                $("<option>", {
                    value: "",
                    text: "Error loading ICGEM mathematical representations"
                })
            );
        },
        
        complete: function () {
            selectElement.prop('disabled', false);
        }
    });
}

// Call the function when document is ready
$(document).ready(function() {
    setupICGEMFileFormats();
    setupModelTypes();
    setupMathReps();
});

/**
 * @description real-time frontend validation 
 * 
 * @module ggmspropertiesessential
 */
function checkGGMsPropertiesEssential() {
    /**
    * finds all the required fields in the formgroup
    * - Scans all essential fields (modelType, mathRepresentation, modelName, fileFormat)
    * - If any field contains a non-empty value, marks ALL fields as required
    * - Called automatically on 'change' and 'blur' events for monitored fields to actualise the result
   */
    const container = $('#group-ggmspropertiesessential');
    // Define all the essential fields
    const fields = {
        modelType: container.find('#input-model-type'),
        mathRepresentation: container.find('#input-mathematical-representation'),
        modelName: container.find('#input-model-name'),
        fileFormat: container.find('#input-file-format')
    };
    
    // Check if any field is filled (or selected for dropdowns)
    const isAnyFieldFilled = Object.values(fields).some(field => {
        const value = field.val();
        return value && value.trim() !== '';
    });
    
    // If any field is filled, all required fields must be filled
    if (isAnyFieldFilled) {
        // These fields should always be required
        fields.modelType.attr('required', 'required');
        fields.mathRepresentation.attr('required', 'required');
        fields.modelName.attr('required', 'required');
        fields.fileFormat.attr('required', 'required');
    }    
}

// Attach event listeners to relevant fields
$(document).ready(function() {
    const fieldsToWatch = [
        '#input-model-type',
        '#input-mathematical-representation',
        '#input-model-name',
        '#input-file-format'
    ];
    
    // Watch for changes on all relevant fields
    $(document).on('change blur', fieldsToWatch.join(', '), function() {
        checkGGMsPropertiesEssential();
    });
});

/**
 * @description Handles default values for mathematical representation and file format
 * based on special model types (altimetry-derived, mascon).
 * 
 * @module ggmspropertiesessential
 */
$(document).ready(function() {
    const modelTypeSelect = $('#input-model-type');
    const mathRepSelect = $('#input-mathematical-representation');
    const fileFormatSelect = $('#input-file-format');

    if (!modelTypeSelect.length) {
        return;
    }

    let previousMathRepValue = '';
    let previousFileFormatValue = '';
    let wasSpecialType = false;

    /** Normalizes model type string for comparisons. */
    function normalizeModelType(value) {
        return (value || '').toString().trim().toLowerCase();
    }

    /** Checks if the model type requires gridded dataset defaults. */
    function isGriddedDatasetType(modelType) {
        return modelType === 'altimetry-derived' || modelType === 'mascon';
    }

    /** Sets select to value by text match (case-insensitive), returns true if found. */
    function setSelectByText(selectElement, targetText) {
        const target = (targetText || '').toLowerCase();
        let found = false;

        selectElement.find('option').each(function() {
            const optionText = ($(this).text() || '').trim().toLowerCase();
            if (optionText === target) {
                selectElement.val($(this).val()).trigger('change');
                found = true;
                return false;
            }
        });

        return found;
    }

    /** Applies defaults for gridded dataset model types. */
    function applyGriddedDatasetDefaults(forceOverride) {
        // Store previous values if entering special mode
        if (!wasSpecialType) {
            previousMathRepValue = mathRepSelect.val() || '';
            previousFileFormatValue = fileFormatSelect.val() || '';
        }

        // Set mathematical representation to "Gridded dataset"
        if (mathRepSelect.length && (forceOverride || !mathRepSelect.val())) {
            setSelectByText(mathRepSelect, 'gridded dataset');
        }

        // Set file format to "NetCDF"
        if (fileFormatSelect.length && (forceOverride || !fileFormatSelect.val())) {
            setSelectByText(fileFormatSelect, 'netcdf');
        }
    }

    /** Restores previous values when leaving special model types. */
    function restorePreviousDefaults() {
        if (mathRepSelect.length && previousMathRepValue !== '') {
            mathRepSelect.val(previousMathRepValue).trigger('change');
        } else if (mathRepSelect.length) {
            mathRepSelect.val('').trigger('change');
        }

        if (fileFormatSelect.length && previousFileFormatValue !== '') {
            fileFormatSelect.val(previousFileFormatValue).trigger('change');
        } else if (fileFormatSelect.length) {
            fileFormatSelect.val('').trigger('change');
        }

        previousMathRepValue = '';
        previousFileFormatValue = '';
    }

    /** Handles model type change for gridded dataset defaults. */
    function handleModelTypeChangeForDefaults() {
        const modelType = normalizeModelType(modelTypeSelect.val());
        const isSpecial = isGriddedDatasetType(modelType);

        if (isSpecial) {
            applyGriddedDatasetDefaults(!wasSpecialType);
        } else if (wasSpecialType) {
            restorePreviousDefaults();
        }

        wasSpecialType = isSpecial;
    }

    // Track changes to math rep and file format when not in special mode
    $(document).on('change', '#input-mathematical-representation', function() {
        const modelType = normalizeModelType(modelTypeSelect.val());
        if (!isGriddedDatasetType(modelType)) {
            previousMathRepValue = mathRepSelect.val() || '';
        }
    });

    $(document).on('change', '#input-file-format', function() {
        const modelType = normalizeModelType(modelTypeSelect.val());
        if (!isGriddedDatasetType(modelType)) {
            previousFileFormatValue = fileFormatSelect.val() || '';
        }
    });

    // Listen for model type changes
    $(document).on('change', '#input-model-type', handleModelTypeChangeForDefaults);

    // Apply defaults after dropdowns are populated (async)
    $(document).ajaxComplete(function() {
        const modelType = normalizeModelType(modelTypeSelect.val());
        if (isGriddedDatasetType(modelType)) {
            applyGriddedDatasetDefaults(false);
        }
    });
});