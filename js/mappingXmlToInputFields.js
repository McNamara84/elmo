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
    'Subtitle': '3',
    'TranslatedTitle': '4'
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

  // Reset titles
  $('input[name="title[]"]').closest('.row').not(':first').remove();
  $('input[name="title[]"]:first').val('');
  $('#input-resourceinformation-titletype').val('1');

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

// Globale Variable für die Labor-Daten
let labData = [];

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

  // Reset existing authors
  $('#group-author .row[data-creator-row]').not(':first').remove();
  $('#group-author .row[data-creator-row]:first input').val('');

  for (let i = 0; i < creatorNodes.snapshotLength; i++) {
    const creatorNode = creatorNodes.snapshotItem(i);

    // Extract Creators
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

    if (i === 0) {
      // First Author - use existing row
      const firstRow = $('#group-author .row[data-creator-row]:first');
      firstRow.find('input[name="orcids[]"]').val(orcid);
      firstRow.find('input[name="familynames[]"]').val(familyName);
      firstRow.find('input[name="givennames[]"]').val(givenName);

      // Initialize Tagify for first row
      const tagifyInput = firstRow.find('input[name="affiliation[]"]')[0];
      if (tagifyInput) {
        const tagify = new Tagify(tagifyInput);
        tagify.addTags(affiliations.map(a => ({ value: a })));
        firstRow.find('input[name="authorRorIds[]"]').val(rorIds.join(','));
      }
    } else {
      // Additional authors - simulate button click
      $('#button-author-add').click();

      // Find newly added row
      const newRow = $('#group-author .row[data-creator-row]').last();

      // Set values
      newRow.find('input[name="orcids[]"]').val(orcid);
      newRow.find('input[name="familynames[]"]').val(familyName);
      newRow.find('input[name="givennames[]"]').val(givenName);

      // Wait briefly for Tagify initialization
      setTimeout(() => {
        const tagifyInput = newRow.find('input[name="affiliation[]"]')[0];
        if (tagifyInput && tagifyInput.tagify) {
          tagifyInput.tagify.addTags(affiliations.map(a => ({ value: a })));
          newRow.find('input[name="authorRorIds[]"]').val(rorIds.join(','));
        }
      }, 100);
    }
  }
}

/**
 * Process contact persons from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processContactPersons(xmlDoc, resolver) {
  const contactPersonNodes = xmlDoc.evaluate(
    './/ns:contributors/ns:contributor[@contributorType="ContactPerson"]',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  // Reset existing Contact Persons
  $('#group-contactperson .row[contact-person-row]').not(':first').remove();
  $('#group-contactperson .row[contact-person-row]:first input').val('');

  let validContactPersonCount = 0;

  for (let i = 0; i < contactPersonNodes.snapshotLength; i++) {
    const contactPersonNode = contactPersonNodes.snapshotItem(i);

    // Extract relevant data
    const givenName = getNodeText(contactPersonNode, 'ns:givenName', xmlDoc, resolver);
    const familyName = getNodeText(contactPersonNode, 'ns:familyName', xmlDoc, resolver);

    // Skip this contact person if either given name or family name is missing
    if (!givenName || !familyName) {
      continue;
    }

    // Extract additional data
    const position = getNodeText(contactPersonNode, 'ns:position', xmlDoc, resolver);
    const email = getNodeText(contactPersonNode, 'ns:email', xmlDoc, resolver);
    const website = getNodeText(contactPersonNode, 'ns:onlineResource', xmlDoc, resolver);

    // Get all affiliations for this contact person
    const affiliationNodes = xmlDoc.evaluate(
      'ns:affiliation',
      contactPersonNode,
      resolver,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    // Create array of affiliations and ROR IDs
    const affiliations = [];
    const rorIds = [];

    for (let j = 0; j < affiliationNodes.snapshotLength; j++) {
      const affNode = affiliationNodes.snapshotItem(j);
      const affiliationName = affNode.textContent;
      const rorId = affNode.getAttribute('affiliationIdentifier');

      if (affiliationName) {
        affiliations.push(affiliationName);
        if (rorId) {
          rorIds.push(rorId.replace('https://ror.org/', '')); // Remove URL prefix if present
        }
      }
    }

    if (validContactPersonCount === 0) {
      // First valid Contact Person - use the existing row
      const firstRow = $('#group-contactperson .row[contact-person-row]:first');
      firstRow.find('input[name="cpFirstname[]"]').val(givenName);
      firstRow.find('input[name="cpLastname[]"]').val(familyName);
      firstRow.find('input[name="cpPosition[]"]').val(position);
      firstRow.find('input[name="cpEmail[]"]').val(email);
      firstRow.find('input[name="cpOnlineResource[]"]').val(website);

      // Affiliation mit Tagify
      const affiliationInput = firstRow.find('input[name="cpAffiliation[]"]')[0];
      if (affiliationInput && affiliationInput.tagify) {
        affiliationInput.tagify.removeAllTags();
        affiliationInput.tagify.addTags(affiliations.map(aff => ({ value: aff })));
      }

      // Set ROR IDs
      firstRow.find('input[name="cpRorIds[]"]').val(rorIds.join(','));

    } else {
      // Additional valid Contact Persons - clone a new row
      $('#button-contactperson-add').click();
      const newRow = $('#group-contactperson .row[contact-person-row]').last();
      newRow.find('input[name="cpFirstname[]"]').val(givenName);
      newRow.find('input[name="cpLastname[]"]').val(familyName);
      newRow.find('input[name="cpPosition[]"]').val(position);
      newRow.find('input[name="cpEmail[]"]').val(email);
      newRow.find('input[name="cpOnlineResource[]"]').val(website);

      // Wait briefly for Tagify initialization
      setTimeout(() => {
        const affiliationInput = newRow.find('input[name="cpAffiliation[]"]')[0];
        if (affiliationInput && affiliationInput.tagify) {
          affiliationInput.tagify.removeAllTags();
          affiliationInput.tagify.addTags(affiliations.map(aff => ({ value: aff })));
        }

        // Set ROR IDs
        newRow.find('input[name="cpRorIds[]"]').val(rorIds.join(','));
      }, 100);
    }

    validContactPersonCount++;
  }
}

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
 * Helper function to set laboratory name with Tagify
 * @param {jQuery} row - The jQuery row element
 * @param {string} labId - The laboratory ID
 */
