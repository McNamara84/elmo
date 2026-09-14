/**
 * @description Handles saving functionality for dataset metadata
 * @requires bootstrap
 * @requires jquery
 */

import { fetchAndStoreCsrfToken } from './services/csrfTokenService.js';
import { synchronizeAuthorsPayload } from './services/authorPayloadService.js';

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
        this.$honeypotField = $('#input-please-fill-in-this-field');
        
        this.initializeEventListeners();
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

        // Focus on filename input when modal opens
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
     * @param {string} [format='xml'] - Download format
     */
    async handleSave(format = 'xml') {
        this.saveFlowStartedAt = Date.now();
        this.setCurrentFormat(format);
        if (!this.validateAuthorAffiliationsForSave()) {
            return;
        }
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

    validateAuthorAffiliationsForSave() {
        const validator = typeof globalThis !== 'undefined'
            ? globalThis.validateAuthorAffiliationEditors
            : null;

        if (typeof validator !== 'function' || validator()) {
            return true;
        }

        const firstInvalid = this.$form.find('[data-author-affiliation-label].is-invalid').first();
        if (firstInvalid.length > 0 && firstInvalid[0]) {
            firstInvalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalid[0].focus();
        }

        this.showNotification(
            'danger',
            translations.alerts.validationErrorheading || translations.alerts.errorHeading,
            translations.alerts.validationError || translations.alerts.saveError
        );
        return false;
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
        await this.saveAndDownload(filename, this.currentFormat);
    }

    /**
     * Saves the current form state and triggers the generated file download.
     *
     * Before `FormData` is created, the structured Authors payload is rebuilt
     * from the live Authors stack. A missing payload field, an uninitialized
     * stack, or an invalid generated payload aborts the request and is reported
     * through the standard error notification; incomplete/stale Authors data is
     * never sent through legacy form fields as a silent fallback.
     *
     * @param {string} filename - Chosen filename.
     * @param {string} [format=this.currentFormat] - Download format.
     * @returns {Promise<void>} Promise resolved after download or error handling completes.
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

            const authorsPayload = synchronizeAuthorsPayload(formEl);
            const formData = new FormData(formEl);
            formData.set('authorsPayload', JSON.stringify(authorsPayload));
            if (window.ggmsExperimentalPayload && typeof window.ggmsExperimentalPayload.appendPayloadsToFormData === 'function') {
                window.ggmsExperimentalPayload.appendPayloadsToFormData(formData);
            }
            formData.append('filename', filename);

            const csrfToken = await fetchAndStoreCsrfToken('form');

            formData.set('csrf-token', csrfToken);
            const honeypotEl = this.$honeypotField[0];
            if (honeypotEl?.name) {
                formData.append(honeypotEl.name, this.$honeypotField.val());
            }
            formData.append('download_format', formatConfig.extension);
            formData.append('action', 'save_and_download');

            const response = await fetch('save/save_data.php', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const serverMessage = await this.extractErrorMessage(response);
                throw Object.assign(new Error(`HTTP error! status: ${response.status}`), {
                    userMessage: serverMessage
                });
            }

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
        } catch (error) {
            console.error('Error saving dataset:', error);

            this.showNotification('danger',
                translations.alerts.errorHeading,
                error?.userMessage || translations.alerts.saveError);
        }
    }

    /**
     * Calculate elapsed save interaction time in whole seconds.
     * @returns {number}
     */
    calculateTimeSpent() {
        const now = Date.now();
        const startedAtCandidates = [this.modalOpenedAt, this.saveFlowStartedAt]
            .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);

        if (!startedAtCandidates.length) {
            return 0;
        }

        return Math.max(
            0,
            ...startedAtCandidates.map((timestamp) => Math.floor((now - timestamp) / 1000))
        );
    }

    /**
     * Extract a user-safe error message from a failed save response.
     * @param {Response} response - Failed fetch response
     * @returns {Promise<string|null>}
     */
    async extractErrorMessage(response) {
        if (!response?.clone) {
            return null;
        }

        try {
            const clone = response.clone();
            const contentType = clone.headers?.get?.('Content-Type')
                || clone.headers?.get?.('content-type')
                || '';

            if (!contentType.includes('application/json') || typeof clone.json !== 'function') {
                return null;
            }

            const payload = await clone.json();
            return payload?.error || payload?.message || null;
        } catch (error) {
            console.warn('Could not parse save error response:', error);
        }

        return null;
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
