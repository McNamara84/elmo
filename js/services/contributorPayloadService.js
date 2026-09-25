/** Regenerate the ordered Contributors payload from its live card stack. */
export function synchronizeContributorsPayload(root) {
    if (!root || typeof root.querySelector !== 'function') {
        throw new TypeError('Cannot synchronize Contributors without a queryable form.');
    }
    const input = root.querySelector('input[name="contributorsPayload"]');
    if (!input) return null; // Feature can be disabled entirely.
    const stack = globalThis.contributorStack;
    if (!stack || typeof stack.updatePayload !== 'function') {
        throw new Error('Cannot synchronize Contributors: stack is not initialized.');
    }
    const payload = stack.updatePayload();
    if (!Array.isArray(payload)) {
        throw new Error('Cannot synchronize Contributors: stack returned a non-array value.');
    }
    input.value = JSON.stringify(payload);
    return payload;
}
