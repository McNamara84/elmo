/**
 * @description Generic confirmation modal helper for reusable confirmation dialogs
 * @module confirmationModal
 */

/**
 * Shows a generic confirmation modal with translated text
 * 
 * @param {string} titleKey - Translation key for modal title (e.g., "confirmations.clear.title")
 * @param {string} messageKey - Translation key for modal message (e.g., "confirmations.clear.message")
 * @param {string} cancelKey - Translation key for cancel button (e.g., "confirmations.clear.cancel")
 * @param {string} confirmKey - Translation key for confirm button (e.g., "confirmations.clear.confirm")
 * @param {Function} onConfirm - Callback function executed when user confirms
 * 
 * @example
 * showConfirmationModal(
 *   'confirmations.clear.title',
 *   'confirmations.clear.message',
 *   'confirmations.clear.cancel',
 *   'confirmations.clear.confirm',
 *   clearInputFields
 * );
 */
function showConfirmationModal(titleKey, messageKey, cancelKey, confirmKey, onConfirm) {
    // Get translations from nested keys (e.g., "confirmations.clear.title")
    const getTranslation = (key) => {
        const keys = key.split('.');
        let value = window.elmo?.translations || {};
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return key; // Fallback to key if translation not found
            }
        }
        return value || key;
    };

    const title = getTranslation(titleKey);
    const message = getTranslation(messageKey);
    const cancel = getTranslation(cancelKey);
    const confirm = getTranslation(confirmKey);
    
    // Set modal content
    $('#modal-confirm-label').text(title);
    $('#modal-confirm-description').text(message);
    $('#button-confirm-cancel').text(cancel);
    $('#button-confirm-action').text(confirm);
    
    // Remove previous event handlers to avoid duplicates
    $('#button-confirm-action').off('click');
    
    // Attach confirmation handler (use .one() to ensure it only fires once)
    $('#button-confirm-action').one('click', function () {
        $('#modal-confirm').modal('hide');
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    });
    
    // Show modal
    const modalElement = document.getElementById('modal-confirm');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('Confirmation modal element not found');
    }
}

// Make function globally available for use in other modules
window.showConfirmationModal = showConfirmationModal;

// Export for ES module compatibility
export { showConfirmationModal };