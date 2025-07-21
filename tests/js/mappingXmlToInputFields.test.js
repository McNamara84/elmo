const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadMappingModule(contextOverrides = {}) {
  const code = fs.readFileSync(path.resolve(__dirname, "../../js/mappingXmlToInputFields.js"), "utf8");
  const context = {
    console,
    document: global.document,
    window: global.window,
    XPathResult: global.XPathResult,
    ...contextOverrides,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

function createJQuery() {
  const map = new WeakMap();
  const $ = (sel) => {
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!el) return { length: 0, find: () => $(null), val: () => {}, trigger: jest.fn() };
    if (map.has(el)) return map.get(el);
    const obj = {
      length: 1,
      element: el,
      find: (s) => $(el.querySelector(s)),
      val(v) {
        if (v === undefined) return this.element.value;
        this.element.value = v;
        return this;
      },
      trigger: jest.fn(),
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

    const xml = `<resource xmlns=\"http://datacite.org/schema/kernel-4\">
      <resourceType resourceTypeGeneral=\"Dataset\">Genome Sequencing Data</resourceType>
    </resource>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

    ctx.processResourceType(xmlDoc);
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
    expect(ctx.mapTitleType("AlternativeTitle")).toBe("2");
    expect(ctx.mapTitleType("TranslatedTitle")).toBe("3");
    expect(ctx.mapTitleType("UnknownType")).toBe("1");
  });

  test("normalizeRole inserts whitespace in contributor roles", () => {
    const ctx = loadMappingModule();
    expect(ctx.normalizeRole("DataCurator")).toBe("Data Curator");
  });

  test("findLabNameById returns lab info from labData", () => {
    const ctx = loadMappingModule();
    vm.runInContext(
      `labData = [{id: 'MSL-001', name: 'Max Planck Institute for Astronomy', rorid: 'https://ror.org/05y42nb95', affiliation: 'Max Planck Society'}];`,
      ctx
    );
    const lab = ctx.findLabNameById("MSL-001");
    expect(lab).toEqual({ id: "MSL-001", name: "Max Planck Institute for Astronomy", rorid: "https://ror.org/05y42nb95", affiliation: "Max Planck Society" });
  });

  test("getNodeText returns trimmed text for relative paths", () => {
    const ctx = loadMappingModule();
    const xml = `<root><parent id="p1"><child>  Value </child></parent></root>`;
    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const parent = xmlDoc.getElementById("p1");
    const text = ctx.getNodeText(parent, "child", xmlDoc, null);
    expect(text).toBe("Value");
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
    vm.runInContext(`labData = [{ id: 'LAB1', name: 'Lab1', rorid: 'R1', affiliation: 'Aff1' }];`, ctx);

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
    const xml =
      `<resource xmlns=\"http://datacite.org/schema/kernel-4\">\n` +
      `  <geoLocations>\n` +
      `    <geoLocation>\n` +
      `      <geoLocationBox>\n` +
      `        <westBoundLongitude>-123.27</westBoundLongitude>\n` +
      `        <eastBoundLongitude>-123.02</eastBoundLongitude>\n` +
      `        <southBoundLatitude>49.195</southBoundLatitude>\n` +
      `        <northBoundLatitude>49.315</northBoundLatitude>\n` +
      `      </geoLocationBox>\n` +
      `    </geoLocation>\n` +
      `    <geoLocation>\n` +
      `      <geoLocationPoint>\n` +
      `        <pointLatitude>41.2827</pointLatitude>\n` +
      `        <pointLongitude>-101.1207</pointLongitude>\n` +
      `      </geoLocationPoint>\n` +
      `    </geoLocation>\n` +
      `  </geoLocations>\n` +
      `</resource>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = xmlDoc.querySelectorAll("geoLocation");
    const first = ctx.getGeoLocationData(nodes[0]);
    const second = ctx.getGeoLocationData(nodes[1]);

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
    const xml =
      `<resource xmlns=\"http://datacite.org/schema/kernel-4\">\n` +
      `  <geoLocations>\n` +
      `    <geoLocation>\n` +
      `      <geoLocationPoint>\n` +
      `        <pointLatitude>12.34</pointLatitude>\n` +
      `        <pointLongitude>56.78</pointLongitude>\n` +
      `      </geoLocationPoint>\n` +
      `    </geoLocation>\n` +
      `  </geoLocations>\n` +
      `</resource>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const node = xmlDoc.querySelector("geoLocation");
    const data = ctx.getGeoLocationData(node);

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
    const xml =
      `<resource xmlns=\"http://datacite.org/schema/kernel-4\">\n` +
      `  <geoLocations>\n` +
      `    <geoLocation>\n` +
      `      <geoLocationBox>\n` +
      `        <westBoundLongitude>-10</westBoundLongitude>\n` +
      `        <eastBoundLongitude>10</eastBoundLongitude>\n` +
      `        <southBoundLatitude>-20</southBoundLatitude>\n` +
      `        <northBoundLatitude>20</northBoundLatitude>\n` +
      `      </geoLocationBox>\n` +
      `    </geoLocation>\n` +
      `  </geoLocations>\n` +
      `</resource>`;

    const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
    const node = xmlDoc.querySelector("geoLocation");
    const data = ctx.getGeoLocationData(node);

    expect(data).toEqual({
      place: "",
      latitudeMin: "-20",
      latitudeMax: "20",
      longitudeMin: "-10",
      longitudeMax: "10",
    });
  });
});
