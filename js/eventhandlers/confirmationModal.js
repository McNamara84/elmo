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
        // Check both window.elmo.translations and global translations variable
        let value = window.elmo?.translations || (typeof translations !== 'undefined' ? translations : {});
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
    
    // Get modal elements
    const modalElement = document.getElementById('modal-confirm');
    const confirmButton = document.getElementById('button-confirm-action');
    const cancelButton = document.getElementById('button-confirm-cancel');
    
    if (!modalElement || !confirmButton || !cancelButton) {
        console.error('Confirmation modal elements not found');
        return;
    }
    
    // Set modal content
    document.getElementById('modal-confirm-label').textContent = title;
    document.getElementById('modal-confirm-description').textContent = message;
    cancelButton.textContent = cancel;
    confirmButton.textContent = confirm;
    
    // Remove previous event handlers to avoid duplicates
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    const newCancelButton = cancelButton.cloneNode(true);
    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    
    // Get fresh references after cloning
    const freshConfirmButton = document.getElementById('button-confirm-action');
    const freshCancelButton = document.getElementById('button-confirm-cancel');
    
    // Create modal instance
    let modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
        modal.dispose();
    }
    modal = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
    });
    
    // Handle confirm action
    freshConfirmButton.addEventListener('click', function handleConfirm() {
        modal.hide();
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    });
    
    // Handle cancel action
    freshCancelButton.addEventListener('click', function handleCancel() {
        modal.hide();
    });
    
    // Focus management: move focus into the modal when it opens.
    // WebKit can occasionally keep focus on the triggering button unless we retry.
    const moveFocusIntoModal = () => {
        try {
            if (freshConfirmButton && typeof freshConfirmButton.focus === 'function') {
                freshConfirmButton.focus({ preventScroll: true });
            }

            const activeElement = document.activeElement;
            const isFocusInModal = modalElement && activeElement && modalElement.contains(activeElement);
            if (!isFocusInModal && modalElement && typeof modalElement.focus === 'function') {
                modalElement.focus({ preventScroll: true });
            }
        } catch (e) {
            // Ignore focus errors (e.g., in rare browser edge cases)
        }
    };

    const scheduleFocusRetries = () => {
        moveFocusIntoModal();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(moveFocusIntoModal);
        }
        setTimeout(moveFocusIntoModal, 0);
        setTimeout(moveFocusIntoModal, 50);
    };

    modalElement.addEventListener('show.bs.modal', scheduleFocusRetries, { once: true });
    modalElement.addEventListener('shown.bs.modal', scheduleFocusRetries, { once: true });
    
    // Show modal
    modal.show();
}

// Make function globally available for use in other modules
window.showConfirmationModal = showConfirmationModal;

// Export for ES module compatibility
export { showConfirmationModal };

// Export for CommonJS testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { showConfirmationModal };
}