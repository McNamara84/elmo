// Global storage for roles data
var personRoles = [];
var organizationRoles = [];
var sharedRoles = [];
var fetchedRoleTypes = new Set();

/**
 * Refreshes all role Tagify instances when translations are changed.
 * Updates only the placeholder, avoiding full reinitialization.
 */
function refreshRoleTagifyInstances() {
  const inputs = document.querySelectorAll(
    'input[name="cbPersonRoles[]"], input[name="cbOrganisationRoles[]"]'
  );

  inputs.forEach(inputElement => {
    if (!inputElement || !inputElement._tagify) return;

    const placeholderValue = translations?.general?.roleLabel || 'Select roles';

    inputElement._tagify.settings.placeholder = placeholderValue;

    const placeholderElem = inputElement.parentElement.querySelector('.tagify__input');
    if (placeholderElem) {
      placeholderElem.setAttribute('data-placeholder', placeholderValue);
    }

    if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
      window.applyTagifyAccessibilityAttributes(inputElement._tagify, inputElement, {
        placeholder: placeholderValue
      });
    }
  });
}

/**
 * Configures a dropdown field for selecting roles using Tagify.
 * Fetches roles from API if not cached, then initializes Tagify with the roles.
 * 
 * @param {string[]} roletypes - Array of role types ("person", "institution", "both")
 * @param {string} inputSelector - CSS selector for the input element
 * @returns {void}
 */
function setupRolesDropdown(roletypes, inputSelector) {
  const input = document.querySelector(inputSelector);
  if (!input) {
    return;
  }

  if (input._tagify) {
    input._tagify.destroy();
  }

  let rolesToUse = [];
  if (roletypes.includes("person")) {
    rolesToUse = [...rolesToUse, ...personRoles];
  }
  if (roletypes.includes("institution")) {
    rolesToUse = [...rolesToUse, ...organizationRoles];
  }
  if (roletypes.includes("both")) {
    rolesToUse = [...rolesToUse, ...sharedRoles];
  }

  const allTypesFetched = roletypes.every(type => fetchedRoleTypes.has(type));
  const hasPreloadedRoles = fetchedRoleTypes.size === 0 && rolesToUse.length > 0;
  if (rolesToUse.length > 0 && (allTypesFetched || hasPreloadedRoles)) {
    initializeTagifyWithRoles(inputSelector, rolesToUse);
    return;
  }

  const rolePromises = roletypes.map(type =>
    fetch(`./api/v2/vocabs/roles?type=${type}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
  );

  Promise.all(rolePromises)
    .then(results => {
      results.forEach((roles, index) => {
        fetchedRoleTypes.add(roletypes[index]);
        if (roletypes[index] === "person") {
          personRoles = [...new Set([...personRoles, ...roles])];
        }
        if (roletypes[index] === "institution") {
          organizationRoles = [...new Set([...organizationRoles, ...roles])];
        }
        if (roletypes[index] === "both") {
          sharedRoles = [...new Set([...sharedRoles, ...roles])];
        }
      });

      initializeTagifyWithRoles(inputSelector, [...new Set(results.flat())]);
    })
    .catch(error => {
      console.error(`Error fetching roles for ${inputSelector}:`, error);
    });
}

/**
 * Initializes a Tagify instance for role selection on a specific input element.
 * Converts roles to strings if they are objects, sets up Tagify with options,
 * and attaches event listeners.
 * 
 * @param {string} inputSelector - CSS selector for the input element
 * @param {(string|Object)[]} roles - Array of role names or role objects
 * @returns {void}
 */
function initializeTagifyWithRoles(inputSelector, roles) {
  const input = document.querySelector(inputSelector);
  if (!input) return;

  const isPerson = input.name === 'cbPersonRoles[]';
  const isInstitution = input.name === 'cbOrganisationRoles[]';
  const roleNames = roles.map(role =>
    typeof role === 'string' ? role : role.name
  ).filter(name => !isInstitution || window.ELMO_FEATURES?.showContactInstitution === true || name !== 'Contact Person');
  if (isPerson || (isInstitution && window.ELMO_FEATURES?.showContactInstitution === true)) {
    roleNames.push('Contact Person');
  }
  // ERNIE and the local role table may already contain the synthetic contact role.
  const allowedRoles = [...new Set(roleNames.filter(Boolean))];

  const tagifyOptions = {
    whitelist: allowedRoles,
    enforceWhitelist: true,
    maxTags: 16,
    dropdown: {
      maxItems: 20,
      classname: "tags-look",
      enabled: 0,
      closeOnSelect: false
    },
    editTags: false,
    placeholder: translations?.general?.roleLabel || "Select roles"
  };

  try {
    const tagify = new Tagify(input, tagifyOptions);

    tagify.on('invalid', () => console.log('Invalid tag attempted'));

    input._tagify = tagify;

    if (typeof window.applyTagifyAccessibilityAttributes === 'function') {
      window.applyTagifyAccessibilityAttributes(tagify, input, {
        placeholder: tagifyOptions.placeholder
      });
    }
  } catch (error) {
    console.error('Error initializing Tagify:', error);
  }
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', function () {
  // Read feature toggles
  const features = window.ELMO_FEATURES || {};
  
  // Set up Contributor Persons role dropdown only if feature is enabled
  if (features.showContributorPersons !== false) {
    setupRolesDropdown(["person", "both"], "#input-contributor-personrole");
  }
  
  // Set up Contributor Institutions role dropdown only if feature is enabled  
  if (features.showContributorInstitutions !== false) {
    setupRolesDropdown(["institution", "both"], "#input-contributor-organisationrole");
  }

  // Add listener for translation changes
  document.addEventListener('translationsLoaded', refreshRoleTagifyInstances);
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setupRolesDropdown,
    refreshRoleTagifyInstances,
    getPersonRoles: () => personRoles,
    getOrganizationRoles: () => organizationRoles,
    setPersonRoles: (roles) => { personRoles = roles; },
    setOrganizationRoles: (roles) => { organizationRoles = roles; }
  };
}
