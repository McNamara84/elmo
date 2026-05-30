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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Refreshes all Tagify instances when translations are changed.
 * This function updates the placeholder text without destroying instances.
 * 
 * @returns {void}
 */
function refreshTagifyInstances() {
  const allPairs = [
    { input: "input-author-affiliation", hidden: "input-author-rorid" },
    { input: "input-authorinstitution-affiliation", hidden: "input-author-institutionrorid" },
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
  autocompleteAffiliations("input-author-affiliation", "input-author-rorid");
  autocompleteAffiliations("input-authorinstitution-affiliation", "input-author-institutionrorid");
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
    editTags: false,
    keepInvalidTags: false,
    autoComplete: {
      enabled: true
    },
    templates: {
      // The tag template needs to recreate the whole templates.tag string. There is no partial override.
      // The key addition is the button  looking like a pencil - a symbol of editing
      tag(tagData, ctrl) {
        const safeValue = escapeHtml(tagData.value);

        return `<tag title="${safeValue}"
                     contenteditable='false'
                     spellcheck='false'
                     tabIndex="-1"
                     class="${ctrl.settings.classNames.tag} ${tagData.class ? tagData.class : ''}"
                     ${ctrl.getAttributes(tagData)}>
          <x title='' class='tagify__tag__removeBtn' role='button' aria-label='remove tag'></x>
          <div>
            <span class='tagify__tag-text'>${safeValue}</span>
            <button type='button' class='tagify__tag__editBtn' tabindex='-1' aria-label='Edit affiliation'>
              <i class='bi bi-pencil-fill' aria-hidden='true'></i>
            </button>
          </div>
        </tag>`;
      },
      dropdownItem(item) {
        // Build dropdown item using Tagify's standard approach but with custom content
        const displayText = escapeHtml(item.mappedValue || item.value || '');
        const otherNames = item.other && Array.isArray(item.other)
          ? escapeHtml(item.other.join(', '))
          : '';
        
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
          id: item.id,
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

  /**
   * Updates the hidden input field with the IDs of the selected affiliations.
   */
  function updateHiddenField() {
    const allSelectedItems = tagify.value.map(tag => tag.id || "");
    hiddenField.val(allSelectedItems.join(','));
  }

  /**
   * Edit-icon click handler: opens the affiliation edit modal for the clicked tag.
   * The original tag element and its full data (including the ROR id) are stored in
   * module-level variables so the save handler can use them.
   */
  tagify.DOM.scope.addEventListener('click', function (e) {
    const editBtn = e.target.closest('.tagify__tag__editBtn');
    if (!editBtn) return;

    e.stopPropagation();

    const tagElm = editBtn.closest('tag');
    if (!tagElm) return;

    const tagData = tagElm.__tagifyTagData;
    if (!tagData) return;

    // Stash on the modal element so the save handler can reach them
    const modalEl = document.getElementById('modal-affiliation-edit');
    modalEl._editTagElm = tagElm;
    modalEl._editTagData = tagData;

    // Stamp the owning instance references onto the tag element for the save handler
    tagElm._tagify_originalTagify = tagify;
    tagElm._tagify_updateHiddenField = updateHiddenField;

    const valueInput = document.getElementById('input-affiliation-edit-value');
    valueInput.value = tagData.value;

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();

    // Focus the input after the modal animation finishes
    modalEl.addEventListener('shown.bs.modal', function focusOnShown() {
      valueInput.select();
      modalEl.removeEventListener('shown.bs.modal', focusOnShown);
    });
  });

  /**
   * Save handler for the affiliation edit modal.
   * Clones the original tag data, replaces only the `value`, then calls
   * tagify.replaceTag() so the ROR id is preserved in the background.
   * The handler is registered only once (on the first autocompleteAffiliations call).
   */
  const saveBtn = document.getElementById('button-affiliation-edit-save');
  if (saveBtn && !saveBtn._affiliEditHandlerAttached) {
    saveBtn._affiliEditHandlerAttached = true;
    saveBtn.addEventListener('click', function onAffilEditSave() {
      const modalEl = document.getElementById('modal-affiliation-edit');
      const tagElm = modalEl._editTagElm;
      const originalData = modalEl._editTagData;

      if (!tagElm || !originalData) return;

      const newValue = document.getElementById('input-affiliation-edit-value').value.trim();
      if (!newValue) return;

      // Preserve all original properties (especially `id` / ROR URI) but update value
      const newTagData = Object.assign({}, originalData, { value: newValue });

      tagElm._tagify_originalTagify.replaceTag(tagElm, newTagData);

      // Update hidden field of the owning Tagify instance
      if (typeof tagElm._tagify_updateHiddenField === 'function') {
        tagElm._tagify_updateHiddenField();
      }

      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    });
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
    if (typeof window.validateAllMandatoryFields === 'function') {
        window.validateAllMandatoryFields();
    }
  });

  // Event listener for when a tag is removed
  tagify.on("remove", function () {
    updateHiddenField();
    scheduleRequirementSync();
    syncAuthorInstitutionRequirement();
    if (typeof window.validateAllMandatoryFields === 'function') {
      window.validateAllMandatoryFields();
    }
  });

  // Store the Tagify instance in the DOM element for later access
  // Using _tagify prefix for consistency with other modules (roles.js, freekeywordTags.js, etc.)
  inputElement[0]._tagify = tagify;
  // Expose updateHiddenField so clear.js can call it synchronously after removeAllTags()
  tagify._updateHiddenField = updateHiddenField;
  updateTagifyAccessibilityState(false);
  scheduleRequirementSync();
  syncAuthorInstitutionRequirement();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { autocompleteAffiliations, refreshTagifyInstances, searchAffiliationsFromServer };
}