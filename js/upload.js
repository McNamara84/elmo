/**
 * Event handlers for metadata file upload functionality
 * @requires jQuery
 * @requires Bootstrap
 */
const DATACITE_NAMESPACE = 'http://datacite.org/schema/kernel-4';
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';

$(document).ready(function () {
    // Event listener for load button click
    $('#button-form-load').on('click', function () {
        $('#modal-uploadxml').modal('show');
    });

    // Event handler for file input change
    $('#input-uploadxml-file').on('change', function (event) {
        const file = event.target.files[0];
        if (isSupportedMetadataFile(file)) {
            handleMetadataFile(file);
        } else if (file) {
            showUploadStatus(translateWithFallback('modals.upload.invalidFileType', 'Please upload an XML or JSON-LD file.'), 'danger');
        }
    });

    // Event handlers for drag and drop
    const dropZone = $('#panel-uploadxml-dropfile');

    dropZone.on('dragover', function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.addClass('border-primary');
    });

    dropZone.on('dragleave', function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.removeClass('border-primary');
    });

    dropZone.on('drop', function (event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.removeClass('border-primary');

        const file = event.originalEvent.dataTransfer.files[0];
        if (isSupportedMetadataFile(file)) {
            handleMetadataFile(file);
        } else {
            showUploadStatus(translateWithFallback('modals.upload.invalidFileType', 'Please upload an XML or JSON-LD file.'), 'danger');
        }
    });

    // Reset modal state when closed
    $('#modal-uploadxml').on('hidden.bs.modal', function () {
        $('#input-uploadxml-file').val('');
        setUploadLoadingState(false);
        clearStatusHideTimer();
        $('#xml-upload-status').addClass('d-none').text('');
        $('#panel-uploadxml-dropfile').removeClass('border-primary');
    });
});

/**
 * Checks whether a file is a valid XML file by type or extension
 * @param {File|undefined} file - The file to check
 * @returns {boolean} True if the file is an XML file
 */
function isXmlFile(file) {
    if (!file) return false;
    if (file.type === 'text/xml' || file.type === 'application/xml') return true;
    return !!(file.name && file.name.toLowerCase().endsWith('.xml'));
}

/**
 * Checks whether a file is a valid JSON-LD file by type or extension
 * @param {File|undefined} file - The file to check
 * @returns {boolean} True if the file is a JSON-LD file
 */
function isJsonLdFile(file) {
    if (!file) return false;
    if (file.type === 'application/ld+json') return true;
    return !!(file.name && file.name.toLowerCase().endsWith('.jsonld'));
}

/**
 * Checks whether a file is a supported metadata file
 * @param {File|undefined} file - The file to check
 * @returns {boolean} True if the file is supported
 */
function isSupportedMetadataFile(file) {
    return isXmlFile(file) || isJsonLdFile(file);
}

/**
 * Detects the upload format for a supported metadata file
 * @param {File|undefined} file - The file to inspect
 * @returns {'xml'|'jsonld'|null}
 */
function detectUploadFormat(file) {
    if (isXmlFile(file)) {
        return 'xml';
    }

    if (isJsonLdFile(file)) {
        return 'jsonld';
    }

    return null;
}

/**
 * Returns a translated string with a safe fallback
 * @param {string} key - The i18n key
 * @param {string} fallback - Fallback string if translation is unavailable
 * @returns {string}
 */
function translateWithFallback(key, fallback) {
    const translate = (window.elmo && typeof window.elmo.translate === 'function')
        ? window.elmo.translate
        : null;
    return (translate && translate(key)) || fallback;
}

/**
 * Builds the toast/fallback message for a given file name and type
 * @param {string} fileName - The uploaded file name
 * @param {string} type - 'success' or 'danger'
 * @param {string} [errorKey] - Optional specific i18n key for the error message
 * @returns {string}
 */
