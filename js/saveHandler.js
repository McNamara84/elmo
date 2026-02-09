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
     * @param {import('./services/autosaveService.js').default|null} [autosaveService=null] - Autosave coordination service.
     */
    constructor(formId, saveAsModalId, notificationModalId, autosaveService = null) {
        this.$form = $(`#${formId}`);
        this.modals = {
            saveAs: new bootstrap.Modal($(`#${saveAsModalId}`)[0]),
            notification: new bootstrap.Modal($(`#${notificationModalId}`)[0])
        };
        this.autosaveService = autosaveService;
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
        this.showNotification('info',
            translations.alerts.processingHeading,
            translations.alerts.preparingDownload);
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
            this.showNotification('danger',
                translations.alerts.errorHeading,
                translations.alerts.filenameGenerationError);
            return null;
        }
    }

    /**
     * Handle save confirmation
     */
    async handleSaveConfirm() {
        const filename = $('#input-saveas-filename').val().trim();
        if (!filename) {
            this.showNotification('danger',
                translations.alerts.filenameErrorHeading,
                translations.alerts.filenameError);
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
        if (this.autosaveService) {
            await this.autosaveService.flushPending();
        }
        this.showNotification('info',
            translations.alerts.savingHeading,
            translations.alerts.savingInfo);

        try {
            /**
            * Reset form validation state before saving.
            * Prevents submit validation styles from persisting on save.
            */
            const formEl = this.$form[0];
            formEl.classList.remove('was-validated');

            formEl.querySelectorAll('.is-invalid, .is-valid').forEach(el => {
                el.classList.remove('is-invalid', 'is-valid');
                el.removeAttribute('aria-invalid');
            });

            formEl.querySelectorAll('.js-required-on-submit').forEach(el => {
                el.removeAttribute('required');
            });

            $(formEl).find('.tagify').removeClass('is-invalid is-valid');
            
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

            if (this.autosaveService) {
                await this.autosaveService.markManualSave();
            }

            // Log successful save
            await logEvent('save', 'user successfully saved xml file locally');

            this.showNotification('success',
                translations.alerts.successHeading,
                translations.alerts.savingSuccess);
        } catch (error) {
            console.error('Error saving dataset:', error);

            // Log failed save
            await logEvent('save', 'user FAILED to save xml file locally');

            this.showNotification('danger',
                translations.alerts.errorHeading,
                translations.alerts.saveError);
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SaveHandler,
    default: SaveHandler
  };
}

export { SaveHandler };
export default SaveHandler;
