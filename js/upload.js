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
        if (file) {
            handleXmlFile(file);
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
        if (file && (file.type === 'text/xml' || file.type === 'application/xml' || (file.name && file.name.endsWith('.xml')))) {
            handleXmlFile(file);
        } else {
            showUploadStatus('Please upload an XML file.', 'danger');
        }
    });

    // Reset modal state when closed
    $('#modal-uploadxml').on('hidden.bs.modal', function () {
        $('#input-uploadxml-file').val('');
        setUploadLoadingState(false);
        $('#xml-upload-status').addClass('d-none');
        $('#panel-uploadxml-dropfile').removeClass('border-primary');
    });
});

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

            // Close modal and show success toast
            setUploadLoadingState(false);
            $('#modal-uploadxml').modal('hide');
            showUploadToast(file.name, 'success');

        } catch (error) {
            console.error('Error:', error);
            setUploadLoadingState(false);
            showUploadStatus('Error processing XML file: ' + error.message, 'danger');
        }
    };

    reader.onerror = function () {
        setUploadLoadingState(false);
        showUploadStatus('Error reading file', 'danger');
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
 */
function showUploadToast(fileName, type) {
    const toastEl = document.getElementById('toast-upload-feedback');
    if (!toastEl) {
        var fallbackMsg = type === 'success'
            ? fileName + ' successfully loaded'
            : 'Error loading ' + fileName;
        showUploadStatus(fallbackMsg, type === 'success' ? 'success' : 'danger');
        return;
    }

    if (!window.bootstrap || !window.bootstrap.Toast) {
        var fallbackMsg = type === 'success'
            ? fileName + ' successfully loaded'
            : 'Error loading ' + fileName;
        showUploadStatus(fallbackMsg, type === 'success' ? 'success' : 'danger');
        return;
    }

    var translate = (window.elmo && typeof window.elmo.translate === 'function')
        ? window.elmo.translate
        : null;

    const messageEl = document.getElementById('toast-upload-feedback-message');
    const iconEl = document.getElementById('toast-upload-feedback-icon');

    if (!messageEl || !iconEl) {
        var fallbackMsg = type === 'success'
            ? fileName + ' successfully loaded'
            : 'Error loading ' + fileName;
        showUploadStatus(fallbackMsg, type === 'success' ? 'success' : 'danger');
        return;
    }

    toastEl.classList.remove('text-bg-success', 'text-bg-danger');

    if (type === 'success') {
        toastEl.classList.add('text-bg-success');
        iconEl.className = 'bi bi-check-circle-fill me-2';
        var successText = translate ? translate('modals.upload.successToast') : null;
        messageEl.textContent = fileName + ' ' + (successText || 'successfully loaded');
    } else {
        toastEl.classList.add('text-bg-danger');
        iconEl.className = 'bi bi-exclamation-triangle-fill me-2';
        var errorText = translate ? translate('modals.upload.errorToast') : null;
        messageEl.textContent = (errorText || 'Error loading file') + ': ' + fileName;
    }

    var toast = new window.bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();
}

/**
 * Shows upload status message inside the modal
 * @param {string} message - The message to display
 * @param {string} type - Bootstrap alert type (success, danger, etc.)
 */
function showUploadStatus(message, type) {
    const statusElement = $('#xml-upload-status');
    statusElement.removeClass()
        .addClass(`alert alert-${type}`)
        .removeClass('d-none')
        .text(message);

    // Hide message after 10 seconds
    setTimeout(() => {
        statusElement.addClass('d-none');
    }, 10000);
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleXmlFile, showUploadStatus, setUploadLoadingState, showUploadToast };
}