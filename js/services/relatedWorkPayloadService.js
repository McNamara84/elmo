/**
 * Regenerates and validates the structured Related Works payload for a form action.
 *
 * The Related Work stack owns the live card state. Consumers must refresh that
 * state immediately before creating FormData instead of trusting a possibly
 * stale hidden field or reconstructing parallel legacy arrays.
 *
 * @param {ParentNode} root - Form or document containing the payload field.
 * @returns {Array<Record<string, unknown>>} Fresh payload in current card order.
 * @throws {TypeError} When root cannot be queried.
 * @throws {Error} When the payload field or stack is missing, generation fails,
 *                 or the stack returns a non-array value.
 */
function synchronizeRelatedWorksPayload(root) {
    if (!root || typeof root.querySelector !== 'function') {
        throw new TypeError('Cannot synchronize Related Works payload without a queryable form or document.');
    }

    const payloadInput = root.querySelector('input[name="relatedWorksPayload"]');
    if (!payloadInput) {
        throw new Error('Cannot synchronize Related Works payload: hidden relatedWorksPayload field is missing.');
    }

    const relatedWorkStack = typeof globalThis !== 'undefined' ? globalThis.relatedWorkStack : null;
    if (!relatedWorkStack || typeof relatedWorkStack.updatePayload !== 'function') {
        throw new Error('Cannot synchronize Related Works payload: relatedWorkStack is not initialized.');
    }

    let payload;
    try {
        payload = relatedWorkStack.updatePayload({ notify: false });
    } catch (error) {
        const synchronizationError = new Error('Cannot synchronize Related Works payload from the current form state.');
        synchronizationError.cause = error;
        throw synchronizationError;
    }

    if (!Array.isArray(payload)) {
        throw new Error('Cannot synchronize Related Works payload: relatedWorkStack returned a non-array value.');
    }

    payloadInput.value = JSON.stringify(payload);
    return payload;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { synchronizeRelatedWorksPayload };
}

export { synchronizeRelatedWorksPayload };