function buildUploadMessage(fileName, type, errorKey) {
    if (type === 'success') {
        const successText = translateWithFallback('modals.upload.successToast', 'successfully loaded');
        return fileName + ' ' + successText;
    }
    const key = errorKey || 'modals.upload.errorToast';
    const fallbacks = {
        'modals.upload.errorReading': 'Error reading file',
        'modals.upload.errorProcessing': 'Error processing metadata file',
        'modals.upload.errorToast': 'Error loading file'
    };
    const errorText = translateWithFallback(key, fallbacks[key] || 'Error loading file');
    return errorText + ': ' + fileName;
}

/**
 * Parses an uploaded XML document
 * @param {string} xmlString - The XML source string
 * @returns {Document}
 */
function parseXmlDocument(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML file');
    }

    return xmlDoc;
}

/**
 * Parses an uploaded JSON-LD document and converts it to DataCite XML
 * @param {string} jsonString - The JSON-LD source string
 * @returns {Document}
 */
function parseJsonLdDocument(jsonString) {
    return convertJsonLdToXmlDocument(JSON.parse(jsonString));
}

/**
 * Normalizes a JSON-LD payload to the DataCite resource shape used by ELMO
 * @param {Object} payload - The parsed JSON-LD object
 * @returns {Object}
 */
function normalizeJsonLdPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid JSON-LD file');
    }

    if (!payload.resource || typeof payload.resource !== 'object' || Array.isArray(payload.resource)) {
        return payload;
    }

    const resourcePayload = { ...payload.resource };

    if (payload['@context'] && resourcePayload['@context'] === undefined) {
        resourcePayload['@context'] = payload['@context'];
    }

    if (payload['@id'] && resourcePayload['@id'] === undefined) {
        resourcePayload['@id'] = payload['@id'];
    }

    return resourcePayload;
}

/**
 * Converts XML-shaped DataCite JSON-LD back into a DataCite XML document
 * @param {Object} payload - The JSON-LD payload
 * @returns {Document}
 */
function convertJsonLdToXmlDocument(payload) {
    const normalizedPayload = normalizeJsonLdPayload(payload);
    const xmlDoc = document.implementation && typeof document.implementation.createDocument === 'function'
        ? document.implementation.createDocument(DATACITE_NAMESPACE, 'resource', null)
        : parseXmlDocument('<resource xmlns="' + DATACITE_NAMESPACE + '"></resource>');
    const resource = xmlDoc.documentElement;
    let appendedNodes = 0;

    if (!normalizedPayload.identifier && typeof normalizedPayload['@id'] === 'string') {
        const identifierElement = createIdentifierElementFromResourceId(xmlDoc, normalizedPayload['@id']);
        if (identifierElement) {
            resource.appendChild(identifierElement);
            appendedNodes += 1;
        }
    }

    for (const [key, value] of Object.entries(normalizedPayload)) {
        if (key === '@context' || key === '@id') {
            continue;
        }

        appendedNodes += appendJsonLdField(xmlDoc, resource, key, value);
    }

    if (appendedNodes === 0) {
        throw new Error('Invalid JSON-LD file');
    }

    return xmlDoc;
}

/**
 * Appends a JSON-LD value as one or more DataCite XML nodes
 * @param {Document} xmlDoc - The target XML document
 * @param {Element} parentNode - The parent element
 * @param {string} fieldName - The element name to create
 * @param {*} fieldValue - The value to serialize
 * @returns {number} The number of appended elements
 */
function appendJsonLdField(xmlDoc, parentNode, fieldName, fieldValue) {
    if (fieldValue === null || fieldValue === undefined) {
        return 0;
    }

    if (Array.isArray(fieldValue)) {
        return fieldValue.reduce((count, item) => count + appendJsonLdField(xmlDoc, parentNode, fieldName, item), 0);
    }

    const element = xmlDoc.createElementNS(DATACITE_NAMESPACE, fieldName);
    parentNode.appendChild(element);

    if (typeof fieldValue === 'object') {
        if (fieldValue.attrs && typeof fieldValue.attrs === 'object' && !Array.isArray(fieldValue.attrs)) {
            appendJsonLdAttributes(element, fieldValue.attrs);
        }

        for (const [childName, childValue] of Object.entries(fieldValue)) {
            if (childName === 'attrs' || childName === 'value') {
                continue;
            }

            appendJsonLdField(xmlDoc, element, childName, childValue);
        }

        if (Object.prototype.hasOwnProperty.call(fieldValue, 'value') && fieldValue.value !== null && fieldValue.value !== undefined) {
            element.appendChild(xmlDoc.createTextNode(String(fieldValue.value)));
        }

        return 1;
    }

    element.appendChild(xmlDoc.createTextNode(String(fieldValue)));
    return 1;
}

