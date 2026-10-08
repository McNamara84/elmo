/**
 * Shared resource-type helpers for XML upload and DOI prefill.
 */
var resourceTypeUtils = typeof module !== 'undefined' && module.exports
  ? require('./resourceTypeUtils')
  : window.resourceTypeUtils;

const RELATED_WORK_XSLT_URL = 'schemas/XSLT/MappingDataCiteRelatedWorksToMap.xslt';
let relatedWorksXsltDocumentPromise = null;
const RESOURCE_INFORMATION_XSLT_URL = 'schemas/XSLT/MappingDataCiteResourceInformationToMap.xslt';
let resourceInformationXsltPromise = null;

/**
 * Transform DataCite XML into the Resource Information import map. Cache the
 * stylesheet promise so simultaneous imports share one request; retry after a failure.
 * @param {Document} xmlDoc Parsed DataCite XML.
 * @returns {Promise<Document>} The Resource Information map document.
 */
async function transformResourceInformationDocument(xmlDoc) {
  if (!resourceInformationXsltPromise) {
    resourceInformationXsltPromise = fetch(RESOURCE_INFORMATION_XSLT_URL, { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) throw new Error(`Resource Information stylesheet request failed: ${response.status}`);
        const stylesheet = new DOMParser().parseFromString(await response.text(), 'application/xml');
        if (stylesheet.querySelector('parsererror')) throw new Error('Invalid Resource Information stylesheet.');
        return stylesheet;
      }).catch(error => {
        resourceInformationXsltPromise = null;
        throw error;
      });
  }
  const Processor = typeof XSLTProcessor !== 'undefined' ? XSLTProcessor : window.XSLTProcessor;
  if (typeof Processor !== 'function') throw new Error('This browser does not support Resource Information XSLT import.');
  const processor = new Processor();
  processor.importStylesheet(await resourceInformationXsltPromise);
  const mapped = processor.transformToDocument(xmlDoc);
  if (!mapped?.documentElement || mapped.querySelector('parsererror')) {
    throw new Error('Resource Information transformation failed.');
  }
  return mapped;
}

/**
 * Resolve imported vocabulary names to the options available in this edition.
 * @param {Document} mapped Resource Information XSLT output.
 * @param {Record<string, string>} languageMapping Language code to option ID.
 * @param {Record<string, string>} titleTypeMapping DataCite title type to option ID.
 * @returns {Object} Ordered fields and titles for the Resource Information controller.
 */
function parseResourceInformationMap(mapped, languageMapping, titleTypeMapping) {
  const root = mapped.documentElement;
  if (root.localName !== 'ResourceInformation') throw new Error('Unexpected Resource Information map.');
  const value = name => String(root.getElementsByTagName(name)[0]?.textContent || '').trim();
  const typeSelect = document.getElementById('input-resourceinformation-resourcetype');
  const typeOption = typeSelect && resourceTypeUtils.findResourceTypeOption(
    Array.from(typeSelect.options), value('ResourceType'));
  return {
    doi: value('Doi'), year: value('Year'),
    resourceTypeId: typeOption?.value || '',
    version: value('Version'),
    languageId: languageMapping[value('Language').toLowerCase()] ||
      document.getElementById('input-resourceinformation-language')?.value || '',
    titles: Array.from(root.getElementsByTagName('Title')).map((node, position) => ({
      key: position === 0 ? 'main' : `import-${position}`,
      text: String(node.textContent || '').trim(),
      typeId: mapTitleType(node.getAttribute('type'), titleTypeMapping),
      position
    }))
  };
}

/**
 * Creates an import error while retaining the original failure as its cause.
 * @param {string} message - User-facing processing context.
 * @param {unknown} [cause] - Original error.
 * @returns {Error} Error enriched with the original cause when available.
 */
function createRelatedWorksImportError(message, cause) {
  const error = new Error(message);
  if (cause) {
    error.cause = cause;
  }
  return error;
}

/** Clears the cached Related Works stylesheet, primarily for isolated tests. */
function resetRelatedWorksXsltCache() {
  relatedWorksXsltDocumentPromise = null;
}

/**
 * Loads and caches the browser-side Related Works import stylesheet.
 * @returns {Promise<Document>} Parsed XSLT document.
 */
