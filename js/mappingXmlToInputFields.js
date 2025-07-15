/**
 * Processes the resource type from an XML document and selects the corresponding option
 * in the dropdown based on the visible text matching the `resourceTypeGeneral` attribute.
 *
 * @param {Document} xmlDoc - The XML document containing the resourceType element.
 */
function processResourceType(xmlDoc) {
  // Extract the resourceType element
  const resourceNode = xmlDoc.querySelector('resourceType');
  if (!resourceNode) {
    console.error('No resourceType element found in XML');
    return;
  }

  // Get the resourceTypeGeneral attribute
  const resourceTypeGeneral = resourceNode.getAttribute('resourceTypeGeneral');
  if (!resourceTypeGeneral) {
    console.error('No resourceTypeGeneral attribute found');
    return;
  }

  // Select the corresponding option in the dropdown
  const selectField = document.querySelector('#input-resourceinformation-resourcetype');
  if (!selectField) {
    console.error('Select field not found');
    return;
  }

  // Find an option where the visible text matches resourceTypeGeneral
  const optionToSelect = Array.from(selectField.options).find(option => option.text.trim() === resourceTypeGeneral);

  if (optionToSelect) {
    optionToSelect.selected = true;
  } else {
    console.warn(`No matching option found for text: ${resourceTypeGeneral}`);
  }
}


/**
 * Extracts license identifier from various formats
 * @param {Element} rightsNode - The XML rights element
 * @returns {string} The normalized license identifier
 */
function extractLicenseIdentifier(rightsNode) {
  // Try to get identifier from rightsIdentifier attribute first
  let identifier = rightsNode.getAttribute('rightsIdentifier');

  if (!identifier) {
    // Try to extract from rightsURI
    const uri = rightsNode.getAttribute('rightsURI');
    if (uri) {
      // Extract identifier from SPDX URL (e.g. "https://spdx.org/licenses/CC0-1.0.html" -> "CC0-1.0")
      const match = uri.match(/licenses\/([^/.]+)/);
      if (match) {
        identifier = match[1];
      }
    }
  }

  if (!identifier) {
    // Use text content as last resort
    identifier = rightsNode.textContent.trim();
  }

  return identifier;
}

/**
 * Creates a license mapping from API data
 * @returns {Promise<Object>} A promise that resolves to the license mapping
 */
async function createLicenseMapping() {
  try {
    const response = await $.getJSON('./api/v2/vocabs/licenses/all');
    const mapping = {};

    response.forEach(license => {
      mapping[license.rightsIdentifier] = license.rights_id.toString();
    });

    return mapping;
  } catch (error) {
    console.error('Error creating license mapping:', error);
    return {
      'CC-BY-4.0': '1',
      'CC0-1.0': '2',
      'GPL-3.0-or-later': '3',
      'MIT': '4',
      'Apache-2.0': '5',
      'EUPL-1.2': '6'
    };
  }
}

/**
* Maps title type to select option value
* @param {string} titleType - The type of the title from XML
* @returns {string} The corresponding select option value
*/
function mapTitleType(titleType) {
  const typeMap = {
    undefined: '1', // Main Title
    'AlternativeTitle': '2',
    'TranslatedTitle': '3'
  };
  return typeMap[titleType] || '1';
}

/**
 * Process titles from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processTitles(xmlDoc, resolver) {
  const titleNodes = xmlDoc.evaluate(
    './/ns:titles/ns:title',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let i = 0; i < titleNodes.snapshotLength; i++) {
    const titleNode = titleNodes.snapshotItem(i);
    const titleType = titleNode.getAttribute('titleType');
    const titleText = titleNode.textContent;
    const titleLang = titleNode.getAttribute('xml:lang') || 'en';

    if (i === 0) {
      // First Title
      $('input[name="title[]"]:first').val(titleText);
      $('#input-resourceinformation-titletype').val(mapTitleType(titleType));
      if (titleType) {
        $('#container-resourceinformation-titletype').show();
      }
    } else {
      // Add Title - Clone new row
      $('#button-resourceinformation-addtitle').click();

      // Find last row
      const $lastRow = $('input[name="title[]"]').last().closest('.row');

      // Set values
      $lastRow.find('input[name="title[]"]').val(titleText);
      $lastRow.find('select[name="titleType[]"]').val(mapTitleType(titleType));
    }
  }
}

/**
 * Helper function to get text content of a node using XPath
 * @param {Node} contextNode - The context node to search from
 * @param {string} xpath - The XPath expression
 * @param {Document} xmlDoc - The XML document
 * @param {Function} resolver - The namespace resolver function
 * @returns {string} The text content of the matched node
 */
