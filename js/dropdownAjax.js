/**
 * Sequential AJAX/fetch-based dropdown setup functions.
 * Used as fallbacks when parallel fetch initialization is unavailable or fails.
 * @module dropdownAjax
 */

const { filterDataByGEM } =
  (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./dropdownUtils.js')
    : { filterDataByGEM: window.filterDataByGEM };

/**
 * Fills the timezone dropdown and sets the default timezone based on system settings and user's location
 * @async
 * @param {string|jQuery|HTMLElement} dropdownSelector - The selector for the timezone dropdown element
 * @param {string} jsonPath - Path to the timezones JSON file
 * @returns {Promise<void>}
 */
async function setupTimezoneDropdownAjax(dropdownSelector = '#input-stc-timezone', jsonPath = 'json/timezones.json') {
  try {
    const $dropdown = $(dropdownSelector);
    if ($dropdown.length === 0) return;

    function getSystemTimezone($select) {
      try {
        const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (timezoneName) {
          const options = $select.find('option').get();
          const date = new Date();
          const offset = -date.getTimezoneOffset();
          const hours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
          const minutes = (Math.abs(offset) % 60).toString().padStart(2, '0');
          const offsetStr = `${offset >= 0 ? '+' : '-'}${hours}:${minutes}`;

          let bestMatch = null;

          for (const option of options) {
            const optionText = $(option).text();
            const optionValue = $(option).val();

            if (optionText.includes(`(${timezoneName})`)) {
              return optionValue;
            }

            if (optionValue === offsetStr && optionText.includes(timezoneName.split('/')[0])) {
              bestMatch = optionValue;
              break;
            }

            if (optionValue === offsetStr && !bestMatch) {
              bestMatch = optionValue;
            }
          }

          if (bestMatch) return bestMatch;
        }

        const date = new Date();
        const offset = -date.getTimezoneOffset();
        const hours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
        const minutes = (Math.abs(offset) % 60).toString().padStart(2, '0');
        return `${offset >= 0 ? '+' : '-'}${hours}:${minutes}`;

      } catch (error) {
        console.error('Error getting system timezone:', error);
        return null;
      }
    }

    if ($dropdown.find('option').length > 0) {
      const systemTimezone = getSystemTimezone($dropdown);
      setTimezoneInDropdown($dropdown, systemTimezone);
      return;
    }

    const response = await fetch(jsonPath);
    const timezones = await response.json();

    function extractUTCOffset(label) {
      const match = label.match(/UTC([+-]\d{2}:\d{2})/);
      return match ? match[1] : '';
    }

    $dropdown.empty();
    timezones.forEach(timezone => {
      $dropdown.append(
        $('<option>', {
          value: extractUTCOffset(timezone.label),
          text: timezone.label
        })
      );
    });

    function setTimezoneInDropdown($select, timezoneName) {
      if (!timezoneName) return false;

      const allOptions = Array.from($select.find('option'));
      const exactMatch = allOptions.find(option =>
        option.text.includes(`(${timezoneName})`)
      );

      if (exactMatch) {
        $select.find('option').prop('selected', false);
        $(exactMatch).prop('selected', true);
        return true;
      }

      const region = timezoneName.split('/')[0];
      const regionMatch = allOptions.find(option =>
        option.text.includes(`(${region}/`)
      );

      if (regionMatch) {
        $select.find('option').prop('selected', false);
        $(regionMatch).prop('selected', true);
        return true;
      }

      return false;
    }

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimezone) {
      setTimezoneInDropdown($dropdown, browserTimezone);
    }

  } catch (error) {
    console.error('Error initializing timezone dropdown:', error);
  }
}

function setupResourceTypeDropdownAjax() {
  const select = $("#input-resourceinformation-resourcetype");
  if (select.length === 0) return;

  select.prop('disabled', true).empty().append(
    $("<option>", {
      value: "",
      text: "Loading...",
    })
  );

  $.ajax({
    url: "api/v2/vocabs/resourcetypes",
    method: "GET",
    dataType: "json",
    success: function (data) {
      select.empty();
      addPlaceholder(select, true);

      if (Array.isArray(data)) {
        const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
        const filteredData = filterDataByGEM(data, 'resourceType', isGEM);

        filteredData.forEach(function (type) {
          select.append(
            $("<option>", {
              value: type.id,
              text: type.resource_type_general,
              title: type.description,
            })
          );
        });
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.error("Error loading resource types:", textStatus, errorThrown);
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Error loading data",
        })
      );
    },
    complete: function () {
      select.prop('disabled', false).trigger("change");
    },
  });
}

function setupLanguageDropdownAjax() {
  const select = $("#input-resourceinformation-language");
  if (select.length === 0) return;

  select.prop('disabled', true).empty().append(
    $("<option>", {
      value: "",
      text: "Loading...",
    })
  );

  $.ajax({
    url: "api/v2/vocabs/languages",
    method: "GET",
    dataType: "json",
    success: function (data) {
      select.empty();
      addPlaceholder(select, true);

      if (Array.isArray(data)) {
        const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
        const filteredData = filterDataByGEM(data, 'language', isGEM);

        filteredData.forEach(function (lang) {
          select.append(
            $("<option>", {
              value: lang.id,
              text: lang.name,
              title: lang.code,
            })
          );
        });

        const englishOption = filteredData.find(lang => lang.code === 'en');
        if (englishOption) {
          select.val(englishOption.id);
        }
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.error("Error loading languages:", textStatus, errorThrown);
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Error loading data",
        })
      );
    },
    complete: function () {
      select.prop('disabled', false);
    },
  });
}

