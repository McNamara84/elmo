import { fetchAndStoreCsrfToken } from './services/csrfTokenService.js';
import { synchronizeAuthorsPayload } from './services/authorPayloadService.js';

/**
 * Validates that the embargo date is not before the creation date.
 * @returns {boolean} True if the dates are valid, false otherwise.
 */

function validateEmbargoDate() {
    const dateCreatedInput = document.getElementById('input-date-created');
    const dateEmbargoInput = document.getElementById('input-date-embargo');
    const embargoInvalidFeedback = document.querySelector('.embargo-invalid');

    if (!dateEmbargoInput || !dateEmbargoInput.value) {
        resetFieldState(dateEmbargoInput, embargoInvalidFeedback);
        return true;
    }

    if (!dateCreatedInput || !dateCreatedInput.value) {
        setValidState(dateEmbargoInput, embargoInvalidFeedback);
        return true;
    }

    const dateCreated = new Date(dateCreatedInput.value);
    const dateEmbargo = new Date(dateEmbargoInput.value);

    if (dateCreated > dateEmbargo) {
        setInvalidState(dateEmbargoInput, embargoInvalidFeedback, translations.dates.embargoDateError);
        return false;
    } else {
        setValidState(dateEmbargoInput, embargoInvalidFeedback);
        return true;
    }
}

/**
 * Converts a time string (HH:MM or HH:MM:SS) to seconds for robust ordering checks.
 * @param {string} timeValue - Time value from an input[type="time"] field.
 * @returns {number|null} Seconds since midnight, or null if value is empty/invalid.
 */
function parseTimeToSeconds(timeValue) {
    if (!timeValue) {
        return null;
    }

    const parts = timeValue.split(':');
    if (parts.length < 2 || parts.length > 3) {
        return null;
    }

    const [hours, minutes, seconds = '0'] = parts;
    const h = Number(hours);
    const m = Number(minutes);
    const s = Number(seconds);

    if ([h, m, s].some(Number.isNaN)) {
        return null;
    }

    return (h * 3600) + (m * 60) + s;
}

/**
 * Validates date and time order in the temporal coverage section.
 * @param {HTMLElement} row - The row containing the start and end dates.
 * @returns {boolean} True if date/time values are valid, false otherwise.
 */
function validateTemporalCoverage(row) {
    if (!row) {
        return true;
    }

    const dateStartInput = row.querySelector('[id*="input-stc-datestart"]');
    const dateEndInput = row.querySelector('[id*="input-stc-dateend"]');
    const timeStartInput = row.querySelector('[id*="input-stc-timestart"]');
    const timeEndInput = row.querySelector('[id*="input-stc-timeend"]');
    const dateTimeInvalidFeedback =
        dateEndInput?.closest('.input-group')?.querySelector('.invalid-feedback') ||
        row.querySelector('.invalid-feedback[data-translate="coverage.dateTimeInvalid"]');

    if (!dateStartInput || !dateEndInput || !dateTimeInvalidFeedback) {
        return true;
    }

    if (!dateStartInput.value || !dateEndInput.value) {
        setValidState(dateEndInput, dateTimeInvalidFeedback);
        return true;
    }

    const dateStart = new Date(dateStartInput.value);
    const dateEnd = new Date(dateEndInput.value);

    if (dateStart > dateEnd) {
        setInvalidState(dateEndInput, dateTimeInvalidFeedback, translations.coverage.endDateError);
        return false;
    }

    if (dateStartInput.value === dateEndInput.value && timeStartInput && timeEndInput) {
        const startSeconds = parseTimeToSeconds(timeStartInput.value);
        const endSeconds = parseTimeToSeconds(timeEndInput.value);

        if (startSeconds !== null && endSeconds !== null && endSeconds < startSeconds) {
            setInvalidState(dateEndInput, dateTimeInvalidFeedback, translations.coverage.endTimeError);
            return false;
        }
    }

    setValidState(dateEndInput, dateTimeInvalidFeedback);
    return true;
}

/**
 * Validates all STC rows to ensure submit is blocked even without prior change events.
 * @returns {boolean} True if all rows are valid.
 */
