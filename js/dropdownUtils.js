/**
 * Shared dropdown helpers used by select.js.
 * @module dropdownUtils
 */
(function () {
  function updateDropdownPlaceholders() {
    const translatedText = window.elmo?.translate?.('general.choose');
    if (!translatedText) return;

    $('option[data-translate="general.choose"]').each(function () {
      $(this).text(translatedText);
    });
  }

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

  const api = {
    updateDropdownPlaceholders,
    filterDataByGEM,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.updateDropdownPlaceholders = updateDropdownPlaceholders;
    window.filterDataByGEM = filterDataByGEM;
  }
})();
