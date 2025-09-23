$(document).ready(function () {
  // Alle Optionen klonen und als Variable zwischenspeichern
  var allOptions = $("#input-rights-license option").clone();

  // Event Handler für Änderungen am Resource Type Select Element
  $("#input-resourceinformation-resourcetype").change(function () {
    var selectedResourceType = $("#input-resourceinformation-resourcetype option:selected").text().trim();

    // Prüfung ob "Software" ausgewählt wurde
    if (selectedResourceType === "Software") {
      $("#input-rights-license").empty();

      // Filtern der Optionen nach "MIT License" und "Apache License 2.0"
      allOptions.each(function () {
        var optionText = $(this).text().trim();

        if (optionText === "MIT License" || optionText === "Apache License 2.0") {
          $("#input-rights-license").append($(this).clone());
        }
      });
    } else {
      // Optionen zurücksetzen auf Klon der ursprünglichen Optionen
      $("#input-rights-license").empty().append(allOptions.clone());
    }
  });
});

/**
 * Normalizes a ROR identifier to include the canonical https scheme.
 * @param {string} rorId - The raw ROR identifier from the ORCID payload.
 * @returns {string} - The normalized ROR identifier.
 */
function normalizeRorId(rorId) {
  if (!rorId) {
    return '';
  }

  return rorId.startsWith('https://ror.org/') ? rorId : `https://ror.org/${rorId}`;
}

/**
 * Extracts affiliation information from an ORCID affiliation summary.
 * This helper collects both current and past affiliations as long as they
 * provide a ROR disambiguated organization, matching the behaviour described
 * in the UI copy.
 *
 * @param {Object} affiliation - The affiliation summary from ORCID.
 * @param {Set<string>} affiliationSet - Accumulator for affiliation names.
 * @param {Set<string>} rorIds - Accumulator for normalized ROR identifiers.
 */
function collectAffiliation(affiliation, affiliationSet, rorIds) {
  if (!affiliation?.organization) {
    return;
  }

  const orgName = affiliation.organization.name;
  const disambiguated = affiliation.organization['disambiguated-organization'];

  if (!orgName || !disambiguated || disambiguated['disambiguation-source'] !== 'ROR') {
    return;
  }

  const rawRorId = disambiguated['disambiguated-organization-identifier'];

  if (!rawRorId) {
    return;
  }

  affiliationSet.add(orgName);
  rorIds.add(normalizeRorId(rawRorId));
}

/**
 * Event handler for Author ORCID input fields.
 * Automatically fills in author's last name, first name, and affiliations based on their ORCID.
 * 
 * When a valid ORCID is entered and the input field loses focus:
 * 1. Fetches the author's data from the ORCID API
 * 2. Fills in their last name and first name
 * 3. Adds their current and past affiliations to the affiliations field
 * 4. Stores corresponding ROR IDs in a hidden field
 * 
 * @listens blur - Triggers when an ORCID input field loses focus
 * @requires Tagify - For handling the affiliations input field
 * @requires jQuery - For DOM manipulation
 * @requires affiliationsData - Global array containing valid affiliations data
 * 
 * @example
 * // HTML structure expected:
 * // <div data-creator-row>
 * //   <input name="orcids[]" pattern="^[0-9]{4}-[0-9]{4}-[0-9]{4}-([0-9]{4}|[0-9]{3}X)$" />
 * //   <input name="familynames[]" />
 * //   <input name="givennames[]" />
 * //   <input id="input-author-affiliation" /> // Tagify field
 * //   <input id="input-author-rorid" />
 * // </div>
 */
