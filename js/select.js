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
          title: type.description
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
      if (val.rightsIdentifier === "CC-BY-4.0") {
        $option.prop("selected", true);
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
  relatedWorkDropdownCache.identifierTypes = response && Array.isArray(response.identifierTypes)
    ? [...response.identifierTypes]
    : [];
  applyRelatedWorkDropdowns();
}

// Make parallel initialization function available globally
window.initializeAllDropdownsParallel = initializeAllDropdownsParallel;
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
 * @param {string} id - The ID selector of the dropdown to populate.
 */
function setupIdentifierTypesDropdown(id) {
  var select = $(id);

  // Add the "Choose..." placeholder option
  select.empty().append(
    $("<option>", {
      value: "",
      text: "Choose...", // Placeholder text
      "data-translate": "general.choose"
    })
  );

  // Fetch identifier types from the server
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
    } else {
      console.warn("No identifier types available");
    }
  }).fail(function (jqXHR, textStatus, errorThrown) {
    console.error("Error loading identifier types:", textStatus, errorThrown);
  });
}


/**
 * Function to update the identifier type based on the entered identifier.
 * @param {HTMLElement} inputElement - The input element for the identifier.
 */
// Priority map for identifier types when multiple patterns match
const IDENTIFIER_TYPE_PRIORITY = {
  DOI: 10,
  URL: 0,
};
const IDENTIFIER_TYPE_AUTO_UPDATE_KEY = 'elmoIdentifierTypeAutoUpdate';
const IDENTIFIER_TYPE_MANUAL_SELECTION_KEY = 'elmoIdentifierTypeManualSelection';
const IDENTIFIER_TYPE_MANUAL_IDENTIFIER_KEY = 'elmoIdentifierTypeManualIdentifier';

// A native/Chosen change after identifier input is a user decision. Bind that
// decision to the current identifier so a pending debounced detector cannot
// erase it. Typing a new identifier clears the marker and enables detection again.

function getIdentifierPriority(name) {
  return IDENTIFIER_TYPE_PRIORITY.hasOwnProperty(name)
    ? IDENTIFIER_TYPE_PRIORITY[name]
    : 5;
}

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
  let normalized = String(pattern || '').trim().replace(/^"|"$/g, '');
  const delimitedPattern = normalized.match(/^\/(.*)\/[a-z]*$/i);
  if (delimitedPattern) {
    normalized = delimitedPattern[1];
  } else {
    normalized = normalized.replace(/\/[a-z]+$/i, '');
  }
  return normalized;
}

function updateValidationPattern(selectElement) {
  const select = $(selectElement);
  const selectedType = String(select.val() || '').trim();
  const inputIdentifier = identifierInputForTypeSelect(selectElement);
  if (!inputIdentifier.length) {
    return;
  }

  const applyPattern = function (pattern) {
    if (String(select.val() || '').trim() !== selectedType) {
      return;
    }
    if (pattern) {
      inputIdentifier.attr('pattern', pattern);
    } else {
      inputIdentifier.removeAttr('pattern');
    }
  };

  if (selectedType === '') {
    inputIdentifier.removeAttr('pattern');
    return;
  }

  if (identifierPatternCache.has(selectedType)) {
    applyPattern(identifierPatternCache.get(selectedType));
    return;
  }

  $.ajax({
    url: 'api/v2/validation/patterns/' + encodeURIComponent(selectedType),
    method: 'GET',
    dataType: 'json',
    success: function (response) {
      const pattern = response && response.pattern
        ? normalizeIdentifierPattern(response.pattern)
        : '';
      identifierPatternCache.set(selectedType, pattern);
      applyPattern(pattern);
    },
    error: function () {
      identifierPatternCache.set(selectedType, '');
      applyPattern('');
    },
  });
}

window.elmo = window.elmo || {};
window.elmo.updateIdentifierValidationPattern = updateValidationPattern;

function setDetectedIdentifierType(selectElement, type) {
  if (!selectElement.length) {
    return;
  }
  const typeName = type ? String(type.name || '') : '';
  if (typeName !== '' && !selectElement.find('option').filter(function () {
    return String($(this).val()) === typeName;
  }).length) {
    selectElement.append($('<option>', {
      value: typeName,
      text: typeName,
      title: type.description,
    }));
  }
  selectElement.data(IDENTIFIER_TYPE_AUTO_UPDATE_KEY, true);
  try {
    selectElement.val(typeName).trigger('change');
  } finally {
    selectElement.removeData(IDENTIFIER_TYPE_AUTO_UPDATE_KEY);
  }
}

