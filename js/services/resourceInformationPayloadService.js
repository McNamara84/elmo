/**
 * Read visible Resource Information fields immediately before persistence.
 * @param {HTMLFormElement} form The form being saved or submitted.
 * @returns {Object|null} The ordered Resource Information payload, if present.
 */
export function synchronizeResourceInformationPayload(form) {
  const field = form?.querySelector('input[name="resourceInformationPayload"]');
  if (!field) return null;
  const controller = window.resourceInformation;
  if (!controller || typeof controller.sync !== 'function') {
    throw new Error('Resource Information form is not initialized.');
  }
  const payload = controller.sync();
  if (!payload || !Array.isArray(payload.titles)) {
    throw new Error('Resource Information form state is invalid.');
  }
  field.value = JSON.stringify(payload);
  return payload;
}
