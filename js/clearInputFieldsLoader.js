/**
 * Loads clearInputFields from clear.js (ES module) for classic scripts.
 */
(function () {
  let clearInputFieldsModulePromise;

  window.loadClearInputFields = function loadClearInputFields() {
    if (!clearInputFieldsModulePromise) {
      clearInputFieldsModulePromise = import('./clear.js').then((module) => module.default);
    }
    return clearInputFieldsModulePromise;
  };
})();
