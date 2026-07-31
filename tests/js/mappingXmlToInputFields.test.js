const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadMappingModule(contextOverrides = {}) {
  const resourceTypeUtilsCode = fs.readFileSync(
    path.resolve(__dirname, "../../js/resourceTypeUtils.js"),
    "utf8"
  );
  const code = fs.readFileSync(path.resolve(__dirname, "../../js/mappingXmlToInputFields.js"), "utf8");
  const context = {
    console,
    document: global.document,
    window: global.window,
    XPathResult: global.XPathResult,
    ...contextOverrides,
  };
  vm.createContext(context);
  vm.runInContext(resourceTypeUtilsCode, context);
  context.window.resourceTypeUtils = context.resourceTypeUtils;
  vm.runInContext(code, context);
  return context;
}

function createJQuery() {
  const map = new WeakMap();
  const $ = (sel) => {
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!el) return { length: 0, find: () => $(null), val: () => {}, trigger: jest.fn(), click: jest.fn() };
    if (map.has(el)) return map.get(el);
    const obj = {
      length: 1,
      element: el,
      find: (s) => $(el.querySelector(s)),
      closest: (s) => $(el.closest(s)),
      last() { return this; },
      val(v) {
        if (v === undefined) return this.element.value;
        this.element.value = v;
        return this;
      },
      trigger: jest.fn(),
      click: jest.fn(),
    };
    map.set(el, obj);
    return obj;
  };
  return $;
}

