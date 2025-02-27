/**
* Validates that the embargo date is not before the creation date.
*/
function validateEmbargoDate() {
    const dateCreatedInput = document.getElementById('input-date-created');
    const dateEmbargoInput = document.getElementById('input-date-embargo');
    const embargoInvalidFeedback = document.querySelector('.embargo-invalid'); // Correct selector

    const dateCreated = new Date(dateCreatedInput.value);
    const dateEmbargo = new Date(dateEmbargoInput.value);

    if (dateCreated > dateEmbargo) {
        dateEmbargoInput.setCustomValidity("Embargo date must be after the creation date.");
        embargoInvalidFeedback.textContent = "Embargo date must be after the creation date.";
    } else {
        dateEmbargoInput.setCustomValidity("");
        embargoInvalidFeedback.textContent = "Please enter a valid date!";
    }

    dateEmbargoInput.reportValidity(); // Trigger validation and show message
}

/**
 * @description Handles saving functionality for dataset metadata
 * @requires bootstrap
 * @requires jquery
 */

class SaveHandler {
    /**
     * Initialize save handler
     * @param {string} formId - ID of the main form
     * @param {string} saveAsModalId - ID of the save-as modal
     * @param {string} notificationModalId - ID of the notification modal
     */
    constructor(formId, saveAsModalId, notificationModalId) {
        this.$form = $(`#${formId}`);
        this.modals = {
            saveAs: new bootstrap.Modal($(`#${saveAsModalId}`)[0]),
            notification: new bootstrap.Modal($(`#${notificationModalId}`)[0])
        };
        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        $('#button-saveas-save').on('click', () => this.handleSaveConfirm());
        $('#modal-saveas').on('hidden.bs.modal', () => this.modals.notification.hide());
        // Focus on input field
        $('#modal-saveas').on('shown.bs.modal', () => {
            $('#input-saveas-filename').select();
        });
        $('#modal-saveas').on('keydown', (e) => {
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

                this.handleSaveConfirm();
            }
        });
    }

    /**
     * Handle save action
     */
    async handleSave() {
        // Check form validity before proceeding
        if (!this.$form[0].checkValidity() || !validateEmbargoDate()) {
            this.$form.addClass('was-validated');
            const $firstInvalid = this.$form.find(':invalid').first();
            $firstInvalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            $firstInvalid.focus();
            this.showNotification('danger', 'Validation Error', 'Please check your inputs');
            return;
        }

        this.showNotification('info', 'Processing...', 'Preparing file for download.');
        const suggestedFilename = await this.generateFilename();
        if (suggestedFilename) {
            $('#input-saveas-filename').val(suggestedFilename);
            this.modals.saveAs.show();
        }
    }

    /**
     * Generate filename with timestamp
     * @returns {Promise<string|null>} Generated filename or null if error
     */
    async generateFilename() {
        try {
            const timestamp = new Date().toISOString()
                .replace(/[-:]/g, '')
                .replace(/[T.]/g, '_')
                .slice(0, 15);
            return `dataset_${timestamp}`;
        } catch (error) {
            console.error('Error generating filename:', error);
            this.showNotification('danger', 'Error', 'Failed to generate filename');
            return null;
        }
    }

    /**
     * Handle save confirmation
     */
    async handleSaveConfirm() {
        const filename = $('#input-saveas-filename').val().trim();
        if (!filename) {
            this.showNotification('danger', 'Error', 'Please enter a filename');
            return;
        }

        this.modals.saveAs.hide();
        await this.saveAndDownload(filename);
    }

    /**
     * Save data and trigger download
     * @param {string} filename - Chosen filename
     */
    async saveAndDownload(filename) {
        this.showNotification('info', 'Processing...', 'Saving dataset and preparing download...');

        try {
            const formData = new FormData(this.$form[0]);
            formData.append('filename', filename);
            formData.append('action', 'save_and_download');

            const response = await fetch('save/save_data.php', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showNotification('success', 'Success!', 'Dataset saved successfully');
        } catch (error) {
            console.error('Error saving dataset:', error);
            this.showNotification('danger', 'Error', 'Failed to save dataset');
        }
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
        $('#modal-notification .btn-close').on('click', () => {
            this.modals.notification.hide();
        });

        $('#modal-notification .btn-primary').on('click', () => {
            this.modals.notification.hide();
        });
        if (type === 'success') {
            setTimeout(() => this.modals.notification.hide(), 3000);
        }
    }
}

export default SaveHandler;