async function loadRelatedWorksXsltDocument() {
  if (relatedWorksXsltDocumentPromise) {
    return relatedWorksXsltDocumentPromise;
  }

  relatedWorksXsltDocumentPromise = (async function () {
    if (typeof fetch !== 'function') {
      throw new Error('Fetch API is not available.');
    }

    const response = await fetch(RELATED_WORK_XSLT_URL, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`Stylesheet request failed with status ${response.status}.`);
    }

    const source = await response.text();
    const stylesheet = new DOMParser().parseFromString(source, 'application/xml');
    if (stylesheet.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Stylesheet is not valid XML.');
    }

    return stylesheet;
  })().catch(function (error) {
    relatedWorksXsltDocumentPromise = null;
    throw createRelatedWorksImportError('Could not load the Related Works import stylesheet.', error);
  });

  return relatedWorksXsltDocumentPromise;
}

/**
 * Transforms DataCite Related Identifiers into ELMO's internal RelatedWorks map.
 * @param {Document} xmlDoc - Uploaded metadata document.
 * @param {Object} [options] - Transformation options.
 * @param {boolean} [options.excludeIsCollectedBy=false] - Leave Used Instruments to their form group.
 * @returns {Promise<Document>} Transformed RelatedWorks document.
 */
async function transformRelatedWorksDocument(xmlDoc, options = {}) {
  const Processor = typeof XSLTProcessor !== 'undefined'
    ? XSLTProcessor
    : (typeof window !== 'undefined' ? window.XSLTProcessor : null);
  if (typeof Processor !== 'function') {
    throw createRelatedWorksImportError('This browser does not support the Related Works XSLT import.');
  }

  try {
    const stylesheet = await loadRelatedWorksXsltDocument();
    const processor = new Processor();
    processor.importStylesheet(stylesheet);
    processor.setParameter(
      null,
      'excludeIsCollectedBy',
      options.excludeIsCollectedBy === true ? 'true' : 'false'
    );
    const transformedDocument = processor.transformToDocument(xmlDoc);
    if (!transformedDocument
      || transformedDocument.getElementsByTagName('parsererror').length > 0
      || !transformedDocument.documentElement) {
      throw new Error('The stylesheet returned an invalid XML document.');
    }
    return transformedDocument;
  } catch (error) {
    if (error && error.message === 'This browser does not support the Related Works XSLT import.') {
      throw error;
    }
    throw createRelatedWorksImportError('Could not transform Related Works from the uploaded XML file.', error);
  }
}

/**
 * Finds a direct element child by local name without assuming a namespace.
 * @param {Node|null} node - Parent node.
 * @param {string} localName - Child local name.
 * @returns {Element|null} Matching direct child.
 */
function findDirectChildByLocalName(node, localName) {
  return Array.from(node ? node.childNodes : []).find(function (child) {
    return child.nodeType === 1 && child.localName === localName;
  }) || null;
}

/**
 * Converts a transformed RelatedWorks document into card payload entries.
 * @param {Document} transformedDocument - Result of the import XSLT.
 * @returns {Array<{identifier: string, relation: string, relationId: string, identifierType: string}>}
 */
function parseRelatedWorksMap(transformedDocument) {
  if (!transformedDocument || !transformedDocument.documentElement) {
    throw createRelatedWorksImportError('The Related Works transformation returned no document.');
  }

  return Array.from(transformedDocument.getElementsByTagName('RelatedWork')).map(function (workNode) {
    const identifierNode = findDirectChildByLocalName(workNode, 'Identifier');
    const relationNode = findDirectChildByLocalName(workNode, 'Relation');
    const relationNameNode = findDirectChildByLocalName(relationNode, 'name');
    const identifierTypeNode = findDirectChildByLocalName(workNode, 'IdentifierType');
    const identifierTypeNameNode = findDirectChildByLocalName(identifierTypeNode, 'name');

    return {
      identifier: String(identifierNode ? identifierNode.textContent : '').trim(),
      relation: String(relationNameNode ? relationNameNode.textContent : '').trim(),
      relationId: '',
      identifierType: String(identifierTypeNameNode ? identifierTypeNameNode.textContent : '').trim()
    };
  });
}

