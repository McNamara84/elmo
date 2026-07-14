/**
 * Shared dropdown helpers used by select.js.
 * @module dropdownUtils
 */

/**
 * Updates all placeholder options in dropdown selects with the current translation.
 * Called when translations are loaded or changed to fix race condition between
 * dropdown initialization and translation loading.
 */
function updateDropdownPlaceholders() {
  const translatedText = window.elmo?.translate?.('general.choose');
  if (!translatedText) return;

  $('option[data-translate="general.choose"]').each(function () {
    $(this).text(translatedText);
  });
}

/**
 * Filters data based on GEM feature flag
 * @param {Array} data - Array of data objects to filter
 * @param {string} type - Type of filter: "resourceType" or "language"
 * @param {boolean} isGEM - Whether ICGEM mode is enabled (see showGGMsProperties flag)
 * @returns {Array} Filtered data array
 */
function filterDataByGEM(data, type, isGEM) {
  if (!isGEM || !Array.isArray(data)) {
    return data;
  }

  switch (type) {
    case 'resourceType':
      return data.filter(item => item.resource_type_general === "Dataset");
    case 'language':
      return data.filter(item => item.name === "English");
    default:
      return data;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateDropdownPlaceholders,
    filterDataByGEM,
  };
}

if (typeof window !== 'undefined') {
  window.updateDropdownPlaceholders = updateDropdownPlaceholders;
  window.filterDataByGEM = filterDataByGEM;
}
