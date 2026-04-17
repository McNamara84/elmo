/**
 * Processes the resource type from an XML document and selects the corresponding option
 * in the dropdown based on the visible text matching the `resourceTypeGeneral` attribute.
 *
 * @param {Document} xmlDoc - The XML document containing the resourceType element.
 * @param {Function} resolver - The namespace resolver function.
 */
function processResourceType(xmlDoc, resolver) {
  // Extract the resourceType element using XPath with namespace fallback
  // (supports both namespaced and non-namespaced XML documents)
  const result = xmlDoc.evaluate(
    ".//ns:resourceType | .//resourceType",
    xmlDoc,
    resolver,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  const resourceNode = result.singleNodeValue;
  if (!resourceNode) {
    console.error("No resourceType element found in XML");
    return;
  }

  // Get the resourceTypeGeneral attribute
  const resourceTypeGeneral = resourceNode.getAttribute("resourceTypeGeneral");
  if (!resourceTypeGeneral) {
    console.error("No resourceTypeGeneral attribute found");
    return;
  }

  // Select the corresponding option in the dropdown
  const selectField = document.querySelector("#input-resourceinformation-resourcetype");
  if (!selectField) {
    console.error("Select field not found");
    return;
  }

  // Find an option where the visible text matches resourceTypeGeneral
  const optionToSelect = Array.from(selectField.options).find((option) => option.text.trim() === resourceTypeGeneral);

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
  let identifier = rightsNode.getAttribute("rightsIdentifier");

  if (!identifier) {
    // Try to extract from rightsURI
    const uri = rightsNode.getAttribute("rightsURI");
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
    const response = await $.getJSON("./api/v2/vocabs/licenses/all");
    const mapping = {};

    response.forEach((license) => {
      mapping[license.rightsIdentifier] = license.rights_id.toString();
    });

    return mapping;
  } catch (error) {
    console.error("Error creating license mapping:", error);
    return {
      "CC-BY-4.0": "1",
      "CC0-1.0": "2",
      "GPL-3.0-or-later": "3",
      "MIT": "4",
      "Apache-2.0": "5",
      "EUPL-1.2": "6",
    };
  }
}

/**
 * Creates a language mapping from API data
 * @returns {Promise<Object>} A promise that resolves to a code->id mapping
 */
async function createLanguageMapping() {
  try {
    const response = await $.getJSON("./api/v2/vocabs/languages");
    const mapping = {};

    response.forEach((lang) => {
      mapping[lang.code.toLowerCase()] = lang.id.toString();
    });

    return mapping;
  } catch (error) {
    console.error("Error creating language mapping:", error);
    return {
      en: "1",
      de: "2",
      fr: "3",
    };
  }
}

/**
 * Creates a title type mapping from API data
 * @returns {Promise<Object>} A promise that resolves to a mapping of title types
 */
async function createTitleTypeMapping() {
  try {
    const response = await $.getJSON("./api/v2/vocabs/titletypes");
    const mapping = {};

    response.forEach((type) => {
      const key = type.name.replace(/\s+/g, "");
      mapping[key] = type.id.toString();
    });

    const main = response.find((t) => t.name.toLowerCase() === "main title");
    if (main) {
      mapping[""] = main.id.toString();
      mapping["MainTitle"] = main.id.toString();
    }

    return mapping;
  } catch (error) {
    console.error("Error creating title type mapping:", error);
    return {
      "": "1",
      MainTitle: "1",
      AlternativeTitle: "2",
      TranslatedTitle: "3",
    };
  }
}

/**
 * Maps title type to select option value
 * @param {string} titleType - The type of the title from XML
 * @param {Object} mapping - Mapping object returned by createTitleTypeMapping
 * @returns {string} The corresponding select option value
 */
function mapTitleType(titleType, mapping = {}) {
  const key = (titleType || "").replace(/\s+/g, "");
  const map = Object.keys(mapping).length
    ? mapping
    : { "": "1", MainTitle: "1", AlternativeTitle: "2", TranslatedTitle: "3" };
  return map[key] || map[""] || "1";
}

/**
 * Process titles from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processTitles(xmlDoc, resolver, titleTypeMapping) {
  const titleNodes = xmlDoc.evaluate(".//ns:titles/ns:title", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  for (let i = 0; i < titleNodes.snapshotLength; i++) {
    const titleNode = titleNodes.snapshotItem(i);
    const titleType = titleNode.getAttribute("titleType");
    const titleText = titleNode.textContent;
    const titleLang = titleNode.getAttribute("xml:lang") || "en";

    if (i === 0) {
      // First Title
      $('input[name="title[]"]:first').val(titleText);
      $("#input-resourceinformation-titletype").val(mapTitleType(titleType, titleTypeMapping));
    } else {
      // Add Title - Clone new row
      $("#button-resourceinformation-addtitle").click();

      // Find last row
      const $lastRow = $('input[name="title[]"]').last().closest(".row");

      // Set values
      $lastRow.find('input[name="title[]"]').val(titleText);
      $lastRow.find('select[name="titleType[]"]').val(mapTitleType(titleType, titleTypeMapping));
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
  if (!xpath.startsWith(".") && !xpath.startsWith("/")) {
    xpath = "./" + xpath;
  }

  const node = xmlDoc.evaluate(xpath, contextNode, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

  return node ? node.textContent.trim() : "";
}

/**
 * Process creators from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processCreators(xmlDoc, resolver) {
  // Select all <creator> elements inside <creators> using namespace resolver
  const creatorNodes = xmlDoc.evaluate(".//ns:creators/ns:creator", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  // Separate counter for person authors to avoid index mismatch when creators
  // contain a mix of persons and institutions (fixes #739)
  let personIndex = 0;

  for (let i = 0; i < creatorNodes.snapshotLength; i++) {
    const creatorNode = creatorNodes.snapshotItem(i);

    // Extract basic creator info: given name, family name, ORCID, and creatorName
    const givenName = getNodeText(creatorNode, "ns:givenName", xmlDoc, resolver);
    const familyName = getNodeText(creatorNode, "ns:familyName", xmlDoc, resolver);
    // Clean ORCID by removing URL prefix if present
    const orcid = getNodeText(creatorNode, 'ns:nameIdentifier[@nameIdentifierScheme="ORCID"]', xmlDoc, resolver).replace("https://orcid.org/", "");
    const creatorName = getNodeText(creatorNode, "ns:creatorName", xmlDoc, resolver);

    // Extract affiliations, either <personAffiliation> or <affiliation> elements under the current creator node
    const affiliationNodes = xmlDoc.evaluate("ns:personAffiliation | ns:affiliation", creatorNode, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const affiliations = [];
    const rorIds = [];

    // Collect all affiliation names and ROR IDs for the current creator
    for (let j = 0; j < affiliationNodes.snapshotLength; j++) {
      const affNode = affiliationNodes.snapshotItem(j);
      const affiliationName = affNode.textContent;
      const rorId = affNode.getAttribute("affiliationIdentifier");

      if (affiliationName) {
        affiliations.push(affiliationName);
        if (rorId) {
          rorIds.push(rorId);
        }
      }
    }

    // ------- Handle Person Authors -------
    // If givenName or familyName exists, we treat this as a personal author
    if (givenName || familyName) {
      let $row;
      if (personIndex === 0) {
        // For the first person creator, use the first existing row in the form
        $row = $("div[data-creator-row]").eq(0);
      } else {
        // For subsequent person creators, simulate click on "add author" button to create new row
        $("#button-author-add").click();
        $row = $("div[data-creator-row]").eq(personIndex);
      }
      personIndex++;

      // Populate the personal author fields
      $row.find('input[name="orcids[]"]').val(orcid);
      $row.find('input[name="familynames[]"]').val(familyName);
      $row.find('input[name="givennames[]"]').val(givenName);

      // Handle affiliations with Tagify plugin if initialized
      const tagifyInput = $row.find('input[name="personAffiliation[]"]')[0];
      if (tagifyInput && tagifyInput._tagify) {
        tagifyInput._tagify.removeAllTags(); // Clear existing tags
        tagifyInput._tagify.addTags(affiliations.map((a) => ({ value: a }))); // Add new affiliations as tags
        $row.find('input[name="authorPersonRorIds[]"]').val(rorIds.join(",")); // Set ROR IDs as CSV string
      } else {
        // Fallback if Tagify is not used: set affiliations as comma-separated string
        $row.find('input[name="personAffiliation[]"]').val(affiliations.join(","));
        $row.find('input[name="authorPersonRorIds[]"]').val(rorIds.join(","));
      }

      // Reset contact-related inputs (checkbox, email, online resource) for the author row
      $row.find('input[name="contacts[]"]').prop("checked", false);
      $row.find(".contact-person-input").hide();
      $row.find('input[name="cpEmail[]"]').val("");
      $row.find('input[name="cpOnlineResource[]"]').val("");
    }
    // ------- Handle Institution Authors -------
    else if (creatorName) {
      // Select all institution rows container
      let $instRows = $("div[data-authorinstitution-row]");
      let $instRow;

      // Try to find the first empty institution row to reuse
      const foundEmptyRow = $instRows.toArray().find((row) => {
        return $(row).find('input[name="authorinstitutionName[]"]').val().trim() === "";
      });

      if (foundEmptyRow) {
        $instRow = $(foundEmptyRow);
      } else {
        // If no empty row found, simulate click to add new institution row and select it
        $("#button-authorinstitution-add").click();
        $instRow = $("div[data-authorinstitution-row]").last();
      }

      // Set institution name
      $instRow.find('input[name="authorinstitutionName[]"]').val(creatorName);

      // Handle institution affiliations with Tagify plugin if present
      const tagifyInput = $instRow.find('input[name="institutionAffiliation[]"]')[0];
      if (tagifyInput && tagifyInput._tagify) {
        tagifyInput._tagify.removeAllTags(); // Clear existing tags
        tagifyInput._tagify.addTags(affiliations.map((a) => ({ value: a }))); // Add new affiliations as tags
      } else {
        // Fallback: set affiliations as comma-separated string if no Tagify
        $instRow.find('input[name="institutionAffiliation[]"]').val(affiliations.join(","));
      }

      // Set ROR IDs for the institution as CSV string
      $instRow.find('input[name="authorInstitutionRorIds[]"]').val(rorIds.join(","));
    }
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
      gmd: "http://www.isotc211.org/2005/gmd",
      gco: "http://www.isotc211.org/2005/gco",
    };
    return ns[prefix] || null;
  }

  const contactPersonNodes = xmlDoc.evaluate("//gmd:pointOfContact/gmd:CI_ResponsibleParty", xmlDoc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  for (let i = 0; i < contactPersonNodes.snapshotLength; i++) {
    const contactPersonNode = contactPersonNodes.snapshotItem(i);

    // Extract Contact Person details
    const fullName = getNodeText(contactPersonNode, "gmd:individualName/gco:CharacterString", xmlDoc, nsResolver);
    const [familyName, givenName] = fullName?.split(", "); // Use optional chaining

    if (!givenName || !familyName) {
      continue;
    }

    // Extract email and website, handling potential namespace issues
    let email = getNodeText(
      contactPersonNode,
      "gmd:contactInfo/gmd:CI_Contact/gmd:address/gmd:CI_Address/gmd:electronicMailAddress/gco:CharacterString",
      xmlDoc,
      nsResolver
    );
    let website = getNodeText(
      contactPersonNode,
      "gmd:contactInfo/gmd:CI_Contact/gmd:onlineResource/gmd:CI_OnlineResource/gmd:linkage/gmd:URL",
      xmlDoc,
      nsResolver
    );

    if (!email) {
      email = getNodeText(contactPersonNode, "//electronicMailAddress/CharacterString", xmlDoc, null);
    }
    if (!website) {
      website = getNodeText(contactPersonNode, "//linkage/URL", xmlDoc, null);
    }

    // Find the matching author row based on name (case-insensitive, trimmed)
    const normalizedFamily = familyName.trim().toLowerCase();
    const normalizedGiven = givenName.trim().toLowerCase();
    let $row = $("div[data-creator-row]")
      .filter(function () {
        const rowFamily = ($(this).find('input[name="familynames[]"]').val() || "").trim().toLowerCase();
        const rowGiven = ($(this).find('input[name="givennames[]"]').val() || "").trim().toLowerCase();
        return rowFamily === normalizedFamily && rowGiven === normalizedGiven;
      })
      .first();

    if ($row.length === 0) {
      // No matching author found — add a new author row for the contact person
      const countBefore = $("div[data-creator-row]").length;
      $("#button-author-add").click();
      const countAfter = $("div[data-creator-row]").length;
      if (countAfter <= countBefore) {
        console.warn("Could not create new author row for contact person:", familyName, givenName);
        continue;
      }
      $row = $("div[data-creator-row]").last();
      $row.find('input[name="familynames[]"]').val(familyName);
      $row.find('input[name="givennames[]"]').val(givenName);
    }

    // Mark the row as contact person
    $row.find('input[name="contacts[]"]').prop("checked", true);

    // Show the contact person fields
    $row.find(".contact-person-input").show();

    // Populate the contact person fields
    $row.find('input[name="cpEmail[]"]').val(email || "");
    $row.find('input[name="cpOnlineResource[]"]').val(website || "");
  }

  // If no ISO contact persons were found, try DataCite fallback
  if (contactPersonNodes.snapshotLength === 0) {
    processContactPersonsFromDataCite(xmlDoc);
  }
}

/**
 * Fallback: Process contact persons from DataCite contributor elements.
 * Used when no ISO pointOfContact section is present (e.g. pure DataCite XML).
 * Note: DataCite schema does not carry email/website for contact persons.
 * @param {Document} xmlDoc - The parsed XML document
 */
function processContactPersonsFromDataCite(xmlDoc) {
  function dcResolver(prefix) {
    return prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;
  }

  // Select all contributors, then filter by attribute in JS
  // (some XPath engines don't support attribute predicates on namespaced elements)
  const allContributors = xmlDoc.evaluate(
    './/ns:contributors/ns:contributor',
    xmlDoc,
    dcResolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let i = 0; i < allContributors.snapshotLength; i++) {
    const node = allContributors.snapshotItem(i);
    if (node.getAttribute("contributorType") !== "ContactPerson") continue;

    const familyName = getNodeText(node, "ns:familyName", xmlDoc, dcResolver);
    const givenName = getNodeText(node, "ns:givenName", xmlDoc, dcResolver);

    if (!familyName || !givenName) continue;

    const normalizedFamily = familyName.trim().toLowerCase();
    const normalizedGiven = givenName.trim().toLowerCase();
    let $row = $("div[data-creator-row]")
      .filter(function () {
        const rowFamily = ($(this).find('input[name="familynames[]"]').val() || "").trim().toLowerCase();
        const rowGiven = ($(this).find('input[name="givennames[]"]').val() || "").trim().toLowerCase();
        return rowFamily === normalizedFamily && rowGiven === normalizedGiven;
      })
      .first();

    if ($row.length === 0) {
      // No matching author found — add a new author row for the contact person
      const countBefore = $("div[data-creator-row]").length;
      $("#button-author-add").click();
      const countAfter = $("div[data-creator-row]").length;
      if (countAfter <= countBefore) {
        console.warn("Could not create new author row for contact person:", familyName, givenName);
        continue;
      }
      $row = $("div[data-creator-row]").last();
      $row.find('input[name="familynames[]"]').val(familyName);
      $row.find('input[name="givennames[]"]').val(givenName);
    }

    $row.find('input[name="contacts[]"]').prop("checked", true);
    $row.find(".contact-person-input").show();
    // Email/website not available in DataCite schema
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
    console.error("labData is not available");
    return null;
  }
  return labData.find((lab) => lab.identifier === labId) || null;
}

/**
 * Helper function to set laboratory data in a row
 * @param {jQuery} row - The jQuery row element
 * @param {string} labId - The laboratory ID
 */
function setLabDataInRow(row, labId) {
  // Check if labData is available
  if (typeof labData === "undefined") {
    console.error("labData is not available");
    return;
  }

  const selectName = row.find('select[name="laboratoryName[]"]');

  if (!selectName.length) {
    console.error("Select element for laboratory name not found");
    return;
  }

  const lab = findLabNameById(labId);

  if (!lab) {
    console.error("Lab not found with ID:", labId);
    return;
  }

  try {
    // Set the select value to the lab name
    selectName.val(lab.name);

    // Trigger change event to ensure any attached handlers run
    selectName.trigger("change");

    // Set affiliation
    const inputAffiliation = row.find('input[name="laboratoryAffiliation[]"]');
    if (inputAffiliation.length) {
      inputAffiliation.val(lab.affiliation_name || "");
    }

    // Set hidden fields
    const hiddenRorId = row.find('input[name="laboratoryRorIds[]"]');
    const hiddenLabId = row.find('input[name="LabId[]"]');

    if (hiddenRorId.length) hiddenRorId.val(lab.affiliation_ror || "");
    if (hiddenLabId.length) hiddenLabId.val(lab.identifier);
  } catch (error) {
    console.error("Error in setLabDataInRow:", error);
    console.error("Error stack:", error.stack);
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
      const firstRow = $("#group-originatinglaboratory .row[data-laboratory-row]:first");

      // Set lab data in the row
      setLabDataInRow(firstRow, labId);
    } else {
      // Additional laboratories - clone new row
      $("#button-originatinglaboratory-add").click();

      // Find the newly added row
      const newRow = $("#group-originatinglaboratory .row[data-laboratory-row]").last();

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
  return contributorType.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// Helper function to get or create a new organization row
function getOrCreateOrgRow(index) {
  const container = $("#group-contributororganisation");
  if (index === 0) {
    return container.find("[contributors-row]").first();
  }

  // Simulate click on add button to create new row
  $("#button-contributor-addorganisation").click();

  // Return the newly created row
  return container.find(".row").last();
}

// Helper function to get or create a new person row
function getOrCreatePersonRow(index) {
  const container = $("#group-contributorperson");
  if (index === 0) {
    return container.find("[contributor-person-row]").first();
  }

  // Simulate click on add button to create new row
  $("#button-contributor-addperson").click();

  // Return the newly created row
  return container.find(".row").last();
}

/**
 * Process contributors from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processContributors(xmlDoc, resolver) {
  const contributorsNode = xmlDoc.evaluate(".//ns:contributors", xmlDoc, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

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
  const orgMap = new Map(); // Key: name, Value: contributor data

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
  const contributorType = contributor.getAttribute("contributorType");
  const nameType = getNodeText(contributor, "ns:contributorName/@nameType", xmlDoc, resolver);
  const contributorName = getNodeText(contributor, "ns:contributorName", xmlDoc, resolver);
  const givenName = getNodeText(contributor, "ns:givenName", xmlDoc, resolver);
  const familyName = getNodeText(contributor, "ns:familyName", xmlDoc, resolver);
  const orcid = getNodeText(contributor, 'ns:nameIdentifier[@schemeURI="https://orcid.org/"]', xmlDoc, resolver);

  // Get affiliations as aligned pairs of { name, rorId }
  const affiliationNodes = xmlDoc.evaluate("ns:affiliation", contributor, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  const affiliationPairs = [];

  for (let j = 0; j < affiliationNodes.snapshotLength; j++) {
    const affNode = affiliationNodes.snapshotItem(j);
    const affiliationName = affNode.textContent ? affNode.textContent.trim().replace(/\s+/g, ' ') : '';
    const rorId = affNode.getAttribute("affiliationIdentifier");

    if (affiliationName && !affiliationPairs.some(p => p.name === affiliationName)) {
      affiliationPairs.push({
        name: affiliationName,
        rorId: rorId ? rorId.replace("https://ror.org/", "") : ""
      });
    }
  }

  const isPerson = nameType === "Personal" || (givenName && familyName);

  if (isPerson) {
    const key = orcid || `${givenName}_${familyName}`;
    updateContributorMap(personMap, key, {
      givenName,
      familyName,
      orcid,
      roles: [normalizeRole(contributorType)],
      affiliationPairs,
    });
  } else {
    updateContributorMap(orgMap, contributorName, {
      name: contributorName,
      roles: [normalizeRole(contributorType)],
      affiliationPairs,
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
    newData.affiliationPairs.forEach((pair) => {
      const existingPair = existing.affiliationPairs.find(p => p.name === pair.name);
      if (existingPair) {
        if (!existingPair.rorId && pair.rorId) {
          existingPair.rorId = pair.rorId;
        }
      } else {
        existing.affiliationPairs.push(pair);
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
  if (inputElement._tagify) {
    return inputElement._tagify;
  }

  // Check for _tagify property
  if (inputElement._tagify) {
    return inputElement._tagify;
  }

  // Check for jQuery element with tagify
  if (inputElement[0] && inputElement[0]._tagify) {
    return inputElement[0]._tagify;
  }

  // Look for data- attribute
  if (inputElement.dataset && inputElement.dataset._tagify) {
    return window[inputElement.dataset._tagify];
  }

  console.log("No existing Tagify instance found for element, returning null", inputElement);
  return null;
}

/**
 * Populate the form with processed contributor data using canonical field names
 * (cbAffiliation[], cbpRorIds[], OrganisationAffiliation[], hiddenOrganisationRorId[]).
 * @param {Map} personMap - Map containing person contributors
 * @param {Map} orgMap - Map containing organization contributors
 */
function populateFormWithContributors(personMap, orgMap) {
  let personIndex = 0;
  let orgIndex = 0;

  // Process persons
  for (const person of personMap.values()) {
    const personRow = getOrCreatePersonRow(personIndex++);

    // Roles
    const roleInput = personRow.find('input[name="cbPersonRoles[]"]')[0];
    const tagifyRoles = getTagifyInstance(roleInput);
    if (tagifyRoles) {
      tagifyRoles.removeAllTags();
      tagifyRoles.addTags(person.roles.map((role) => ({ value: role })));
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

    // Affiliations — add tags with both value and id (ROR) for Tagify state consistency
    const affiliationInput = personRow.find('input[name="cbAffiliation[]"]')[0];
    const tagifyAffiliations = getTagifyInstance(affiliationInput);
    if (tagifyAffiliations) {
      tagifyAffiliations.removeAllTags();
      tagifyAffiliations.addTags(person.affiliationPairs.map((pair) => ({
        value: pair.name,
        id: pair.rorId
      })));
    } else {
      console.warn("No Tagify instance found for affiliation input:", affiliationInput);
    }

    // ROR IDs — aligned with affiliations (empty string for missing ROR IDs)
    personRow.find('input[name="cbpRorIds[]"]').val(
      person.affiliationPairs.map((pair) => pair.rorId).join(",")
    );
  }

  // Process organizations
  for (const org of orgMap.values()) {
    const orgRow = getOrCreateOrgRow(orgIndex++);

    // Roles
    const roleInput = orgRow.find('input[name="cbOrganisationRoles[]"]')[0];
    const tagifyRoles = getTagifyInstance(roleInput);
    if (tagifyRoles) {
      tagifyRoles.removeAllTags();
      tagifyRoles.addTags(org.roles.map((role) => ({ value: role })));
    } else {
      console.warn("No Tagify instance found for organization role input:", roleInput);
    }

    // Organization name
    orgRow.find('input[name="cbOrganisationName[]"]').val(org.name);

    // Affiliations — add tags with both value and id (ROR) for Tagify state consistency
    const affiliationInput = orgRow.find('input[name="OrganisationAffiliation[]"]')[0];
    const tagifyAffiliations = getTagifyInstance(affiliationInput);
    if (tagifyAffiliations) {
      tagifyAffiliations.removeAllTags();
      tagifyAffiliations.addTags(org.affiliationPairs.map((pair) => ({
        value: pair.name,
        id: pair.rorId
      })));
    } else {
      console.warn("No Tagify instance found for organization affiliation input:", affiliationInput);
    }

    // ROR IDs — aligned with affiliations (empty string for missing ROR IDs)
    orgRow.find('input[name="hiddenOrganisationRorId[]"]').val(
      org.affiliationPairs.map((pair) => pair.rorId).join(",")
    );
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
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    timezoneOffset: "",
  };

  if (!dateNode || !dateNode.textContent) return result;

  const [start, end] = dateNode.textContent.split("/");

  // Handle start date and time
  if (start) {
    if (start.includes("T")) {
      // Case 1: Date with time and timezone (e.g., 2025-02-28T01:11:00+01:00)
      const [startDate, startTime] = start.split("T");
      result.startDate = startDate;
      result.startTime = startTime.split(/[+-]/)[0]; // Extract time part

      // Extract timezone if present
      if (start.includes("+") || start.includes("-")) {
        result.timezoneOffset = start.slice(-6); // Extract the timezone offset (+01:00, -02:00)
      }
    } else {
      // Case 2: Date with only timezone (e.g., 2025-02-28+02:00)
      result.startDate = start.replace(/([+-]\d{2}:\d{2})$/, ""); // Remove timezone part from the date
      result.startTime = ""; // No time
      const offsetMatch = start.match(/([+-]\d{2}:\d{2})$/);
      if (offsetMatch) {
        result.timezoneOffset = offsetMatch[1]; // Extract the timezone offset (+02:00)
      }
    }
  }

  // Handle end date and time (similar to start)
  if (end) {
    if (end.includes("T")) {
      // Case 1: Date with time and timezone (e.g., 2025-02-28T22:22:00+01:00)
      const [endDate, endTime] = end.split("T");
      result.endDate = endDate;
      result.endTime = endTime.split(/[+-]/)[0]; // Extract time part

      // Extract timezone if present
      if (end.includes("+") || end.includes("-")) {
        result.timezoneOffset = end.slice(-6); // Extract the timezone offset (+01:00, -02:00)
      }
    } else {
      // Case 2: Date with only timezone (e.g., 2025-02-28+02:00)
      result.endDate = end.replace(/([+-]\d{2}:\d{2})$/, ""); // Remove timezone part from the date
      result.endTime = ""; // No time
      const offsetMatch = end.match(/([+-]\d{2}:\d{2})$/);
      if (offsetMatch) {
        result.timezoneOffset = offsetMatch[1]; // Extract the timezone offset (+02:00)
      }
    }
  }

  return result;
}

/**
 * Extract spatial coordinates and description from a geoLocation node.
 * @param {Element} node - The geoLocation XML element.
 * @param {Document} xmlDoc - The XML document (needed for XPath evaluation).
 * @param {Function} resolver - The namespace resolver function.
 * @returns {Object} Parsed location data.
 */
function getGeoLocationData(node, xmlDoc, resolver) {
  function getText(contextNode, localName) {
    const result = xmlDoc.evaluate("ns:" + localName + " | " + localName, contextNode, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue?.textContent || "";
  }

  function getNode(contextNode, localName) {
    const result = xmlDoc.evaluate("ns:" + localName + " | " + localName, contextNode, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
  }

  const place = getText(node, "geoLocationPlace");
  const boxNode = getNode(node, "geoLocationBox");
  const pointNode = getNode(node, "geoLocationPoint");

  if (boxNode) {
    return {
      place,
      latitudeMin: getText(boxNode, "southBoundLatitude"),
      latitudeMax: getText(boxNode, "northBoundLatitude"),
      longitudeMin: getText(boxNode, "westBoundLongitude"),
      longitudeMax: getText(boxNode, "eastBoundLongitude"),
    };
  }

  if (pointNode) {
    const lat = getText(pointNode, "pointLatitude");
    const lon = getText(pointNode, "pointLongitude");
    return {
      place,
      latitudeMin: lat,
      latitudeMax: lat,
      longitudeMin: lon,
      longitudeMax: lon,
    };
  }

  return {
    place,
    latitudeMin: "",
    latitudeMax: "",
    longitudeMin: "",
    longitudeMax: "",
  };
}

/**
 * Populate a STC form row with spatial values and update the map overlay.
 * @param {jQuery} $row - Row element containing STC inputs.
 * @param {Object} data - Location data returned from getGeoLocationData().
 */
function fillSpatialFields($row, data) {
  $row.find('textarea[name="tscDescription[]"]').val(data.place);
  $row.find('input[name="tscLatitudeMin[]"]').val(data.latitudeMin);
  $row.find('input[name="tscLatitudeMax[]"]').val(data.latitudeMax);
  $row.find('input[name="tscLongitudeMin[]"]').val(data.longitudeMin);
  $row.find('input[name="tscLongitudeMax[]"]').val(data.longitudeMax);

  const rowId = $row.attr("tsc-row-id");
  if (typeof window.updateMapOverlay === "function") {
    window.updateMapOverlay(rowId, data.latitudeMax, data.longitudeMax, data.latitudeMin, data.longitudeMin);
  }
}

/**
 * Apply temporal data and timezone to a STC row.
 * @param {jQuery} $row - Row element containing STC inputs.
 * @param {Object} temporalData - Data returned by parseTemporalData().
 */
function fillTemporalFields($row, temporalData) {
  $row.find('input[name="tscDateStart[]"]').val(temporalData.startDate);
  if (temporalData.startTime) {
    $row.find('input[name="tscTimeStart[]"]').val(temporalData.startTime);
  }
  if (temporalData.endTime) {
    $row.find('input[name="tscTimeEnd[]"]').val(temporalData.endTime);
  }
  $row.find('input[name="tscDateEnd[]"]').val(temporalData.endDate);

  const timezoneField = $row.find('select[name="tscTimezone[]"]');
  timezoneField.find("option").each(function () {
    if ($(this).text().includes(temporalData.timezoneOffset)) {
      timezoneField.val($(this).val());
      return false;
    }
  });
}

/**
 * Process spatial-temporal coverage (STC) data from XML and populate the form.
 * @param {Document} xmlDoc - The parsed XML document.
 * @param {Function} resolver - The namespace resolver function.
 */
function processSpatialTemporalCoverages(xmlDoc, resolver) {
  const geoLocationNodes = xmlDoc.evaluate(".//ns:geoLocations/ns:geoLocation | .//geoLocations/geoLocation", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const dateNodes = xmlDoc.evaluate('//ns:dates/ns:date[@dateType="Coverage" or @dateType="Collected"] | //dates/date[@dateType="Coverage" or @dateType="Collected"]', xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  for (let i = 0; i < geoLocationNodes.snapshotLength; i++) {
    const geoData = getGeoLocationData(geoLocationNodes.snapshotItem(i), xmlDoc, resolver);
    const temporalData = parseTemporalData(dateNodes.snapshotItem(i));

    const $lastRow = $('textarea[name="tscDescription[]"]').last().closest("[tsc-row]");
    fillSpatialFields($lastRow, geoData);
    fillTemporalFields($lastRow, temporalData);

    if (i < geoLocationNodes.snapshotLength - 1) {
      $("#button-stc-add").click();
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
  const descriptionNodes = xmlDoc.evaluate(".//ns:descriptions/ns:description", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  // Mapping for Abstract (always static) and dynamic description types
  const staticMapping = {
    Abstract: "input-abstract",
  };

  // Dynamic description types use the pattern input-description-{Slug}
  const dynamicSlugs = ["Methods", "TechnicalInfo", "TechnicalInformation", "SeriesInformation", "TableOfContents", "Other"];

  // Process each description node
  for (let i = 0; i < descriptionNodes.snapshotLength; i++) {
    const descriptionNode = descriptionNodes.snapshotItem(i);
    const descriptionType = descriptionNode.getAttribute("descriptionType");
    const content = descriptionNode.textContent.trim();

    if (staticMapping[descriptionType]) {
      // Abstract: static field
      $(`#${staticMapping[descriptionType]}`).val(content);
    } else if (dynamicSlugs.indexOf(descriptionType) !== -1) {
      // Dynamic types: normalize TechnicalInformation -> TechnicalInfo
      const slug = descriptionType === "TechnicalInformation" ? "TechnicalInfo" : descriptionType;
      const inputId = "input-description-" + slug;
      const $input = $(`#${inputId}`);
      if ($input.length) {
        $input.val(content);
        // Expand the accordion section
        $(`#collapse-description-${slug}`).addClass("show");
      }
    }
  }

  // Ensure Abstract accordion is always expanded
  $("#collapse-abstract").addClass("show");
}

/**
 * Process dates from XML and populate the form.
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processDates(xmlDoc, resolver) {
  const dateNodes = xmlDoc.evaluate("//ns:dates/ns:date", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  for (let i = 0; i < dateNodes.snapshotLength; i++) {
    const dateNode = dateNodes.snapshotItem(i);
    const dateType = dateNode.getAttribute("dateType");
    const dateValue = dateNode.textContent.trim();

    // Set values based on date type
    if (dateType === "Created") {
      $('input[name="dateCreated"]').val(dateValue);
    } else if (dateType === "Available") {
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
  const subjectNodes = xmlDoc.evaluate(".//ns:subjects/ns:subject", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  // Thesaurus inputs — may not exist if the thesaurus is disabled via ERNIE availability
  const tagifyInputGCMD = document.querySelector("#input-sciencekeyword");
  const tagifyInputPlatforms = document.querySelector("#input-platforms");
  const tagifyInputInstruments = document.querySelector("#input-instruments");
  const tagifyInputChronostrat = document.querySelector("#input-chronostratigraphy");
  const tagifyInputGemet = document.querySelector("#input-gemet");

  // Always-present inputs
  const tagifyInputMsl = document.querySelector("#input-mslkeyword");
  const tagifyInputFree = document.querySelector("#input-freekeyword");

  if (!tagifyInputFree?._tagify) {
    console.error("Free keyword Tagify instance is not properly initialized.");
    return;
  }

  const tagifyFree = tagifyInputFree._tagify;
  const tagifyMsl = tagifyInputMsl?._tagify;

  // Clear existing tags on all available inputs
  tagifyFree.removeAllTags();
  tagifyMsl?.removeAllTags();
  tagifyInputGCMD?._tagify?.removeAllTags();
  tagifyInputPlatforms?._tagify?.removeAllTags();
  tagifyInputInstruments?._tagify?.removeAllTags();
  tagifyInputChronostrat?._tagify?.removeAllTags();
  tagifyInputGemet?._tagify?.removeAllTags();

  for (let i = 0; i < subjectNodes.snapshotLength; i++) {
    const subjectNode = subjectNodes.snapshotItem(i);
    const subjectScheme = subjectNode.getAttribute("subjectScheme") || "";
    const schemeURI = subjectNode.getAttribute("schemeURI") || "";
    const valueURI = subjectNode.getAttribute("valueURI") || "";
    const language = subjectNode.getAttribute("xml:lang") || "";
    const keyword = subjectNode.textContent.trim();

    const tagData = {
      value: keyword,
      scheme: subjectScheme,
      schemeURI: schemeURI,
      id: valueURI,
    };
    if (language) {
      tagData.language = language;
    }

    // Route tag to appropriate Tagify instance based on schemeURI
    if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords") {
      if (tagifyInputGCMD?._tagify) tagifyInputGCMD._tagify.addTags([tagData]);
      else tagifyFree.addTags([tagData]);
    } else if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms") {
      if (tagifyInputPlatforms?._tagify) tagifyInputPlatforms._tagify.addTags([tagData]);
      else tagifyFree.addTags([tagData]);
    } else if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments") {
      if (tagifyInputInstruments?._tagify) tagifyInputInstruments._tagify.addTags([tagData]);
      else tagifyFree.addTags([tagData]);
    } else if (
      schemeURI === "http://resource.geosciml.org/vocabulary/timescale/gts2020" ||
      subjectScheme === "International Chronostratigraphic Chart" ||
      subjectScheme === "Chronostratigraphic Chart"
    ) {
      if (tagifyInputChronostrat?._tagify) tagifyInputChronostrat._tagify.addTags([tagData]);
      else tagifyFree.addTags([tagData]);
    } else if (
      schemeURI === "http://www.eionet.europa.eu/gemet/gemetThesaurus" ||
      schemeURI === "http://www.eionet.europa.eu/gemet/concept/" ||
      subjectScheme?.includes("GEMET")
    ) {
      if (tagifyInputGemet?._tagify) tagifyInputGemet._tagify.addTags([tagData]);
      else tagifyFree.addTags([tagData]);
    } else if (schemeURI.startsWith("https://epos-msl.uu.nl/voc/")) {
      if (tagifyMsl) tagifyMsl.addTags([tagData]);
      else tagifyFree.addTags([tagData]);
    } else {
      tagifyFree.addTags([tagData]);
    }
  }
}

/**
 * Process related identifiers from XML and populate the formgroup Related Works
 * When showUsedInstruments is active, entries with relationType="IsCollectedBy" are
 * filtered out and handled by processUsedInstruments() instead.
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processRelatedWorks(xmlDoc, resolver) {
  const identifierNodes = xmlDoc.evaluate(".//ns:relatedIdentifiers/ns:relatedIdentifier", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  // Collect entries, optionally filtering out instruments
  const showUsedInstruments = window.ELMO_FEATURES && window.ELMO_FEATURES.showUsedInstruments;
  let entries = [];

  for (let i = 0; i < identifierNodes.snapshotLength; i++) {
    const identifierNode = identifierNodes.snapshotItem(i);
    const relationType = identifierNode.getAttribute("relationType");
    const identifierType = identifierNode.getAttribute("relatedIdentifierType");
    const identifierValue = identifierNode.textContent;

    // Skip IsCollectedBy entries when Used Instruments feature is active
    if (showUsedInstruments && relationType === "IsCollectedBy") {
      continue;
    }

    entries.push({ relationType, identifierType, identifierValue });
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Find last row
    const $lastRow = $('input[name="rIdentifier[]"]').last().closest(".row");

    // Set values
    $lastRow.find('input[name="rIdentifier[]"]').val(entry.identifierValue);
    $lastRow.find('select[name="rIdentifierType[]"]').val(entry.identifierType);
    // Match relation by visible text instead of value
    $lastRow
      .find('select[name="relation[]"]:first option')
      .filter(function () {
        return $(this).text() === entry.relationType; // Match by visible text
      })
      .prop("selected", true);

    // clone row for the next entry, if there is one
    if (i < entries.length - 1) {
      // Add Related Work
      $("#button-relatedwork-add").click();
    }
  }
}

/**
 * Process related identifiers with relationType="IsCollectedBy" from XML
 * and populate the Used Instruments Tagify field.
 * Only active when the showUsedInstruments feature toggle is enabled.
 * Adds PID-only tags immediately so the import pipeline is never blocked,
 * then triggers a background API load that upgrades them with full metadata
 * (name, instrument types) once the data arrives.
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processUsedInstruments(xmlDoc, resolver) {
  if (!window.ELMO_FEATURES || !window.ELMO_FEATURES.showUsedInstruments) {
    return;
  }

  const identifierNodes = xmlDoc.evaluate(".//ns:relatedIdentifiers/ns:relatedIdentifier", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  const pidList = [];

  for (let i = 0; i < identifierNodes.snapshotLength; i++) {
    const identifierNode = identifierNodes.snapshotItem(i);
    const relationType = identifierNode.getAttribute("relationType");

    if (relationType !== "IsCollectedBy") {
      continue;
    }

    const pidType = identifierNode.getAttribute("relatedIdentifierType") || "Handle";
    const pid = identifierNode.textContent.trim();

    pidList.push({
      pid: pid,
      pidType: pidType
    });
  }

  if (pidList.length > 0 && window.usedInstrumentsModule) {
    // Add PID-only tags immediately so the import pipeline is never blocked
    // by a slow/unreachable PID4INST endpoint.
    window.usedInstrumentsModule.addInstrumentsByPid(pidList);

    // Fire-and-forget: load API data in the background and upgrade the
    // PID-only tags with full metadata (name, types) once available.
    window.usedInstrumentsModule.loadInstrumentsFromAPI().then(function (result) {
      if (result.dataLoaded) {
        window.usedInstrumentsModule.upgradeInstrumentTags();
      }
    });
  }
}

/**
 * Process fundingReferences from XML and populate the formgroup Funders
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processFunders(xmlDoc, resolver) {
  // Fetch all fundingReference nodes
  const funderNodes = xmlDoc.evaluate(".//ns:fundingReferences/ns:fundingReference | .//fundingReferences/fundingReference", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  for (let i = 0; i < funderNodes.snapshotLength; i++) {
    const funderNode = funderNodes.snapshotItem(i);
    // Extract data from XML
    const funderName = getNodeText(funderNode, "ns:funderName | funderName", xmlDoc, resolver);
    const funderIdNode = xmlDoc.evaluate("ns:funderIdentifier | funderIdentifier", funderNode, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const funderId = funderIdNode ? funderIdNode.textContent.trim() : "";
    const funderIdTyp = funderIdNode?.getAttribute("funderIdentifierType") || "";
    const awardTitle = getNodeText(funderNode, "ns:awardTitle | awardTitle", xmlDoc, resolver);
    const awardNumberNode = xmlDoc.evaluate("ns:awardNumber | awardNumber", funderNode, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const awardNumber = awardNumberNode ? awardNumberNode.textContent.trim() : "";
    const awardUri = awardNumberNode?.getAttribute("awardURI") || "";

    // Find the last row in the form
    const $lastRow = $('input[name="funder[]"]').last().closest(".row");

    // Populate fields
    $lastRow.find('input[name="funder[]"]').val(funderName);
    $lastRow.find('input[name="funderId[]"]').val(funderId);
    $lastRow.find('input[name="funderidtyp[]"]').val(funderIdTyp);

    $lastRow.find('input[name="grantNummer[]"]').val(awardNumber);
    $lastRow.find('input[name="grantName[]"]').val(awardTitle);
    $lastRow.find('input[name="awardURI[]"]').val(awardUri);

    // Clone a new row if more funding references need to be added
    if (i < funderNodes.snapshotLength - 1) {
      $("#button-fundingreference-add").click();
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
    "//ns:resource | /resource | //resource",
    xmlDoc,
    function (prefix) {
      if (prefix === "ns") {
        return "http://datacite.org/schema/kernel-4";
      }
      return null;
    },
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;

  if (!resourceNode) {
    console.error("No DataCite resource element found");
    return;
  }
  // Warte auf das Laden der Labordaten, falls noch nicht geschehen
  if (!labData || labData.length === 0) {
    try {
      labData = await $.getJSON("json/msl-labs.json");
    } catch (error) {
      console.error("Error loading laboratory data:", error);
      labData = [];
    }
  }

  // Erstelle das License- und Language-Mapping zuerst
  const licenseMapping = await createLicenseMapping();
  const languageMapping = await createLanguageMapping();
  const titleTypeMapping = await createTitleTypeMapping();

  // Definiere das komplette XML_MAPPING mit dem erstellten licenseMapping
  const XML_MAPPING = {
    // Resource Information
    identifier: {
      selector: "#input-resourceinformation-doi",
      attribute: "textContent",
    },
    publicationYear: {
      selector: "#input-resourceinformation-publicationyear",
      attribute: "textContent",
    },
    version: {
      selector: "#input-resourceinformation-version",
      attribute: "textContent",
    },

    // Language mapping
    language: {
      selector: "#input-resourceinformation-language",
      attribute: "textContent",
      transform: (value) => {
        return languageMapping[value.toLowerCase()] || "1";
      },
    },
    // Rights
    "rightsList/ns:rights": {
      selector: "#input-rights-license",
      attribute: "rightsIdentifier",
      transform: (value) => {
        return licenseMapping[value] || "1";
      },
    },
  };

  // const nsResolver = xmlDoc.createNSResolver(xmlDoc.documentElement);
  const defaultNS = resourceNode.namespaceURI || "http://datacite.org/schema/kernel-4";

  function resolver(prefix) {
    if (prefix === "ns") {
      return defaultNS;
    }
    return null;
  }

  // Verarbeite zuerst die Standard-Mappings
  for (const [xmlPath, config] of Object.entries(XML_MAPPING)) {
    const nsPath = `.//ns:${xmlPath}`;

    const xmlElements = xmlDoc.evaluate(nsPath, xmlDoc, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null);

    const xmlNode = xmlElements.singleNodeValue;
    if (xmlNode) {
      const value = config.attribute === "textContent" ? xmlNode.textContent : xmlNode.getAttribute(config.attribute);

      const transformedValue = config.transform ? config.transform(value) : value;

      $(config.selector).val(transformedValue);
    }
  }

  processResourceType(xmlDoc, resolver);
  // Process titles
  processTitles(xmlDoc, resolver, titleTypeMapping);
  // Processing Creators
  processCreators(xmlDoc, resolver);
  // Allow DOM to settle after creator row insertion (fixes Firefox timing issue #1046)
  await new Promise(resolve => setTimeout(resolve, 0));
  // Process Contact Persons
  processContactPersons(xmlDoc);
  // Process Originating Laboratories
  processOriginatingLaboratories(xmlDoc, resolver);
  // Process contributors
  processContributors(xmlDoc, resolver);
  // Wait for dynamic description type fields to be ready
  if (window.descriptionTypesReady) {
    await window.descriptionTypesReady;
  }
  // Process descriptions
  processDescriptions(xmlDoc, resolver);
  // Process Spatial and Temporal Coverages
  processSpatialTemporalCoverages(xmlDoc, resolver);
  // Process Keywords
  processKeywords(xmlDoc, resolver);
  // Process Related Works
  processRelatedWorks(xmlDoc, resolver);
  // Process Used Instruments (IsCollectedBy entries)
  processUsedInstruments(xmlDoc, resolver);
  // Process Funders
  processFunders(xmlDoc, resolver);
  // Process Dates
  processDates(xmlDoc, resolver);
}

// Export for testing (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        processResourceType,
        extractLicenseIdentifier,
        mapTitleType,
        processTitles,
        getNodeText,
        processCreators,
        processContactPersons,
        processContactPersonsFromDataCite,
        findLabNameById,
        setLabDataInRow,
        processOriginatingLaboratories,
        normalizeRole,
        getOrCreateOrgRow,
        getOrCreatePersonRow,
        processContributors,
        processIndividualContributor,
        updateContributorMap,
        getTagifyInstance,
        populateFormWithContributors,
        processKeywords,
        parseTemporalData,
        getGeoLocationData,
        fillSpatialFields,
        processUsedInstruments,
        processDescriptions,
        processRelatedWorks,
        processFunders,
        processSpatialTemporalCoverages
    };
}
