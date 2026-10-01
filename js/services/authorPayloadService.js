/**
 * Regenerates and validates the structured Authors payload for a form action.
 *
 * `authorStack` owns the live Authors UI and is therefore the only valid source
 * for a payload used by validation, saving, or submission. This function is the
 * shared boundary used by those consumers: it requires both the hidden transport
 * field and an initialized stack, refreshes the payload from the current DOM
 * order, and rejects an invalid result instead of falling back to legacy fields.
 *
 * @param {ParentNode} root - Form or document containing the Authors payload field.
 * @returns {Array<Record<string, unknown>>} Fresh Authors payload in current UI order.
 * @throws {TypeError} When the supplied root cannot be queried.
 * @throws {Error} When the payload field or initialized Authors stack is missing,
 *                 payload generation fails, or the generated value is not an array.
 */
function synchronizeAuthorsPayload(root) {
    if (!root || typeof root.querySelector !== 'function') {
        throw new TypeError('Cannot synchronize Authors payload without a queryable form or document.');
    }

    const payloadInput = root.querySelector('input[name="authorsPayload"]');
    if (!payloadInput) {
        throw new Error('Cannot synchronize Authors payload: hidden authorsPayload field is missing.');
    }

    const authorStack = typeof globalThis !== 'undefined' ? globalThis.authorStack : null;
    if (!authorStack || typeof authorStack.updatePayload !== 'function') {
        throw new Error('Cannot synchronize Authors payload: authorStack is not initialized.');
    }

    let payload;
    try {
        payload = authorStack.updatePayload();
    } catch (error) {
        const synchronizationError = new Error('Cannot synchronize Authors payload from the current form state.');
        synchronizationError.cause = error;
        throw synchronizationError;
    }

    if (!Array.isArray(payload)) {
        throw new Error('Cannot synchronize Authors payload: authorStack returned a non-array value.');
    }

    payloadInput.value = JSON.stringify(payload);
    return payload;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { synchronizeAuthorsPayload };
}

export { synchronizeAuthorsPayload };