$('#group-author').on('blur', 'input[name="orcids[]"]', function () {
  const orcidInput = $(this);
  const row = orcidInput.closest('[data-creator-row]');
  const orcid = orcidInput.val();

  if (orcid.match(/^\d{4}-\d{4}-\d{4}-(\d{4}|\d{3}X)$/)) {
    fetch(`https://pub.orcid.org/v3.0/${orcid}/record`, {
      headers: {
        'Accept': 'application/vnd.orcid+json'
      }
    })
      .then(response => response.json())
      .then(data => {
        const familyName = data.person?.name?.['family-name']?.value || '';
        const givenName = data.person?.name?.['given-names']?.value || '';
        row.find('input[name="familynames[]"]').val(familyName);
        row.find('input[name="givennames[]"]').val(givenName);

        // Collect affiliations and ROR IDs
        const affiliationSet = new Set();
        const rorIds = new Set();

        // Process an affiliation entry from ORCID data
        const processAffiliation = (affiliation) => collectAffiliation(affiliation, affiliationSet, rorIds);

        // Process employment affiliations
        const employments = data['activities-summary']?.employments?.['affiliation-group'] || [];
        employments.forEach(group => {
          const employment = group.summaries?.[0]?.['employment-summary'];
          processAffiliation(employment);
        });

        // Process education affiliations
        const educations = data['activities-summary']?.educations?.['affiliation-group'] || [];
        educations.forEach(group => {
          const education = group.summaries?.[0]?.['education-summary'];
          processAffiliation(education);
        });

        // Convert Set to array of objects for Tagify
        const affiliationObjects = Array.from(affiliationSet).map(name => ({ value: name }));

        // Set Tagify tags
        const affiliationInput = row.find('input[id^="input-author-affiliation"]')[0];
        if (affiliationInput.tagify) {
          affiliationInput.tagify.removeAllTags();
          if (affiliationObjects.length > 0) {
            affiliationInput.tagify.addTags(affiliationObjects);
          }
        }

        // Fill hidden ROR ID field
        const rorIdsArray = Array.from(rorIds);
        row.find('input[id^="input-author-rorid"]').val(rorIdsArray.join(','));
      })
      .catch(error => {
        console.error('Error fetching ORCID data:', error);
      });
  }
});

/**
 * Event handler for Contributor ORCID input fields.
 * Automatically fills in contributor's last name, first name, and affiliations based on their ORCID.
 * 
 * When a valid ORCID is entered and the input field loses focus:
 * 1. Fetches the contributor's data from the ORCID API
 * 2. Fills in their last name and first name
 * 3. Adds their current and past affiliations to the affiliations field
 * 4. Stores corresponding ROR IDs in a hidden field
 * 
 * @listens blur - Triggers when an ORCID input field loses focus
 * @requires Tagify - For handling the affiliations input field
 * @requires jQuery - For DOM manipulation
 * 
 * @example
 * // HTML structure expected:
 * // <input name="cbORCID[]" pattern="^[0-9]{4}-[0-9]{4}-[0-9]{4}-([0-9]{4}|[0-9]{3}X)$" />
 * // <input name="cbPersonLastname[]" />
 * // <input name="cbPersonFirstname[]" />
 * // <input id="input-contributorpersons-affiliation" /> // Tagify field
 * // <input id="input-contributor-personrorid" />
 */
$('#group-contributorperson').on('blur', 'input[name="cbORCID[]"]', function () {
  const orcidInput = $(this);
  const row = orcidInput.closest('[contributor-person-row]');
  const orcid = orcidInput.val();

  if (orcid.match(/^\d{4}-\d{4}-\d{4}-(\d{4}|\d{3}X)$/)) {
    fetch(`https://pub.orcid.org/v3.0/${orcid}/record`, {
      headers: {
        'Accept': 'application/vnd.orcid+json'
      }
    })
      .then(response => response.json())
      .then(data => {
        // Fill in names
        const familyName = data.person?.name?.['family-name']?.value || '';
        const givenName = data.person?.name?.['given-names']?.value || '';
        row.find('input[name="cbPersonLastname[]"]').val(familyName);
        row.find('input[name="cbPersonFirstname[]"]').val(givenName);

        // Collect affiliations and ROR IDs
        const affiliationSet = new Set();
        const rorIds = new Set();

        // Process an affiliation entry from ORCID data
        const processAffiliation = (affiliation) => collectAffiliation(affiliation, affiliationSet, rorIds);

        // Process employment affiliations
        const employments = data['activities-summary']?.employments?.['affiliation-group'] || [];
        employments.forEach(group => {
          const employment = group.summaries?.[0]?.['employment-summary'];
          processAffiliation(employment);
        });

        // Process education affiliations
        const educations = data['activities-summary']?.educations?.['affiliation-group'] || [];
        educations.forEach(group => {
          const education = group.summaries?.[0]?.['education-summary'];
          processAffiliation(education);
        });

        // Convert Set to array of objects for Tagify
        const affiliationObjects = Array.from(affiliationSet).map(name => ({ value: name }));

        // Set Tagify tags
        const affiliationInput = row.find('input[id^="input-contributorpersons-affiliation"]')[0];
        if (affiliationInput.tagify) {
          affiliationInput.tagify.removeAllTags();
          if (affiliationObjects.length > 0) {
            affiliationInput.tagify.addTags(affiliationObjects);
          }
        }

        // Fill hidden ROR ID field
        const rorIdsArray = Array.from(rorIds);
        row.find('input[id^="input-contributor-personrorid"]').val(rorIdsArray.join(','));
      })
      .catch(error => {
        console.error('Error fetching ORCID data:', error);
      });
  }
});