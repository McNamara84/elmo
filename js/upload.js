/**
 * Event handlers for XML file upload functionality
 * @requires jQuery
 * @requires Bootstrap
 */
$(document).ready(function () {
    // Event listener for load button click
    $('#button-form-load').on('click', function () {
        $('#modal-uploadxml').modal('show');
    });

    // Event handler for file input change
    $('#input-uploadxml-file').on('change', function (event) {
        const file = event.target.files[0];
        if (isXmlFile(file)) {
            handleXmlFile(file);
        } else if (file) {
            showUploadStatus(translateWithFallback('modals.upload.invalidFileType', 'Please upload an XML file.'), 'danger');
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
        if (isXmlFile(file)) {
            handleXmlFile(file);
        } else {
            showUploadStatus(translateWithFallback('modals.upload.invalidFileType', 'Please upload an XML file.'), 'danger');
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
        'modals.upload.errorProcessing': 'Error processing XML file',
        'modals.upload.errorToast': 'Error loading file'
    };
    const errorText = translateWithFallback(key, fallbacks[key] || 'Error loading file');
    return errorText + ': ' + fileName;
}

/**
 * Handles the uploaded XML file
 * @param {File} file - The uploaded XML file
 */
function handleXmlFile(file) {
    setUploadLoadingState(true);

    const reader = new FileReader();

    reader.onload = async function (event) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(event.target.result, 'text/xml');

            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                throw new Error('Invalid XML file');
            }

            // Load XML data into form
            await loadXmlToForm(xmlDoc);

            // Show success toast; close modal only when toast is available.
            // Register a shown.bs.modal fallback first: Bootstrap's hide() is a silent
            // no-op when the opening animation is still running (_isTransitioning === true).
            setUploadLoadingState(false);
            if (showUploadToast(file.name, 'success')) {
                const $modal = $('#modal-uploadxml');
                $modal.one('shown.bs.modal.upload', function () { $modal.modal('hide'); });
                $modal.one('hidden.bs.modal.upload', function () { $modal.off('shown.bs.modal.upload'); });
                $modal.modal('hide');
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
    module.exports = { handleXmlFile, showUploadStatus, setUploadLoadingState, showUploadToast, isXmlFile, translateWithFallback, buildUploadMessage, clearStatusHideTimer };
}