/**
 * Appends JSON-LD attrs to a DataCite XML node
 * @param {Element} element - The element to update
 * @param {Object} attrs - Attribute map
 */
function appendJsonLdAttributes(element, attrs) {
    for (const [name, value] of Object.entries(attrs)) {
        if (value === null || value === undefined) {
            continue;
        }

        if (name === 'lang') {
            element.setAttributeNS(XML_NAMESPACE, 'xml:lang', String(value));
            continue;
        }

        element.setAttribute(name, String(value));
    }
}

/**
 * Creates a DataCite identifier element from a JSON-LD @id value when possible
 * @param {Document} xmlDoc - The target XML document
 * @param {string} resourceId - The JSON-LD resource identifier
 * @returns {Element|null}
 */
function createIdentifierElementFromResourceId(xmlDoc, resourceId) {
    if (!/^https?:\/\/doi\.org\//i.test(resourceId)) {
        return null;
    }

    const identifier = xmlDoc.createElementNS(DATACITE_NAMESPACE, 'identifier');
    identifier.setAttribute('identifierType', 'DOI');
    identifier.appendChild(xmlDoc.createTextNode(resourceId.replace(/^https?:\/\/doi\.org\//i, '')));
    return identifier;
}

/**
 * Resolves the existing XML-to-form loader from the global scope
 * @returns {Function}
 */
function getLoadXmlToFormHandler() {
    const loader = window.loadXmlToForm || globalThis.loadXmlToForm;

    if (typeof loader !== 'function') {
        throw new Error('loadXmlToForm is not available');
    }

    return loader;
}

/**
 * Handles an uploaded metadata file
 * @param {File} file - The uploaded metadata file
 */
function handleMetadataFile(file) {
    setUploadLoadingState(true);
    const format = detectUploadFormat(file);

    const reader = new FileReader();

    reader.onload = async function (event) {
        try {
            if (!format) {
                throw new Error('Unsupported file type');
            }

            const xmlDoc = format === 'jsonld'
                ? parseJsonLdDocument(event.target.result)
                : parseXmlDocument(event.target.result);


            // If this is an ICGEM file uploaded to regular ELMO (not ELMOGEM), warn the user
            const isIcgemFile = window.icgemModule?.detectXmlSchema(xmlDoc) === 'icgem';
            const isElmoGem = window.ELMO_FEATURES && window.ELMO_FEATURES.showGGMsProperties;
            // For ICGEM files that are uploaded to generic ELMO (not ELMOGEM), show a warning and prevent loading
            if (isIcgemFile && !isElmoGem) {
                setUploadLoadingState(false);
                $('#modal-uploadxml').modal('hide');
                $('#modal-icgem-wrong-app').modal('show');
                return;
            }

            // Load XML data into form
            await loadXmlToForm(xmlDoc);

            // Show success toast; close modal only when toast is available
            setUploadLoadingState(false);
            if (showUploadToast(file.name, 'success')) {
                $('#modal-uploadxml').modal('hide');
            }

        } catch (error) {
            console.error('Error:', error);
            setUploadLoadingState(false);
            if (showUploadToast(file.name, 'danger', 'modals.upload.errorProcessing')) {
                $('#modal-uploadxml').modal('hide');
            }
        }
    };

    reader.onerror = function () {
        setUploadLoadingState(false);
        if (showUploadToast(file.name, 'danger', 'modals.upload.errorReading')) {
            $('#modal-uploadxml').modal('hide');
        }
    };

    reader.readAsText(file);
}

/**
 * Backwards-compatible alias for existing XML upload tests and callers
 * @param {File} file - The uploaded file
 */
function handleXmlFile(file) {
    handleMetadataFile(file);
}

/**
 * Toggles loading state in the upload modal
 * @param {boolean} loading - Whether the loading state should be active
 */
function setUploadLoadingState(loading) {
    const fileInput = $('#input-uploadxml-file');
    const dropZone = $('#panel-uploadxml-dropfile');
    const spinner = $('#upload-spinner-overlay');

    if (loading) {
        fileInput.prop('disabled', true);
        dropZone.addClass('pe-none opacity-50');
        spinner.removeClass('d-none');
        clearStatusHideTimer();
        $('#xml-upload-status').addClass('d-none').text('');
    } else {
        fileInput.prop('disabled', false);
        dropZone.removeClass('pe-none opacity-50');
        spinner.addClass('d-none');
    }
}

/**
 * Shows a Bootstrap toast notification after upload
 * @param {string} fileName - The name of the uploaded file
 * @param {string} type - 'success' or 'danger'
 * @param {string} [errorKey] - Optional specific i18n key for the error message
 * @returns {boolean} True if the toast was shown, false if the in-modal fallback was used
 */
function showUploadToast(fileName, type, errorKey) {
    const toastEl = document.getElementById('toast-upload-feedback');
    if (!toastEl) {
        showUploadStatus(buildUploadMessage(fileName, type, errorKey), type === 'success' ? 'success' : 'danger');
        return false;
    }

    if (!window.bootstrap || !window.bootstrap.Toast) {
        showUploadStatus(buildUploadMessage(fileName, type, errorKey), type === 'success' ? 'success' : 'danger');
        return false;
    }

    const messageEl = document.getElementById('toast-upload-feedback-message');
    const iconEl = document.getElementById('toast-upload-feedback-icon');

    if (!messageEl || !iconEl) {
        showUploadStatus(buildUploadMessage(fileName, type, errorKey), type === 'success' ? 'success' : 'danger');
        return false;
    }

    toastEl.classList.remove('text-bg-success', 'text-bg-danger');

    if (type === 'success') {
        toastEl.classList.add('text-bg-success');
        iconEl.className = 'bi bi-check-circle-fill me-2';
    } else {
        toastEl.classList.add('text-bg-danger');
        iconEl.className = 'bi bi-exclamation-triangle-fill me-2';
    }

    messageEl.textContent = buildUploadMessage(fileName, type, errorKey);

    const toast = new window.bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();
    return true;
}

/**
 * Shows upload status message inside the modal
 * @param {string} message - The message to display
 * @param {string} type - Bootstrap alert type (success, danger, etc.)
 */
let _statusHideTimer = null;

/**
 * Cancels any pending auto-hide timer for the status element
 */
function clearStatusHideTimer() {
    if (_statusHideTimer) {
        clearTimeout(_statusHideTimer);
        _statusHideTimer = null;
    }
}

function showUploadStatus(message, type) {
    const statusElement = $('#xml-upload-status');
    statusElement.removeClass()
        .addClass(`alert alert-${type}`)
        .removeClass('d-none')
        .text(message);

    // Cancel any previous hide timer
    clearStatusHideTimer();

    // Hide message after 10 seconds
    _statusHideTimer = setTimeout(() => {
        statusElement.addClass('d-none');
        _statusHideTimer = null;
    }, 10000);
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleMetadataFile,
        handleXmlFile,
        showUploadStatus,
        setUploadLoadingState,
        showUploadToast,
        isXmlFile,
        isJsonLdFile,
        isSupportedMetadataFile,
        detectUploadFormat,
        translateWithFallback,
        buildUploadMessage,
        parseXmlDocument,
        parseJsonLdDocument,
        normalizeJsonLdPayload,
        convertJsonLdToXmlDocument,
        appendJsonLdField,
        appendJsonLdAttributes,
        createIdentifierElementFromResourceId,
        clearStatusHideTimer
    };
}