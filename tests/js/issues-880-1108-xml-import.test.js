const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createJQuery() {
  const $ = (selector) => {
    const elements = Array.from(document.querySelectorAll(selector));
    return {
      length: elements.length,
      val(value) {
        if (value === undefined) {
          return elements[0]?.value;
        }
        elements.forEach((element) => {
          element.value = value;
        });
        return this;
      }
    };
  };

  return $;
}

function loadMappingModule(contextOverrides = {}) {
  const code = fs.readFileSync(
    path.resolve(__dirname, '../../js/mappingXmlToInputFields.js'),
    'utf8'
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
      settings: { whitelist: [] }
    })),
    translations: {},
    ...contextOverrides
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

const dataciteResolver = (prefix) =>
  prefix === 'ns' ? 'http://datacite.org/schema/kernel-4' : null;

describe('Issue #880 STC date-only XML import', () => {
  test('open Coverage interval is parsed as start date with empty end date', () => {
    const ctx = loadMappingModule();
    const xmlDoc = new DOMParser().parseFromString(
      '<date dateType="Coverage">2026-06-12/</date>',
      'application/xml'
    );

    const result = ctx.parseTemporalData(xmlDoc.querySelector('date'));

    expect(result.startDate).toBe('2026-06-12');
    expect(result.startTime).toBe('');
    expect(result.endDate).toBe('');
    expect(result.endTime).toBe('');
    expect(result.timezoneOffset).toBe('');
  });
});

describe('Issue #1108 ICGEM Date Created XML import', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input name="dateCreated" value="" />
      <input name="dateEmbargo" value="" />
    `;
  });

  test('Date Created is populated from dace:dates inside a grav envelope', () => {
    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="http://icgem.gfz.de/schema"
                     xmlns:dace="http://datacite.org/schema/kernel-4">
        <dace:resource>
          <dace:dates>
            <dace:date dateType="Created">2019-06-12</dace:date>
          </dace:dates>
        </dace:resource>
      </grav:envelope>`, 'application/xml');

    expect(typeof ctx.processDates).toBe('function');
    ctx.processDates(xmlDoc, dataciteResolver);

    expect(document.querySelector('input[name="dateCreated"]').value).toBe('2019-06-12');
  });

  test('Submitted date is not imported as Date Created', () => {
    const $ = createJQuery();
    const ctx = loadMappingModule({ $ });
    const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <grav:envelope xmlns:grav="http://icgem.gfz.de/schema"
                     xmlns:dace="http://datacite.org/schema/kernel-4">
        <dace:resource>
          <dace:dates>
            <dace:date dateType="Submitted">2026-06-25</dace:date>
          </dace:dates>
        </dace:resource>
      </grav:envelope>`, 'application/xml');

    ctx.processDates(xmlDoc, dataciteResolver);

    expect(document.querySelector('input[name="dateCreated"]').value).toBe('');
  });
});
