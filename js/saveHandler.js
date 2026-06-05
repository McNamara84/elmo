/**
 * @description Handles saving functionality for dataset metadata
 * @requires bootstrap
 * @requires jquery
 */

const SAVE_FORMATS = {
    xml: {
        extension: 'xml',
        modalTitleKey: 'saveAs',
        fallbackTitle: 'Save as XML',
        logLabel: 'xml file locally'
    },
    jsonld: {
        extension: 'jsonld',
        modalTitleKey: 'saveAsJsonLd',
        fallbackTitle: 'Save as JSON-LD',
        logLabel: 'json-ld file locally'
    }
};

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
        this.modalElements = {
            title: document.getElementById('label-saveas-modal'),
            extension: document.getElementById('saveas-extension')
        };
        this.autosaveService = autosaveService;
        this.currentFormat = 'xml';
        
        // Security fields
        this.$csrfTokenField = $('#input-save-csrf-token');
        this.$timeSpentField = $('#input-save-time-spent');
        this.$honeypotField = $('input[name="website"]');
        this.modalOpenedAt = null;
        
        this.initializeEventListeners();
    }

    /**
     * Fetches a CSRF token from the server for form protection.
     * @returns {Promise<string>} The CSRF token
     */
    async fetchCsrfToken() {
        try {
            const response = await fetch('api/csrf_token.php');
            const data = await response.json();
            return data.token || '';
        } catch (error) {
            console.error('Failed to fetch CSRF token:', error);
            return '';
        }
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        $('#button-saveas-save').on('click', () => this.handleSaveConfirm());
        $('#modal-saveas').on('hidden.bs.modal', () => {
            // Only dismiss the notification when it still shows the preparatory
            // info alert. After the save completes the notification contains
            // a success/danger alert and must stay visible.
            if ($('#modal-notification-body .alert-info').length) {
                this.modals.notification.hide();
            }
        });

        // Focus on input field and fetch CSRF token
        $('#modal-saveas').on('shown.bs.modal', async () => {
            // Record when modal was opened for time-spent calculation
            this.modalOpenedAt = Date.now();
            
            // Fetch fresh CSRF token
            const token = await this.fetchCsrfToken();
            this.$csrfTokenField.val(token);
            
            // Reset time spent and honeypot
            this.$timeSpentField.val('0');
            this.$honeypotField.val('');
            
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
     * @param {string} [format='xml'] - Download format
     */
    async handleSave(format = 'xml') {
        this.setCurrentFormat(format);
        this.updateSaveAsModal();
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

        // Calculate time spent filling the save modal (in seconds)
        if (this.modalOpenedAt) {
            const timeSpent = Math.floor((Date.now() - this.modalOpenedAt) / 1000);
            this.$timeSpentField.val(timeSpent);
        }

        this.modals.saveAs.hide();
        await this.saveAndDownload(filename, this.currentFormat);
    }

    /**
     * Save data and trigger download
     * @param {string} filename - Chosen filename
     * @param {string} [format=this.currentFormat] - Download format
     */
    async saveAndDownload(filename, format = this.currentFormat) {
        const formatConfig = this.getFormatConfig(format);
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
            
            // Append security fields
            formData.append('csrf_token', this.$csrfTokenField.val());
            formData.append('save_time_spent', this.$timeSpentField.val());
            formData.append('website', this.$honeypotField.val());
            formData.append('download_format', formatConfig.extension);

            const response = await fetch('save/save_data.php', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.resolveDownloadFilename(response, filename, formatConfig.extension);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            if (this.autosaveService) {
                await this.autosaveService.markManualSave();
            }

            this.showNotification('success',
                translations.alerts.successHeading,
                translations.alerts.savingSuccess);

            // Log successful save (fire-and-forget, must not delay the notification)
            logEvent('save', `user successfully saved ${formatConfig.logLabel}`);
        } catch (error) {
            console.error('Error saving dataset:', error);

            // Log failed save
            await logEvent('save', `user FAILED to save ${formatConfig.logLabel}`);

            this.showNotification('danger',
                translations.alerts.errorHeading,
                translations.alerts.saveError);
        }
    }

    /**
     * Normalize and store the current save format.
     * @param {string} format - Requested format
     */
    setCurrentFormat(format) {
        this.currentFormat = this.getFormatConfig(format).extension;
    }

    /**
     * Return the config for a supported format.
     * @param {string} format - Requested format
     * @returns {{extension: string, modalTitleKey: string, fallbackTitle: string, logLabel: string}}
     */
    getFormatConfig(format) {
        return SAVE_FORMATS[format] || SAVE_FORMATS.xml;
    }

    /**
     * Update modal title and visible filename suffix for the active format.
     */
    updateSaveAsModal() {
        const formatConfig = this.getFormatConfig(this.currentFormat);
        const translatedTitle = translations?.modals?.save?.[formatConfig.modalTitleKey] || formatConfig.fallbackTitle;

        if (this.modalElements.title) {
            this.modalElements.title.textContent = translatedTitle;
        }

        if (this.modalElements.extension) {
            this.modalElements.extension.textContent = `.${formatConfig.extension}`;
        }
    }

    /**
     * Resolve the downloaded filename from the response headers or format.
     * @param {Response} response - Fetch response
     * @param {string} filename - User-chosen base filename
     * @param {string} extension - Fallback extension
     * @returns {string}
     */
    resolveDownloadFilename(response, filename, extension) {
        const contentDisposition = response?.headers?.get?.('Content-Disposition')
            || response?.headers?.get?.('content-disposition')
            || '';
        const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (encodedMatch && encodedMatch[1]) {
            return decodeURIComponent(encodedMatch[1]);
        }

        const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
        if (plainMatch && plainMatch[1]) {
            return plainMatch[1];
        }

        return `${filename}.${extension}`;
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
