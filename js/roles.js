// Global storage for roles data
var personRoles = [];
var organizationRoles = [];

/**
 * Refreshes all role Tagify instances when translations are changed.
 * Updates only the placeholder, avoiding full reinitialization.
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

    // Update only the placeholder
    const placeholderValue = window.translations?.general?.roleLabel || "Select roles";

    // Assign directly
    inputElement._tagify.settings.placeholder = placeholderValue;


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
    rolesToUse = [...rolesToUse, ...personRoles, ...organizationRoles];
  }

  if (rolesToUse.length > 0) {
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
        if (roletypes[index] === "person" || roletypes[index] === "both") {
          personRoles = [...new Set([...personRoles, ...roles])];
        }
        if (roletypes[index] === "institution" || roletypes[index] === "both") {
          organizationRoles = [...new Set([...organizationRoles, ...roles])];
        }
      });

      const allRoles = results.flat();
      initializeTagifyWithRoles(inputSelector, allRoles);
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

  const roleNames = roles.map(role =>
    typeof role === 'string' ? role : role.name
  );

  const tagifyOptions = {
    whitelist: roleNames,
    enforceWhitelist: true,
    maxTags: 10,
    dropdown: {
      maxItems: 20,
      classname: "tags-look",
      enabled: 0,
      closeOnSelect: false
    },
    editTags: false,
    placeholder: window.translations?.general?.roleLabel || "Select roles"
  };

  try {
    const tagify = new Tagify(input, tagifyOptions);

    tagify.on('add', () => console.log('Tag added'));
    tagify.on('remove', () => console.log('Tag removed'));
    tagify.on('invalid', () => console.log('Invalid tag attempted'));

    input._tagify = tagify;
  } catch (error) {
    console.error('Error initializing Tagify:', error);
  }
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', function () {
  // Set up initial role dropdowns
  setupRolesDropdown(["person", "both"], "#input-contributor-personrole");
  setupRolesDropdown(["institution", "both"], "#input-contributor-organisationrole");

  // Add listener for translation changes
  document.addEventListener('translationsLoaded', refreshRoleTagifyInstances);
});