function detectIdentifierType(identifier, identifierTypes) {
  const matchingTypes = identifierTypes.filter(type => {
    try {
      let pattern = normalizeIdentifierPattern(type.pattern);
      if (pattern === '') {
        return false;
      }
      pattern = pattern.replace(/\\{2}/g, '\\');
      return new RegExp(pattern, 'i').test(identifier);
    } catch (error) {
      console.warn(`Invalid pattern for ${type.name}:`, error);
      return false;
    }
  });

  matchingTypes.sort((a, b) => {
    const priorityDifference = getIdentifierPriority(b.name) - getIdentifierPriority(a.name);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    return String(b.pattern || '').length - String(a.pattern || '').length;
  });
  return matchingTypes[0] || null;
}

/**
 * Detects an identifier type without overwriting a later manual selection.
 * @param {HTMLElement} inputElement - Related Work or Data Source identifier input.
 */
function updateIdentifierType(inputElement) {
  const input = $(inputElement);
  const identifier = String(input.val() || '');
  const selectElement = identifierTypeSelectForInput(inputElement);

  const applyTypes = function (types) {
    if (
      String(input.val() || '') !== identifier
      || hasManualIdentifierTypeSelection(selectElement, identifier)
    ) {
      return;
    }
    setDetectedIdentifierType(selectElement, detectIdentifierType(identifier, types));
  };
  const clearType = function () {
    if (
      String(input.val() || '') === identifier
      && !hasManualIdentifierTypeSelection(selectElement, identifier)
    ) {
      setDetectedIdentifierType(selectElement, null);
    }
  };

  if (identifier) {
    if (Array.isArray(relatedWorkDropdownCache.identifierTypes)) {
      applyTypes(relatedWorkDropdownCache.identifierTypes);
      return;
    }
    $.ajax({
      url: "api/v2/validation/identifiertypes/active",
      method: "GET",
      dataType: "json",
      success: function (response) {
        if (response && Array.isArray(response.identifierTypes)) {
          relatedWorkDropdownCache.identifierTypes = [...response.identifierTypes];
          applyTypes(response.identifierTypes);
        } else {
          clearType();
          console.warn("No identifier types found in the response");
        }
      },
      error: function (xhr, status) {
        console.error("Error retrieving identifier types:", status);
        clearType();
      },
    });
  } else {
    clearType();
  }
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

const updateRelatedWorkIdentifierTypeDebounced = debounce(function () {
  updateIdentifierType(this);
}, 300);

// Event listener for input in the identifier input field with debounce
$(document).on("input", 'input[name="rIdentifier[]"]', function () {
  clearManualIdentifierTypeSelection(identifierTypeSelectForInput(this));
  updateRelatedWorkIdentifierTypeDebounced.call(this);
});

// Event listener for leaving the identifier input field
$(document).on("blur", 'input[name="rIdentifier[]"]', function () {
  updateIdentifierType(this);
});

$(document).on('change', 'select[name="rIdentifierType[]"], select[name="dIdentifierType[]"]', function () {
  const selectElement = $(this);
  if (selectElement.data(IDENTIFIER_TYPE_AUTO_UPDATE_KEY) !== true) {
    markManualIdentifierTypeSelection(selectElement);
  }
  updateValidationPattern(this);
});

function updateDataSourceIdsAndNames() {
  $("#group-datasources .row").each(function (index) {
    $(this)
      .find('select[name="datasource_type[]"]')
      .attr("id", "input-datasource-type" + index);
    $(this)
      .find('select[name="datasource_details[]"]')
      .attr("id", "input-datasource-details" + index);
    $(this)
      .find('input[name="dName[]"]')
      .attr("id", "input-datasource-modelname" + index);
    $(this)
      .find('input[name="dIdentifier[]"]')
      .attr("id", "input-datasource-identifier" + index);
    $(this)
      .find('select[name="dIdentifierType[]"]')
      .attr("id", "input-datasource-identifiertype" + index);
  });
}

const updateDataSourceIdentifierTypeDebounced = debounce(function () {
  updateDataSourceIdsAndNames();
  updateIdentifierType(this);
}, 300);

// Event listener for input in the data source identifier input field with debounce
$(document).on("input", 'input[name="dIdentifier[]"]', function () {
  clearManualIdentifierTypeSelection(identifierTypeSelectForInput(this));
  updateDataSourceIdentifierTypeDebounced.call(this);
});

// Event listener for leaving the data source identifier input field
$(document).on("blur", 'input[name="dIdentifier[]"]', function () {
  updateIdentifierType(this);
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
    getIdentifierPriority,
    detectIdentifierType,
    updateIdentifierType,
    updateValidationPattern,
    debounce,
    updateDataSourceIdsAndNames,
    loadFundersData
  };
}
