// Global storage for roles data
var personRoles = [];
var organizationRoles = [];

/**
 * Refreshes all role Tagify instances when translations are changed.
 * Destroys existing instances, reinitializes them with updated translations,
 * and restores previously selected values.
 */
function refreshRoleTagifyInstances() {
  const roleFields = [
    { selector: "#input-contributor-personrole", types: ["person", "both"] },
    { selector: "#input-contributor-organisationrole", types: ["institution", "both"] }
  ];

  roleFields.forEach(field => {
    const inputElement = document.querySelector(field.selector);

    // Skip if element doesn't exist or doesn't have a Tagify instance
    if (!inputElement || !inputElement._tagify) return;

    // Save current values
    const currentValues = [...inputElement._tagify.value]; // Create a copy

    // Destroy current Tagify instance
    inputElement._tagify.destroy();

    // Remove _tagify property
    delete inputElement._tagify;

    // Reinitialize with updated translations
    setupRolesDropdown(field.types, field.selector);

    // Restore previously selected values (with a delay to ensure initialization is complete)
    if (currentValues && currentValues.length > 0) {
      setTimeout(() => {
        if (inputElement._tagify) {
          inputElement._tagify.addTags(currentValues);
        }
      }, 50);
    }
  });
}

/**
 * Configures a dropdown field for selecting roles.
 * Fetches roles based on specified types from the APIv2 endpoint and updates the dropdown options.
 *
 * @param {Array} roletypes - Array of role types (e.g., "person", "institution", "both")
 * @param {string} inputSelector - CSS selector of the input field to be configured
 */
function setupRolesDropdown(roletypes, inputSelector) {
  // If we already have the data cached, use it directly
  if (roletypes.includes("person") && personRoles.length > 0 &&
    roletypes.includes("institution") && organizationRoles.length > 0) {
    initializeTagifyWithRoles(inputSelector, [...personRoles, ...organizationRoles]);
    return;
  }

  if (roletypes.includes("person") && personRoles.length > 0 && !roletypes.includes("institution")) {
    initializeTagifyWithRoles(inputSelector, personRoles);
    return;
  }

  if (roletypes.includes("institution") && organizationRoles.length > 0 && !roletypes.includes("person")) {
    initializeTagifyWithRoles(inputSelector, organizationRoles);
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
      // Cache the results
      results.forEach((roles, index) => {
        if (roletypes[index] === "person" || roletypes[index] === "both") {
          personRoles = [...personRoles, ...roles];
        }
        if (roletypes[index] === "institution" || roletypes[index] === "both") {
          organizationRoles = [...organizationRoles, ...roles];
        }
      });

      const roleNames = results.flatMap(roles =>
        roles.map(role => role.name)
      );

      const uniqueSortedRoles = [...new Set(roleNames)].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );

      initializeTagifyWithRoles(inputSelector, uniqueSortedRoles);
    })
    .catch(error => {
      console.error(`Error fetching roles for ${inputSelector}:`, error);
    });
}

/**
 * Initializes a Tagify instance for role selection
 * 
 * @param {string} inputSelector - CSS selector for the input element
 * @param {Array} roles - List of role names to use as options
 */
function initializeTagifyWithRoles(inputSelector, roles) {
  const inputElement = document.querySelector(inputSelector);

  if (!inputElement) {
    console.error(`Input element not found for selector: ${inputSelector}`);
    return;
  }

  // Initialize Tagify
  const rolesTagify = new Tagify(inputElement, {
    whitelist: roles,
    enforceWhitelist: true,
    maxTags: 10,
    placeholder: window.translations && window.translations.general ?
      window.translations.general.roleLabel :
      "Select roles",
    dropdown: {
      maxItems: 20,
      classname: "tags-look",
      enabled: 0,
      closeOnSelect: false,
    },
    editTags: false,
  });

  // Assign the Tagify instance to the input
  inputElement._tagify = rolesTagify;
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', function () {
  // Set up initial role dropdowns
  setupRolesDropdown(["person", "both"], "#input-contributor-personrole");
  setupRolesDropdown(["institution", "both"], "#input-contributor-organisationrole");

  // Add listener for translation changes
  document.addEventListener('translationsLoaded', refreshRoleTagifyInstances);
});