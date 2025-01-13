/**
 * Configures a dropdown field for selecting roles.
 * Fetches roles based on specified types from an API and updates the dropdown options.
 *
 * @param {Array} roletypes - Array of role types (e.g., "person", "institution", "both")
 * @param {string} inputSelector - CSS selector of the input field to be configured
 */
function setupRolesDropdown(roletypes, inputSelector) {
  const rolePromises = roletypes.map(type =>
    $.getJSON(`./api.php?action=getRoles&type=${type}`)
  );

  Promise.all(rolePromises)
    .then(results => {
      const roleNames = results.flatMap(data =>
        data.map(role => role.name)
      );

      const uniqueSortedRoles = [...new Set(roleNames)].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );

      const inputElement = $(inputSelector);

      if (inputElement.length) {
        if (inputElement[0].tagify) {
          inputElement[0].tagify.settings.whitelist = uniqueSortedRoles;
          inputElement[0].tagify.dropdown.show.call(inputElement[0].tagify);
        } else {
          new Tagify(inputElement[0], {
            whitelist: uniqueSortedRoles,
            enforceWhitelist: true,
            maxTags: 10,
            placeholder: translations.general.roleLabel,
            dropdown: {
              maxItems: 20,
              classname: "tags-look",
              enabled: 0,
              closeOnSelect: false
            }
          });
        }
      }
    })
}

$(document).ready(function () {
  setupRolesDropdown(["person", "both"], "#input-contributor-personrole");
  setupRolesDropdown(["institution", "both"], "#input-contributor-organisationrole");
});