describe("mappingXmlToInputFields helpers", () => {
  test("processResourceType selects option matching resourceTypeGeneral", () => {
    document.body.innerHTML = `
      <select id="input-resourceinformation-resourcetype">
        <option value="Dataset">Dataset</option>
        <option value="Software">Software</option>
      </select>`;

    const ctx = loadMappingModule();
    const nsResolver = (prefix) => prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;

    const xml = `<ns:resource xmlns:ns=\"http://datacite.org/schema/kernel-4\">
      <ns:resourceType resourceTypeGeneral=\"Dataset\">Genome Sequencing Data</ns:resourceType>
    </ns:resource>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

    ctx.processResourceType(xmlDoc, nsResolver);
    const select = document.getElementById("input-resourceinformation-resourcetype");
    expect(select.value).toBe("Dataset");
  });

  test("extractLicenseIdentifier resolves SPDX identifier", () => {
    const ctx = loadMappingModule();
    const xml = `<rights rightsURI=\"https://spdx.org/licenses/CC0-1.0.html\">CC0 1.0</rights>`;
    const node = new DOMParser().parseFromString(xml, "application/xml").documentElement;
    expect(ctx.extractLicenseIdentifier(node)).toBe("CC0-1");
  });

  test("mapTitleType maps known types to option values", () => {
    const ctx = loadMappingModule();
    const mapping = {
      MainTitle: "6",
      AlternativeTitle: "1",
      TranslatedTitle: "16",
      "": "6",
    };
    expect(ctx.mapTitleType("AlternativeTitle", mapping)).toBe("1");
    expect(ctx.mapTitleType("TranslatedTitle", mapping)).toBe("16");
    expect(ctx.mapTitleType("UnknownType", mapping)).toBe("6");
  });

  test("normalizeRole inserts whitespace in contributor roles", () => {
    const ctx = loadMappingModule();
    expect(ctx.normalizeRole("DataCurator")).toBe("Data Curator");
  });

  test("findLabNameById returns lab info from labData", () => {
    const ctx = loadMappingModule();
    vm.runInContext(
      `labData = [{identifier: 'MSL-001', name: 'Max Planck Institute for Astronomy', affiliation_ror: 'https://ror.org/05y42nb95', affiliation_name: 'Max Planck Society'}];`,
      ctx
    );
    const lab = ctx.findLabNameById("MSL-001");
    expect(lab).toEqual({ identifier: "MSL-001", name: "Max Planck Institute for Astronomy", affiliation_ror: "https://ror.org/05y42nb95", affiliation_name: "Max Planck Society" });
  });

  test("getNodeText returns trimmed text for relative paths", () => {
    const ctx = loadMappingModule();
    const xml = `<root><parent id="p1"><child>  Value </child></parent></root>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const parent = xmlDoc.getElementById("p1");
    const text = ctx.getNodeText(parent, "child", xmlDoc, null);
    expect(text).toBe("Value");
  });

  test("processCreators sends mixed creators to authorStack when available", () => {
    const setAuthors = jest.fn();
    window.authorStack = { setAuthors };
    const ctx = loadMappingModule();
    const xml = `<ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
      <ns:creators>
        <ns:creator>
          <ns:creatorName nameType="Personal">Doe, Jane</ns:creatorName>
          <ns:givenName>Jane</ns:givenName>
          <ns:familyName>Doe</ns:familyName>
          <ns:nameIdentifier nameIdentifierScheme="ORCID">https://orcid.org/0000-0002-1825-0097</ns:nameIdentifier>
          <ns:affiliation affiliationIdentifier="https://ror.org/04z8jg394">GFZ</ns:affiliation>
          <ns:affiliation>Additional University</ns:affiliation>
        </ns:creator>
        <ns:creator>
          <ns:creatorName nameType="Organizational">Payload Institute</ns:creatorName>
          <ns:affiliation affiliationIdentifier="https://ror.org/03qjp1d79">Helmholtz</ns:affiliation>
        </ns:creator>
        <ns:creator>
          <ns:creatorName nameType="Personal">Sukarno</ns:creatorName>
          <ns:familyName>Sukarno</ns:familyName>
        </ns:creator>
      </ns:creators>
    </ns:resource>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const resolver = (prefix) => prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;

    try {
      ctx.processCreators(xmlDoc, resolver);

      expect(setAuthors).toHaveBeenCalledWith([
        expect.objectContaining({
          type: "person",
          familyname: "Doe",
          givenname: "Jane",
          orcid: "0000-0002-1825-0097",
          affiliations: [
            { label: "GFZ", rorId: "04z8jg394" },
            { label: "Additional University", rorId: "" }
          ]
        }),
        expect.objectContaining({
          type: "institution",
          institutionname: "Payload Institute",
          affiliations: [{ label: "Helmholtz", rorId: "03qjp1d79" }]
        }),
        expect.objectContaining({
          type: "person",
          familyname: "Sukarno",
          givenname: ""
        })
      ]);
    } finally {
      delete window.authorStack;
    }
  });

  test("processContactPersons restores contact state for a mononymous authorStack entry", () => {
    const setAuthors = jest.fn();
    window.authorStack = {
      collectPayload: jest.fn(() => [{
        type: "person",
        familyname: "Sukarno",
        givenname: "",
        orcid: "",
        isContact: false,
        email: "",
        website: "",
        affiliations: []
      }]),
      setAuthors
    };
    const ctx = loadMappingModule();
    const xml = `<ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
      <ns:contributors>
        <ns:contributor contributorType="ContactPerson">
          <ns:contributorName nameType="Personal">Sukarno</ns:contributorName>
          <ns:familyName>Sukarno</ns:familyName>
        </ns:contributor>
      </ns:contributors>
    </ns:resource>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

    try {
      ctx.processContactPersons(xmlDoc);

      expect(setAuthors).toHaveBeenCalledWith([
        expect.objectContaining({
          type: "person",
          familyname: "Sukarno",
          givenname: "",
          isContact: true,
          email: "",
          website: ""
        })
      ]);
    } finally {
      delete window.authorStack;
    }
  });

  test("createLicenseMapping resolves API data and handles errors", async () => {
    const getJSON = jest.fn(() => Promise.resolve([{ rightsIdentifier: "MIT", rights_id: 4 }]));
    const ctx = loadMappingModule({ $: { getJSON } });
    const result = await ctx.createLicenseMapping();
    expect(getJSON).toHaveBeenCalled();
    expect(result).toEqual({ MIT: "4" });

    const failingGetJSON = jest.fn(() => Promise.reject(new Error("fail")));
    const ctxFail = loadMappingModule({ $: { getJSON: failingGetJSON }, console: { ...console, error: jest.fn() } });
    const fallback = await ctxFail.createLicenseMapping();
    expect(failingGetJSON).toHaveBeenCalled();
    expect(fallback["CC-BY-4.0"]).toBe("1");
    expect(fallback["Apache-2.0"]).toBe("5");
  });

  test("processFunders populates fields including award URI", () => {
    document.body.innerHTML = `
      <div id="group-fundingreference">
        <div class="row">
          <input name="funder[]" />
          <input name="funderId[]" />
          <input name="funderidtyp[]" />
          <input name="grantNummer[]" />
          <input name="grantName[]" />
          <input name="awardURI[]" />
        </div>
      </div>
      <button id="button-fundingreference-add"></button>`;

    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });

    const xml = `
      <ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
        <ns:fundingReferences>
          <ns:fundingReference>
            <ns:funderName>Test Fund</ns:funderName>
            <funderIdentifier funderIdentifierType="Crossref Funder ID">12345</funderIdentifier>
            <ns:awardNumber awardURI="https://example.com/award">AB123</ns:awardNumber>
            <ns:awardTitle>Award Title</ns:awardTitle>
          </ns:fundingReference>
        </ns:fundingReferences>
      </ns:resource>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const resolver = (prefix) => prefix === 'ns' ? 'http://datacite.org/schema/kernel-4' : null;

    ctx.processFunders(xmlDoc, resolver);

    const row = $(document.querySelector("#group-fundingreference .row"));
    expect(row.find('input[name="funder[]"]').val()).toBe("Test Fund");
    expect(row.find('input[name="grantNummer[]"]').val()).toBe("AB123");
    expect(row.find('input[name="grantName[]"]').val()).toBe("Award Title");
    expect(row.find('input[name="awardURI[]"]').val()).toBe("https://example.com/award");
  });

  test("createLanguageMapping resolves API data and handles errors", async () => {
    const getJSON = jest.fn(() => Promise.resolve([
      { id: 1, code: "en", name: "English" },
      { id: 2, code: "de", name: "German" },
    ]));
    const ctx = loadMappingModule({ $: { getJSON } });
    const result = await ctx.createLanguageMapping();
    expect(getJSON).toHaveBeenCalled();
    expect(result).toEqual({ en: "1", de: "2" });

    const failingGetJSON = jest.fn(() => Promise.reject(new Error("fail")));
    const ctxFail = loadMappingModule({ $: { getJSON: failingGetJSON }, console: { ...console, error: jest.fn() } });
    const fallback = await ctxFail.createLanguageMapping();
    expect(failingGetJSON).toHaveBeenCalled();
    expect(fallback.en).toBe("1");
    expect(fallback.de).toBe("2");
  });

  test("createTitleTypeMapping resolves API data and handles errors", async () => {
    const getJSON = jest.fn(() => Promise.resolve([
      { id: 1, name: "Main Title" },
      { id: 2, name: "Alternative Title" },
    ]));
    const ctx = loadMappingModule({ $: { getJSON } });
    const result = await ctx.createTitleTypeMapping();
    expect(getJSON).toHaveBeenCalled();
    expect(result.MainTitle).toBe("1");
    expect(result.AlternativeTitle).toBe("2");

    const failingGetJSON = jest.fn(() => Promise.reject(new Error("fail")));
    const ctxFail = loadMappingModule({ $: { getJSON: failingGetJSON }, console: { ...console, error: jest.fn() } });
    const fallback = await ctxFail.createTitleTypeMapping();
    expect(failingGetJSON).toHaveBeenCalled();
    expect(fallback[""]).toBe("");
    expect(fallback.AlternativeTitle).toBe("");
    expect(fallback.MainTitle).toBe("");
    expect(fallback.TranslatedTitle).toBe("");
  });

  test("setLabDataInRow populates fields and triggers change", () => {
    document.body.innerHTML = `
      <div id="row">
        <select name="laboratoryName[]"><option></option><option value="Lab1">Lab1</option></select>
        <input name="laboratoryAffiliation[]" />
        <input name="laboratoryRorIds[]" />
        <input name="LabId[]" />
      </div>`;
    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });
    vm.runInContext(`labData = [{ identifier: 'LAB1', name: 'Lab1', affiliation_ror: 'R1', affiliation_name: 'Aff1' }];`, ctx);

    const row = $(document.getElementById("row"));
    ctx.setLabDataInRow(row, "LAB1");

    expect(row.find('select[name="laboratoryName[]"]').val()).toBe("Lab1");
    expect(row.find('input[name="laboratoryAffiliation[]"]').val()).toBe("Aff1");
    expect(row.find('input[name="laboratoryRorIds[]"]').val()).toBe("R1");
    expect(row.find('input[name="LabId[]"]').val()).toBe("LAB1");
    expect(row.find('select[name="laboratoryName[]"]').trigger).toHaveBeenCalledWith("change");
  });

  test("getGeoLocationData extracts boxes and points correctly", () => {
    const ctx = loadMappingModule();
    const nsResolver = (prefix) => prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;
    const xml =
      `<ns:resource xmlns:ns=\"http://datacite.org/schema/kernel-4\">\n` +
      `  <ns:geoLocations>\n` +
      `    <ns:geoLocation>\n` +
      `      <ns:geoLocationBox>\n` +
      `        <ns:westBoundLongitude>-123.27</ns:westBoundLongitude>\n` +
      `        <ns:eastBoundLongitude>-123.02</ns:eastBoundLongitude>\n` +
      `        <ns:southBoundLatitude>49.195</ns:southBoundLatitude>\n` +
      `        <ns:northBoundLatitude>49.315</ns:northBoundLatitude>\n` +
      `      </ns:geoLocationBox>\n` +
      `    </ns:geoLocation>\n` +
      `    <ns:geoLocation>\n` +
      `      <ns:geoLocationPoint>\n` +
      `        <ns:pointLatitude>41.2827</ns:pointLatitude>\n` +
      `        <ns:pointLongitude>-101.1207</ns:pointLongitude>\n` +
      `      </ns:geoLocationPoint>\n` +
      `    </ns:geoLocation>\n` +
      `  </ns:geoLocations>\n` +
      `</ns:resource>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = xmlDoc.evaluate(".//ns:geoLocations/ns:geoLocation", xmlDoc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const first = ctx.getGeoLocationData(nodes.snapshotItem(0), xmlDoc, nsResolver);
    const second = ctx.getGeoLocationData(nodes.snapshotItem(1), xmlDoc, nsResolver);

    expect(first).toEqual({
      place: "",
      latitudeMin: "49.195",
      latitudeMax: "49.315",
      longitudeMin: "-123.27",
      longitudeMax: "-123.02",
    });

    expect(second).toEqual({
      place: "",
      latitudeMin: "41.2827",
      latitudeMax: "41.2827",
      longitudeMin: "-101.1207",
      longitudeMax: "-101.1207",
    });
  });

  test("getGeoLocationData handles a single point", () => {
    const ctx = loadMappingModule();
    const nsResolver = (prefix) => prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;
    const xml =
      `<ns:resource xmlns:ns=\"http://datacite.org/schema/kernel-4\">\n` +
      `  <ns:geoLocations>\n` +
      `    <ns:geoLocation>\n` +
      `      <ns:geoLocationPoint>\n` +
      `        <ns:pointLatitude>12.34</ns:pointLatitude>\n` +
      `        <ns:pointLongitude>56.78</ns:pointLongitude>\n` +
      `      </ns:geoLocationPoint>\n` +
      `    </ns:geoLocation>\n` +
      `  </ns:geoLocations>\n` +
      `</ns:resource>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const node = xmlDoc.evaluate(".//ns:geoLocations/ns:geoLocation", xmlDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const data = ctx.getGeoLocationData(node, xmlDoc, nsResolver);

    expect(data).toEqual({
      place: "",
      latitudeMin: "12.34",
      latitudeMax: "12.34",
      longitudeMin: "56.78",
      longitudeMax: "56.78",
    });
  });

  test("getGeoLocationData handles a single box", () => {
    const ctx = loadMappingModule();
    const nsResolver = (prefix) => prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;
    const xml =
      `<ns:resource xmlns:ns=\"http://datacite.org/schema/kernel-4\">\n` +
      `  <ns:geoLocations>\n` +
      `    <ns:geoLocation>\n` +
      `      <ns:geoLocationBox>\n` +
      `        <ns:westBoundLongitude>-10</ns:westBoundLongitude>\n` +
      `        <ns:eastBoundLongitude>10</ns:eastBoundLongitude>\n` +
      `        <ns:southBoundLatitude>-20</ns:southBoundLatitude>\n` +
      `        <ns:northBoundLatitude>20</ns:northBoundLatitude>\n` +
      `      </ns:geoLocationBox>\n` +
      `    </ns:geoLocation>\n` +
      `  </ns:geoLocations>\n` +
      `</ns:resource>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const node = xmlDoc.evaluate(".//ns:geoLocations/ns:geoLocation", xmlDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const data = ctx.getGeoLocationData(node, xmlDoc, nsResolver);

    expect(data).toEqual({
      place: "",
      latitudeMin: "-20",
      latitudeMax: "20",
      longitudeMin: "-10",
      longitudeMax: "10",
    });
  });

  test("getGeoLocationData handles point then box order", () => {
    const ctx = loadMappingModule();
    const nsResolver = (prefix) => prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;
    const xml =
      `<ns:resource xmlns:ns=\"http://datacite.org/schema/kernel-4\">\n` +
      `  <ns:geoLocations>\n` +
      `    <ns:geoLocation>\n` +
      `      <ns:geoLocationPoint>\n` +
      `        <ns:pointLatitude>1</ns:pointLatitude>\n` +
      `        <ns:pointLongitude>2</ns:pointLongitude>\n` +
      `      </ns:geoLocationPoint>\n` +
      `    </ns:geoLocation>\n` +
      `    <ns:geoLocation>\n` +
      `      <ns:geoLocationBox>\n` +
      `        <ns:westBoundLongitude>-5</ns:westBoundLongitude>\n` +
      `        <ns:eastBoundLongitude>5</ns:eastBoundLongitude>\n` +
      `        <ns:southBoundLatitude>-6</ns:southBoundLatitude>\n` +
      `        <ns:northBoundLatitude>6</ns:northBoundLatitude>\n` +
      `      </ns:geoLocationBox>\n` +
      `    </ns:geoLocation>\n` +
      `  </ns:geoLocations>\n` +
      `</ns:resource>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = xmlDoc.evaluate(".//ns:geoLocations/ns:geoLocation", xmlDoc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const first = ctx.getGeoLocationData(nodes.snapshotItem(0), xmlDoc, nsResolver);
    const second = ctx.getGeoLocationData(nodes.snapshotItem(1), xmlDoc, nsResolver);

    expect(first).toEqual({
      place: "",
      latitudeMin: "1",
      latitudeMax: "1",
      longitudeMin: "2",
      longitudeMax: "2",
    });

    expect(second).toEqual({
      place: "",
      latitudeMin: "-6",
      latitudeMax: "6",
      longitudeMin: "-5",
      longitudeMax: "5",
    });
  });

  test("getGeoLocationData includes geoLocationPlace values", () => {
    const ctx = loadMappingModule();
    const nsResolver = (prefix) => prefix === "ns" ? "http://datacite.org/schema/kernel-4" : null;
    const xml =
      `<ns:resource xmlns:ns=\"http://datacite.org/schema/kernel-4\">\n` +
      `  <ns:geoLocations>\n` +
      `    <ns:geoLocation>\n` +
      `      <ns:geoLocationPlace>Pacific Ocean</ns:geoLocationPlace>\n` +
      `      <ns:geoLocationPoint>\n` +
      `        <ns:pointLatitude>-33</ns:pointLatitude>\n` +
      `        <ns:pointLongitude>151</ns:pointLongitude>\n` +
      `      </ns:geoLocationPoint>\n` +
      `    </ns:geoLocation>\n` +
      `    <ns:geoLocation>\n` +
      `      <ns:geoLocationPlace>Area 51</ns:geoLocationPlace>\n` +
      `      <ns:geoLocationBox>\n` +
      `        <ns:westBoundLongitude>-115.9</ns:westBoundLongitude>\n` +
      `        <ns:eastBoundLongitude>-115.7</ns:eastBoundLongitude>\n` +
      `        <ns:southBoundLatitude>37.2</ns:southBoundLatitude>\n` +
      `        <ns:northBoundLatitude>37.3</ns:northBoundLatitude>\n` +
      `      </ns:geoLocationBox>\n` +
      `    </ns:geoLocation>\n` +
      `  </ns:geoLocations>\n` +
      `</ns:resource>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = xmlDoc.evaluate(".//ns:geoLocations/ns:geoLocation", xmlDoc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const first = ctx.getGeoLocationData(nodes.snapshotItem(0), xmlDoc, nsResolver);
    const second = ctx.getGeoLocationData(nodes.snapshotItem(1), xmlDoc, nsResolver);

    expect(first).toEqual({
      place: "Pacific Ocean",
      latitudeMin: "-33",
      latitudeMax: "-33",
      longitudeMin: "151",
      longitudeMax: "151",
    });

    expect(second).toEqual({
      place: "Area 51",
      latitudeMin: "37.2",
      latitudeMax: "37.3",
      longitudeMin: "-115.9",
      longitudeMax: "-115.7",
    });
  });
});
