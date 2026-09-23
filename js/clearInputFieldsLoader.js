/**
 * Loads clearInputFields from clear.js (ES module) for classic scripts.
 * Uses import.meta.url so dynamic import() works on harness pages (about:blank + base href).
 */
const clearModuleUrl = new URL('./clear.js', import.meta.url).href;

let clearInputFieldsModulePromise;

window.loadClearInputFields = function loadClearInputFields() {
  if (!clearInputFieldsModulePromise) {
    clearInputFieldsModulePromise = import(clearModuleUrl).then((module) => module.default);
  }
  return clearInputFieldsModulePromise;
};