function validateAllTemporalCoverageRows() {
    const rows = document.querySelectorAll('#group-stc [tsc-row]');
    let isValid = true;

    rows.forEach((row) => {
        if (!validateTemporalCoverage(row)) {
            isValid = false;
        }
    });

    return isValid;
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

function getTagifyValidationMessage(input) {
    const feedback = input.closest('.input-group')?.querySelector('.invalid-feedback');
    const message = feedback?.textContent?.trim();
    if (message) return message;
    return translations?.general?.pleaseFillOut || 'Please fill out this field.';
}

function isTagifyInputEmpty(input) {
    if (input._tagify) {
        return !(input._tagify.value && input._tagify.value.length);
    }
    return !String(input.value ?? '').trim();
}

/**
 * Resolves the visible Tagify wrapper for an original input.
 * Tagify keeps the original <input> as a sibling of <tags class="tagify">.
 */
function getTagifyWrapper(input) {
    if (!input) return null;
    if (input._tagify?.DOM?.scope) {
        return input._tagify.DOM.scope;
    }
    return input.closest('.tagify') || input.parentElement?.querySelector('.tagify') || null;
}

/** Sync Bootstrap invalid styling onto Tagify wrappers for constraint-validated inputs. */
function syncTagifyInvalidState(form) {
    if (!form) return;

    // Walk original inputs that own a Tagify instance (not nested `.tagify input`,
    // which misses the sibling DOM structure Tagify actually creates).
    form.querySelectorAll('input').forEach((input) => {
        if (!input._tagify) return;

        const tagify = getTagifyWrapper(input);
        const requiredEmpty = input.required && isTagifyInputEmpty(input);

        // Set emptiness validity first so :invalid reflects the Tagify tag list,
        // not a stale customValidity from a previous submit attempt.
        if (requiredEmpty) {
            input.setCustomValidity(getTagifyValidationMessage(input));
        } else {
            input.setCustomValidity('');
        }

        const invalid = input.matches(':invalid');
        input.classList.toggle('is-invalid', invalid);
        tagify?.classList.toggle('is-invalid', invalid);
    });
}

// Event listeners for immediate validation
const dateCreatedInput = document.getElementById('input-date-created');
const dateEmbargoInput = document.getElementById('input-date-embargo');
const groupStc = document.getElementById('group-stc');

// Nur Event Listener hinzufügen, wenn die Elemente existieren
if (dateCreatedInput) {
    dateCreatedInput.addEventListener('change', validateEmbargoDate);
}

if (dateEmbargoInput) {
    dateEmbargoInput.addEventListener('change', validateEmbargoDate);
}

// Event listener for temporal coverage validation
if (groupStc) {
    groupStc.addEventListener('change', function(event) {
        if (
            event.target &&
            (
                event.target.id.includes('input-stc-datestart') ||
                event.target.id.includes('input-stc-dateend') ||
                event.target.id.includes('input-stc-timestart') ||
                event.target.id.includes('input-stc-timeend')
            )
        ) {
            const row = event.target.closest('[tsc-row]');
            validateTemporalCoverage(row);
        }
    });
}


/**
 * Checks whether an Authors payload entry is a complete person contact.
 *
 * @param {Record<string, unknown>|null} author - Authors payload entry.
 * @returns {boolean} True for a selected person contact with family name and email.
 */
function isCompletePayloadContact(author) {
    if (!author || author.type !== 'person' || author.isContact !== true) {
        return false;
    }

    return String(author.familyname || '').trim() !== '' &&
        String(author.email || '').trim() !== '';
}

/**
 * Validates that the synchronized Authors payload contains a complete contact.
 *
 * Direct calls rebuild the payload through the shared Authors synchronization
 * service. The optional payload is used by the `authorsPayload:updated` event,
 * whose detail already contains the freshly synchronized value. Missing or
 * malformed payload infrastructure is a validation failure and never falls
 * back to legacy checkboxes.
 *
 * @param {Array<Record<string, unknown>>|null} [synchronizedPayload=null]
 *        Payload supplied by an Authors update event, or null to synchronize now.
 * @returns {boolean} True when the payload contains a complete person contact.
 */
function validateContactPerson(synchronizedPayload = null) {
    var authorsPayload = Array.isArray(synchronizedPayload) ? synchronizedPayload : null;

    if (!Array.isArray(authorsPayload)) {
        try {
            authorsPayload = synchronizeAuthorsPayload(document);
        } catch (error) {
            console.error('Could not synchronize Authors payload for contact validation:', error);
        }
    }

    var isValid = Array.isArray(authorsPayload) &&
        authorsPayload.some(function (author) {
            return isCompletePayloadContact(author);
        });

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
     * @param {import('./services/autosaveService.js').default|null} [autosaveService=null] - Autosave coordination service.
     */
    constructor(formId, submitModalId, notificationModalId, autosaveService = null) {
        this.$form = $(`#${formId}`);
        this.modals = {
            submit: new bootstrap.Modal($(`#${submitModalId}`)[0]),
            notification: new bootstrap.Modal($(`#${notificationModalId}`)[0]),
            validationFailed: document.getElementById('modal-validation-failed')
                ? new bootstrap.Modal($('#modal-validation-failed')[0])
                : null
        };

        // File Input References
        this.$fileInput = $('#input-submit-datadescription');
        this.$removeFileBtn = $('#remove-file-btn');
        this.$selectedFileName = $('#selected-file-name');
        this.autosaveService = autosaveService;

        // Security field references
        this.$mainHoneypotField = $('#input-please-fill-in-this-field');
        this.$modalHoneypotField = $('#input-submit-please-fill-in-this-field');

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
        this.$form.on('change', 'input[name="contacts[]"]', () => validateContactPerson());
        this.$form.on('input change', 'input[name="familynames[]"], input[name="cpEmail[]"]', () => {
            if ($('#contact-person-error').length || this.$form.hasClass('was-validated')) {
                validateContactPerson();
            }
        });
        document.addEventListener('authorsPayload:updated', (event) => {
            if ($('#contact-person-error').length || this.$form.hasClass('was-validated')) {
                validateContactPerson(event.detail?.payload);
            }
        });

        // Reset modal-scoped fields on open
        $('#modal-submit').on('shown.bs.modal', () => {
            this.$modalHoneypotField.val('');
            $('#input-submit-dataurl').select();
        });

        $('#modal-submit').on('hidden.bs.modal', () => {
            this.toggleSubmitButton();
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
        if (this.autosaveService) {
            this.autosaveService.flushPending();
        }
        validateEmbargoDate();
        validateTitleField();
        validateAuthorNameFields();
        const temporalCoverageValid = validateAllTemporalCoverageRows();
        const authorAffiliationsValid = typeof globalThis !== 'undefined'
            && typeof globalThis.validateAuthorAffiliationEditors === 'function'
            ? globalThis.validateAuthorAffiliationEditors()
            : true;
        syncTagifyInvalidState(this.$form[0]);
        if (!this.$form[0].checkValidity() || !validateContactPerson() || !temporalCoverageValid || !authorAffiliationsValid) {
            this.$form.addClass('was-validated');
            syncTagifyInvalidState(this.$form[0]);
            const $firstInvalid = this.$form.find(':invalid').first();
            if ($firstInvalid.length > 0 && $firstInvalid[0]) {
                $firstInvalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                $firstInvalid.focus();
            }
            this.showValidationFailedModal();
            return;
        }

        this.modals.submit.show();
    }

    /**
     * Show the validation-failed modal with dynamic email address.
     * Replaces the {email} placeholder in the save-hint paragraph with
     * the configured xmlSubmitAddress from ELMO_FEATURES.
     */
    showValidationFailedModal() {
        const email = window.ELMO_FEATURES?.xmlSubmitAddress || '';
        const saveHintEl = document.getElementById('modal-validation-failed-save-hint');
        if (saveHintEl && email) {
            const template = translations.modals?.validationFailed?.saveHint || '';
            saveHintEl.innerHTML = template.replace(/\{email\}/g, this.escapeHtml(email));
        }
        if (this.modals.validationFailed) {
            this.modals.validationFailed.show();
        }
    }

    /**
     * Submits the validated form using the same freshly generated Authors
     * payload used by contact validation and file saving.
     *
     * Payload synchronization failures abort submission, display the standard
     * submit error, and prevent stale legacy author fields from reaching the
     * backend.
     *
     * @returns {Promise<void>} Promise resolved after handing data to the AJAX submission.
     */
    async handleModalSubmit() {
        if (this.autosaveService) {
            await this.autosaveService.flushPending();
        }

        let authorsPayload;
        try {
            authorsPayload = synchronizeAuthorsPayload(this.$form[0]);
        } catch (error) {
            console.error('Could not synchronize Authors payload for submission:', error);
            this.showNotification(
                'danger',
                translations.alerts.errorHeading,
                translations.alerts.submitError
            );
            return;
        }

        const submitData = new FormData(this.$form[0]);
        submitData.set('authorsPayload', JSON.stringify(authorsPayload));

        // Ensure the form-level CSRF token is present.
        const csrfToken = await fetchAndStoreCsrfToken('form');
        if (csrfToken) {
            submitData.set('csrf-token', csrfToken.toString());
        }

        // Backend validates one honeypot field — send whichever trap was filled.
        const mainHoneypot = (this.$mainHoneypotField.val() || '').toString().trim();
        let modalHoneypot = '';
        if (this.$modalHoneypotField && this.$modalHoneypotField.length > 0) {
            const element = this.$modalHoneypotField[0];
            if (element && element.value) {
                modalHoneypot = String(element.value).trim();
            }
        }
        const honeypotField = this.$mainHoneypotField[0] || this.$modalHoneypotField[0];
        if (honeypotField?.name) {
            submitData.set(honeypotField.name, mainHoneypot || modalHoneypot);
        }

        submitData.append('urgency', $('#input-submit-urgency').val());
        submitData.append('dataUrl', $('#input-submit-dataurl').val());
        submitData.append('action', 'submit');

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
            url: 'endpoints/send_xml_file.php',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: (response) => {
                let parsedResponse;
                try {
                    parsedResponse = typeof response === 'object' ? response : JSON.parse(response);
                } catch (e) {
                    console.error('Invalid JSON response:', response);
                    this.showNotification('danger',
                        translations.alerts.errorHeading,
                        translations.alerts.submitError);
                    return;
                }

                if (parsedResponse.success) {
                    this.showNotification('success',
                        translations.alerts.successHeading,
                        translations.alerts.successMessage);

                    // Append primary data upload hint if URL is configured
                    const uploadUrl = window.ELMO_FEATURES?.dataUploadUrl;
                    if (uploadUrl) {
                        const mainTitle = $('#input-resourceinformation-title').val() || '';
                        const hint = this.buildDataUploadHint(uploadUrl, mainTitle);
                        $('#modal-notification-body').append(hint);
                        $('#modal-notification .modal-dialog').addClass('modal-lg');
                    }

                    if (this.autosaveService) {
                        this.autosaveService.clearDraft();
                    }
                    this.clearFileInput(); // Clear file input after successful submission
                } else {
                    const errorMessage = parsedResponse.message || translations.alerts.submitError;
                    const debugInfo = parsedResponse.debug || parsedResponse.error;
                    this.showNotification('danger',
                        translations.alerts.errorHeading,
                        errorMessage);
                    if (debugInfo) {
                        console.error('Error details:', debugInfo);
                    }
                }
            },
            error: (xhr, textStatus, errorThrown) => {
                this.handleAjaxError(xhr, textStatus, errorThrown);
            }
        });
    }

    /**
     * Handle AJAX errors
     * @param {XMLHttpRequest} xhr - XHR object
     * @param {string} error - Error message
     */
    handleAjaxError(xhr, textStatus, errorThrown) {
        let errorMessage = translations.alerts.submitError;
        const contentType = xhr.getResponseHeader('Content-Type') || '';

        if (contentType.includes('application/json')) {
            try {
                const response = JSON.parse(xhr.responseText);
                errorMessage = response.message || errorMessage;
                if (response.debug) {
                    console.error('Error details:', response.debug);
                }
            } catch (e) {
                console.error('Invalid JSON response:', xhr.responseText);
            }
        } else {
            console.error('Unexpected response:', xhr.responseText);
        }

        this.showNotification('danger',
            translations.alerts.errorHeading,
            errorMessage || translations.alerts.submitError);
    }

    /**
     * Show notification modal
     * @param {string} type - Message type ('success', 'danger', 'info')
     * @param {string} title - Modal title
     * @param {string} message - Notification message
     * @param {Object} options - Additional options
     * @param {boolean} [options.autoClose=true] - Auto-close notification
     * @param {number} [options.autoCloseDelay=3000] - Auto-close delay in milliseconds
     */
    showNotification(type, title, message, options = {}) {
        const {
            autoClose = type !== 'success' && type !== 'danger',
            autoCloseDelay = 3000
        } = options;
        $('#modal-notification-label').text(title);
        
        // Get icon for notification type
        const icon = this.getNotificationIcon(type);
        
        // Format message for display
        const formattedMessage = this.formatMessage(message);
        
        $('#modal-notification-body').html(`
            <div class="alert alert-${type} mb-0 d-flex">
                <div class="notification-icon-container me-3">
                    <span class="notification-icon notification-icon-${type}">
                        ${icon}
                    </span>
                </div>
                <div class="notification-message-container mb-0">
                    ${formattedMessage}
                </div>
            </div>
        `);

        this.modals.notification.show();
        // Auto-close only for non-critical notifications
        if (autoClose) {
            setTimeout(() => this.modals.notification.hide(), autoCloseDelay);
        }
    }

    /**
     * Get icon for notification type
     * @param {string} type - Notification type
     * @returns {string} Icon character
     * @private
     */
    getNotificationIcon(type) {
        const icons = {
            'success': '✓',
            'danger': '✕',
            'info': 'ℹ'
        };
        return icons[type] || icons.info;
    }
    /** 
     * Escape HTML special characters in a string
     * @param {string} text - Raw text
     * @returns {string} Escaped text safe for HTML insertion
     * @private
     */
    escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, function (ch) {
            switch (ch) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#39;';
                default: return ch;
            }
        });
    }
    /**
     * Build HTML for the primary data upload hint shown after successful submit.
     * @param {string} uploadUrl - The Nextcloud upload URL
     * @param {string} mainTitle - The main title from the form
     * @returns {string} HTML string for the hint block
     */
    buildDataUploadHint(uploadUrl, mainTitle) {
        const escapedTitle = this.escapeHtml(mainTitle);
        const titleHint = escapedTitle
            ? `<p class="mb-1"><strong>${translations.alerts.dataUploadFileNameHint}</strong></p>
               <p class="mb-0 font-monospace bg-light rounded px-2 py-1">${escapedTitle}</p>`
            : '';

        return `
            <div class="alert alert-warning mt-3 mb-0">
                <h6 class="alert-heading fw-bold">
                    <i class="bi bi-cloud-arrow-up-fill me-2"></i>${translations.alerts.dataUploadTitle}
                </h6>
                <p>${translations.alerts.dataUploadMessage}</p>
                <p class="mb-2">
                    <a href="${this.escapeHtml(uploadUrl)}" target="_blank" rel="noopener noreferrer"
                       class="btn btn-warning btn-sm fw-bold">
                        <i class="bi bi-box-arrow-up-right me-1"></i>${translations.alerts.dataUploadLinkText}
                    </a>
                </p>
                ${titleHint}
            </div>
        `;
    }
    /**
     * Format message for display (scrubs risky tags, escapes, and converts newlines)
     * @param {string} message - Raw message
     * @returns {string} Formatted HTML message
     * @private
     */
    formatMessage(message) {
        const raw = message == null ? '' : String(message);
        
        // Parse the message as HTML to safely remove dangerous elements
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, 'text/html');
        
        // Remove dangerous elements
        const dangerousElements = doc.querySelectorAll('script, img');
        dangerousElements.forEach(el => el.remove());
        
        // Get the cleaned HTML content
        const scrubbed = doc.body.innerHTML;
        
        // Escape HTML special characters
        const escaped = this.escapeHtml(scrubbed);
        
        // Convert newlines to paragraphs and line breaks
        const paragraphs = escaped.split(/\n{2,}/).map(part => part.replace(/\n/g, '<br>'));
        return paragraphs.length ? `<p>${paragraphs.join('</p><p>')}</p>` : '';
    }
}
    

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SubmitHandler,
    validateEmbargoDate,
    validateTemporalCoverage,
        validateAllTemporalCoverageRows,
    validateContactPerson,
    syncTagifyInvalidState,
    default: SubmitHandler
  };
}

export { SubmitHandler, validateEmbargoDate, validateTemporalCoverage, validateAllTemporalCoverageRows, validateContactPerson, syncTagifyInvalidState };
export default SubmitHandler;
