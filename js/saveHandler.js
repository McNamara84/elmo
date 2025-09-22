/**
 * Validates that the embargo date is not before the creation date.
 * @returns {boolean} True if the dates are valid, false otherwise.
 */
function validateEmbargoDate() {
    const dateCreatedInput = document.getElementById('input-date-created');
    const dateEmbargoInput = document.getElementById('input-date-embargo');
    const embargoInvalidFeedback = document.querySelector('.embargo-invalid');

    if (!dateCreatedInput || !dateEmbargoInput || !embargoInvalidFeedback) {
        return true;
    }

    const dateCreated = new Date(dateCreatedInput.value);
    const dateEmbargo = new Date(dateEmbargoInput.value);

    if (!dateEmbargoInput.value) {
        resetFieldState(dateEmbargoInput, embargoInvalidFeedback);
        return true;
    }

    if (dateCreated > dateEmbargo) {
        setInvalidState(dateEmbargoInput, embargoInvalidFeedback, translations.dates.embargoDateError);
        return false;
    } else {
        setValidState(dateEmbargoInput, embargoInvalidFeedback);
        return true;
    }
}

/**
 * Validates that the start date is not after the end date in the temporal coverage section.
 * @param {HTMLElement} row - The row containing the start and end dates.
 * @returns {boolean} True if the dates are valid, false otherwise.
 */
function validateTemporalCoverage(row) {
    const dateStartInput = row.querySelector('[id*="input-stc-datestart"]');
    const dateEndInput = row.querySelector('[id*="input-stc-dateend"]');
    const dateTimeInvalidFeedback = row.querySelector('.invalid-feedback[data-translate="coverage.dateTimeInvalid"]');

    if (!dateStartInput || !dateEndInput) {
        return true;
    }

    const dateStart = new Date(dateStartInput.value);
    const dateEnd = new Date(dateEndInput.value);

    if (dateStart > dateEnd) {
        setInvalidState(dateEndInput, dateTimeInvalidFeedback, translations.coverage.endDateError);
        return false;
    } else {
        setValidState(dateEndInput, dateTimeInvalidFeedback);
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

const dateCreatedInput = document.getElementById('input-date-created');
const dateEmbargoInput = document.getElementById('input-date-embargo');
const groupStc = document.getElementById('group-stc');

// Event listeners for immediate validation
if (dateCreatedInput) {
    dateCreatedInput.addEventListener('change', validateEmbargoDate);
}

if (dateEmbargoInput) {
    dateEmbargoInput.addEventListener('change', validateEmbargoDate);
}

// Event listener for temporal coverage validation
if (groupStc) {
    groupStc.addEventListener('change', function (event) {
        if (event.target && (event.target.id.includes('input-stc-datestart') || event.target.id.includes('input-stc-dateend'))) {
            const row = event.target.closest('[tsc-row]');
            validateTemporalCoverage(row);
        }
    });
}

/**
 * Validates if a Contact Person is selected from group of Authors.
 */
function validateContactPerson() {
    var isValid = $('input[name="contacts[]"]:checked').length > 0;
    $('#contact-person-error').remove();
    // 
    if (!isValid) {
        $('#group-author').append('<div id="contact-person-error" class="text-danger mt-2" data-translate="contactPersons.contactPersonError"></div>');
        applyTranslations();
        $('input[name="contacts[]"]').prop('required', true);
    } else {
        $('input[name="contacts[]"]').prop('required', false);
    }
    return isValid;
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
        this.$form.on('change', 'input[name="contacts[]"]', validateContactPerson);

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
        validateEmbargoDate();
        // Check form validity before proceeding
        if (!this.$form[0].checkValidity() || !validateContactPerson()) {
            this.$form.addClass('was-validated');
            const $firstInvalid = this.$form.find(':invalid').first();
            $firstInvalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            $firstInvalid.focus();
            this.showNotification('danger',
                translations.alerts.validationErrorheading,
                translations.alerts.validationError);
            return;
        }

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
            this.showNotification('success',
                translations.alerts.successHeading,
                translations.alerts.savingSuccess);
        } catch (error) {
            console.error('Error saving dataset:', error);
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
    validateEmbargoDate,
    validateTemporalCoverage,
    validateContactPerson,
    default: SaveHandler
  };
}

export { SaveHandler, validateEmbargoDate, validateTemporalCoverage, validateContactPerson };
export default SaveHandler;