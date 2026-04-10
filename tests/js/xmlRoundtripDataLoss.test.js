/**
 * @file Round-trip data loss regression tests for XML export → import.
 *
 * These tests verify that data exported as XML by ELMO can be re-imported
 * without information loss. Each test covers a previously identified data
 * loss scenario and serves as a regression test.
 *
 * IMPORTANT: jsdom's XPath only works with explicit namespace prefixes (ns:element).
 * The real XSLT export uses default namespace (<resource xmlns="...">) without prefixes.
 * Tests use ns: prefix XML for XPath compatibility.
 * Additionally, jsdom XPath does NOT support attribute predicates on namespaced
 * elements (e.g. ns:nameIdentifier[@scheme="ORCID"]), so some fields cannot be
 * tested here; those are covered by Playwright E2E tests.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadMappingModule(contextOverrides = {}) {
  const code = fs.readFileSync(
    path.resolve(__dirname, "../../js/mappingXmlToInputFields.js"),
    "utf8"
  );
  const context = {
    console,
    document: global.document,
    window: global.window,
    XPathResult: global.XPathResult,
    ELMO_FEATURES: {},
    Tagify: jest.fn().mockImplementation(() => ({
      addTags: jest.fn(),
      removeAllTags: jest.fn(),
      settings: { whitelist: [] },
    })),
    translations: {},
    ...contextOverrides,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

/**
 * Enhanced jQuery mock supporting all methods used by mappingXmlToInputFields.js.
 */
function createJQuery() {
  const $ = (sel) => {
    if (typeof sel === "function") {
      sel();
      return;
    }
    let elements;
    if (typeof sel === "string") {
      const firstMatch = sel.match(/^(.+):first$/);
      if (firstMatch) {
        const el = document.querySelector(firstMatch[1]);
        elements = el ? [el] : [];
      } else {
        elements = Array.from(document.querySelectorAll(sel));
      }
    } else if (sel instanceof NodeList || Array.isArray(sel)) {
      elements = Array.from(sel);
    } else if (sel && sel.nodeType) {
      elements = [sel];
    } else {
      elements = [];
    }
    return wrapElements(elements);
  };

  function wrapElements(elements) {
    const obj = {
      length: elements.length,
      get: (i) => elements[i],
      toArray: () => elements,
      each(fn) {
        elements.forEach((el, i) => fn.call(el, i, el));
        return obj;
      },
      find(s) {
        const results = [];
        // Handle jQuery :first pseudo-selector (not valid CSS)
        const firstMatch = s.match(/^(.+):first\s+(.+)$/);
        if (firstMatch) {
          elements.forEach((el) => {
            const parents = el.querySelectorAll(firstMatch[1]);
            if (parents.length > 0) {
              results.push(...parents[0].querySelectorAll(firstMatch[2]));
            }
          });
        } else if (s.includes(':first')) {
          const cleanSel = s.replace(/:first$/, '');
          elements.forEach((el) => {
            const found = el.querySelectorAll(cleanSel);
            if (found.length > 0) results.push(found[0]);
          });
        } else {
          elements.forEach((el) => results.push(...el.querySelectorAll(s)));
        }
        return wrapElements(results);
      },
      filter(fnOrSel) {
        if (typeof fnOrSel === "function") {
          const filtered = elements.filter((el, i) => fnOrSel.call(el, i, el));
          return wrapElements(filtered);
        }
        const filtered = elements.filter((el) => el.matches(fnOrSel));
        return wrapElements(filtered);
      },
      first() {
        return wrapElements(elements.length ? [elements[0]] : []);
      },
      last() {
        return wrapElements(elements.length ? [elements[elements.length - 1]] : []);
      },
      eq(i) {
        return wrapElements(i >= 0 && i < elements.length ? [elements[i]] : []);
      },
      closest(s) {
        if (!elements.length) return wrapElements([]);
        const found = elements[0].closest(s);
        return found ? wrapElements([found]) : wrapElements([]);
      },
      val(v) {
        if (v === undefined) {
          return elements.length ? elements[0].value : undefined;
        }
        elements.forEach((el) => (el.value = v));
        return obj;
      },
      text(v) {
        if (v === undefined) {
          return elements.length ? elements[0].textContent : "";
        }
        elements.forEach((el) => (el.textContent = v));
        return obj;
      },
      prop(name, value) {
        if (value === undefined) {
          return elements.length ? elements[0][name] : undefined;
        }
        elements.forEach((el) => (el[name] = value));
        return obj;
      },
      attr(name, value) {
        if (value === undefined) {
          return elements.length ? elements[0].getAttribute(name) : undefined;
        }
        elements.forEach((el) => el.setAttribute(name, value));
        return obj;
      },
      addClass(cls) {
        elements.forEach((el) => el.classList.add(cls));
        return obj;
      },
      show() {
        elements.forEach((el) => (el.style.display = ""));
        return obj;
      },
      hide() {
        elements.forEach((el) => (el.style.display = "none"));
        return obj;
      },
      click() {
        elements.forEach((el) => el.click());
        return obj;
      },
      trigger: jest.fn().mockReturnThis(),
    };
    elements.forEach((el, i) => (obj[i] = el));
    return obj;
  }

  $.getJSON = jest.fn();
  return $;
}

