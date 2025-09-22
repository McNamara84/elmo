// Global array to store affiliations data
var affiliationsData = [];

/**
 * Refreshes all Tagify instances when translations are changed.
 * This function updates the whitelist and restores any previously selected values without destroying instances.
 * 
 * @returns {void}
 */
function refreshTagifyInstances() {
  if (!window.affiliationsData) return;

  const allPairs = [
    { input: "input-author-affiliation", hidden: "input-author-rorid" },
    { input: "input-authorinstitution-affiliation", hidden: "input-author-institutionrorid" },
    { input: "input-contactperson-affiliation", hidden: "input-contactperson-rorid" },
    { input: "input-contributorpersons-affiliation", hidden: "input-contributor-personrorid" },
    { input: "input-contributor-organisationaffiliation", hidden: "input-contributor-organisationrorid" }
  ];

  allPairs.forEach(pair => {
    const inputElement = document.getElementById(pair.input);
    if (!inputElement || !inputElement.tagify) return;

    // Save current values
    const currentValues = [...inputElement.tagify.value]; // Create a copy

    // Update whitelist without destroying the instance
    inputElement.tagify.settings.whitelist = window.affiliationsData.map(item => ({
      value: item.name,
      id: item.id,
      other: item.other
    }));
    inputElement.tagify.settings.dropdown.searchKeys = ['value', 'other'];

    // Update placeholder if translations are available
    if (translations?.general?.affiliation) {
      inputElement.tagify.settings.placeholder = translations.general.affiliation;
      const placeholderElement = inputElement.parentElement.querySelector('.tagify__input');
      if (placeholderElement) {
        placeholderElement.setAttribute('data-placeholder', translations.general.affiliation);
      }
    }

    if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
      window.applyTagifyAccessibilityAttributes(inputElement.tagify, inputElement, {
        placeholder: inputElement.tagify.settings.placeholder
      });
    }

    // Restore previously selected values
    inputElement.tagify.removeAllTags();
    inputElement.tagify.addTags(currentValues);
  });
}

/**
 * Loads affiliations data from a JSON file and initializes Tagify for specified input fields.
 */
$.getJSON("json/affiliations.json", function (data) {
  // Globale Variable mit den Daten befüllen
  window.affiliationsData = data;  // Explizit global verfügbar machen

  // Initialize Tagify for existing input fields when the document is ready
  $(document).ready(function () {
    autocompleteAffiliations("input-author-affiliation", "input-author-rorid", affiliationsData);
    autocompleteAffiliations("input-authorinstitution-affiliation", "input-author-institutionrorid", affiliationsData);
    autocompleteAffiliations("input-contributorpersons-affiliation", "input-contributor-personrorid", affiliationsData);
    autocompleteAffiliations("input-contributor-organisationaffiliation", "input-contributor-organisationrorid", affiliationsData);
    document.addEventListener('translationsLoaded', refreshTagifyInstances);
  });
});

/**
 * @typedef {Object} Affiliation
 * @property {string} id - The unique identifier of the affiliation.
 * @property {string} name - The name of the affiliation.
 * @property {string[]} [other] - Alternative names for the affiliation.
 */

/**
 * Initializes Tagify on a specified input field for affiliation autocompletion.
 *
 * @param {string} inputFieldId - The ID of the input field to initialize Tagify on.
 * @param {string} hiddenFieldId - The ID of the hidden input field to store selected affiliation IDs.
 * @param {Affiliation[]} data - The affiliation data array used for autocompletion.
 */
function autocompleteAffiliations(inputFieldId, hiddenFieldId, data) {
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
    whitelist: data.map(item => ({
      value: item.name,
      id: item.id,
      other: item.other
    })),
    dropdown: {
      maxItems: 20,
      classname: "affiliation",
      enabled: 3,
      closeOnSelect: true,
      searchKeys: ['value', 'other']
    },
    editTags: false,
    keepInvalidTags: false,
    autoComplete: {
      enabled: true
    }
  });

  /**
   * Updates the hidden input field with the IDs of the selected affiliations.
   */
  function updateHiddenField() {
    const allSelectedItems = tagify.value.map(tag => tag.id || "");
    hiddenField.val(allSelectedItems.join(','));
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
    const hasAffiliations = tagify.value.length > 0 || rawValue.length > 0;

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
    updateHiddenField();
    scheduleRequirementSync();
    syncAuthorInstitutionRequirement();

    const selectedName = e.detail.data.value;
    const isOnWhitelist = tagify.whitelist.some(item => item.value === selectedName);
    if (!isOnWhitelist) {
      closeDropdown();
    }
    if (typeof window.checkMandatoryFields === 'function') {
        window.checkMandatoryFields();
    }
  });

  // Event listener for when a tag is removed
  tagify.on("remove", function () {
    updateHiddenField();
    scheduleRequirementSync();
    syncAuthorInstitutionRequirement();
    if (typeof window.checkMandatoryFields === 'function') {
      window.checkMandatoryFields();
    }
  });

  // Event listener for input changes to adjust the input field width dynamically
  tagify.on("input", function (e) {
    tagify.DOM.input.style.width = (e.detail.value.length + 1) * 8 + "px";
  });

  // Store the Tagify instance in the DOM element for later access
  inputElement[0].tagify = tagify;
  updateTagifyAccessibilityState(false);
  scheduleRequirementSync();
  syncAuthorInstitutionRequirement();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { autocompleteAffiliations, refreshTagifyInstances };
}