function setupTitleTypeDropdownAjax() {
  const select = $("#input-resourceinformation-titletype");
  if (select.length === 0) {
    console.error("Title type dropdown not found. Ensure the element with ID 'input-resourceinformation-titletype' exists in the DOM.");
    return;
  }

  select.prop('disabled', true).empty().append(
    $("<option>", {
      value: "",
      text: "Loading...",
    })
  );

  $.ajax({
    url: "api/v2/vocabs/titletypes",
    method: "GET",
    dataType: "json",
    success: function (data) {
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Choose...",
          "data-translate": "general.choose",
        })
      );

      let mainTitleId = "";
      let alternativeTitleId = "";
      if (Array.isArray(data)) {
        data.forEach(function (type) {
          const option = $("<option>", {
            value: type.id,
            text: type.name,
          });

          select.append(option);

          if (type.name.toLowerCase() === "main title") {
            mainTitleId = type.id.toString();
          }
          if (type.name.toLowerCase() === "alternative title") {
            alternativeTitleId = type.id.toString();
          }
        });
      }

      if (mainTitleId) {
        select.val(mainTitleId);
        window.mainTitleTypeId = mainTitleId;
      }
      window.alternativeTitleTypeId = alternativeTitleId || "";
      window.titleTypeOptionsHtml = select.html();
    },
    error: function (jqXHR, textStatus, errorThrown) {
      console.error("Error loading title types:", textStatus, errorThrown);
      select.empty().append(
        $("<option>", {
          value: "",
          text: "Error loading data",
        })
      );
    },
    complete: function () {
      select.prop('disabled', false);
    },
  });
}

/**
 * Populates the select field with ID input-rights-license with options created via an API call.
 * @param {boolean} isSoftware - Determines whether to retrieve licenses for software or all resource types.
 */
function setupLicenseDropdown(isSoftware) {
  const $select = $("#input-rights-license");
  const top_licenseId = "CC-BY-4.0";
  const copyleftLicenses = ['GPL-3.0-or-later', 'EUPL-1.2'];
  const endpoint = isSoftware ? "vocabs/licenses/software" : "vocabs/licenses/all";

  $select.prop("disabled", true).empty().append(
    $("<option>", {
      value: "",
      text: "Loading...",
      "data-translate": "general.loading",
    })
  );

  $.getJSON(`./api/v2/${endpoint}`, function (data) {
    let processedLicenses = [];

    if (!isSoftware) {
      processedLicenses = data
        .filter(item => item.forSoftware === "0")
        .sort((a, b) => {
          if (a.rightsIdentifier === top_licenseId) return -1;
          if (b.rightsIdentifier === top_licenseId) return 1;
          return a.rightsIdentifier.localeCompare(b.rightsIdentifier);
        });
    } else {
      processedLicenses = data
        .filter(item => item.forSoftware === "1")
        .sort((a, b) => {
          const aIsCopyleft = copyleftLicenses.includes(a.rightsIdentifier);
          const bIsCopyleft = copyleftLicenses.includes(b.rightsIdentifier);

          if (aIsCopyleft !== bIsCopyleft) {
            return aIsCopyleft ? 1 : -1;
          }
          return a.rightsIdentifier.localeCompare(b.rightsIdentifier);
        });
    }

    $select.empty();

    processedLicenses.forEach(license => {
      const option = $("<option>", {
        value: license.rights_id,
        text: `${license.text} (${license.rightsIdentifier})`,
        title: license.description || license.text
      });

      if (license.rightsIdentifier === "CC-BY-4.0") {
        option.prop("selected", true);
      }

      $select.append(option);
    });

    $select.prop("disabled", false).trigger("change");

  }).fail(function (jqXHR, textStatus, errorThrown) {
    console.error("Error loading licenses:", textStatus, errorThrown);
    $select.empty().append(
      $("<option>", {
        value: "1",
        text: "Creative Commons Attribution 4.0 International (CC-BY-4.0)",
        selected: true
      })
    );

    $select.prop("disabled", false).trigger("change");
  });
}

/**
 * Adds a "Choose..." placeholder option to a dropdown.
 * For ICGEM-specific dropdowns, skips placeholder when ICGEM mode is enabled.
 * @param {jQuery} $select - The jQuery select element
 * @param {boolean} isGEMDropdown - Whether this is a ICGEM-specific dropdown
 */
function addPlaceholder($select, isGEMDropdown = false) {
  const isGEM = window.ELMO_FEATURES?.showGGMsProperties;

  if (isGEMDropdown && isGEM) return;

  const translatedText = window.elmo?.translate?.('general.choose') || 'Choose...';

  $select.append(
    $("<option>", { value: "", text: translatedText, "data-translate": "general.choose" })
  );
}

/**
 * Runs legacy sequential AJAX fallbacks when parallel fetch initialization is unavailable or fails.
 */
function runSequentialFallback() {
  console.warn("Falling back to legacy sequential dropdown initialization.");
  setupTimezoneDropdownAjax();
  setupResourceTypeDropdownAjax();
  setupLanguageDropdownAjax();
  setupTitleTypeDropdownAjax();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setupTimezoneDropdownAjax,
    setupResourceTypeDropdownAjax,
    setupLanguageDropdownAjax,
    setupTitleTypeDropdownAjax,
    setupLicenseDropdown,
    addPlaceholder,
    runSequentialFallback,
  };
}

if (typeof window !== 'undefined') {
  window.setupTimezoneDropdownAjax = setupTimezoneDropdownAjax;
  window.setupLicenseDropdown = setupLicenseDropdown;
  window.setupLanguageDropdownAjax = setupLanguageDropdownAjax;
  window.setupResourceTypeDropdownAjax = setupResourceTypeDropdownAjax;
  window.setupTitleTypeDropdownAjax = setupTitleTypeDropdownAjax;
  window.addPlaceholder = addPlaceholder;
  window.runSequentialFallback = runSequentialFallback;
}
