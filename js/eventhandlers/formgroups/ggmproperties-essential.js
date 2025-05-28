function setupICGEMFileFormats() {
    const selectId = "#input-file-format";
    var selectElement = $(selectId).closest(".row").find('select[name="rFileFormat[]"]');
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
                                value: format.id,
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

function setupModelTypes() {
    const selectId = "#input-model-type" ;
    var selectElement = $(selectId).closest(".row").find('select[name="rModelType[]"]');
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
                                value: format.id,
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

function setupMathReps() {
    const selectId = "#input-mathematical-representation" ;
    var selectElement = $(selectId).closest(".row").find('select[name="rMathematicalRepresentation[]"]');
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
                                value: format.id,
                                text: format.name,
                                title: format.description
                            })
                        );
                    });
            } else {
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

function checkGGMsPropertiesEssential() {
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