function getNodeText(contextNode, xpath, xmlDoc, resolver) {
  if (!xpath.startsWith('.') && !xpath.startsWith('/')) {
    xpath = './' + xpath;
  }

  const node = xmlDoc.evaluate(
    xpath,
    contextNode,
    resolver,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;

  return node ? node.textContent.trim() : '';
}

/**
 * Process creators from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processCreators(xmlDoc, resolver) {
  const creatorNodes = xmlDoc.evaluate(
    './/ns:creators/ns:creator',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let i = 0; i < creatorNodes.snapshotLength; i++) {
    const creatorNode = creatorNodes.snapshotItem(i);

    // Extract Creator Data
    const givenName = getNodeText(creatorNode, 'ns:givenName', xmlDoc, resolver);
    const familyName = getNodeText(creatorNode, 'ns:familyName', xmlDoc, resolver);
    const orcid = getNodeText(
      creatorNode,
      'ns:nameIdentifier[@nameIdentifierScheme="ORCID"]',
      xmlDoc,
      resolver
    ).replace('https://orcid.org/', '');

    // Extract Affiliations
    const affiliationNodes = xmlDoc.evaluate(
      'ns:affiliation',
      creatorNode,
      resolver,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    const affiliations = [];
    const rorIds = [];

    for (let j = 0; j < affiliationNodes.snapshotLength; j++) {
      const affNode = affiliationNodes.snapshotItem(j);
      const affiliationName = affNode.textContent;
      const rorId = affNode.getAttribute('affiliationIdentifier');

      if (affiliationName) {
        affiliations.push(affiliationName);
        if (rorId) {
          rorIds.push(rorId);
        }
      }
    }

    // Find the row to populate (either the first one, or the newly added one)
    let $row;
    if (i === 0) {
      // Use the first row
      $row = $('div[data-creator-row]').eq(0);
    } else {
      // Add a new row and use it
      $('#button-author-add').click();
      $row = $('div[data-creator-row]').eq(i);
    }

    // Populate fields in the author section
    $row.find('input[name="orcids[]"]').val(orcid);
    $row.find('input[name="familynames[]"]').val(familyName);
    $row.find('input[name="givennames[]"]').val(givenName);

    // Tagify handling for affiliations
    const tagifyInput = $row.find('input[name="affiliation[]"]')[0];
    if (tagifyInput && tagifyInput.tagify) {
      tagifyInput.tagify.removeAllTags(); // Clear existing tags
      tagifyInput.tagify.addTags(affiliations.map(a => ({ value: a })));
      $row.find('input[name="authorRorIds[]"]').val(rorIds.join(','));
    }

    //** Clear Contact Person fields (Crucial!) **
    $row.find('input[name="contacts[]"]').prop('checked', false);
    $row.find('.contact-person-input').hide();
    $row.find('input[name="cpEmail[]"]').val('');
    $row.find('input[name="cpOnlineResource[]"]').val('');
  }
}

/**
 * Process contact persons from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 */
function processContactPersons(xmlDoc) {
  // Namespace resolver for ISO metadata
  function nsResolver(prefix) {
    const ns = {
      'gmd': 'http://www.isotc211.org/2005/gmd',
      'gco': 'http://www.isotc211.org/2005/gco'
    };
    return ns[prefix] || null;
  }

  const contactPersonNodes = xmlDoc.evaluate(
    '//gmd:pointOfContact/gmd:CI_ResponsibleParty',
    xmlDoc,
    nsResolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );


  for (let i = 0; i < contactPersonNodes.snapshotLength; i++) {
    const contactPersonNode = contactPersonNodes.snapshotItem(i);

    // Extract Contact Person details
    const fullName = getNodeText(contactPersonNode, 'gmd:individualName/gco:CharacterString', xmlDoc, nsResolver);
    const [familyName, givenName] = fullName?.split(', '); // Use optional chaining

    if (!givenName || !familyName) {
      continue;
    }

    // Extract email and website, handling potential namespace issues
    let email = getNodeText(contactPersonNode, 'gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress/gco:CharacterString', xmlDoc, nsResolver);
    let website = getNodeText(contactPersonNode, 'gmd:contactInfo/gmd:CI_Contact/gmd:onlineResource/gmd:CI_OnlineResource/gmd:linkage/gmd:URL', xmlDoc, nsResolver);

    if (!email) {
      email = getNodeText(contactPersonNode, '//electronicMailAddress/CharacterString', xmlDoc, null);
    }
    if (!website) {
      website = getNodeText(contactPersonNode, '//linkage/URL', xmlDoc, null);
    }

    // Find the matching author row based on name
    let $row = $('div[data-creator-row]').filter(function () {
      return $(this).find('input[name="familynames[]"]').val() === familyName &&
        $(this).find('input[name="givennames[]"]').val() === givenName;
    }).first();

    if ($row.length === 0) {
      console.warn(`No matching author row found for contact person: ${givenName} ${familyName}`);
      continue;
    }

    // Mark the row as contact person
    $row.find('input[name="contacts[]"]').prop('checked', true);

    // Show the contact person fields
    $row.find('.contact-person-input').show();

    // Populate the contact person fields
    $row.find('input[name="cpEmail[]"]').val(email || '');
    $row.find('input[name="cpOnlineResource[]"]').val(website || '');
  }
}

// Global variable to store labs data
let labData = [];

/**
 * Helper function to find lab name by ID
 * @param {string} labId - The laboratory ID
 * @returns {Object|null} The laboratory object or null if not found
 */
function findLabNameById(labId) {
  if (!labData) {
    console.error('labData is not available');
    return null;
  }
  return labData.find(lab => lab.id === labId) || null;
}

/**
 * Helper function to set laboratory data in a row
 * @param {jQuery} row - The jQuery row element
 * @param {string} labId - The laboratory ID
 */
function setLabDataInRow(row, labId) {
  // Check if labData is available
  if (typeof labData === 'undefined') {
    console.error('labData is not available');
    return;
  }

  const selectName = row.find('select[name="laboratoryName[]"]');

  if (!selectName.length) {
    console.error('Select element for laboratory name not found');
    return;
  }

  const lab = findLabNameById(labId);

  if (!lab) {
    console.error('Lab not found with ID:', labId);
    return;
  }

  try {
    // Set the select value to the lab name
    selectName.val(lab.name);

    // Trigger change event to ensure any attached handlers run
    selectName.trigger('change');

    // Set affiliation
    const inputAffiliation = row.find('input[name="laboratoryAffiliation[]"]');
    if (inputAffiliation.length) {
      inputAffiliation.val(lab.affiliation || '');
    }

    // Set hidden fields
    const hiddenRorId = row.find('input[name="laboratoryRorIds[]"]');
    const hiddenLabId = row.find('input[name="LabId[]"]');

    if (hiddenRorId.length) hiddenRorId.val(lab.rorid || '');
    if (hiddenLabId.length) hiddenLabId.val(lab.id);

  } catch (error) {
    console.error('Error in setLabDataInRow:', error);
    console.error('Error stack:', error.stack);
  }
}

/**
 * Process originating laboratories from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processOriginatingLaboratories(xmlDoc, resolver) {
  const laboratoryNodes = xmlDoc.evaluate(
    './/ns:contributors/ns:contributor[@contributorType="HostingInstitution" and ns:nameIdentifier[@nameIdentifierScheme="labid"]]',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let i = 0; i < laboratoryNodes.snapshotLength; i++) {
    const labNode = laboratoryNodes.snapshotItem(i);

    // Extract laboratory ID
    const labId = getNodeText(labNode, 'ns:nameIdentifier[@nameIdentifierScheme="labid"]', xmlDoc, resolver);

    // Skip if no lab ID
    if (!labId) {
      continue;
    }

    if (i === 0) {
      // First laboratory - use existing row
      const firstRow = $('#group-originatinglaboratory .row[data-laboratory-row]:first');

      // Set lab data in the row
      setLabDataInRow(firstRow, labId);

    } else {
      // Additional laboratories - clone new row
      $('#button-originatinglaboratory-add').click();

      // Find the newly added row
      const newRow = $('#group-originatinglaboratory .row[data-laboratory-row]').last();

      // Set lab data in the row
      setLabDataInRow(newRow, labId);
    }
  }
}

/**
 * Normalize contributorType by adding whitespace between words.
 * @param {string} contributorType - The contributorType from the XML.
 * @returns {string} - Normalized role with spaces between words.
 */
function normalizeRole(contributorType) {
  return contributorType.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Helper function to get or create a new organization row
function getOrCreateOrgRow(index) {
  const container = $('#group-contributororganisation');
  if (index === 0) {
    return container.find('[contributors-row]').first();
  }

  // Simulate click on add button to create new row
  $('#button-contributor-addorganisation').click();

  // Return the newly created row
  return container.find('.row').last();
}

// Helper function to get or create a new person row
function getOrCreatePersonRow(index) {
  const container = $('#group-contributorperson');
  if (index === 0) {
    return container.find('[contributor-person-row]').first();
  }

  // Simulate click on add button to create new row
  $('#button-contributor-addperson').click();

  // Return the newly created row
  return container.find('.row').last();
}

/**
 * Process contributors from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processContributors(xmlDoc, resolver) {
  const contributorsNode = xmlDoc.evaluate(
    './/ns:contributors',
    xmlDoc,
    resolver,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;

  if (!contributorsNode) return;

  // Get all contributors except ContactPerson and Contributers with nameIdentifierScheme labid, because those are loaded into fg Contact Person and fg Originating Laboratory
  const contributorNodes = xmlDoc.evaluate(
    'ns:contributor[not(@contributorType="ContactPerson") and not(ns:nameIdentifier[@nameIdentifierScheme="labid"])]',
    contributorsNode,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  // Create maps to store unique contributors
  const personMap = new Map(); // Key: ORCID or name, Value: contributor data
  const orgMap = new Map();    // Key: name, Value: contributor data

  // Process all contributors
  for (let i = 0; i < contributorNodes.snapshotLength; i++) {
    const contributor = contributorNodes.snapshotItem(i);
    processIndividualContributor(contributor, xmlDoc, resolver, personMap, orgMap);
  }

  // Populate form with processed data
  populateFormWithContributors(personMap, orgMap);
}

/**
 * Process an individual contributor node and update the corresponding maps
 * @param {Node} contributor - The contributor XML node
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 * @param {Map} personMap - Map to store person contributors
 * @param {Map} orgMap - Map to store organization contributors
 */
function processIndividualContributor(contributor, xmlDoc, resolver, personMap, orgMap) {
  const contributorType = contributor.getAttribute('contributorType');
  const nameType = getNodeText(contributor, 'ns:contributorName/@nameType', xmlDoc, resolver);
  const contributorName = getNodeText(contributor, 'ns:contributorName', xmlDoc, resolver);
  const givenName = getNodeText(contributor, 'ns:givenName', xmlDoc, resolver);
  const familyName = getNodeText(contributor, 'ns:familyName', xmlDoc, resolver);
  const orcid = getNodeText(contributor, 'ns:nameIdentifier[@schemeURI="https://orcid.org/"]', xmlDoc, resolver);

  // Get affiliations
  const affiliationNodes = xmlDoc.evaluate(
    'ns:affiliation',
    contributor,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  const affiliations = [];
  const rorIds = [];

  for (let j = 0; j < affiliationNodes.snapshotLength; j++) {
    const affNode = affiliationNodes.snapshotItem(j);
    const affiliationName = affNode.textContent;
    const rorId = affNode.getAttribute('affiliationIdentifier');

    if (affiliationName && !affiliations.includes(affiliationName)) {
      affiliations.push(affiliationName);
      if (rorId) {
        const cleanRorId = rorId.replace('https://ror.org/', '');
        if (!rorIds.includes(cleanRorId)) {
          rorIds.push(cleanRorId);
        }
      }
    }
  }

  const isPerson = nameType === 'Personal' || (givenName && familyName);

  if (isPerson) {
    const key = orcid || `${givenName}_${familyName}`;
    updateContributorMap(personMap, key, {
      givenName,
      familyName,
      orcid,
      roles: [normalizeRole(contributorType)], // Use normalized role
      affiliations,
      rorIds
    });
  } else {
    updateContributorMap(orgMap, contributorName, {
      name: contributorName,
      roles: [normalizeRole(contributorType)], // Use normalized role
      affiliations,
      rorIds
    });
  }
}

/**
 * Update the contributor map with new data, merging if the key already exists
 * @param {Map} map - The map to update
 * @param {string} key - The key for the contributor
 * @param {Object} newData - The new contributor data
 */
function updateContributorMap(map, key, newData) {
  if (map.has(key)) {
    const existing = map.get(key);
    if (!existing.roles.includes(newData.roles[0])) {
      existing.roles.push(newData.roles[0]);
    }
    newData.affiliations.forEach(aff => {
      if (!existing.affiliations.includes(aff)) {
        existing.affiliations.push(aff);
      }
    });
    newData.rorIds.forEach(rid => {
      if (!existing.rorIds.includes(rid)) {
        existing.rorIds.push(rid);
      }
    });
  } else {
    map.set(key, newData);
  }
}

/**
 * Get or retrieve the Tagify instance for an input element
 * @param {HTMLElement} inputElement - The input element
 * @returns {Tagify|null} The Tagify instance or null if not available
 */
function getTagifyInstance(inputElement) {
  if (!inputElement) return null;

  // Check for direct property
  if (inputElement.tagify) {
    return inputElement.tagify;
  }

  // Check for _tagify property
  if (inputElement._tagify) {
    return inputElement._tagify;
  }

  // Check for jQuery element with tagify
  if (inputElement[0] && inputElement[0].tagify) {
    return inputElement[0].tagify;
  }

  // Look for data- attribute
  if (inputElement.dataset && inputElement.dataset.tagify) {
    return window[inputElement.dataset.tagify];
  }

  console.log("No existing Tagify instance found for element, returning null", inputElement);
  return null;
}

/**
 * Populate the form with processed contributor data, handling both original and cloned field names
 * @param {Map} personMap - Map containing person contributors
 * @param {Map} orgMap - Map containing organization contributors
 */
function populateFormWithContributors(personMap, orgMap) {
  let personIndex = 0;
  let orgIndex = 0;

  // Process persons
  for (const person of personMap.values()) {
    const personRow = getOrCreatePersonRow(personIndex++);
    let isClonedRow = personIndex > 1; // First row is original, others are cloned

    // Roles
    const roleInput = personRow.find('input[name="cbPersonRoles[]"]')[0];
    const tagifyRoles = getTagifyInstance(roleInput);
    if (tagifyRoles) {
      tagifyRoles.removeAllTags();
      tagifyRoles.addTags(person.roles.map(role => ({ value: role })));
    } else {
      console.warn("No Tagify instance found for role input:", roleInput);
    }

    // ORCID
    if (person.orcid) {
      personRow.find('input[name="cbORCID[]"]').val(person.orcid);
    }

    // Names
    personRow.find('input[name="cbPersonLastname[]"]').val(person.familyName);
    personRow.find('input[name="cbPersonFirstname[]"]').val(person.givenName);

    // Affiliations - handle both original and cloned field names
    let affiliationInput;
    if (isClonedRow) {
      // Cloned rows use cbPersonAffiliations[] as the name
      affiliationInput = personRow.find('input[name="cbPersonAffiliations[]"]')[0];
    } else {
      // Original row uses cbAffiliation[] as the name
      affiliationInput = personRow.find('input[name="cbAffiliation[]"]')[0];
    }

    const tagifyAffiliations = getTagifyInstance(affiliationInput);
    if (tagifyAffiliations) {
      tagifyAffiliations.removeAllTags();
      tagifyAffiliations.addTags(person.affiliations.map(aff => ({ value: aff })));
    } else {
      console.warn("No Tagify instance found for affiliation input:", affiliationInput, "in row", isClonedRow ? "cloned" : "original");
    }

    // ROR IDs - handle both original and cloned field names
    if (isClonedRow) {
      // Cloned rows use cbPersonRorIds[] as the name
      personRow.find('input[name="cbPersonRorIds[]"]').val(person.rorIds.join(','));
    } else {
      // Original row uses cbpRorIds[] as the name
      personRow.find('input[name="cbpRorIds[]"]').val(person.rorIds.join(','));
    }
  }

  // Process organizations
  for (const org of orgMap.values()) {
    const orgRow = getOrCreateOrgRow(orgIndex++);
    let isClonedRow = orgIndex > 1; // First row is original, others are cloned

    // Roles
    const roleInput = orgRow.find('input[name="cbOrganisationRoles[]"]')[0];
    const tagifyRoles = getTagifyInstance(roleInput);
    if (tagifyRoles) {
      tagifyRoles.removeAllTags();
      tagifyRoles.addTags(org.roles.map(role => ({ value: role })));
    } else {
      console.warn("No Tagify instance found for organization role input:", roleInput);
    }

    // Organization name
    orgRow.find('input[name="cbOrganisationName[]"]').val(org.name);

    // Affiliations - handle both original and cloned field names
    let affiliationInput;
    if (isClonedRow) {
      // Cloned rows use cbOrganisationAffiliations[] as the name
      affiliationInput = orgRow.find('input[name="cbOrganisationAffiliations[]"]')[0];
    } else {
      // Original row uses OrganisationAffiliation[] as the name
      affiliationInput = orgRow.find('input[name="OrganisationAffiliation[]"]')[0];
    }

    const tagifyAffiliations = getTagifyInstance(affiliationInput);
    if (tagifyAffiliations) {
      tagifyAffiliations.removeAllTags();
      tagifyAffiliations.addTags(org.affiliations.map(aff => ({ value: aff })));
    } else {
      console.warn("No Tagify instance found for organization affiliation input:", affiliationInput, "in row", isClonedRow ? "cloned" : "original");
    }

    // ROR IDs - handle both original and cloned field names
    if (isClonedRow) {
      // Cloned rows use cbOrganisationRorIds[] as the name
      orgRow.find('input[name="cbOrganisationRorIds[]"]').val(org.rorIds.join(','));
    } else {
      // Original row uses hiddenOrganisationRorId[] as the name
      orgRow.find('input[name="hiddenOrganisationRorId[]"]').val(org.rorIds.join(','));
    }
  }
}

/**
 * Parse temporal data from a date node.
 * This helper function simplifies the processing of temporal data in the main `processSpatialTemporalCoverages` function. 
 * It parses date strings and returns the extracted start and end dates, times and the timezone as separate components.
 * @param {Node} dateNode - The XML node containing temporal data.
 * @returns {Object} An object containing startDate, startTime, endDate, and endTime.
 */
function parseTemporalData(dateNode) {
  const result = {
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezoneOffset: '',
  };

  if (!dateNode || !dateNode.textContent) return result;

  const [start, end] = dateNode.textContent.split('/');

  // Handle start date and time
  if (start) {
    if (start.includes('T')) {
      // Case 1: Date with time and timezone (e.g., 2025-02-28T01:11:00+01:00)
      const [startDate, startTime] = start.split('T');
      result.startDate = startDate;
      result.startTime = startTime.split(/[+-]/)[0];  // Extract time part

      // Extract timezone if present
      if (start.includes('+') || start.includes('-')) {
        result.timezoneOffset = start.slice(-6);  // Extract the timezone offset (+01:00, -02:00)
      }
    } else {
      // Case 2: Date with only timezone (e.g., 2025-02-28+02:00)
      result.startDate = start.replace(/([+-]\d{2}:\d{2})$/, '');  // Remove timezone part from the date
      result.startTime = '';  // No time
      const offsetMatch = start.match(/([+-]\d{2}:\d{2})$/);
      if (offsetMatch) {
        result.timezoneOffset = offsetMatch[1];  // Extract the timezone offset (+02:00)
      }
    }
  }

  // Handle end date and time (similar to start)
  if (end) {
    if (end.includes('T')) {
      // Case 1: Date with time and timezone (e.g., 2025-02-28T22:22:00+01:00)
      const [endDate, endTime] = end.split('T');
      result.endDate = endDate;
      result.endTime = endTime.split(/[+-]/)[0];  // Extract time part

      // Extract timezone if present
      if (end.includes('+') || end.includes('-')) {
        result.timezoneOffset = end.slice(-6);  // Extract the timezone offset (+01:00, -02:00)
      }
    } else {
      // Case 2: Date with only timezone (e.g., 2025-02-28+02:00)
      result.endDate = end.replace(/([+-]\d{2}:\d{2})$/, '');  // Remove timezone part from the date
      result.endTime = '';  // No time
      const offsetMatch = end.match(/([+-]\d{2}:\d{2})$/);
      if (offsetMatch) {
        result.timezoneOffset = offsetMatch[1];  // Extract the timezone offset (+02:00)
      }
    }
  }

  return result;
}

/**
 * Process spatial-temporal coverage (STC) data from XML and populate the form.
 * @param {Document} xmlDoc - The parsed XML document.
 * @param {Function} resolver - The namespace resolver function.
 */
function processSpatialTemporalCoverages(xmlDoc, resolver) {
  const geoLocationNodes = xmlDoc.evaluate(
    './/ns:geoLocations/ns:geoLocation',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let i = 0; i < geoLocationNodes.snapshotLength; i++) {
    const geoLocationNode = geoLocationNodes.snapshotItem(i);

    // Extract geoLocation data
    const place = geoLocationNode.querySelector('geoLocationPlace')?.textContent || '';
    const boxNode = geoLocationNode.querySelector('geoLocationBox');
    const pointNode = geoLocationNode.querySelector('geoLocationPoint');

    const westBoundLongitude = boxNode?.querySelector('westBoundLongitude')?.textContent || '';
    const eastBoundLongitude = boxNode?.querySelector('eastBoundLongitude')?.textContent || '';
    const southBoundLatitude = boxNode?.querySelector('southBoundLatitude')?.textContent || '';
    const northBoundLatitude = boxNode?.querySelector('northBoundLatitude')?.textContent || '';
    const pointLongitude = pointNode?.querySelector('pointLongitude')?.textContent || '';
    const pointLatitude = pointNode?.querySelector('pointLatitude')?.textContent || '';

    // Determine latitude and longitude values
    const latitudeMin = southBoundLatitude || pointLatitude;
    const latitudeMax = northBoundLatitude || pointLatitude;
    const longitudeMin = westBoundLongitude || pointLongitude;
    const longitudeMax = eastBoundLongitude || pointLongitude;

    // Find last row
    const $lastRow = $('textarea[name="tscDescription[]"]').last().closest('.row');

    // Set values
    $lastRow.find('textarea[name="tscDescription[]"]').val(place);
    $lastRow.find('input[name="tscLatitudeMin[]"]').val(latitudeMin);
    $lastRow.find('input[name="tscLatitudeMax[]"]').val(latitudeMax);
    $lastRow.find('input[name="tscLongitudeMin[]"]').val(longitudeMin);
    $lastRow.find('input[name="tscLongitudeMax[]"]').val(longitudeMax);

    // Update map overlay if function available
    const rowId = $lastRow.attr('tsc-row-id');
    if (typeof window.updateMapOverlay === 'function') {
      window.updateMapOverlay(rowId, latitudeMax, longitudeMax, latitudeMin, longitudeMin);
    }

    // Set date and time if available
    const dateNode = xmlDoc.evaluate('//ns:dates/ns:date[@dateType="Collected"]', xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotItem(i);
    const temporalData = parseTemporalData(dateNode);

    $lastRow.find('input[name="tscDateStart[]"]').val(temporalData.startDate);
    if (temporalData.startTime != '') {
      $lastRow.find('input[name="tscTimeStart[]"]').val(temporalData.startTime);
    }
    if (temporalData.endTime != '') {
      $lastRow.find('input[name="tscTimeEnd[]"]').val(temporalData.endTime);

    }

    $lastRow.find('input[name="tscDateEnd[]"]').val(temporalData.endDate);

    // Handle timezone
    const timezoneField = $lastRow.find('select[name="tscTimezone[]"]');

    // Find the option that matches the extracted timezoneOffset and set it as the selected value
    timezoneField.find('option').each(function () {
      if ($(this).text().includes(temporalData.timezoneOffset)) {
        timezoneField.val($(this).val());  // Select the matched option
        return false;  // Exit the loop once a match is found
      }
    });

    // Clone row for the next entry, if there is one
    if (i < geoLocationNodes.snapshotLength - 1) {
      $('#button-stc-add').click();
    }
  }
}

/**
 * Process descriptions from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processDescriptions(xmlDoc, resolver) {
  // Get all description elements
  const descriptionNodes = xmlDoc.evaluate(
    './/ns:descriptions/ns:description',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );


  // Create a mapping of description types to form input IDs
  const descriptionMapping = {
    'Abstract': 'input-abstract',
    'Methods': 'input-methods',
    'TechnicalInformation': 'input-technicalinfo',
    'Other': 'input-other'
  };

  // Process each description node
  for (let i = 0; i < descriptionNodes.snapshotLength; i++) {
    const descriptionNode = descriptionNodes.snapshotItem(i);
    const descriptionType = descriptionNode.getAttribute('descriptionType');
    const language = descriptionNode.getAttribute('xml:lang') || 'en';
    const content = descriptionNode.textContent.trim();

    // Find the corresponding input field
    const inputId = descriptionMapping[descriptionType];
    if (inputId) {
      // Set the content in the appropriate textarea
      $(`#${inputId}`).val(content);

      // If this is not the Abstract, expand the corresponding accordion section
      if (descriptionType !== 'Abstract') {
        const collapseId = `collapse-${descriptionType.toLowerCase().replace('information', 'info')}`;
        $(`#${collapseId}`).addClass('show');
      }
    }
  }

  // Ensure Abstract accordion is always expanded
  $('#collapse-abstract').addClass('show');
}

/**
 * Process dates from XML and populate the form.
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processDates(xmlDoc, resolver) {
  const dateNodes = xmlDoc.evaluate(
    '//ns:dates/ns:date',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let i = 0; i < dateNodes.snapshotLength; i++) {
    const dateNode = dateNodes.snapshotItem(i);
    const dateType = dateNode.getAttribute('dateType');
    const dateValue = dateNode.textContent.trim();

    // Set values based on date type
    if (dateType === 'Created') {
      $('input[name="dateCreated"]').val(dateValue);
    } else if (dateType === 'Available') {
      $('input[name="dateEmbargo"]').val(dateValue);
    }
  }
}

/**
* Process Subjects from XML and populate the Keyword fields
* @param {Document} xmlDoc - The parsed XML document
* @param {Function} resolver - The namespace resolver function
*/
function processKeywords(xmlDoc, resolver) {
  const subjectNodes = xmlDoc.evaluate(
    './/ns:subjects/ns:subject',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );
  const tagifyInputGCMD = document.querySelector('#input-sciencekeyword');
  const tagifyInputMsl = document.querySelector('#input-mslkeyword');
  const tagifyInputFree = document.querySelector('#input-freekeyword');
  const tagifyInputPlatforms = document.querySelector('#input-Platforms');
  const tagifyInputInstruments = document.querySelector('#input-Instruments');

  // Error handling
  if (!tagifyInputGCMD?._tagify || !tagifyInputMsl?._tagify || !tagifyInputFree?._tagify ||
    !tagifyInputPlatforms?._tagify || !tagifyInputInstruments?._tagify) {
    console.error("One or more Tagify instances are not properly initialized.");
    return;
  }

  // Retrieve existing Tagify instances
  const tagifyGCMD = tagifyInputGCMD._tagify;
  const tagifyMsl = tagifyInputMsl._tagify;
  const tagifyFree = tagifyInputFree._tagify;
  const tagifyPlatforms = tagifyInputPlatforms._tagify;
  const tagifyInstruments = tagifyInputInstruments._tagify;

  // Clear existing tags
  tagifyGCMD.removeAllTags();
  tagifyMsl.removeAllTags();
  tagifyFree.removeAllTags();
  tagifyPlatforms.removeAllTags();
  tagifyInstruments.removeAllTags();

  for (let i = 0; i < subjectNodes.snapshotLength; i++) {
    const subjectNode = subjectNodes.snapshotItem(i);
    const subjectScheme = subjectNode.getAttribute('subjectScheme') || '';
    const schemeURI = subjectNode.getAttribute('schemeURI') || '';
    const valueURI = subjectNode.getAttribute('valueURI') || '';
    const keyword = subjectNode.textContent.trim();

    // Create the tag data
    const tagData = {
      value: keyword,
      scheme: subjectScheme,
      schemeURI: schemeURI,
      id: valueURI
    };

    // Check the schemeURI and add the tag to the appropriate Tagify instance
    if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords") {
      // Add the tag to the GCMD Science Keyword input field
      tagifyGCMD.addTags([tagData]);
    } else if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms") {
      tagifyPlatforms.addTags([tagData]);
    } else if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments") {
      tagifyInstruments.addTags([tagData]);
    } else if (schemeURI.startsWith("https://epos-msl.uu.nl/voc/")) {
      // Add the tag to the MSL Keyword input field
      tagifyMsl.addTags([tagData]);
    } else {
      // Add all other tags to the Free Keyword input field
      tagifyFree.addTags([tagData]);
    }
  }
}


/**
 * Process related identifiers from XML and populate the formgroup Related Works
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processRelatedWorks(xmlDoc, resolver) {
  const identifierNodes = xmlDoc.evaluate(
    './/ns:relatedIdentifiers/ns:relatedIdentifier',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let i = 0; i < identifierNodes.snapshotLength; i++) {
    const identifierNode = identifierNodes.snapshotItem(i);
    const relationType = identifierNode.getAttribute('relationType');
    const identifierType = identifierNode.getAttribute('relatedIdentifierType');
    const identifierValue = identifierNode.textContent;

    // Find last row
    const $lastRow = $('input[name="rIdentifier[]"]').last().closest('.row');

    // Set values
    $lastRow.find('input[name="rIdentifier[]"]').val(identifierValue);
    $lastRow.find('select[name="rIdentifierType[]"]').val(identifierType);
    // Match relation by visible text instead of value
    $lastRow.find('select[name="relation[]"]:first option').filter(function () {
      return $(this).text() === relationType; // Match by visible text
    }).prop('selected', true);

    // clone row for the next entry, if there is one
    if (i < identifierNodes.snapshotLength - 1) {
      // Add Related Work
      $('#button-relatedwork-add').click();
    }
  }
}

/**
 * Process fundingReferences from XML and populate the formgroup Funders
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processFunders(xmlDoc, resolver) {
  // Fetch all fundingReference nodes
  const funderNodes = xmlDoc.evaluate(
    './/ns:fundingReferences/ns:fundingReference',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let i = 0; i < funderNodes.snapshotLength; i++) {
    const funderNode = funderNodes.snapshotItem(i);
    // Extract data from XML
    const funderName = getNodeText(funderNode, 'ns:funderName', xmlDoc, resolver);
    const funderId = getNodeText(funderNode, 'ns:funderIdentifier', xmlDoc, resolver);
    const funderIdTyp = funderNode.querySelector('funderIdentifier')?.getAttribute('funderIdentifierType') || '';
    const awardTitle = getNodeText(funderNode, 'ns:awardTitle', xmlDoc, resolver);
    const awardNumber = getNodeText(funderNode, 'ns:awardNumber', xmlDoc, resolver);

    // Find the last row in the form
    const $lastRow = $('input[name="funder[]"]').last().closest('.row');

    // Populate fields
    $lastRow.find('input[name="funder[]"]').val(funderName);
    $lastRow.find('input[name="funderId[]"]').val(funderId);
    $lastRow.find('input[name="funderidtyp[]"]').val(funderIdTyp);

    $lastRow.find('input[name="grantNummer[]"]').val(awardNumber);
    $lastRow.find('input[name="grantName[]"]').val(awardTitle);

    // Clone a new row if more funding references need to be added
    if (i < funderNodes.snapshotLength - 1) {
      $('#button-fundingreference-add').click();
    }
  }
}



/**
 * Loads XML data into form fields according to mapping configuration
 * @param {Document} xmlDoc - The parsed XML document
 */
async function loadXmlToForm(xmlDoc) {
  clearInputFields();
  const resourceNode = xmlDoc.evaluate(
    '//ns:resource | /resource | //resource',
    xmlDoc,
    function (prefix) {
      if (prefix === 'ns') {
        return 'http://datacite.org/schema/kernel-4';
      }
      return null;
    },
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;

  if (!resourceNode) {
    console.error('No DataCite resource element found');
    return;
  }
  // Warte auf das Laden der Labordaten, falls noch nicht geschehen
  if (!labData || labData.length === 0) {
    try {
      labData = await $.getJSON("json/msl-labs.json");
    } catch (error) {
      console.error('Error loading laboratory data:', error);
      labData = [];
    }
  }
  // Erstelle das License-Mapping zuerst
  const licenseMapping = await createLicenseMapping();

  // Definiere das komplette XML_MAPPING mit dem erstellten licenseMapping
  const XML_MAPPING = {
    // Resource Information
    'identifier': {
      selector: '#input-resourceinformation-doi',
      attribute: 'textContent'
    },
    'publicationYear': {
      selector: '#input-resourceinformation-publicationyear',
      attribute: 'textContent'
    },
    'version': {
      selector: '#input-resourceinformation-version',
      attribute: 'textContent'
    },

    // Language mapping
    'language': {
      selector: '#input-resourceinformation-language',
      attribute: 'textContent',
      transform: (value) => {
        // Map language codes to database IDs
        const languageMap = {
          'en': '1', // Assuming English has ID 1
          'de': '2', // Assuming German has ID 2
          'fr': '3'  // Assuming French has ID 3
        };
        return languageMap[value.toLowerCase()] || '1'; // Default to English if not found
      }
    },
    // Rights
    'rightsList/ns:rights': {
      selector: '#input-rights-license',
      attribute: 'rightsIdentifier',
      transform: (value) => {
        return licenseMapping[value] || '1';
      }
    }
  };

  // const nsResolver = xmlDoc.createNSResolver(xmlDoc.documentElement);
  const defaultNS = resourceNode.namespaceURI || 'http://datacite.org/schema/kernel-4';

  function resolver(prefix) {
    if (prefix === 'ns') {
      return defaultNS;
    }
    return null;
  }

  // Verarbeite zuerst die Standard-Mappings
  for (const [xmlPath, config] of Object.entries(XML_MAPPING)) {
    const nsPath = `.//ns:${xmlPath}`;

    const xmlElements = xmlDoc.evaluate(
      nsPath,
      xmlDoc,
      resolver,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );

    const xmlNode = xmlElements.singleNodeValue;
    if (xmlNode) {

      const value = config.attribute === 'textContent'
        ? xmlNode.textContent
        : xmlNode.getAttribute(config.attribute);

      const transformedValue = config.transform ? config.transform(value) : value;

      $(config.selector).val(transformedValue);
    }
  }

  processResourceType(xmlDoc);
  // Process titles
  processTitles(xmlDoc, resolver);
  // Processing Creators
  processCreators(xmlDoc, resolver);
  // Process Contact Persons
  processContactPersons(xmlDoc);
  // Process Originating Laboratories
  processOriginatingLaboratories(xmlDoc, resolver);
  // Process contributors
  processContributors(xmlDoc, resolver);
  // Process descriptions
  processDescriptions(xmlDoc, resolver);
  // Process Spatial and Temporal Coverages
  processSpatialTemporalCoverages(xmlDoc, resolver);
  // Process Keywords
  processKeywords(xmlDoc, resolver);
  // Process Related Works
  processRelatedWorks(xmlDoc, resolver);
  // Process Funders
  processFunders(xmlDoc, resolver);
  // Process Dates
  processDates(xmlDoc, resolver);

}