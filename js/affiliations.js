// Global array to store affiliations data (kept for compatibility, but now empty initially)
var affiliationsData = [];

/**
 * Searches affiliations via the server-side API endpoint.
 * This avoids loading the full 23MB affiliations.json file.
 * 
 * @param {string} query - The search query (minimum 2 characters)
 * @param {number} [limit=20] - Maximum number of results
 * @returns {Promise<Array>} Array of matching affiliations
 */
async function searchAffiliationsFromServer(query, limit = 20) {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const response = await fetch(`api/v2/affiliations/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Affiliation search error:', error);
    return [];
  }
}

/**
 * Refreshes all Tagify instances when translations are changed.
 * This function updates the placeholder text without destroying instances.
 * 
 * @returns {void}
 */
function refreshTagifyInstances() {
  const allPairs = [
    { input: "input-contactperson-affiliation", hidden: "input-contactperson-rorid" },
    { input: "input-contributorpersons-affiliation", hidden: "input-contributor-personrorid" },
    { input: "input-contributor-organisationaffiliation", hidden: "input-contributor-organisationrorid" }
  ];

  allPairs.forEach(pair => {
    const inputElement = document.getElementById(pair.input);
    if (!inputElement || !inputElement._tagify) return;

    // Save current values
    const currentValues = [...inputElement._tagify.value]; // Create a copy

    // Update placeholder if translations are available
    if (translations?.general?.affiliation) {
      inputElement._tagify.settings.placeholder = translations.general.affiliation;
      const placeholderElement = inputElement.parentElement.querySelector('.tagify__input');
      if (placeholderElement) {
        placeholderElement.setAttribute('data-placeholder', translations.general.affiliation);
      }
    }

    if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
      window.applyTagifyAccessibilityAttributes(inputElement._tagify, inputElement, {
        placeholder: inputElement._tagify.settings.placeholder
      });
    }

    // Restore previously selected values
    inputElement._tagify.removeAllTags();
    inputElement._tagify.addTags(currentValues);
  });
}

/**
 * Initialize Tagify for affiliation fields when the document is ready.
 * Uses server-side search instead of loading the full JSON file.
 */
$(document).ready(function () {
  autocompleteAffiliations("input-contributorpersons-affiliation", "input-contributor-personrorid");
  autocompleteAffiliations("input-contributor-organisationaffiliation", "input-contributor-organisationrorid");
  document.addEventListener('translationsLoaded', refreshTagifyInstances);
});

/**
 * @typedef {Object} Affiliation
 * @property {string} id - The unique identifier of the affiliation.
 * @property {string} name - The name of the affiliation.
 * @property {string[]} [other] - Alternative names for the affiliation.
 */

/**
 * Initializes Tagify on a specified input field for affiliation autocompletion.
 * Uses server-side search for performance instead of loading the full affiliations list.
 *
 * @param {string} inputFieldId - The ID of the input field to initialize Tagify on.
 * @param {string} hiddenFieldId - The ID of the hidden input field to store selected affiliation IDs.
 */
function autocompleteAffiliations(inputFieldId, hiddenFieldId) {
  const inputElement = $("#" + inputFieldId);
  if (!inputElement.length) return;

  const hiddenField = $("#" + hiddenFieldId);

  const placeholderValue = (typeof translations !== 'undefined' && translations.general?.affiliation)
    ? translations.general.affiliation
    : 'Affiliation';

  const scheduleMicrotask = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (cb) => Promise.resolve().then(cb);

  const scheduleAnimationFrame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb) => setTimeout(cb, 16);

  const attributeObservers = new WeakMap();

  function registerAttributeObserver(element, attributeName, desiredValue) {
    let observers = attributeObservers.get(element);
    if (!observers) {
      observers = new Map();
      attributeObservers.set(element, observers);
    }

    let observerState = observers.get(attributeName);
    if (!observerState) {
      observerState = { desiredValue, active: false };
      const observer = new MutationObserver(() => {
        if (!observerState.active) {
          return;
        }

        if (element.getAttribute(attributeName) !== observerState.desiredValue) {
          element.setAttribute(attributeName, observerState.desiredValue);
        }
      });

      observer.observe(element, { attributes: true, attributeFilter: [attributeName] });
      observerState.observer = observer;
      observers.set(attributeName, observerState);
    }

    observerState.desiredValue = desiredValue;
    return observerState;
  }

  function setObserverActiveState(element, attributeName, isActive) {
    const observers = attributeObservers.get(element);
    if (!observers) {
      return;
    }

    const observerState = observers.get(attributeName);
    if (!observerState) {
      return;
    }

    observerState.active = isActive;
  }

  function enforceAttributeValue(element, attributeName, desiredValue) {
    const ensureValue = () => {
      if (element.getAttribute(attributeName) !== desiredValue) {
        element.setAttribute(attributeName, desiredValue);
      }
    };

    element.setAttribute(attributeName, desiredValue);
    scheduleMicrotask(ensureValue);
    scheduleAnimationFrame(() => {
      ensureValue();
      scheduleMicrotask(ensureValue);
    });

    const observerState = registerAttributeObserver(element, attributeName, desiredValue);
    observerState.active = true;
  }

  let requirementSyncPending = false;

  function applyAuthorInstitutionNameRequirement(element, shouldRequire) {
    if (shouldRequire) {
      enforceAttributeValue(element, 'required', 'required');
      enforceAttributeValue(element, 'aria-required', 'true');
    } else {
      element.removeAttribute('required');
      element.removeAttribute('aria-required');
      setObserverActiveState(element, 'required', false);
      setObserverActiveState(element, 'aria-required', false);
    }
  }

  const tagify = new Tagify(inputElement[0], {
    enforceWhitelist: false,
    duplicates: false,
    placeholder: placeholderValue,
    whitelist: [], // Start with empty whitelist - will be populated via server search
    dropdown: {
      maxItems: 20,
      classname: "affiliation",
      enabled: 2, // Show dropdown after 2 characters
      closeOnSelect: true,
      searchKeys: ['value', 'other'],
      position: 'all',
      highlightFirst: true
    },
    editTags: true,
    keepInvalidTags: false,
    autoComplete: {
      enabled: true
    },
    templates: {
      dropdownItem(item) {
        // Build dropdown item using Tagify's standard approach but with custom content
        const displayText = item.mappedValue || item.value || '';
        const otherNames = item.other && Array.isArray(item.other) ? item.other.join(', ') : '';
        
        // Build HTML with all necessary Tagify attributes for proper selection handling
        let html = `<div ${this.getAttributes(item)}
                         class='${this.settings.classNames.dropdownItem} ${item.class ? item.class : ""}'
                         tabindex="0"
                         role="option">`;
        
        if (otherNames) {
          html += `<span class="tagify__dropdown__item__text">${displayText}</span>`;
          html += `<small class="tagify__dropdown__item__subtext text-muted d-block text-truncate">${otherNames}</small>`;
        } else {
          html += displayText;
        }
        
        html += `</div>`;
        return html;
      }
    }
  });

  // Track the search timeout for this specific Tagify instance
  let searchTimeout = null;

  /**
   * Event handler for Tagify input - performs server-side search
   */
  tagify.on('input', async function(e) {
    const query = e.detail.value;
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Don't search if query is too short
    if (!query || query.length < 2) {
      tagify.whitelist = [];
      return;
    }

    // Debounce: wait 200ms before searching
    searchTimeout = setTimeout(async () => {
      // Show loading state
      tagify.loading(true);

      try {
        // Fetch results from server
        const results = await searchAffiliationsFromServer(query, 20);

        // Update whitelist with server results
        tagify.whitelist = results.map(item => ({
          value: item.name,
          label: item.name,
          id: normalizeRorId(item.id),
          rorId: normalizeRorId(item.id),
          other: item.other
        }));

        // Hide loading and show dropdown
        tagify.loading(false);
        tagify.dropdown.show(query);
      } catch (error) {
        console.error('Error during affiliation search:', error);
        tagify.loading(false);
      }
    }, 200);
  });

  function normalizeRorId(value) {
    if (!value) {
      return '';
    }

    return String(value)
      .trim()
      .replace(/^https?:\/\/ror\.org\//, '');
  }

  function getTagLabel(tag) {
    return String(tag.value || tag.label || tag.name || tag.mappedValue || '').trim();
  }

  function findWhitelistRorId(label) {
    const whitelistMatch = tagify.whitelist.find(item => item.value === label || item.label === label || item.name === label);
    return whitelistMatch ? normalizeRorId(whitelistMatch.rorId || whitelistMatch.id) : '';
  }

  function normalizeTag(tag) {
    const label = getTagLabel(tag);
    const rorId = normalizeRorId(tag.rorId || tag.id) || findWhitelistRorId(label);

    tag.value = label;
    tag.label = label;
    tag.rorId = rorId;
    tag.id = rorId;

    return {
      value: label,
      label,
      rorId,
      id: rorId
    };
  }

  /**
   * Updates the visible Tagify field with structured affiliation data and the legacy hidden ROR ID CSV.
   */
  function syncStructuredAffiliations() {
    const structuredAffiliations = tagify.value
      .map(normalizeTag)
      .filter(tag => tag.value !== '' || tag.rorId !== '');

    inputElement.val(JSON.stringify(structuredAffiliations));
    hiddenField.val(structuredAffiliations.map(tag => tag.rorId).join(','));
  }

  /**
   * Applies ARIA enhancements to the interactive Tagify input, ensuring that
   * assistive technologies are aware of the current required state.
   *
   * @param {boolean} isRequired - Whether the associated name input is required.
   */
  function updateTagifyAccessibilityState(isRequired) {
    if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
      window.applyTagifyAccessibilityAttributes(tagify, inputElement[0], {
        placeholder: placeholderValue,
        isRequired
      });
    }
  }

  /**
   * Updates the required state of the accompanying author institution name input
   * based on Tagify selections or free text input.
   */
  function syncAuthorInstitutionRequirement() {
    requirementSyncPending = false;

    const authorInstitutionRow = inputElement.closest('[data-authorinstitution-row]');
    if (!authorInstitutionRow.length) {
      updateTagifyAccessibilityState(false);
      return;
    }

    const nameInput = authorInstitutionRow.find('input[name="authorinstitutionName[]"]');
    const rawValue = (inputElement.val() || '').trim();
    const hasRawAffiliationText = rawValue.length > 0 && rawValue !== '[]';
    const hasAffiliations = tagify.value.length > 0 || hasRawAffiliationText;

    nameInput.each((_, element) => {
      applyAuthorInstitutionNameRequirement(element, hasAffiliations);
    });

    updateTagifyAccessibilityState(hasAffiliations);
  }

  /**
   * Schedules a deferred synchronization so that Tagify's internal state is
   * fully updated before we inspect it. This avoids race conditions when tags
   * are added or removed in quick succession.
   */
  function scheduleRequirementSync() {
    if (requirementSyncPending) {
      return;
    }

    requirementSyncPending = true;
    scheduleMicrotask(syncAuthorInstitutionRequirement);
  }

  /**
   * Hides the Tagify dropdown menu.
   */
  function closeDropdown() {
    tagify.dropdown.hide.call(tagify.dropdown);
  }

  // Event listener for when a tag is added
  tagify.on("add", function (e) {
    syncStructuredAffiliations();
    scheduleRequirementSync();
    syncAuthorInstitutionRequirement();

    const selectedName = e.detail.data.value;
    const isOnWhitelist = tagify.whitelist.some(item => item.value === selectedName);
    if (!isOnWhitelist) {
      closeDropdown();
    }
    if (typeof window.validateAllMandatoryFields === 'function') {
        window.validateAllMandatoryFields();
    }
  });

  // Event listener for when a tag is removed
  tagify.on("remove", function () {
    syncStructuredAffiliations();
    scheduleRequirementSync();
    syncAuthorInstitutionRequirement();
    if (typeof window.validateAllMandatoryFields === 'function') {
      window.validateAllMandatoryFields();
    }
  });

  tagify.on("edit:updated", function () {
    syncStructuredAffiliations();
    scheduleRequirementSync();
    syncAuthorInstitutionRequirement();
  });

  tagify.on("change", function () {
    syncStructuredAffiliations();
    scheduleRequirementSync();
  });

  // Store the Tagify instance in the DOM element for later access
  // Using _tagify prefix for consistency with other modules (roles.js, freekeywordTags.js, etc.)
  inputElement[0]._tagify = tagify;
  syncStructuredAffiliations();
  updateTagifyAccessibilityState(false);
  scheduleRequirementSync();
  syncAuthorInstitutionRequirement();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { autocompleteAffiliations, refreshTagifyInstances, searchAffiliationsFromServer };
}