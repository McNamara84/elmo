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
        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        $('#input-submit-privacycheck').on('change', () => this.toggleSubmitButton());
        $('#button-submit-submit').on('click', () => this.handleModalSubmit());
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
        submitData.append('input-submit-urgency', $('#input-submit-urgency').val());
        submitData.append('input-submit-dataurl', $('#input-submit-dataurl').val());

        const dataDescriptionFile = $('#input-submit-datadescription')[0].files[0];
        if (dataDescriptionFile) {
            submitData.append('input-submit-datadescription', dataDescriptionFile);
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