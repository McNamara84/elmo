const identifierDetection = (typeof require === "function" && typeof module !== "undefined")
  ? require("./services/identifierDetectionService.js") : window.elmoIdentifierDetection;

const dropdownUtils =
  (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./dropdownUtils.js')
    : {
        updateDropdownPlaceholders: window.updateDropdownPlaceholders,
        filterDataByGEM: window.filterDataByGEM,
      };

const dropdownAjax =
  (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./dropdownAjax.js')
    : {
        setupTimezoneDropdownAjax: window.setupTimezoneDropdownAjax,
        setupResourceTypeDropdownAjax: window.setupResourceTypeDropdownAjax,
        setupLanguageDropdownAjax: window.setupLanguageDropdownAjax,
        setupTitleTypeDropdownAjax: window.setupTitleTypeDropdownAjax,
        setupLicenseDropdown: window.setupLicenseDropdown,
        addPlaceholder: window.addPlaceholder,
        runSequentialFallback: window.runSequentialFallback,
      };

let fundersDataPromise = null;
const relatedWorkDropdownCache = {
  relations: null,
  identifierTypes: null,
};
const identifierPatternCache = new Map();

/**
 * Loads the local Crossref Funder Registry once and reuses the result.
 * The request is intentionally excluded from initial page loading and starts
 * only when CFID autocomplete is actually used.
 * @returns {Promise<Array>} Resolves with the available funder entries.
 */
function loadFundersData() {
  if (Array.isArray(window.fundersData)) {
    return Promise.resolve(window.fundersData);
  }

  if (fundersDataPromise) {
    return fundersDataPromise;
  }

  if (typeof fetch !== 'function') {
    window.fundersData = [];
    fundersDataPromise = Promise.resolve(window.fundersData);
    return fundersDataPromise;
  }

  fundersDataPromise = fetch('json/funders.json')
    .then(response => response.ok ? response.json() : [])
    .then(data => {
      window.fundersData = Array.isArray(data) ? data : [];
      return window.fundersData;
    })
    .catch(() => {
      window.fundersData = [];
      return window.fundersData;
    });

  return fundersDataPromise;
}

/**
 * This script handles the setup and initialization of various dropdowns, event listeners, and autocomplete functions for the metadata editor.
 */

/**
 * Initializes all dropdowns in parallel for faster page load.
 */
async function initializeAllDropdownsParallel() {
  if (typeof fetch !== 'function') {
    return dropdownAjax.runSequentialFallback();
  }

  const dropdownSelectors = {
    resourceType: $("#input-resourceinformation-resourcetype"),
    language: $("#input-resourceinformation-language"),
    titleType: $("#input-resourceinformation-titletype"),
    license: $("#input-rights-license"),
    relation: $("#input-relatedwork-relation"),
    identifierType: $("#input-relatedwork-identifiertype")
  };

  // Set loading state
  Object.values(dropdownSelectors).forEach($el => {
    if ($el.length) {
      $el.prop('disabled', true).empty().append(
        $("<option>", { value: "", text: "Loading..." })
      );
    }
  });

  // Define the operations. Note that we want failures to actually reject 
  // so we can identify them in the results.
  const fetchOperations = {
    timezones: fetch('json/timezones.json').then(r => r.ok ? r.json() : Promise.reject()),
    resourceTypes: fetch('api/v2/vocabs/resourcetypes').then(r => r.ok ? r.json() : Promise.reject()),
    languages: fetch('api/v2/vocabs/languages').then(r => r.ok ? r.json() : Promise.reject()),
    titleTypes: fetch('api/v2/vocabs/titletypes').then(r => r.ok ? r.json() : Promise.reject()),
    licenses: fetch('api/v2/vocabs/licenses/all').then(r => r.ok ? r.json() : Promise.reject()),
    relations: fetch('api/v2/vocabs/relations').then(r => r.ok ? r.json() : { relations: [] }),
    identifierTypes: fetch('api/v2/validation/identifiertypes/active').then(r => r.ok ? r.json() : { identifierTypes: [] })
  };

  // We convert the dictionary into an array of entries: [[key, promise], [key, promise]...]
  const keys = Object.keys(fetchOperations);
  const promises = Object.values(fetchOperations);

  // Promise.allSettled will NEVER reject. It always resolves once everything is done.
  const results = await Promise.allSettled(promises);

  // We map the settled results back to our keys
  const data = {};
  const failures = [];

  results.forEach((result, index) => {
    const key = keys[index];
    if (result.status === 'fulfilled') {
      data[key] = result.value;
    } else {
      // Keep track of exactly which key failed
      failures.push(key);
      console.warn(`Failed to fetch ${key} in parallel. Will use fallback.`);
    }
  });

  // --- POPULATE SUCCESSFUL DROPDOWNS ---
  if ('timezones' in data) populateTimezoneDropdownWithData(data.timezones);
  if ('resourceTypes' in data) populateResourceTypeDropdownWithData(data.resourceTypes);
  if ('languages' in data) populateLanguageDropdownWithData(data.languages);
  if ('titleTypes' in data) populateTitleTypeDropdownWithData(data.titleTypes);
  if ('licenses' in data) populateLicenseDropdownWithData(data.licenses);
  if ('relations' in data) populateRelationsDropdownWithData(data.relations);
  if ('identifierTypes' in data) populateIdentifierTypesDropdownWithData(data.identifierTypes);

  // --- TARGETED FALLBACKS ---
  // Only trigger the sequential AJAX fallbacks for the ones that actually failed!
  if (failures.includes('timezones')) dropdownAjax.setupTimezoneDropdownAjax();
  if (failures.includes('resourceTypes')) dropdownAjax.setupResourceTypeDropdownAjax();
  if (failures.includes('languages')) dropdownAjax.setupLanguageDropdownAjax();
  if (failures.includes('titleTypes')) dropdownAjax.setupTitleTypeDropdownAjax();
  
  // If licenses/relations/identifiers failed and don't have fallbacks,
  // we can at least restore their disabled state so they aren't stuck on "Loading..."
  failures.forEach(key => {
    if (dropdownSelectors[key]) {
      dropdownSelectors[key].prop('disabled', false).empty().append(
        $("<option>", { value: "", text: "Error loading options" })
      );
    }
  });

  document.dispatchEvent(new CustomEvent('dropdownsReady'));
}
export function setBrowserTimezone() {
  const $dropdown = $('#input-stc-timezone');
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (browserTimezone) {
    const allOptions = Array.from($dropdown.find('option'));
    const exactMatch = allOptions.find(option => option.text.includes(`(${browserTimezone})`));
    if (exactMatch) {
      $(exactMatch).prop('selected', true);
    }
  }
}
/**
 * Populates timezone dropdown with pre-fetched data
 * @param {Array} timezones - Array of timezone objects
 */
function populateTimezoneDropdownWithData(timezones) {
  const $dropdown = $('#input-stc-timezone');
  if (!$dropdown.length || !timezones.length) return;

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

  // Set browser timezone
  setBrowserTimezone()

}

/**
 * Populates resource type dropdown with pre-fetched data
 * @param {Array} types - Array of resource type objects
 */
function populateResourceTypeDropdownWithData(types) {
  const $select = $("#input-resourceinformation-resourcetype");
  if (!$select.length) return;
    
  // Always empty to remove "Loading..." option
  $select.empty();
  
  // Handle placeholder logic
  dropdownAjax.addPlaceholder($select, true);
  
  if (Array.isArray(types)) {
    // Filter data based on GEM flag
    const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
    const filteredData = typeof dropdownUtils.filterDataByGEM === 'function'
      ? dropdownUtils.filterDataByGEM(types, 'resourceType', isGEM)
      : types;
    
    filteredData.forEach(type => {
      $select.append(
        $("<option>", {
          value: type.id,
          text: type.resource_type_general,
          title: window.resourceTypeDescriptions?.getResourceTypeDescription(
            type.resource_type_general, type.description) || type.description
        })
      );
    });
  }
  $select.prop('disabled', false).trigger("change");
}

/**
 * Populates language dropdown with pre-fetched data
 * @param {Array} languages - Array of language objects
 */
function populateLanguageDropdownWithData(languages) {
  const $select = $("#input-resourceinformation-language");
  if (!$select.length) return;
  
  // Always empty to remove "Loading..." option
  $select.empty();
  
  // Handle placeholder logic
  dropdownAjax.addPlaceholder($select, true);
  
  if (Array.isArray(languages)) {
    // Filter data based on GEM flag
    const isGEM = window.ELMO_FEATURES?.showGGMsProperties;
    const filteredData = typeof dropdownUtils.filterDataByGEM === 'function'
      ? dropdownUtils.filterDataByGEM(languages, 'language', isGEM)
      : languages;
    
    filteredData.forEach(lang => {
      $select.append(
        $("<option>", {
          value: lang.id,
          text: lang.name,
          title: lang.code
        })
      );
    });

    // Pre-select English (code "en") as default
    const englishOption = filteredData.find(lang => lang.code === 'en');
    if (englishOption) {
      $select.val(englishOption.id);
    }
  }
  $select.prop('disabled', false);
}

/**
 * Populates title type dropdown with pre-fetched data
 * @param {Array} types - Array of title type objects
 */
function populateTitleTypeDropdownWithData(types) {
  const $select = $("#input-resourceinformation-titletype");
  if (!$select.length) return;

  $select.empty();
  dropdownAjax.addPlaceholder($select);

  let mainTitleId = "";
  let alternativeTitleId = "";

  if (Array.isArray(types)) {
    types.forEach(type => {
      $select.append(
        $("<option>", {
          value: type.id,
          text: type.name
        })
      );
      if (type.name.toLowerCase() === "main title") {
        mainTitleId = type.id.toString();
      }
      if (type.name.toLowerCase() === "alternative title") {
        alternativeTitleId = type.id.toString();
      }
    });
  }

  if (mainTitleId) {
    $select.val(mainTitleId);
    window.mainTitleTypeId = mainTitleId;
  }
  window.alternativeTitleTypeId = alternativeTitleId || "";
  window.titleTypeOptionsHtml = $select.html();
  $select.prop('disabled', false);
}

export function setCCBYasDefault() {
  const $select = $("#input-rights-license");
  if (!$select.length) return;

  const $option = $select.find('option').filter(function () {
    return String($(this).text()).includes('(CC-BY-4.0)');
  }).first();
  if ($option.length) {
    $select.val($option.val());
  } else {
    // select the first option if CC-BY-4.0 is not found
    $select.find('option').first().prop('selected', true);
  }
}


/**
 * Populates license dropdown with pre-fetched data
 * @param {Array} licenses - Array of license objects
 */
function populateLicenseDropdownWithData(licenses) {
  const $select = $("#input-rights-license");
  if (!$select.length) return;

  $select.empty();

  if (Array.isArray(licenses) && licenses.length > 0) {
    licenses.forEach(val => {
      const $option = $("<option>", {
        value: val.rights_id,
        text: val.text + " (" + val.rightsIdentifier + ")"
      });
      if (val.rightsIdentifier === 'CC-BY-4.0') {
        $option.prop('selected', true);
      }
      $select.append($option);
    });
  } else {
    // Fallback: use CC-BY-4.0 (rights_id=1)
    $select.append($("<option>", {
      value: "1",
      text: "Creative Commons Attribution 4.0 International (CC-BY-4.0)",
      selected: true
    }));
  }
  $select.prop('disabled', false).trigger("change");
}

function relatedWorkSelects(root, name, legacyId) {
  const selector = `select[name="${name}"]`;
  const scope = root ? $(root) : $(document);
  let selects = scope.is(selector) ? scope.filter(selector) : scope.find(selector);

  if (!root) {
    selects = selects.add(legacyId);
  }
  return selects;
}

function populateRelatedWorkSelect(select, items, createOption, relationSelect = false) {
  const currentValue = String(select.val() || '');
  const selectedOption = select.find('option:selected').first();
  const currentRelationName = String(selectedOption.attr('data-relation-name') || '').trim();
  const currentText = String(selectedOption.text() || '').trim();

  select.empty();
  dropdownAjax.addPlaceholder(select);
  items.forEach(item => select.append(createOption(item)));

  let restoredOption = select.find('option').filter(function () {
    return String($(this).val()) === currentValue && currentValue !== '';
  }).first();

  if (!restoredOption.length && relationSelect) {
    const relationName = currentRelationName || currentText;
    restoredOption = select.find('option').filter(function () {
      return String($(this).attr('data-relation-name') || '').trim() === relationName && relationName !== '';
    }).first();
  }

  if (!restoredOption.length && currentText !== '') {
    restoredOption = select.find('option').filter(function () {
      return String($(this).text() || '').trim() === currentText;
    }).first();
  }

  select.val(restoredOption.length ? restoredOption.val() : '');
  select.prop('disabled', false);
}

/**
 * Applies the cached Related Work vocabularies to all matching selects below root.
 * Existing selections are restored by ID first and by canonical name second.
 * @param {Document|HTMLElement|jQuery|null} [root=null] - Scope containing Related Work selects.
 * @param {Object} [options] - Application options.
 * @param {boolean} [options.notify=true] - Dispatch the dropdown update event.
 * @param {boolean} [options.refreshChosen=true] - Refresh Chosen widgets after population.
 */
function applyRelatedWorkDropdowns(root = null, options = {}) {
  if (Array.isArray(relatedWorkDropdownCache.relations)) {
    relatedWorkSelects(root, 'relation[]', '#input-relatedwork-relation').each(function () {
      populateRelatedWorkSelect($(this), relatedWorkDropdownCache.relations, relation => {
        const canonicalName = String(relation.name || '').trim();
        const visibleLabel = relation.label || relation.displayName || relation.display_name || canonicalName;
        return $('<option>', {
          value: relation.id,
          text: visibleLabel,
          title: relation.description,
          'data-relation-name': canonicalName,
        });
      }, true);
    });
  }

  if (Array.isArray(relatedWorkDropdownCache.identifierTypes)) {
    relatedWorkSelects(root, 'rIdentifierType[]', '#input-relatedwork-identifiertype').each(function () {
      populateRelatedWorkSelect($(this), relatedWorkDropdownCache.identifierTypes, type => $('<option>', {
        value: type.name,
        text: type.name,
        title: type.description,
      }));
    });
  }

  if (options.refreshChosen !== false) {
    $('.chosen-select').trigger('chosen:updated');
  }
  if (options.notify !== false) {
    document.dispatchEvent(new CustomEvent('relatedWorkDropdowns:updated'));
  }
}

/**
 * Populates relations dropdown with pre-fetched data
 * @param {Object} response - Response object containing relations array
 */
function populateRelationsDropdownWithData(response) {
  relatedWorkDropdownCache.relations = response && Array.isArray(response.relations)
    ? [...response.relations].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    : [];
  applyRelatedWorkDropdowns();
}

/**
 * Populates identifier types dropdown with pre-fetched data
 * @param {Object} response - Response object containing identifierTypes array
 */
function populateIdentifierTypesDropdownWithData(response) {
  identifierPatternCache.clear();
  relatedWorkDropdownCache.identifierTypes = response && Array.isArray(response.identifierTypes)
    ? [...response.identifierTypes]
    : [];
  applyRelatedWorkDropdowns();
  $('select[name="rIdentifierType[]"], select[name="dIdentifierType[]"]').each(function () {
    updateValidationPattern(this);
  });
}

// Make parallel initialization function available globally
window.initializeAllDropdownsParallel = initializeAllDropdownsParallel;
window.setupIdentifierTypesDropdown = setupIdentifierTypesDropdown;
window.elmo = window.elmo || {};
window.elmo.applyRelatedWorkDropdowns = applyRelatedWorkDropdowns;

function startInitialDropdownPopulation() {
  window.elmo = window.elmo || {};
  window.elmo.dropdownsReady = initializeAllDropdownsParallel();
  return window.elmo.dropdownsReady;
}

// Update dropdown placeholders when translations are loaded or changed
if (typeof dropdownUtils.updateDropdownPlaceholders === 'function') {
  document.addEventListener('translationsLoaded', dropdownUtils.updateDropdownPlaceholders);
}

$(document).ready(function () {
  // Use parallel initialization for faster page load
  startInitialDropdownPopulation();
  
  // Event handler to monitor if the resource type is changed
  // Only reload licenses when user actually selects a resource type (not on initial load)
  $("#input-resourceinformation-resourcetype").change(function () {
    var selectedValue = $(this).val();
    // Skip if no value selected (e.g., "Choose..." or initial trigger)
    if (!selectedValue) {
      return;
    }
    
    var selectedResourceType = $("#input-resourceinformation-resourcetype option:selected").text().trim();

    // Check if "Software" is selected
    if (selectedResourceType === "Software") {
      window.setupLicenseDropdown(true);
    } else {
      window.setupLicenseDropdown(false);
    }
  });

  /**
   * Sets up the autocomplete functionality for funder input elements.
   * Supports two modes based on ELMO_FEATURES.funderPidMode:
   * - 'CFID' (default): Uses local Crossref Funder Registry data
   * - 'ROR': Uses server-side ROR affiliation search
   * @param {HTMLElement} inputElement - The input element to attach autocomplete to.
   */
  window.setUpAutocompleteFunder = function (inputElement) {
    if (!inputElement || $(inputElement).data('ui-autocomplete')) {
      return;
    }

    const isRorMode = window.ELMO_FEATURES && window.ELMO_FEATURES.funderPidMode === 'ROR';

    if (isRorMode) {
      setUpAutocompleteFunderRor(inputElement);
    } else {
      setUpAutocompleteFunderCfid(inputElement);
    }
  };

  $(".inputFunder").each(function () {
    window.setUpAutocompleteFunder(this);
  });

  /**
   * Sets up funder autocomplete using local Crossref Funder Registry data.
   * @param {HTMLElement} inputElement - The input element to attach autocomplete to.
   */
  function setUpAutocompleteFunderCfid(inputElement) {
    const $input = $(inputElement);
    let searchTimeout;
    const MAX_RESULTS = 30; // Limit dropdown results
    const MIN_LENGTH = 2; // Minimum characters before search

    $input.one('focus.funder-data', () => {
      loadFundersData();
    });

    $input
      .autocomplete({
        source: function (request, response) {
          // Cancel previous search if still pending
          clearTimeout(searchTimeout);
          
          // Require at least MIN_LENGTH characters for search
          if (!request.term || request.term.length < MIN_LENGTH) {
            response([]);
            return;
          }
          
          // Debounce search before filtering the shared lazy-loaded data.
          searchTimeout = setTimeout(() => {
            loadFundersData().then(fundersData => {
              // Search at start of name first (more specific), then anywhere
              const searchTerm = $.ui.autocomplete.escapeRegex(request.term).toLowerCase();
              const results = [];

              for (let i = 0; i < fundersData.length && results.length < MAX_RESULTS; i++) {
                const funder = fundersData[i];
                if (!funder || typeof funder.name !== 'string') {
                  continue;
                }

                const itemName = funder.name.toLowerCase();

                // Prioritize matches at the start of the name
                if (itemName.indexOf(searchTerm) === 0) {
                  results.push(funder);
                }
              }

              // If we need more results, search anywhere in the name
              if (results.length < MAX_RESULTS) {
                for (let i = 0; i < fundersData.length && results.length < MAX_RESULTS; i++) {
                  const funder = fundersData[i];
                  if (!funder || typeof funder.name !== 'string') {
                    continue;
                  }

                  const itemName = funder.name.toLowerCase();

                  // Check if this funder is NOT already in the results array
                  // AND Check if searchTerm exists anywhere in the funder name
                  if (results.indexOf(funder) === -1 && itemName.indexOf(searchTerm) !== -1) {
                    results.push(funder);
                  }
                }
              }

              response(results);
            });
          }, 200); // 200ms debounce
        },
        minLength: MIN_LENGTH,
        select: function (event, ui) {
          $(this).val(ui.item.name);
          $(this).siblings(".inputFunderId").val(ui.item.crossRefId);
          $(this).siblings(".inputFunderIdTyp").val("crossref");
          return false;
        },
        position: { my: "left bottom", at: "left top", collision: "flip" },
      })
      .autocomplete("instance")._renderItem = function (ul, item) {
        return $("<li>")
          .append("<div>" + item.name + "</div>")
          .appendTo(ul);
      };
  }

  /**
   * Sets up funder autocomplete using server-side ROR affiliation search.
   * @param {HTMLElement} inputElement - The input element to attach autocomplete to.
   */
  function setUpAutocompleteFunderRor(inputElement) {
    let searchTimeout;
    const MIN_LENGTH = 2;

    $(inputElement)
      .autocomplete({
        source: function (request, response) {
          clearTimeout(searchTimeout);

          if (!request.term || request.term.length < MIN_LENGTH) {
            response([]);
            return;
          }

          searchTimeout = setTimeout(() => {
            fetch('api/v2/affiliations/search?q=' + encodeURIComponent(request.term) + '&limit=30')
              .then(r => r.ok ? r.json() : [])
              .then(data => {
                response(data.map(item => ({
                  label: item.name,
                  value: item.name,
                  rorId: item.id,
                  name: item.name
                })));
              })
              .catch(() => response([]));
          }, 200);
        },
        minLength: MIN_LENGTH,
        select: function (event, ui) {
          $(this).val(ui.item.name);
          $(this).siblings(".inputFunderId").val(ui.item.rorId);
          $(this).siblings(".inputFunderIdTyp").val("ROR");
          return false;
        },
        position: { my: "left bottom", at: "left top", collision: "flip" },
      })
      .autocomplete("instance")._renderItem = function (ul, item) {
        return $("<li>")
          .append($("<div>").text(item.name))
          .appendTo(ul);
      };
  }

  // Note: Relations dropdown is now populated by initializeAllDropdownsParallel()

});


/**
 * Function to populate the dropdown menu of identifier types.
 * @param {string|jQuery} id - The selector or dropdown to populate.
 * @returns {Promise<void>} Readiness shared by imports and autocomplete.
 */
function setupIdentifierTypesDropdown(id) {
  var select = $(id);
  const pending = select.data('identifierTypesReady');
  if (pending) {
    return pending;
  }

  // Add the "Choose..." placeholder option
  select.empty().append(
    $("<option>", {
      value: "",
      text: "Choose...", // Placeholder text
      "data-translate": "general.choose"
    })
  );

  const ready = new Promise((resolve, reject) => {
    $.getJSON("./api/v2/validation/identifiertypes/active", function (response) {
      if (response && response.identifierTypes) {
        response.identifierTypes.forEach(function (type) {
          select.append(
            $("<option>", {
              value: type.name,
              text: type.name,
              title: type.description, // Uses the description as a tooltip
            })
          );
        });
        // Update chosen-style dropdowns if necessary
        $(".chosen-select").trigger("chosen:updated");
        resolve();
      } else {
        console.warn("No identifier types available");
        resolve();
      }
    }).fail(function (jqXHR, textStatus, errorThrown) {
      console.error("Error loading identifier types:", textStatus, errorThrown);
      reject(new Error("Error loading identifier types: " + textStatus));
    });
  });

  select.data('identifierTypesReady', ready);
  return ready;
}


// Each DOM input owns its timer and version; editing one row cannot cancel another.
const identifierFieldStates = new WeakMap();
const identifierRegistry = new identifierDetection.IdentifierDetectionService({
  request: doi => new Promise((resolve, reject) => $.ajax({
    url: 'api/v2/validation/identifier-type', data: { doi }, method: 'GET', dataType: 'json',
    success: resolve, error: reject,
  })),
});

/**
 * Gets the state used to reject stale asynchronous results for this field.
 * @param {HTMLInputElement} input Identifier field.
 * @returns {{version: number, timer: number|null}} Field's request version and debounce timer.
 */
function fieldState(input) {
  if (!identifierFieldStates.has(input)) identifierFieldStates.set(input, { version: 0, timer: null });
  return identifierFieldStates.get(input);
}

/**
 * Cancels scheduled detection and invalidates in-flight results on edits or restoration.
 * @param {HTMLInputElement} [input] Identifier field, if still present.
 * @returns {void}
 */
function invalidateIdentifierDetection(input) {
  if (!input) return;
  const state = fieldState(input);
  state.version += 1;
  clearTimeout(state.timer);
  state.timer = null;
  detectionStatus(input, null);
}

/**
 * Resets a retained field after form clearing, including requests for its previous value.
 * @param {HTMLInputElement} input Cleared Related Work or GEM identifier field.
 * @returns {void}
 */
export function resetIdentifierField(input) {
  invalidateIdentifierDetection(input);
  const select = identifierTypeSelectForInput(input);
  clearManualIdentifierTypeSelection(select);
  setDetectedIdentifierType(select, null);
  input.setCustomValidity('');
}

/**
 * Protects an imported or autosaved choice, including an intentional empty type.
 * GEM options may arrive after restoration; only the same field version may
 * reapply the stored choice once its dropdown is ready.
 * @param {HTMLInputElement} [input] Restored identifier field.
 * @param {string|null} [restoredType] Stored choice for a dropdown still loading.
 * @returns {void}
 */
function restoreIdentifierType(input, restoredType) {
  if (!input) return;
  invalidateIdentifierDetection(input);
  const select = identifierTypeSelectForInput(input);
  markManualIdentifierTypeSelection(select);
  updateValidationPattern(select[0]);
  const ready = select.data('identifierTypesReady');
  if (restoredType !== undefined && ready) {
    const version = fieldState(input).version;
    const identifier = String($(input).val() || '');
    Promise.resolve(ready).then(() => {
      if (!input.isConnected || fieldState(input).version !== version || String($(input).val() || '') !== identifier) return;
      if (restoredType && !select.find('option').filter(function () { return $(this).val() === restoredType; }).length) {
        select.append($('<option>', { value: restoredType, text: restoredType }));
      }
      select.val(restoredType).trigger('change');
    }).catch(() => {});
  }
}

const IDENTIFIER_TYPE_AUTO_UPDATE_KEY = 'elmoIdentifierTypeAutoUpdate';
const IDENTIFIER_TYPE_MANUAL_SELECTION_KEY = 'elmoIdentifierTypeManualSelection';
const IDENTIFIER_TYPE_MANUAL_IDENTIFIER_KEY = 'elmoIdentifierTypeManualIdentifier';

// A native/Chosen change after identifier input is a user decision. Bind that
// decision to the current identifier so a pending debounced detector cannot
// erase it. Typing a new identifier clears the marker and enables detection again.

function identifierFieldScope(element) {
  const field = $(element);
  const isRelatedWorkField = field.is('[name="rIdentifier[]"], [name="rIdentifierType[]"]');
  if (isRelatedWorkField) {
    const card = field.closest('[data-related-work-entry]');
    if (card.length) {
      return card;
    }
  }
  return field.closest('.row');
}

function identifierTypeSelectForInput(inputElement) {
  const input = $(inputElement);
  const selector = input.is('[name="rIdentifier[]"]')
    ? 'select[name="rIdentifierType[]"]'
    : 'select[name="dIdentifierType[]"]';
  return identifierFieldScope(inputElement).find(selector).first();
}

function identifierInputForTypeSelect(selectElement) {
  const select = $(selectElement);
  const selector = select.is('[name="rIdentifierType[]"]')
    ? 'input[name="rIdentifier[]"]'
    : 'input[name="dIdentifier[]"]';
  return identifierFieldScope(selectElement).find(selector).first();
}

function clearManualIdentifierTypeSelection(selectElement) {
  selectElement
    .removeData(IDENTIFIER_TYPE_MANUAL_SELECTION_KEY)
    .removeData(IDENTIFIER_TYPE_MANUAL_IDENTIFIER_KEY);
}

function markManualIdentifierTypeSelection(selectElement) {
  const identifierInput = identifierInputForTypeSelect(selectElement);
  selectElement
    .data(IDENTIFIER_TYPE_MANUAL_SELECTION_KEY, true)
    .data(IDENTIFIER_TYPE_MANUAL_IDENTIFIER_KEY, String(identifierInput.val() || ''));
}

function hasManualIdentifierTypeSelection(selectElement, identifier) {
  return selectElement.data(IDENTIFIER_TYPE_MANUAL_SELECTION_KEY) === true
    && selectElement.data(IDENTIFIER_TYPE_MANUAL_IDENTIFIER_KEY) === identifier;
}

function normalizeIdentifierPattern(pattern) {
  return identifierDetection.normalizePattern(pattern);
}

/**
 * Applies format/checksum validity to the matching identifier without browser regex differences.
 * @param {HTMLSelectElement} selectElement Identifier type dropdown in the same row/card.
 * @returns {void}
 */
function updateValidationPattern(selectElement) {
  const select = $(selectElement);
  const selectedType = String(select.val() || '').trim();
  const vocabulary = relatedWorkDropdownCache.identifierTypes;
  const input = identifierInputForTypeSelect(selectElement);
  if (!input.length) return;
  input.removeAttr('pattern');
  const apply = patterns => {
    if (String(select.val() || '').trim() !== selectedType || relatedWorkDropdownCache.identifierTypes !== vocabulary) return;
    const value = String(input.val() || '');
    const valid = !value || !selectedType || (identifierDetection.passesAdditionalChecks(value, selectedType)
      && (!patterns.length || patterns.some(pattern => identifierDetection.fullMatch(pattern, value.trim()))));
    const message = window.elmo?.translate?.('relatedWork.identifierInvalid') || 'Please enter a valid identifier.';
    input[0].setCustomValidity(valid ? '' : message);
  };
  if (!selectedType) {
    apply([]);
    return;
  }
  // Validate with the vocabulary that populated the dropdown, before consulting legacy DB patterns.
  const type = identifierDetection.activeType(selectedType, relatedWorkDropdownCache.identifierTypes || []);
  if (type) {
    const patterns = identifierDetection.patternsFor(type);
    identifierPatternCache.set(selectedType, patterns);
    apply(patterns);
    return;
  }
  if (identifierPatternCache.has(selectedType)) {
    apply(identifierPatternCache.get(selectedType));
    return;
  }
  $.ajax({
    url: 'api/v2/validation/patterns/' + encodeURIComponent(selectedType), method: 'GET', dataType: 'json',
    success: response => {
      if (relatedWorkDropdownCache.identifierTypes !== vocabulary) return;
      const patterns = response?.pattern ? [normalizeIdentifierPattern(response.pattern)] : [];
      identifierPatternCache.set(selectedType, patterns);
      apply(patterns);
    },
    error: () => apply([]),
  });
}

/**
 * Updates the accessible hint for a pending or unresolved lookup.
 * @param {HTMLInputElement} input Identifier field receiving the hint.
 * @param {'pending'|'unknown'|null} status Hint state; null hides it.
 * @returns {void}
 */
function detectionStatus(input, status) {
  const field = $(input);
  let hint = field.siblings('[data-identifier-detection-status]').first();
  if (!hint.length) {
    hint = $('<span class="small text-body-secondary w-100" role="status" aria-live="polite" data-identifier-detection-status></span>');
    field.after(hint);
  }
  const key = status === 'pending' ? 'identifierChecking' : 'identifierUncertain';
  const fallback = status === 'pending' ? 'Checking identifier type…' : 'Choose the identifier type manually.';
  hint.text(status ? (window.elmo?.translate?.('relatedWork.' + key) || fallback) : '').toggle(Boolean(status));
  if (status) hint.attr('data-translate', 'relatedWork.' + key);
  else hint.removeAttr('data-translate');
}

window.elmo = window.elmo || {};
window.elmo.updateIdentifierValidationPattern = updateValidationPattern;
window.elmo.invalidateIdentifierDetection = invalidateIdentifierDetection;
window.elmo.restoreIdentifierType = restoreIdentifierType;

function setDetectedIdentifierType(selectElement, type) {
  if (!selectElement.length) {
    return;
  }
  const typeName = type ? String(type.name || '') : '';
  selectElement.data(IDENTIFIER_TYPE_AUTO_UPDATE_KEY, true);
  try {
    selectElement.val(typeName).trigger('change');
  } finally {
    selectElement.removeData(IDENTIFIER_TYPE_AUTO_UPDATE_KEY);
  }
}

/**
 * Returns an active type only when local syntax determines it uniquely.
 * @param {string} identifier Entered identifier.
 * @param {Object[]} identifierTypes Active vocabulary metadata.
 * @returns {Object|null} Detected type, or null for ambiguous/registry-dependent input.
 */
function detectIdentifierType(identifier, identifierTypes) {
  const local = identifierDetection.classifyLocal(identifier, identifierTypes);
  return local.status === 'detected' ? identifierDetection.activeType(local.candidates[0], identifierTypes) : null;
}

/**
 * Resolves syntax or registry evidence without replacing later edits or manual choices.
 * @param {HTMLInputElement} [inputElement] Related Work or GEM identifier field.
 * @returns {Promise<void>} Completes when detection finishes or its result is discarded.
 */
async function updateIdentifierType(inputElement) {
  if (!inputElement) return;
  const input = $(inputElement);
  const identifier = String(input.val() || '');
  const select = identifierTypeSelectForInput(inputElement);
  const state = fieldState(inputElement);
  clearTimeout(state.timer);
  const version = ++state.version;
  // Check again after each await: imports can keep the same text while changing its type.
  const current = () => inputElement.isConnected && !inputElement.disabled && state.version === version
    && String(input.val() || '') === identifier && !hasManualIdentifierTypeSelection(select, identifier);
  if (!current()) return;
  let types = relatedWorkDropdownCache.identifierTypes;
  if (!Array.isArray(types)) {
    try {
      const response = await new Promise((resolve, reject) => $.ajax({
        url: 'api/v2/validation/identifiertypes/active', method: 'GET', dataType: 'json',
        success: resolve, error: reject,
      }));
      if (!Array.isArray(response?.identifierTypes)) throw new Error('Missing identifier types');
      types = response.identifierTypes;
      relatedWorkDropdownCache.identifierTypes = types;
    } catch {
      if (current()) { setDetectedIdentifierType(select, null); detectionStatus(inputElement, identifier.trim() ? 'unknown' : null); }
      return;
    }
  }
  if (!current()) return;
  const local = identifierDetection.classifyLocal(identifier, types);
  let type = local.status === 'detected' ? identifierDetection.activeType(local.candidates[0], types) : null;
  if (local.status === 'lookupRequired') {
    setDetectedIdentifierType(select, null);
    detectionStatus(inputElement, 'pending');
    const result = await identifierRegistry.lookup(local.doi);
    if (!current()) return;
    type = result ? identifierDetection.activeType(result.identifierType, relatedWorkDropdownCache.identifierTypes || []) : null;
    // Registry identity cannot override the format supplied for this type by ERNIE.
    if (type && !identifierDetection.validateIdentifier(identifier, type)) type = null;
  }
  // Only select options currently offered; never restore a disabled subtype as DOI/URL.
  if (type && !select.find('option').filter(function () { return String($(this).val()) === type.name; }).length) {
    select.append($('<option>', { value: type.name, text: type.name, title: type.description }));
  }
  setDetectedIdentifierType(select, type);
  detectionStatus(inputElement, !type && identifier.trim() ? 'unknown' : null);
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The wait time in milliseconds.
 * @returns {Function} - The debounced function.
 */
function debounce(func, wait) {
  var timeout;
  return function () {
    var context = this,
      args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Clears a previous choice immediately and debounces only this field's new input.
 * @param {HTMLInputElement} input Edited identifier field.
 * @returns {void}
 */
function scheduleIdentifierDetection(input) {
  invalidateIdentifierDetection(input);
  clearManualIdentifierTypeSelection(identifierTypeSelectForInput(input));
  setDetectedIdentifierType(identifierTypeSelectForInput(input), null);
  updateValidationPattern(identifierTypeSelectForInput(input)[0]);
  fieldState(input).timer = setTimeout(() => updateIdentifierType(input), 300);
}

$(document).on('input', 'input[name="rIdentifier[]"], input[name="dIdentifier[]"]', function () {
  scheduleIdentifierDetection(this);
});
$(document).on('blur', 'input[name="rIdentifier[]"], input[name="dIdentifier[]"]', function () {
  updateIdentifierType(this);
});
$(document).on('change', 'select[name="rIdentifierType[]"], select[name="dIdentifierType[]"]', function () {
  const select = $(this);
  if (select.data(IDENTIFIER_TYPE_AUTO_UPDATE_KEY) !== true) {
    const input = identifierInputForTypeSelect(this)[0];
    invalidateIdentifierDetection(input);
    markManualIdentifierTypeSelection(select);
    if (input) detectionStatus(input, null);
  }
  updateValidationPattern(this);
});

// Export for testing (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setupTimezoneDropdownAjax: dropdownAjax.setupTimezoneDropdownAjax,
    initializeAllDropdownsParallel,
    startInitialDropdownPopulation,
    setupResourceTypeDropdownAjax: dropdownAjax.setupResourceTypeDropdownAjax,
    setupLanguageDropdownAjax: dropdownAjax.setupLanguageDropdownAjax,
    setupTitleTypeDropdownAjax: dropdownAjax.setupTitleTypeDropdownAjax,
    setupLicenseDropdown: dropdownAjax.setupLicenseDropdown,
    setupIdentifierTypesDropdown,
    runSequentialFallback: dropdownAjax.runSequentialFallback,
    populateTimezoneDropdownWithData,
    populateResourceTypeDropdownWithData,
    populateLanguageDropdownWithData,
    populateTitleTypeDropdownWithData,
    populateLicenseDropdownWithData,
    populateRelationsDropdownWithData,
    populateIdentifierTypesDropdownWithData,
    addPlaceholder: dropdownAjax.addPlaceholder,
    updateDropdownPlaceholders: dropdownUtils.updateDropdownPlaceholders,
    filterDataByGEM: dropdownUtils.filterDataByGEM,
    applyRelatedWorkDropdowns,
    invalidateIdentifierDetection,
    resetIdentifierField,
    detectIdentifierType,
    updateIdentifierType,
    updateValidationPattern,
    debounce,
    loadFundersData,
    setCCBYasDefault,
    setBrowserTimezone,
  };
}
