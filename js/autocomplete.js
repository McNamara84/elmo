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
 * Reads an ORCID date part from either the API object format or a direct value.
 *
 * @param {Object|number|string|null|undefined} part - ORCID date part.
 * @returns {number|null} Parsed integer value or null when unavailable.
 */
function parseOrcidDatePart(part) {
  if (part === null || part === undefined) {
    return null;
  }

  const rawValue = typeof part === 'object' ? part.value : part;
  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

/**
 * Returns the last valid day for a year/month combination.
 *
 * @param {number} year - Full year.
 * @param {number} month - Month number in the range 1-12.
 * @returns {number} Last day of the given month.
 */
function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Resolves an ORCID affiliation end date. Partial dates are normalized to the
 * end of the given period so affiliations are not filtered too early.
 *
 * @param {Object} affiliation - The affiliation summary from ORCID.
 * @returns {Date|null} Normalized end date or null when none exists.
 */
function getAffiliationEndDate(affiliation) {
  const endDate = affiliation?.['end-date'];

  if (!endDate) {
    return null;
  }

  const year = parseOrcidDatePart(endDate.year);
  if (year === null) {
    return null;
  }

  const month = parseOrcidDatePart(endDate.month) ?? 12;
  const day = parseOrcidDatePart(endDate.day) ?? getLastDayOfMonth(year, month);

  return new Date(year, month - 1, day);
}

/**
 * Determines whether an ORCID affiliation should be treated as current.
 * Affiliations without end date are considered current.
 *
 * @param {Object} affiliation - The affiliation summary from ORCID.
 * @param {Date} [now=new Date()] - Reference date for comparisons.
 * @returns {boolean} True when the affiliation is current.
 */
function isCurrentAffiliation(affiliation, now = new Date()) {
  const endDate = getAffiliationEndDate(affiliation);

  if (!endDate) {
    return true;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return endDate >= today;
}

/**
 * Extracts affiliation information from an ORCID affiliation summary.
 * Only current affiliations are collected. Historical affiliations are
 * filtered by ORCID end date before they reach the UI.
 *
 * @param {Object} affiliation - The affiliation summary from ORCID.
 * @param {Set<string>} affiliationSet - Accumulator for affiliation names.
 * @param {Set<string>} rorIds - Accumulator for normalized ROR identifiers.
 */
function collectAffiliation(affiliation, affiliationSet, rorIds) {
  if (!affiliation?.organization || !isCurrentAffiliation(affiliation)) {
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
 * Extracts affiliations and ROR IDs from ORCID record data and fills the
 * corresponding row fields (name, affiliation Tagify, hidden ROR ID field).
 *
 * @param {jQuery} row - The jQuery row element to fill.
 * @param {Object} data - The full ORCID record JSON response.
 * @param {Object} fieldMapping - Maps logical names to selectors within the row.
 * @param {string} fieldMapping.familyName - Selector for the family name input.
 * @param {string} fieldMapping.givenName - Selector for the given name input.
 * @param {string} fieldMapping.affiliation - Selector prefix for the affiliation Tagify input (id starts-with).
 * @param {string} fieldMapping.rorId - Selector prefix for the hidden ROR ID input (id starts-with).
 */
function fillRowFromOrcidRecord(row, data, fieldMapping) {
  const familyName = data.person?.name?.['family-name']?.value || '';
  const givenName = data.person?.name?.['given-names']?.value || '';
  row.find(fieldMapping.familyName).val(familyName);
  row.find(fieldMapping.givenName).val(givenName);

  // Collect affiliations and ROR IDs
  const affiliationSet = new Set();
  const rorIds = new Set();
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
  const affiliationInput = row.find(`input[id^="${fieldMapping.affiliation}"]`)[0];
  if (affiliationInput?._tagify) {
    affiliationInput._tagify.removeAllTags();
    if (affiliationObjects.length > 0) {
      affiliationInput._tagify.addTags(affiliationObjects);
    }
  }

  // Fill hidden ROR ID field
  const rorIdsArray = Array.from(rorIds);
  row.find(`input[id^="${fieldMapping.rorId}"]`).val(rorIdsArray.join(','));
}

/**
 * Field mapping for author person rows.
 */
const AUTHOR_FIELD_MAPPING = {
  familyName: 'input[name="familynames[]"]',
  givenName: 'input[name="givennames[]"]',
  affiliation: 'input-author-affiliation',
  rorId: 'input-author-rorid'
};

/**
 * Field mapping for contributor person rows.
 */
const CONTRIBUTOR_FIELD_MAPPING = {
  familyName: 'input[name="cbPersonLastname[]"]',
  givenName: 'input[name="cbPersonFirstname[]"]',
  affiliation: 'input-contributorpersons-affiliation',
  rorId: 'input-contributor-personrorid'
};

/**
 * Event handler for Author ORCID input fields.
 * Automatically fills in author's last name, first name, and affiliations based on their ORCID.
 * 
 * When a valid ORCID is entered and the input field loses focus:
 * 1. Fetches the author's data from the ORCID API
 * 2. Fills in their last name and first name
 * 3. Adds their current affiliations to the affiliations field
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
        fillRowFromOrcidRecord(row, data, AUTHOR_FIELD_MAPPING);
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
 * 3. Adds their current affiliations to the affiliations field
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
        fillRowFromOrcidRecord(row, data, CONTRIBUTOR_FIELD_MAPPING);
      })
      .catch(error => {
        console.error('Error fetching ORCID data:', error);
      });
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeRorId,
    parseOrcidDatePart,
    getAffiliationEndDate,
    isCurrentAffiliation,
    collectAffiliation,
    fillRowFromOrcidRecord,
    AUTHOR_FIELD_MAPPING,
    CONTRIBUTOR_FIELD_MAPPING
  };
}
