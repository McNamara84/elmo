/**
 * Validates that the embargo date is not before the creation date.
 * @returns {boolean} True if the dates are valid, false otherwise.
 */
function validateEmbargoDate() {
    const dateCreatedInput = document.getElementById('input-date-created');
    const dateEmbargoInput = document.getElementById('input-date-embargo');
    const embargoInvalidFeedback = document.querySelector('.embargo-invalid');

    const dateCreated = new Date(dateCreatedInput.value);
    const dateEmbargo = new Date(dateEmbargoInput.value);

    if (!dateEmbargoInput.value) {
        resetFieldState(dateEmbargoInput, embargoInvalidFeedback);
        return true;
    }

    if (dateCreated > dateEmbargo) {
        setInvalidState(dateEmbargoInput, embargoInvalidFeedback, "Embargo date must be after or equal to the creation date.");
        return false;
    } else {
        setValidState(dateEmbargoInput, embargoInvalidFeedback);
        return true;
    }
}

function setInvalidState(input, feedback, message) {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    input.setCustomValidity(message);
    feedback.textContent = message;
}

function setValidState(input, feedback) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    input.setCustomValidity("");
    feedback.textContent = "";
}

function resetFieldState(input, feedback) {
    input.classList.remove('is-valid', 'is-invalid');
    input.setCustomValidity("");
    feedback.textContent = "";
}

// Event-Listener für sofortige Validierung
document.getElementById('input-date-created').addEventListener('change', validateEmbargoDate);
document.getElementById('input-date-embargo').addEventListener('change', validateEmbargoDate);

/**
 * @description Handles submission functionality for dataset metadata
 * @requires bootstrap
 * @requires jquery
 */

class SubmitHandler {
    /**
     * Initialize submit handler
     * @param {string} formId - ID of the main form
     * @param {string} submitModalId - ID of the submit modal
     * @param {string} notificationModalId - ID of the notification modal
     */
    constructor(formId, submitModalId, notificationModalId) {
        this.$form = $(`#${formId}`);
        this.modals = {
            submit: new bootstrap.Modal($(`#${submitModalId}`)[0]),
            notification: new bootstrap.Modal($(`#${notificationModalId}`)[0])
        };

        // File Input References
        this.$fileInput = $('#input-submit-datadescription');
        this.$removeFileBtn = $('#remove-file-btn');
        this.$selectedFileName = $('#selected-file-name');

        this.initializeEventListeners();
        this.initializeFileHandlers();
        this.$removeFileBtn.hide();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        $('#input-submit-privacycheck').on('change', () => this.toggleSubmitButton());
        $('#button-submit-submit').on('click', () => this.handleModalSubmit());

        // Focus on input field
        $('#modal-submit').on('shown.bs.modal', () => {
            $('#input-submit-dataurl').select();
        });
        $('#modal-submit').on('keydown', (e) => {
            // KeyCode 13? (Enter)
            if (e.which === 13 || e.keyCode === 13) {
                // Prevent form submission
                e.preventDefault();

                // If close button is focused, do nothing
                const activeElement = document.activeElement;
                if (activeElement.classList.contains('btn-secondary') ||
                    activeElement.classList.contains('btn-close')) {
                    return;
                }

                this.handleModalSubmit();
            }
        });
    }

    /**
     * Initialize file input handlers
     */
    initializeFileHandlers() {
        // File Input Change Handler
        this.$fileInput.on('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.$selectedFileName.text(file.name);
                this.$removeFileBtn.show();
            } else {
                this.clearFileInput();
            }
        });

        // Remove Button Click Handler
        this.$removeFileBtn.on('click', () => {
            this.clearFileInput();
        });
    }

    /**
     * Clear file input and reset related elements
     */
    clearFileInput() {
        this.$fileInput.val('');
        this.$selectedFileName.text('');
        this.$removeFileBtn.hide();
    }

    /**
     * Toggle submit button based on privacy checkbox
     */
    toggleSubmitButton() {
        const isChecked = $('#input-submit-privacycheck').is(':checked');
        $('#button-submit-submit').prop('disabled', !isChecked);
    }

    /**
     * Handle submit action
     */
    handleSubmit() {
        validateEmbargoDate();
        if (!this.$form[0].checkValidity()) {
            this.$form.addClass('was-validated');
            const $firstInvalid = this.$form.find(':invalid').first();
            $firstInvalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            $firstInvalid.focus();
            this.showNotification('danger', 'Validation Error', 'Please check your inputs');
            return;
        }

        this.modals.submit.show();
    }

    /**
     * Handle modal submit
     */
    async handleModalSubmit() {
        const submitData = new FormData(this.$form[0]);

        submitData.append('urgency', $('#input-submit-urgency').val());
        submitData.append('dataUrl', $('#input-submit-dataurl').val());

        const dataDescriptionFile = $('#input-submit-datadescription')[0].files[0];
        if (dataDescriptionFile) {
            submitData.append('dataDescription', dataDescriptionFile);
        }

        this.modals.submit.hide();
        this.submitViaAjax(submitData);
    }

    /**
     * Submit form data via AJAX
     * @param {FormData} formData - Form data to submit
     */
    submitViaAjax(formData) {
        $.ajax({
            url: 'send_xml_file.php',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            dataType: 'json',
            success: (response) => {
                if (response.success) {
                    this.showNotification('success', 'Success!', response.message);
                    this.clearFileInput(); // Clear file input after successful submission
                } else {
                    this.showNotification('danger', 'Error!', response.message);
                    console.error('Error details:', response.debug);
                }
            },
            error: (xhr, status, error) => {
                this.handleAjaxError(xhr, error);
            }
        });
    }

    /**
     * Handle AJAX errors
     * @param {XMLHttpRequest} xhr - XHR object
     * @param {string} error - Error message
     */
    handleAjaxError(xhr, error) {
        let errorMessage = 'Failed to submit dataset';
        try {
            const response = JSON.parse(xhr.responseText);
            errorMessage = response.message || errorMessage;
            console.error('Error details:', response.debug);
        } catch (e) {
            errorMessage += ': ' + error;
            console.error('Response:', xhr.responseText);
        }
        this.showNotification('danger', 'Error!', errorMessage);
    }

    /**
     * Show notification modal
     * @param {string} type - Message type ('success', 'danger', 'info')
     * @param {string} title - Modal title
     * @param {string} message - Notification message
     */
    showNotification(type, title, message) {
        $('#modal-notification-label').text(title);
        $('#modal-notification-body').html(`
            <div class="alert alert-${type} mb-0">
                ${message}
            </div>
        `);

        this.modals.notification.show();

        if (type === 'success') {
            setTimeout(() => this.modals.notification.hide(), 3000);
        }
    }
}

export default SubmitHandler;