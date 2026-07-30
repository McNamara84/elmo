(function (root, factory) {
  const resourceTypeUtils = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = resourceTypeUtils;
  }

  if (root) {
    root.resourceTypeUtils = resourceTypeUtils;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /**
   * Creates the whitespace-independent key used by DataCite and ERNIE labels.
   *
   * @param {unknown} value
   * @returns {string}
   */
  function normalizeResourceTypeGeneral(value) {
    return String(value ?? '').replace(/\s+/g, '');
  }

  /**
   * Prefers an exact option label and falls back to whitespace-independent matching.
   *
   * @param {HTMLOptionElement[]} options
   * @param {string} resourceTypeGeneral
   * @returns {HTMLOptionElement|undefined}
   */
  function findResourceTypeOption(options, resourceTypeGeneral) {
    const exactMatch = options.find(
      option => option.text.trim() === resourceTypeGeneral
    );
    if (exactMatch) return exactMatch;

    const normalizedResourceType = normalizeResourceTypeGeneral(resourceTypeGeneral);
    return options.find(
      option => normalizeResourceTypeGeneral(option.text) === normalizedResourceType
    );
  }

  return {
    normalizeResourceTypeGeneral,
    findResourceTypeOption,
  };
});