/**
 * Processes the resource type from an XML document and selects the corresponding option.
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

  // Prefer an exact label match, then account for ERNIE display whitespace.
  const optionToSelect = resourceTypeUtils.findResourceTypeOption(
    Array.from(selectField.options),
    resourceTypeGeneral
  );

  if (optionToSelect) {
    optionToSelect.selected = true;
  } else {
    console.warn(`No matching option found for text: ${resourceTypeGeneral}`);
  }
}

/*
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

const EMPTY_TITLE_TYPE_MAPPING = {
  "": "",
  MainTitle: "",
  AlternativeTitle: "",
  TranslatedTitle: "",
};

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
    return { ...EMPTY_TITLE_TYPE_MAPPING };
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
    : EMPTY_TITLE_TYPE_MAPPING;
  return map[key] ?? map[""] ?? "";
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
 * Reads an ORCID nameIdentifier without relying on XPath attribute predicates.
 *
 * Some supported DOM implementations do not evaluate predicates on namespaced
 * elements consistently. Inspecting the small nameIdentifier collection keeps
 * JSON-LD/XML reloads deterministic in browsers and tests.
 *
 * @param {Document} xmlDoc - The XML document
 * @param {Node} parentNode - Creator or contributor containing identifiers
 * @param {Function} resolver - The namespace resolver function
 * @returns {string} Normalized ORCID without the resolver URL prefix
 */