/**
 * Helper: build a DataCite XML string with explicit ns: prefix.
 * This is needed because jsdom's XPath only works with explicit prefixes.
 */
function buildNsPrefixXml(content) {
  return `<ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">${content}</ns:resource>`;
}

const NS_RESOLVER = (prefix) =>
  prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;

// ─── FIX 1: funderIdentifierType now uses XPath instead of querySelector ────

describe("funderIdentifierType import via XPath (regression for querySelector bug)", () => {
  test("processFunders no longer uses querySelector for funderIdentifier", () => {
    const sourceCode = fs.readFileSync(
      path.resolve(__dirname, "../../js/mappingXmlToInputFields.js"),
      "utf8"
    );

    // Verify querySelector is no longer used for funderIdentifier
    expect(sourceCode).not.toMatch(/funderNode\.querySelector\(["']funderIdentifier["']\)/);

    // Verify XPath is used instead (via xmlDoc.evaluate)
    expect(sourceCode).toMatch(/evaluate\(["']ns:funderIdentifier["']/);
  });

  test("funderIdentifierType is correctly imported from namespaced XML", () => {
    document.body.innerHTML = `
      <div id="group-fundingreference">
        <div class="row">
          <input name="funder[]" value="" />
          <input name="funderId[]" value="" />
          <input name="funderidtyp[]" value="" />
          <input name="grantNummer[]" value="" />
          <input name="grantName[]" value="" />
          <input name="awardURI[]" value="" />
        </div>
      </div>
      <button id="button-fundingreference-add"></button>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:fundingReferences>
        <ns:fundingReference>
          <ns:funderName>Deutsche Forschungsgemeinschaft</ns:funderName>
          <ns:funderIdentifier funderIdentifierType="Crossref Funder ID">https://doi.org/10.13039/501100001659</ns:funderIdentifier>
          <ns:awardNumber awardURI="https://gepris.dfg.de/12345">DFG-12345</ns:awardNumber>
          <ns:awardTitle>Seismic Monitoring</ns:awardTitle>
        </ns:fundingReference>
      </ns:fundingReferences>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processFunders(xmlDoc, NS_RESOLVER);

    expect(document.querySelector('input[name="funder[]"]').value).toBe(
      "Deutsche Forschungsgemeinschaft"
    );
    expect(document.querySelector('input[name="funderId[]"]').value).toBe(
      "https://doi.org/10.13039/501100001659"
    );
    expect(document.querySelector('input[name="grantNummer[]"]').value).toBe("DFG-12345");
    expect(document.querySelector('input[name="awardURI[]"]').value).toBe(
      "https://gepris.dfg.de/12345"
    );

    // FIXED: funderIdentifierType is now correctly extracted via XPath
    expect(document.querySelector('input[name="funderidtyp[]"]').value).toBe(
      "Crossref Funder ID"
    );
  });

  test("funderIdentifierType with ROR type is also correctly imported", () => {
    document.body.innerHTML = `
      <div id="group-fundingreference">
        <div class="row">
          <input name="funder[]" value="" />
          <input name="funderId[]" value="" />
          <input name="funderidtyp[]" value="" />
          <input name="grantNummer[]" value="" />
          <input name="grantName[]" value="" />
          <input name="awardURI[]" value="" />
        </div>
      </div>
      <button id="button-fundingreference-add"></button>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:fundingReferences>
        <ns:fundingReference>
          <ns:funderName>European Research Council</ns:funderName>
          <ns:funderIdentifier funderIdentifierType="ROR">https://ror.org/0472cxd90</ns:funderIdentifier>
          <ns:awardNumber awardURI="https://example.com/award">ERC-123</ns:awardNumber>
          <ns:awardTitle>Climate Research</ns:awardTitle>
        </ns:fundingReference>
      </ns:fundingReferences>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processFunders(xmlDoc, NS_RESOLVER);

    expect(document.querySelector('input[name="funderidtyp[]"]').value).toBe("ROR");
    expect(document.querySelector('input[name="funderId[]"]').value).toBe(
      "https://ror.org/0472cxd90"
    );
  });
});

// ─── awardURI import verification ───────────────────────────────────────────

describe("awardURI import from namespaced XML", () => {
  test("awardURI is correctly imported via XPath getAttribute", () => {
    document.body.innerHTML = `
      <div id="group-fundingreference">
        <div class="row">
          <input name="funder[]" value="" />
          <input name="funderId[]" value="" />
          <input name="funderidtyp[]" value="" />
          <input name="grantNummer[]" value="" />
          <input name="grantName[]" value="" />
          <input name="awardURI[]" value="" />
        </div>
      </div>
      <button id="button-fundingreference-add"></button>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:fundingReferences>
        <ns:fundingReference>
          <ns:funderName>DFG</ns:funderName>
          <ns:funderIdentifier funderIdentifierType="Crossref Funder ID">501100001659</ns:funderIdentifier>
          <ns:awardNumber awardURI="https://gepris.dfg.de/12345">DFG-12345</ns:awardNumber>
          <ns:awardTitle>Seismic Monitoring</ns:awardTitle>
        </ns:fundingReference>
      </ns:fundingReferences>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processFunders(xmlDoc, NS_RESOLVER);

    expect(document.querySelector('input[name="awardURI[]"]').value).toBe(
      "https://gepris.dfg.de/12345"
    );
  });
});

// ─── Contact person email/website from different XML sources ────────────────

describe("Contact person email/website from DataCite-only XML", () => {
  test("contact person checkbox is set via DataCite fallback (but email/website lost)", () => {
    document.body.innerHTML = `
      <div id="group-author">
        <div data-creator-row>
          <input name="familynames[]" value="Schmidt" />
          <input name="givennames[]" value="Thomas" />
          <input name="orcids[]" value="0000-0001-2345-6789" />
          <input name="personAffiliation[]" value="" />
          <input name="authorPersonRorIds[]" value="" />
          <input name="contacts[]" type="checkbox" />
          <div class="contact-person-input" style="display:none">
            <input name="cpEmail[]" value="" />
            <input name="cpOnlineResource[]" value="" />
          </div>
        </div>
      </div>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    // DataCite-only XML (no ISO section) with ns: prefix
    const xml = buildNsPrefixXml(`
      <ns:creators>
        <ns:creator>
          <ns:creatorName nameType="Personal">Schmidt, Thomas</ns:creatorName>
          <ns:givenName>Thomas</ns:givenName>
          <ns:familyName>Schmidt</ns:familyName>
        </ns:creator>
      </ns:creators>
      <ns:contributors>
        <ns:contributor contributorType="ContactPerson">
          <ns:contributorName nameType="Personal">Schmidt, Thomas</ns:contributorName>
          <ns:givenName>Thomas</ns:givenName>
          <ns:familyName>Schmidt</ns:familyName>
        </ns:contributor>
      </ns:contributors>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processContactPersons(xmlDoc);

    // Contact person checkbox should be checked (DataCite fallback matches by name)
    const checkbox = document.querySelector('input[name="contacts[]"]');
    expect(checkbox.checked).toBe(true);

    // Email and website are NOT available in DataCite schema
    const emailField = document.querySelector('input[name="cpEmail[]"]');
    const websiteField = document.querySelector('input[name="cpOnlineResource[]"]');
    expect(emailField.value).toBe("");
    expect(websiteField.value).toBe("");
  });

  test("contact person email/website preserved when ISO section is present", () => {
    document.body.innerHTML = `
      <div id="group-author">
        <div data-creator-row>
          <input name="familynames[]" value="Schmidt" />
          <input name="givennames[]" value="Thomas" />
          <input name="orcids[]" value="0000-0001-2345-6789" />
          <input name="personAffiliation[]" value="" />
          <input name="authorPersonRorIds[]" value="" />
          <input name="contacts[]" type="checkbox" />
          <div class="contact-person-input" style="display:none">
            <input name="cpEmail[]" value="" />
            <input name="cpOnlineResource[]" value="" />
          </div>
        </div>
      </div>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    // Envelope with DataCite (ns: prefix) + ISO section
    const xml = `<envelope>
  <ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
    <ns:creators>
      <ns:creator>
        <ns:creatorName nameType="Personal">Schmidt, Thomas</ns:creatorName>
        <ns:givenName>Thomas</ns:givenName>
        <ns:familyName>Schmidt</ns:familyName>
      </ns:creator>
    </ns:creators>
    <ns:contributors>
      <ns:contributor contributorType="ContactPerson">
        <ns:contributorName nameType="Personal">Schmidt, Thomas</ns:contributorName>
        <ns:givenName>Thomas</ns:givenName>
        <ns:familyName>Schmidt</ns:familyName>
      </ns:contributor>
    </ns:contributors>
  </ns:resource>
  <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                   xmlns:gco="http://www.isotc211.org/2005/gco">
    <gmd:contact>
      <gmd:CI_ResponsibleParty>
        <gmd:individualName>
          <gco:CharacterString>Schmidt, Thomas</gco:CharacterString>
        </gmd:individualName>
      </gmd:CI_ResponsibleParty>
    </gmd:contact>
    <gmd:pointOfContact>
      <gmd:CI_ResponsibleParty>
        <gmd:individualName>
          <gco:CharacterString>Schmidt, Thomas</gco:CharacterString>
        </gmd:individualName>
        <gmd:contactInfo>
          <gmd:CI_Contact>
            <gmd:address>
              <gmd:CI_Address>
                <gmd:electronicMailAddress>
                  <gco:CharacterString>thomas@gfz.de</gco:CharacterString>
                </gmd:electronicMailAddress>
              </gmd:CI_Address>
            </gmd:address>
            <gmd:onlineResource>
              <gmd:CI_OnlineResource>
                <gmd:linkage>
                  <gmd:URL>https://gfz.de/thomas</gmd:URL>
                </gmd:linkage>
              </gmd:CI_OnlineResource>
            </gmd:onlineResource>
          </gmd:CI_Contact>
        </gmd:contactInfo>
      </gmd:CI_ResponsibleParty>
    </gmd:pointOfContact>
  </gmd:MD_Metadata>
</envelope>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processContactPersons(xmlDoc);

    const checkbox = document.querySelector('input[name="contacts[]"]');
    expect(checkbox.checked).toBe(true);

    const emailField = document.querySelector('input[name="cpEmail[]"]');
    const websiteField = document.querySelector('input[name="cpOnlineResource[]"]');
    expect(emailField.value).toBe("thomas@gfz.de");
    expect(websiteField.value).toBe("https://gfz.de/thomas");
  });
});

// ─── FIX 3: Contact person no longer dropped when not matching any author ───

describe("Contact person added as new author when name doesn't match (regression)", () => {
  test("contact person with different name than authors is added as new author row", () => {
    document.body.innerHTML = `
      <div id="group-author">
        <div data-creator-row>
          <input name="familynames[]" value="Schmidt" />
          <input name="givennames[]" value="Thomas" />
          <input name="orcids[]" value="" />
          <input name="personAffiliation[]" value="" />
          <input name="authorPersonRorIds[]" value="" />
          <input name="contacts[]" type="checkbox" />
          <div class="contact-person-input" style="display:none">
            <input name="cpEmail[]" value="" />
            <input name="cpOnlineResource[]" value="" />
          </div>
        </div>
      </div>
      <button id="button-author-add"></button>`;

    // Simulate add-author button creating a new row
    document.getElementById("button-author-add").addEventListener("click", () => {
      const container = document.getElementById("group-author");
      const firstRow = container.querySelector("[data-creator-row]");
      const clone = firstRow.cloneNode(true);
      clone.querySelectorAll("input").forEach((i) => {
        if (i.type === "checkbox") i.checked = false;
        else i.value = "";
      });
      clone.querySelector(".contact-person-input").style.display = "none";
      container.appendChild(clone);
    });

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    // Contact person "Müller" is not one of the authors ("Schmidt")
    const xml = buildNsPrefixXml(`
      <ns:contributors>
        <ns:contributor contributorType="ContactPerson">
          <ns:contributorName nameType="Personal">Müller, Erika</ns:contributorName>
          <ns:givenName>Erika</ns:givenName>
          <ns:familyName>Müller</ns:familyName>
        </ns:contributor>
      </ns:contributors>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processContactPersons(xmlDoc);

    // FIXED: A new author row is created for the contact person
    const allRows = document.querySelectorAll("[data-creator-row]");
    expect(allRows.length).toBe(2);

    // Original author unchanged
    expect(allRows[0].querySelector('input[name="familynames[]"]').value).toBe("Schmidt");
    expect(allRows[0].querySelector('input[name="contacts[]"]').checked).toBe(false);

    // New row has contact person data and is marked as contact
    expect(allRows[1].querySelector('input[name="familynames[]"]').value).toBe("Müller");
    expect(allRows[1].querySelector('input[name="givennames[]"]').value).toBe("Erika");
    expect(allRows[1].querySelector('input[name="contacts[]"]').checked).toBe(true);
  });
});

// ─── Relation type matching works with CamelCase ────────────────────────────

describe("Relation type matching with CamelCase option text", () => {
  test("relation type CamelCase from XML matches CamelCase dropdown option", () => {
    document.body.innerHTML = `
      <div id="group-relatedwork">
        <div class="row">
          <input name="rIdentifier[]" value="" />
          <select name="rIdentifierType[]">
            <option value="DOI">DOI</option>
          </select>
          <select name="relation[]">
            <option value="">-- Select --</option>
            <option value="1">IsCitedBy</option>
            <option value="3">IsSupplementTo</option>
          </select>
        </div>
      </div>
      <button id="button-relatedwork-add"></button>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:relatedIdentifiers>
        <ns:relatedIdentifier relatedIdentifierType="DOI" relationType="IsSupplementTo">10.5555/related</ns:relatedIdentifier>
      </ns:relatedIdentifiers>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processRelatedWorks(xmlDoc, NS_RESOLVER);

    const idField = document.querySelector('input[name="rIdentifier[]"]');
    expect(idField.value).toBe("10.5555/related");

    // CamelCase option text "IsSupplementTo" matches CamelCase XML relationType
    const relationSelect = document.querySelector('select[name="relation[]"]');
    const selectedOption = relationSelect.querySelector("option[selected]") ||
      Array.from(relationSelect.options).find((o) => o.selected && o.value !== "");
    expect(selectedOption).toBeTruthy();
    expect(selectedOption.value).toBe("3");
  });
});

// ─── BUG 6: Multiple funding references ─────────────────────────────────────

describe("Multiple funding references import", () => {
  test("second funding reference row is correctly populated", () => {
    document.body.innerHTML = `
      <div id="group-fundingreference">
        <div class="row">
          <input name="funder[]" value="" />
          <input name="funderId[]" value="" />
          <input name="funderidtyp[]" value="" />
          <input name="grantNummer[]" value="" />
          <input name="grantName[]" value="" />
          <input name="awardURI[]" value="" />
        </div>
      </div>
      <button id="button-fundingreference-add"></button>`;

    let addClicked = 0;
    document.getElementById("button-fundingreference-add").addEventListener("click", () => {
      addClicked++;
      const container = document.getElementById("group-fundingreference");
      const firstRow = container.querySelector(".row");
      const clone = firstRow.cloneNode(true);
      clone.querySelectorAll("input").forEach((i) => (i.value = ""));
      container.appendChild(clone);
    });

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:fundingReferences>
        <ns:fundingReference>
          <ns:funderName>DFG</ns:funderName>
          <ns:funderIdentifier funderIdentifierType="Crossref Funder ID">501100001659</ns:funderIdentifier>
          <ns:awardNumber awardURI="https://example.org/1">GRANT-1</ns:awardNumber>
          <ns:awardTitle>First Grant</ns:awardTitle>
        </ns:fundingReference>
        <ns:fundingReference>
          <ns:funderName>ERC</ns:funderName>
          <ns:funderIdentifier funderIdentifierType="ROR">https://ror.org/0472cxd90</ns:funderIdentifier>
          <ns:awardNumber awardURI="https://example.org/2">GRANT-2</ns:awardNumber>
          <ns:awardTitle>Second Grant</ns:awardTitle>
        </ns:fundingReference>
      </ns:fundingReferences>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processFunders(xmlDoc, NS_RESOLVER);

    expect(addClicked).toBe(1);

    const rows = document.querySelectorAll("#group-fundingreference .row");
    expect(rows.length).toBe(2);

    expect(rows[0].querySelector('input[name="funder[]"]').value).toBe("DFG");
    expect(rows[0].querySelector('input[name="grantNummer[]"]').value).toBe("GRANT-1");

    expect(rows[1].querySelector('input[name="funder[]"]').value).toBe("ERC");
    expect(rows[1].querySelector('input[name="grantNummer[]"]').value).toBe("GRANT-2");
  });
});

// ─── BUG 7: Temporal coverage timezone parsing edge cases ───────────────────

describe("Temporal coverage timezone offset parsing", () => {
  test("negative timezone offset is correctly extracted", () => {
    const ctx = loadMappingModule();

    const xml = `<date>2025-01-15T08:00:00-05:00/2025-06-30T17:00:00-05:00</date>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const dateNode = xmlDoc.querySelector("date");

    const result = ctx.parseTemporalData(dateNode);
    expect(result.startDate).toBe("2025-01-15");
    expect(result.startTime).toBe("08:00:00");
    expect(result.endDate).toBe("2025-06-30");
    expect(result.endTime).toBe("17:00:00");
    expect(result.timezoneOffset).toBe("-05:00");
  });

  test("date without time but with timezone parses correctly", () => {
    const ctx = loadMappingModule();

    const xml = `<date>2025-01-15+02:00/2025-06-30+02:00</date>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const dateNode = xmlDoc.querySelector("date");

    const result = ctx.parseTemporalData(dateNode);
    expect(result.startDate).toBe("2025-01-15");
    expect(result.startTime).toBe("");
    expect(result.endDate).toBe("2025-06-30");
    expect(result.endTime).toBe("");
    expect(result.timezoneOffset).toBe("+02:00");
  });

  test("date with negative offset and no time extracts timezone correctly", () => {
    const ctx = loadMappingModule();

    const xml = `<date>2025-03-01-08:00</date>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const dateNode = xmlDoc.querySelector("date");

    const result = ctx.parseTemporalData(dateNode);
    expect(result.startDate).toBe("2025-03-01");
    expect(result.timezoneOffset).toBe("-08:00");
  });
});

// ─── Known limitation: Description xml:lang not stored in form ──────────────

describe("Description xml:lang attribute limitation", () => {
  test("description content is imported but language attribute has no form field", () => {
    document.body.innerHTML = `
      <textarea id="input-abstract"></textarea>
      <div id="collapse-abstract" class="accordion-body"></div>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:descriptions>
        <ns:description descriptionType="Abstract" xml:lang="de">Abstrakt auf Deutsch</ns:description>
      </ns:descriptions>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processDescriptions(xmlDoc, NS_RESOLVER);

    // Content is imported correctly
    expect(document.getElementById("input-abstract").value).toBe("Abstrakt auf Deutsch");

    // Known limitation: No form field stores the description language.
    // On re-export, it defaults to "en" instead of "de".
    // Verify there is no hidden field for description language:
    expect(document.querySelector('input[name="descriptionLang[]"]')).toBeNull();
    expect(document.querySelector('select[name="descriptionLang[]"]')).toBeNull();
  });
});

// ─── Known limitation: Title xml:lang not stored in form ────────────────────

describe("Title xml:lang attribute limitation", () => {
  test("title content is imported but language attribute has no form field", () => {
    document.body.innerHTML = `
      <div class="row">
        <input name="title[]" value="" />
        <select id="input-resourceinformation-titletype">
          <option value="1">Main Title</option>
        </select>
      </div>
      <button id="button-resourceinformation-addtitle"></button>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:titles>
        <ns:title xml:lang="fr" titleType="MainTitle">Titre en français</ns:title>
      </ns:titles>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processTitles(xmlDoc, NS_RESOLVER, { "": "1", MainTitle: "1" });

    // Title text is imported
    expect(document.querySelector('input[name="title[]"]').value).toBe("Titre en français");

    // Known limitation: xml:lang="fr" is read in code but never stored in any form field.
    // On re-export, defaults to "en". No hidden field exists for title language.
    expect(document.querySelector('input[name="titleLang[]"]')).toBeNull();
    expect(document.querySelector('select[name="titleLang[]"]')).toBeNull();
  });
});

// ─── BUG 10: Thesaurus keyword metadata round-trip ──────────────────────────

describe("Keyword metadata round-trip via Tagify tags", () => {
  test("thesaurus keyword schemeURI and valueURI are preserved in Tagify tag data", () => {
    document.body.innerHTML = `
      <input id="input-freekeyword" />
      <input id="input-sciencekeyword" />`;

    const mockScienceTagify = {
      addTags: jest.fn(),
      removeAllTags: jest.fn(),
    };
    const mockFreeTagify = {
      addTags: jest.fn(),
      removeAllTags: jest.fn(),
    };
    document.getElementById("input-freekeyword")._tagify = mockFreeTagify;
    document.getElementById("input-sciencekeyword")._tagify = mockScienceTagify;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:subjects>
        <ns:subject subjectScheme="NASA/GCMD Earth Science Keywords"
                    schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords"
                    valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/123"
                    xml:lang="en">EARTH SCIENCE &gt; SOLID EARTH</ns:subject>
      </ns:subjects>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processKeywords(xmlDoc, NS_RESOLVER);

    expect(mockScienceTagify.addTags).toHaveBeenCalled();

    const addedTag = mockScienceTagify.addTags.mock.calls[0][0][0];
    expect(addedTag.value).toBe("EARTH SCIENCE > SOLID EARTH");
    expect(addedTag.schemeURI).toBe(
      "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords"
    );
    expect(addedTag.id).toBe("https://gcmd.earthdata.nasa.gov/kms/concept/123");
    expect(addedTag.scheme).toBe("NASA/GCMD Earth Science Keywords");
    expect(addedTag.language).toBe("en");
  });
});

// ─── Author ORCID URL stripping ─────────────────────────────────────

describe("Author ORCID URL stripping", () => {
  /**
   * NOTE: jsdom's XPath engine does not support attribute predicates on
   * namespaced elements (e.g. ns:nameIdentifier[@nameIdentifierScheme="ORCID"])
   * returns null. Therefore, processCreators cannot extract ORCID in jsdom.
   * This test verifies other fields ARE populated (name, affiliation) and
   * documents that ORCID is empty due to XPath limitation.
   * In real browsers, ORCID extraction works correctly.
   */
  test("creator name and affiliation are imported (ORCID empty in jsdom due to XPath attr predicate limitation)", () => {
    document.body.innerHTML = `
      <div id="group-author">
        <div data-creator-row>
          <input name="familynames[]" value="" />
          <input name="givennames[]" value="" />
          <input name="orcids[]" value="" />
          <input name="personAffiliation[]" value="" />
          <input name="authorPersonRorIds[]" value="" />
          <input name="contacts[]" type="checkbox" />
          <div class="contact-person-input" style="display:none">
            <input name="cpEmail[]" value="" />
            <input name="cpOnlineResource[]" value="" />
          </div>
        </div>
      </div>
      <button id="button-author-add"></button>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = buildNsPrefixXml(`
      <ns:creators>
        <ns:creator>
          <ns:creatorName nameType="Personal">Schmidt, Thomas</ns:creatorName>
          <ns:givenName>Thomas</ns:givenName>
          <ns:familyName>Schmidt</ns:familyName>
          <ns:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">https://orcid.org/0000-0001-2345-6789</ns:nameIdentifier>
          <ns:affiliation affiliationIdentifierScheme="ROR" schemeURI="https://ror.org/" affiliationIdentifier="https://ror.org/04z8jg394">GFZ Potsdam</ns:affiliation>
        </ns:creator>
      </ns:creators>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    ctx.processCreators(xmlDoc, NS_RESOLVER);

    // Name fields work (simple XPath without attribute predicates)
    expect(document.querySelector('input[name="familynames[]"]').value).toBe("Schmidt");
    expect(document.querySelector('input[name="givennames[]"]').value).toBe("Thomas");

    // ORCID is empty in jsdom because XPath attribute predicates don't work
    // on namespaced elements. In real browsers, this correctly returns the ORCID.
    // The .replace("https://orcid.org/", "") stripping logic is verified by
    // inspecting the source code below.
    expect(document.querySelector('input[name="orcids[]"]').value).toBe("");
  });

  test("source code uses .replace() to strip ORCID URL prefix", () => {
    const sourceCode = fs.readFileSync(
      path.resolve(__dirname, "../../js/mappingXmlToInputFields.js"),
      "utf8"
    );
    // Verify the ORCID URL stripping logic exists
    expect(sourceCode).toMatch(
      /getNodeText\(creatorNode.*nameIdentifierScheme.*ORCID.*\.replace\(["']https:\/\/orcid\.org\/["']/
    );
  });
});

// ─── Contributor ORCID handling ─────────────────────────────────────

describe("Contributor ORCID extraction", () => {
  /**
   * NOTE: jsdom's XPath does not support attribute predicates on namespaced
   * elements. The XPath query ns:nameIdentifier[@schemeURI="https://orcid.org/"]
   * returns null. So contributor ORCID will be empty in jsdom.
   * Name and role extraction work correctly (no attribute predicates on those).
   */
  test("contributor name and role are extracted (ORCID empty in jsdom)", () => {
    const ctx = loadMappingModule();

    const xml = buildNsPrefixXml(`
      <ns:contributors>
        <ns:contributor contributorType="DataCollector">
          <ns:contributorName nameType="Personal">Müller, Erika</ns:contributorName>
          <ns:givenName>Erika</ns:givenName>
          <ns:familyName>Müller</ns:familyName>
          <ns:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-9876-5432</ns:nameIdentifier>
        </ns:contributor>
      </ns:contributors>`);

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

    const personMap = new Map();
    const orgMap = new Map();
    const contributorNode = xmlDoc.evaluate(
      ".//ns:contributors/ns:contributor",
      xmlDoc,
      NS_RESOLVER,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    expect(contributorNode).not.toBeNull();
    ctx.processIndividualContributor(contributorNode, xmlDoc, NS_RESOLVER, personMap, orgMap);

    expect(personMap.size).toBe(1);
    const person = personMap.values().next().value;
    // ORCID is empty in jsdom due to XPath attribute predicate limitation
    expect(person.orcid).toBe("");
    expect(person.givenName).toBe("Erika");
    expect(person.familyName).toBe("Müller");
    expect(person.roles).toContain("Data Collector");
  });
});