function setLabNameWithTagify(row, labId) {
  // Check if labData is available
  if (typeof labData === 'undefined') {
    console.error('labData is not available');
    return;
  }

  const inputName = row.find('input[name="laboratoryName[]"]')[0];

  if (!inputName) {
    console.error('Input element not found');
    return;
  }

  const lab = findLabNameById(labId);

  if (!lab) {
    console.error('Lab not found');
    return;
  }

  try {
    // Check if Tagify instance exists
    if (inputName.tagify) {
      inputName.tagify.removeAllTags();
      inputName.tagify.addTags([lab.name]);
    } else {
      // Create new Tagify instance
      const tagify = new Tagify(inputName, {
        whitelist: labData.map(item => item.name),
        enforceWhitelist: true,
        maxTags: 1,
        dropdown: {
          maxItems: 20,
          closeOnSelect: true,
          highlightFirst: true
        },
        delimiters: null,
        mode: "select"
      });

      // Set value after short delay
      setTimeout(() => {
        tagify.removeAllTags();
        tagify.addTags([lab.name]);
      }, 100);
    }

    // Find and set affiliation field
    const inputAffiliation = row.find('input[name="laboratoryAffiliation[]"]')[0];
    if (inputAffiliation && inputAffiliation.tagify) {
      inputAffiliation.tagify.removeAllTags();
      inputAffiliation.tagify.addTags([lab.affiliation]);
    }

    // Set hidden fields
    const hiddenRorId = row.find('input[name="laboratoryRorIds[]"]');
    const hiddenLabId = row.find('input[name="LabId[]"]');

    if (hiddenRorId.length) hiddenRorId.val(lab.ror_id || '');
    if (hiddenLabId.length) hiddenLabId.val(lab.id);

  } catch (error) {
    console.error('Error in setLabNameWithTagify:', error);
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
    './/ns:contributors/ns:contributor[@contributorType="HostingInstitution"]',
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  // Reset existing laboratories
  $('#group-originatinglaboratory .row[data-laboratory-row]').not(':first').remove();
  $('#group-originatinglaboratory .row[data-laboratory-row]:first input').val('');

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

      // Set lab ID in hidden field
      firstRow.find('input[name="LabId[]"]').val(labId);

      // Set lab name using Tagify
      setLabNameWithTagify(firstRow, labId);

    } else {
      // Additional laboratories - clone new row
      $('#button-originatinglaboratory-add').click();

      // Find the newly added row
      const newRow = $('#group-originatinglaboratory .row[data-laboratory-row]').last();

      // Set lab ID
      newRow.find('input[name="LabId[]"]').val(labId);

      // Set lab name using Tagify
      setLabNameWithTagify(newRow, labId);
    }
  }
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

  // Get all contributors except ContactPerson and HostingInstitution
  const contributorNodes = xmlDoc.evaluate(
    'ns:contributor[not(@contributorType="ContactPerson") and not(@contributorType="HostingInstitution")]',
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
  const orcid = getNodeText(contributor, 'ns:nameIdentifier[@nameIdentifierScheme="ORCID"]', xmlDoc, resolver);

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
      roles: [contributorType],
      affiliations,
      rorIds
    });
  } else {
    updateContributorMap(orgMap, contributorName, {
      name: contributorName,
      roles: [contributorType],
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
 * Populate the form with processed contributor data
 * @param {Map} personMap - Map containing person contributors
 * @param {Map} orgMap - Map containing organization contributors
 */
function populateFormWithContributors(personMap, orgMap) {
  let personIndex = 0;
  let orgIndex = 0;

  // Process persons
  for (const person of personMap.values()) {
    const personRow = getOrCreatePersonRow(personIndex++);

    // Set ORCID if available
    if (person.orcid) {
      personRow.find('input[name="cbORCID[]"]').val(person.orcid);
    }

    // Set names
    personRow.find('input[name="cbPersonLastname[]"]').val(person.familyName);
    personRow.find('input[name="cbPersonFirstname[]"]').val(person.givenName);

    // Set roles using Tagify
    const roleInput = personRow.find('input[name="cbPersonRoles[]"]')[0];
    if (roleInput && roleInput.tagify) {
      roleInput.tagify.removeAllTags();
      roleInput.tagify.addTags(person.roles.map(role => ({ value: role })));
    }

    // Set affiliations using Tagify
    const affiliationInput = personRow.find('input[name="cbAffiliation[]"]')[0];
    if (affiliationInput && affiliationInput.tagify) {
      affiliationInput.tagify.removeAllTags();
      affiliationInput.tagify.addTags(person.affiliations.map(aff => ({ value: aff })));
    }

    // Set ROR IDs
    personRow.find('input[name="cbRorIds[]"]').val(person.rorIds.join(','));
  }

  // Process organizations
  for (const org of orgMap.values()) {
    const orgRow = getOrCreateOrgRow(orgIndex++);

    // Set organization name
    orgRow.find('input[name="cbOrganisationName[]"]').val(org.name);

    // Set roles using Tagify
    const roleInput = orgRow.find('input[name="cbOrganisationRoles[]"]')[0];
    if (roleInput && roleInput.tagify) {
      roleInput.tagify.removeAllTags();
      roleInput.tagify.addTags(org.roles.map(role => ({ value: role })));
    }

    // Set affiliations using Tagify
    const affiliationInput = orgRow.find('input[name="OrganisationAffiliation[]"]')[0];
    if (affiliationInput && affiliationInput.tagify) {
      affiliationInput.tagify.removeAllTags();
      affiliationInput.tagify.addTags(org.affiliations.map(aff => ({ value: aff })));
    }

    // Set ROR IDs
    orgRow.find('input[name="OrganisationRorIds[]"]').val(org.rorIds.join(','));
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

    // wenn da noch was kommt, klone schonmal ne Row
    if (i < identifierNodes.snapshotLength-1) {
      // Add Related Work
      $('#button-relatedwork-add').click();
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

  // Reset all description fields first
  Object.values(descriptionMapping).forEach(inputId => {
    $(`#${inputId}`).val('');
  });

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
 * Loads XML data into form fields according to mapping configuration
 * @param {Document} xmlDoc - The parsed XML document
 */
async function loadXmlToForm(xmlDoc) {
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
    'resourceType': {
      selector: '#input-resourceinformation-resourcetype',
      attribute: 'resourceTypeGeneral',
      transform: (value) => {
        const typeMap = {
          'Audiovisual': '1',
          'Book': '2',
          'BookChapter': '3',
          'Collection': '4',
          'ComputationalNotebook': '5',
          'ConferencePaper': '6',
          'ConferenceProceeding': '7',
          'DataPaper': '8',
          'Dataset': '9',
          'Dissertation': '10',
          'Event': '11',
          'Image': '12',
          'Instrument': '13',
          'InteractiveResource': '14',
          'Journal': '15',
          'JournalArticle': '16',
          'Model': '17',
          'OutputManagementPlan': '18',
          'PeerReview': '19',
          'PhysicalObject': '20',
          'Preprint': '21',
          'Report': '22',
          'Service': '23',
          'Software': '24',
          'Sound': '25',
          'Standard': '26',
          'StudyRegistration': '27',
          'Text': '28',
          'Workflow': '29',
          'Other': '30'
        };
        return typeMap[value] || '30';
      }
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
    } else {
      console.log('No node found for path:', nsPath);
    }
  }

  // Process titles
  processTitles(xmlDoc, resolver);
  // Processing Creators
  processCreators(xmlDoc, resolver);
  // Process Contact Persons
  processContactPersons(xmlDoc, resolver);
  // Process Originating Laboratories
  processOriginatingLaboratories(xmlDoc, resolver);
  // Process contributors
  processContributors(xmlDoc, resolver);
  // Process Related Works
  processRelatedWorks(xmlDoc, resolver);
  // Process descriptions
  processDescriptions(xmlDoc, resolver);
}