function getOrcidFromNode(xmlDoc, parentNode, resolver) {
  const identifiers = xmlDoc.evaluate(
    "ns:nameIdentifier",
    parentNode,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  for (let index = 0; index < identifiers.snapshotLength; index++) {
    const identifier = identifiers.snapshotItem(index);
    const scheme = (identifier.getAttribute("nameIdentifierScheme") || "").toUpperCase();
    const schemeUri = identifier.getAttribute("schemeURI") || "";

    if (scheme === "ORCID" || /^https?:\/\/orcid\.org\/?$/i.test(schemeUri)) {
      return identifier.textContent.trim().replace(/^https?:\/\/orcid\.org\//i, "");
    }
  }

  return "";
}

function getAuthorStackController() {
  return typeof window !== "undefined" && window.authorStack && typeof window.authorStack.setAuthors === "function"
    ? window.authorStack
    : null;
}

function normalizeRorId(value) {
  return value ? String(value).trim().replace(/^https?:\/\/ror\.org\//, "") : "";
}

function buildAffiliationsPayload(xmlDoc, creatorNode, resolver) {
  const affiliationNodes = xmlDoc.evaluate("ns:personAffiliation | ns:affiliation", creatorNode, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const affiliations = [];

  for (let j = 0; j < affiliationNodes.snapshotLength; j++) {
    const affNode = affiliationNodes.snapshotItem(j);
    const label = affNode.textContent.trim();
    const rorId = normalizeRorId(affNode.getAttribute("affiliationIdentifier"));

    if (label || rorId) {
      affiliations.push({ label, rorId });
    }
  }

  return affiliations;
}

function normalizeNameKey(familyName, givenName) {
  return `${String(familyName || "").trim().toLowerCase()}\u0000${String(givenName || "").trim().toLowerCase()}`;
}

function getCurrentAuthorsPayload(authorStack) {
  if (authorStack?.collectPayload) return authorStack.collectPayload();
  if (document.querySelector('[name="authorsPayload"]')) throw new Error("Authors form is not initialized.");
  return [];
}

function applyContactsToAuthorStack(contactPersons, matchedOnly = false) {
  const authorStack = getAuthorStackController();
  if (!authorStack || !contactPersons.length) {
    return false;
  }

  const authors = getCurrentAuthorsPayload(authorStack).map((author) => ({ ...author }));

  contactPersons.forEach((contact) => {
    const contactKey = normalizeNameKey(contact.familyname, contact.givenname);
    let author = authors.find((candidate) => (
      candidate.type === "person" && normalizeNameKey(candidate.familyname, candidate.givenname) === contactKey
    ));

    if (!author) {
      if (matchedOnly) return;
      author = {
        type: "person",
        familyname: contact.familyname,
        givenname: contact.givenname,
        orcid: "",
        affiliations: []
      };
      authors.push(author);
    }

    author.isContact = true;
    author.email = contact.email || author.email || "";
    author.website = contact.website || author.website || "";
  });

  authorStack.setAuthors(authors);
  return true;
}

function collectDataCiteContactPersons(xmlDoc) {
  function dcResolver(prefix) {
    return prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;
  }

  const contactPersons = [];
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

    const familyname = getNodeText(node, "ns:familyName", xmlDoc, dcResolver);
    const givenname = getNodeText(node, "ns:givenName", xmlDoc, dcResolver);

    if (familyname || givenname) {
      contactPersons.push({ familyname, givenname, email: "", website: "" });
    }
  }

  return contactPersons;
}

/**
 * Process creators from XML and populate the form
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
function processCreators(xmlDoc, resolver) {
  // Select all <creator> elements inside <creators> using namespace resolver
  const creatorNodes = xmlDoc.evaluate(".//ns:creators/ns:creator", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

  const authorStack = getAuthorStackController();
  if (!authorStack) throw new Error("Authors form is not initialized.");
  const authors = [];

  for (let i = 0; i < creatorNodes.snapshotLength; i++) {
    const creatorNode = creatorNodes.snapshotItem(i);
    const givenname = getNodeText(creatorNode, "ns:givenName", xmlDoc, resolver);
    const familyname = getNodeText(creatorNode, "ns:familyName", xmlDoc, resolver);
    const orcid = getOrcidFromNode(xmlDoc, creatorNode, resolver);
    const creatorNameNode = xmlDoc.evaluate("ns:creatorName", creatorNode, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const creatorName = creatorNameNode ? creatorNameNode.textContent.trim() : "";
    const nameType = creatorNameNode ? creatorNameNode.getAttribute("nameType") : "";
    const affiliations = buildAffiliationsPayload(xmlDoc, creatorNode, resolver);

    if (givenname || familyname || nameType === "Personal") {
      authors.push({
        type: "person",
        familyname,
        givenname,
        orcid,
        isContact: false,
        email: "",
        website: "",
        affiliations
      });
    } else if (creatorName || nameType === "Organizational") {
      authors.push({
        type: "institution",
        institutionname: creatorName,
        affiliations
      });
    }
  }

  authorStack.setAuthors(authors);

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

  if (getAuthorStackController()) {
    const contactPersons = [];

    for (let i = 0; i < contactPersonNodes.snapshotLength; i++) {
      const contactPersonNode = contactPersonNodes.snapshotItem(i);
      const fullName = getNodeText(contactPersonNode, "gmd:individualName/gco:CharacterString", xmlDoc, nsResolver);
      const [familyname, givenname] = fullName?.split(", ");

      if (!givenname || !familyname) {
        continue;
      }

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

      contactPersons.push({ familyname, givenname, email, website });
    }

    if (contactPersonNodes.snapshotLength === 0) {
      contactPersons.push(...collectDataCiteContactPersons(xmlDoc));
    }

    applyContactsToAuthorStack(contactPersons, Boolean(window.contributorStack));
    return;
  }

  throw new Error("Authors form is not initialized.");
}

/**
 * Fallback: Process contact persons from DataCite contributor elements.
 * Used when no ISO pointOfContact section is present (e.g. pure DataCite XML).
 * Note: DataCite schema does not carry email/website for contact persons.
 * @param {Document} xmlDoc - The parsed XML document
 */
function processContactPersonsFromDataCite(xmlDoc) {
  if (!getAuthorStackController()) throw new Error("Authors form is not initialized.");
  applyContactsToAuthorStack(collectDataCiteContactPersons(xmlDoc), Boolean(window.contributorStack));
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
    selectName.val(lab.display_name);


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
    if (hiddenLabId.length) hiddenLabId.val(lab.identifier || "");
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

/** Load contributors only when the shared group is enabled. */
function processContributors(xmlDoc, resolver) {
  if (!window.contributorStack?.setContributors) {
    if (document.querySelector('[name="contributorsPayload"]')) throw new Error("Contributors form is not initialized.");
    return;
  }
  processContributorsIntoStack(xmlDoc, resolver);
}

function processContributorsIntoStack(xmlDoc, resolver) {
  const entries = [];
  const byKey = new Map();
  const authors = getCurrentAuthorsPayload(getAuthorStackController());
  const isAuthor = (familyname, givenname) => authors.some(author =>
    author.type === 'person' && normalizeNameKey(author.familyname, author.givenname) === normalizeNameKey(familyname, givenname));
  const append = (key, entry) => {
    if (byKey.has(key)) return byKey.get(key);
    entries.push(entry);
    byKey.set(key, entry);
    return entry;
  };
  const nodes = Array.from(xmlDoc.getElementsByTagNameNS('http://datacite.org/schema/kernel-4', 'contributor'));
  for (const node of nodes) {
    const dcChildren = name => Array.from(node.getElementsByTagNameNS('http://datacite.org/schema/kernel-4', name));
    const dcText = name => dcChildren(name)[0]?.textContent?.trim() || '';
    if (dcChildren('nameIdentifier').some(item => item.getAttribute('nameIdentifierScheme') === 'labid')) continue;
    const rawRole = node.getAttribute('contributorType') || 'Other';
    const role = normalizeRole(rawRole);
    const nameType = dcChildren('contributorName')[0]?.getAttribute('nameType') || '';
    const display = dcText('contributorName');
    let familyname = dcText('familyName');
    let givenname = dcText('givenName');
    if (nameType === 'Personal' && !familyname && display.includes(',')) {
      [familyname, givenname] = display.split(',').map(part => part.trim());
    }
    const person = nameType === 'Personal' || Boolean(familyname || givenname);
    if (rawRole === 'ContactPerson' && person && isAuthor(familyname, givenname)) continue;
    const orcid = getOrcidFromNode(xmlDoc, node, resolver);
    const key = person ? `person:${orcid || normalizeNameKey(familyname, givenname)}` : `institution:${display.trim().toLowerCase()}`;
    const affiliations = [];
    const affiliationNodes = dcChildren('affiliation');
    for (const affiliation of affiliationNodes) {
      const label = (affiliation.textContent || '').trim();
      const rorId = normalizeRorId(affiliation.getAttribute('affiliationIdentifier'));
      if (label) affiliations.push({ label, rorId });
    }
    const entry = append(key, person
      ? { type: 'person', familyname, givenname, orcid, roles: [], affiliations, email: '', website: '' }
      : { type: 'institution', institutionname: display, roles: [], affiliations, email: '', website: '' });
    if (!entry.roles.includes(role)) entry.roles.push(role);
    affiliations.forEach(affiliation => {
      const existing = entry.affiliations.find(item => item.label === affiliation.label);
      if (!existing) entry.affiliations.push(affiliation);
      else if (!existing.rorId && affiliation.rorId) existing.rorId = affiliation.rorId;
    });
  }

  // ISO carries email and website, which DataCite cannot encode.
  const contacts = Array.from(xmlDoc.getElementsByTagNameNS('*', 'pointOfContact'))
    .flatMap(element => Array.from(element.getElementsByTagNameNS('*', 'CI_ResponsibleParty')));
  for (const node of contacts) {
    const textOf = name => node.getElementsByTagNameNS('*', name)[0]?.textContent?.trim() || '';
    const fullName = textOf('individualName');
    const institutionname = textOf('organisationName');
    const email = textOf('electronicMailAddress');
    const website = textOf('URL');
    const [familyname, givenname = ''] = fullName ? fullName.split(',').map(part => part.trim()) : ['', ''];
    if (familyname) {
      if (isAuthor(familyname, givenname)) continue;
      const key = `person:${normalizeNameKey(familyname, givenname)}`;
      const entry = append(key, { type: 'person', familyname, givenname, roles: [], affiliations: [], email: '', website: '' });
      if (!entry.roles.includes('Contact Person')) entry.roles.push('Contact Person');
      entry.email = email || entry.email;
      entry.website = website || entry.website;
    } else if (institutionname) {
      const key = `institution:${institutionname.trim().toLowerCase()}`;
      const entry = append(key, { type: 'institution', institutionname, roles: [], affiliations: [], email: '', website: '' });
      if (window.ELMO_FEATURES?.showContactInstitution === true && !entry.roles.includes('Contact Person')) {
        entry.roles.push('Contact Person');
      }
      entry.email = email || entry.email;
      entry.website = website || entry.website;
    }
  }
  window.contributorStack.setContributors(entries);
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
    // A point is Latitude Min + Longitude Min. Max stays empty so re-upload
    // does not turn the point into a bounding box.
    return {
      place,
      latitudeMin: getText(pointNode, "pointLatitude"),
      latitudeMax: "",
      longitudeMin: getText(pointNode, "pointLongitude"),
      longitudeMax: "",
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

  if (!temporalData.timezoneOffset) {
    return;
  }

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
  const dateNodes = Array.from(xmlDoc.getElementsByTagName("*")).filter((node) => (
    node.localName === "date" &&
    node.parentElement?.localName === "dates" &&
    (!node.namespaceURI || node.namespaceURI === "http://datacite.org/schema/kernel-4")
  ));

  for (let i = 0; i < dateNodes.length; i++) {
    const dateNode = dateNodes[i];
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
 * Populate keyword Tagify fields from XML subjects.
 * processKeywords collects thesaurus keys referenced in the XML,
 * waits for each via waitForThesaurusVocabulary (whitelist applied, jsTree ready), then imports. On timeout/error, import is aborted so Tagify does not silently drop tags.
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - The namespace resolver function
 */
async function processKeywords(xmlDoc, resolver) {
  // Collect all subject nodes from the XML
  const subjectNodes = xmlDoc.evaluate(".//ns:subjects/ns:subject", xmlDoc, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null );

  // Keys for GCMD / GEMET / chronostrat match THESAURUS_CONFIG in thesauri.js.
  // This file is a classic script, so it cannot import that object; the input
  // ids below are the same values as THESAURUS_CONFIG[key].inputId.
  function getTagifyMap() {
    return {
      free: document.querySelector("#input-freekeyword")?._tagify || null,
      msl: document.querySelector("#input-mslkeyword")?._tagify || null,
      science_keywords: document.querySelector("#input-sciencekeyword")?._tagify || null,
      platforms: document.querySelector("#input-platforms")?._tagify || null,
      instruments: document.querySelector("#input-instruments")?._tagify || null,
      chronostratigraphy: document.querySelector("#input-chronostratigraphy")?._tagify || null,
      gemet: document.querySelector("#input-gemet")?._tagify || null,
    };
  }

  let tagifyMap = getTagifyMap();

  // Keep only initialized Tagify fields
  let allTagifyInstances = Object.values(tagifyMap).filter(Boolean);

  if (allTagifyInstances.length === 0) {
    console.error("No keyword Tagify instances are initialized, upload cannot import subjects.");
    return;
  }

  function buildTagData(subjectNode) {
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

    return {
      subjectScheme,
      schemeURI,
      valueURI,
      keyword,
      tagData,
    };
  }

  // Resolve which form group a subject belongs to
  function resolveTargetGroup(subjectScheme, schemeURI) {
    if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords") {
      return "science_keywords";
    }

    if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms") {
      return "platforms";
    }

    if (schemeURI === "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments") {
      return "instruments";
    }

    if (schemeURI === "http://resource.geosciml.org/vocabulary/timescale/gts2020") {
      return "chronostratigraphy";
    }

    if (
      schemeURI === "http://www.eionet.europa.eu/gemet/gemetThesaurus" ||
      schemeURI === "http://www.eionet.europa.eu/gemet/concept/"
    ) {
      return "gemet";
    }

    if (schemeURI.startsWith("https://epos-msl.uu.nl/voc/")) {
      return "msl";
    }

    return "free";
  }

  const thesaurusKeys = new Set();
  for (let i = 0; i < subjectNodes.snapshotLength; i++) {
    const subjectNode = subjectNodes.snapshotItem(i);
    const { subjectScheme, schemeURI } = buildTagData(subjectNode);
    const targetGroup = resolveTargetGroup(subjectScheme, schemeURI);
    if (targetGroup !== "free" && targetGroup !== "msl") {
      thesaurusKeys.add(targetGroup);
    }
  }
  if (thesaurusKeys.size > 0 && typeof window.waitForThesaurusVocabulary === "function") {
    const keys = [...thesaurusKeys];
    // all existing thesauri inputs will wait for the corresponding fields to be ready
    const results = await Promise.all(keys.map((key) => window.waitForThesaurusVocabulary(key)));
    const notReady = keys.filter((key, index) => results[index] !== 'loaded');
    if (notReady.length > 0) {
      throw new Error('Thesaurus vocabularies not ready for import: ' + notReady.join(', '));
    }

    tagifyMap = getTagifyMap();
    allTagifyInstances = Object.values(tagifyMap).filter(Boolean);
  }

  // We don't clear existing tags before importing new ones


  for (let i = 0; i < subjectNodes.snapshotLength; i++) {
    const subjectNode = subjectNodes.snapshotItem(i);
    const { subjectScheme, schemeURI, tagData } = buildTagData(subjectNode);

    const targetGroup = resolveTargetGroup(subjectScheme, schemeURI);
    const targetTagify = tagifyMap[targetGroup];

    // Ignore keywords if the target field is not initialized
    // Different versions may have different thesaurus selections
    if (!targetTagify) {
      continue;
    }

    targetTagify.addTags([tagData]);
  }

  allTagifyInstances.forEach((tagify) => {
    if (typeof tagify.update === "function") {
      tagify.update();
    } else if (typeof tagify._updateHiddenField === "function") {
      tagify._updateHiddenField();
    }
  });
}

/**
 * Transforms Related Identifiers into the internal RelatedWorks map and rebuilds
 * the card stack in batches. When showUsedInstruments is active,
 * relationType="IsCollectedBy" is filtered by the XSLT and remains owned by
 * processUsedInstruments().
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Function} resolver - Kept for backwards-compatible callers
 * @param {Object} [options] - Import and rendering options
 * @param {Function} [options.onProgress] - Receives {processed, total}
 * @param {number} [options.batchSize=50] - Number of cards per render batch
 * @param {Function} [options.transformRelatedWorksDocument] - Test seam for the XSLT transform
 * @returns {Promise<Array<Record<string, string>>>} Imported entries in XML order
 */
async function processRelatedWorks(xmlDoc, resolver, options = {}) {
  const relatedWorkStack = window.relatedWorkStack
    && typeof window.relatedWorkStack.setRelatedWorks === 'function'
    ? window.relatedWorkStack
    : null;
  const relatedWorkEnabled = relatedWorkStack || document.querySelector(
    '[data-related-work-formgroup], [data-related-work-stack], input[name="relatedWorksPayload"]'
  );
  if (!relatedWorkEnabled) {
    return [];
  }
  if (!relatedWorkStack) {
    throw createRelatedWorksImportError('Related Works card stack is not initialized.');
  }

  if (window.elmo && window.elmo.dropdownsReady) {
    await window.elmo.dropdownsReady;
  }

  const showUsedInstruments = window.ELMO_FEATURES && window.ELMO_FEATURES.showUsedInstruments;
  const transform = typeof options.transformRelatedWorksDocument === 'function'
    ? options.transformRelatedWorksDocument
    : transformRelatedWorksDocument;
  const transformedDocument = await transform(xmlDoc, {
    excludeIsCollectedBy: Boolean(showUsedInstruments)
  });
  const entries = parseRelatedWorksMap(transformedDocument);

  try {
    await Promise.resolve(relatedWorkStack.setRelatedWorks(entries, {
      bulk: true,
      batchSize: options.batchSize,
      onProgress: options.onProgress,
      yieldControl: options.yieldControl
    }));
  } catch (error) {
    try {
      await Promise.resolve(relatedWorkStack.setRelatedWorks([]));
    } catch (clearError) {
      // Preserve the original import failure while making a best effort to
      // return the Related Works form group to its empty state.
    }
    throw createRelatedWorksImportError('Could not render Related Works from the uploaded XML file.', error);
  }

  return entries;
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

  const identifierNodes = xmlDoc.evaluate(
    ".//ns:relatedIdentifiers/ns:relatedIdentifier | .//relatedIdentifiers/relatedIdentifier",
    xmlDoc,
    resolver,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads XML data into form fields according to mapping configuration
 * @param {Document} xmlDoc - The parsed XML document
 * @param {Object} [options] - Import integration options
 * @param {Function} [options.onRelatedWorksProgress] - Receives Related Works batch progress
 * @param {number} [options.relatedWorksBatchSize=50] - Related Works render batch size
 */
async function loadXmlToForm(xmlDoc, options = {}) {
  const clearInputFields = await window.loadClearInputFields();
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
  // Load MSL laboratories only when the laboratory form group is present.
  if (document.querySelector('#group-originatinglaboratory') && (!labData || labData.length === 0)) {
    try {
      const originatingLaboratories = await $.getJSON(
        "/api/v2/vocabs/msl-laboratories"
      );
      labData = originatingLaboratories.data;
    } catch (error) {
      console.error("Error loading laboratory data:", error);
      labData = [];
    }
  }

  // Erstelle das License- und Language-Mapping zuerst
  const licenseMapping = await createLicenseMapping();
  const languageMapping = await createLanguageMapping();
  const titleTypeMapping = await createTitleTypeMapping();

  // Non-resource fields retain their existing mapping.
  const XML_MAPPING = {
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

  const mappedResource = await transformResourceInformationDocument(xmlDoc);
  if (!window.resourceInformation?.setResourceInformation) {
    throw new Error('Resource Information form is not initialized.');
  }
  const resourceInformation = parseResourceInformationMap(mappedResource, languageMapping, titleTypeMapping);
  window.resourceInformation.setResourceInformation(resourceInformation);
  if (resourceInformation.doi) window.resourceInformation.enableDoiEditing?.(true);
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
  // For ICGEM schema files, descriptions use a section attribute (not DataCite descriptionType)
  const isIcgem = window.icgemModule?.detectXmlSchema(xmlDoc) === 'icgem';
  if (!isIcgem) {
    processDescriptions(xmlDoc, resolver);
  }
  // Process Spatial and Temporal Coverages
  processSpatialTemporalCoverages(xmlDoc, resolver);
  // Thesaurus Tagify inputs are created after an async availability fetch.
  // Wait until that input scaffolding exists; processKeywords() then waits for
  // only the thesaurus vocabularies referenced by the uploaded subjects.
  if (window.thesauriReady) {
    await window.thesauriReady;
  }
  // Process Keywords (async: waits for the referenced thesaurus vocabularies)
  await processKeywords(xmlDoc, resolver);
  // Process Related Works
  await processRelatedWorks(xmlDoc, resolver, {
    onProgress: options.onRelatedWorksProgress,
    batchSize: options.relatedWorksBatchSize
  });
  // Process Used Instruments (IsCollectedBy entries)
  processUsedInstruments(xmlDoc, resolver);
  // Process Funders
  processFunders(xmlDoc, resolver);
  // Process Dates
  processDates(xmlDoc, resolver);
  // For ICGEM schema files, populate GGM-specific formgroups (descriptions + all ICGEM fields)
  if (isIcgem) {
    await window.icgemModule.loadIcgemXmlToForm(xmlDoc);
  }
}

if (typeof window !== 'undefined') {
  window.loadXmlToForm = loadXmlToForm;
}

// Export for testing (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeResourceTypeGeneral: resourceTypeUtils.normalizeResourceTypeGeneral,
        findResourceTypeOption: resourceTypeUtils.findResourceTypeOption,
        processResourceType,
        transformResourceInformationDocument,
        parseResourceInformationMap,
        extractLicenseIdentifier,
        mapTitleType,
        processTitles,
        getNodeText,
        getOrcidFromNode,
        processCreators,
        processContactPersons,
        processContactPersonsFromDataCite,
        findLabNameById,
        setLabDataInRow,
        processOriginatingLaboratories,
        normalizeRole,
        processContributors,
        processDates,
        processKeywords,
        parseTemporalData,
        getGeoLocationData,
        fillSpatialFields,
        fillTemporalFields,
        loadRelatedWorksXsltDocument,
        transformRelatedWorksDocument,
        parseRelatedWorksMap,
        resetRelatedWorksXsltCache,
        processUsedInstruments,
        processDescriptions,
        processRelatedWorks,
        processFunders,
        processSpatialTemporalCoverages,
        loadXmlToForm
    };
}
