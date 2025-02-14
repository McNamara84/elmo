/**
 * Configures a dropdown field for selecting roles.
 * Fetches roles based on specified types from the APIv2 endpoint and updates the dropdown options.
 *
 * @param {Array} roletypes - Array of role types (e.g., "person", "institution", "both")
 * @param {string} inputSelector - CSS selector of the input field to be configured
 */
function setupRolesDropdown(roletypes, inputSelector) {
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
      const roleNames = results.flatMap(roles =>
        roles.map(role => role.name)
      );

      const uniqueSortedRoles = [...new Set(roleNames)].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );

      const inputElement = document.querySelector(inputSelector);

      if (!inputElement) {
        console.error(`Input element not found for selector: ${inputSelector}`);
        return;
      }

      // Check if Tagify is already initialized
      if (inputElement._tagify) {
        // Update the whitelist and refresh the dropdown
        inputElement._tagify.settings.whitelist = uniqueSortedRoles;
        inputElement._tagify.dropdown.hide(); // Ensure the dropdown is refreshed
      } else {
        // Initialize Tagify
        const rolesTagify = new Tagify(inputElement, {
          whitelist: uniqueSortedRoles,
          enforceWhitelist: true,
          maxTags: 10,
          placeholder: translations.general.roleLabel,
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
    })
    .catch(error => {
      console.error(`Error fetching roles for ${inputSelector}:`, error);
    });
}

document.addEventListener('DOMContentLoaded', function () {
  setupRolesDropdown(["person", "both"], "#input-contributor-personrole");
  setupRolesDropdown(["institution", "both"], "#input-contributor-organisationrole");
});