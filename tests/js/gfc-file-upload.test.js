const fs = require('fs');
const path = require('path');

const { parseGfcFiles, extractSections, parseRecords } = require('../../js/fileUpload.js');

const EXAMPLES_DIR = path.resolve(
  __dirname,
  '../playwright/formgroups/elmogem-specific/gfc-files-examples'
);

function readExample(name) {
  return fs.readFileSync(path.join(EXAMPLES_DIR, name), 'utf8');
}

function makeFile(name, content) {
  return new File([content], name, { type: 'text/plain' });
}

describe('GFC file upload parsing', () => {
  test('parses WGS72.gfc header fields', async () => {
    const content = readExample('WGS72.gfc');
    const { header } = await parseGfcFiles(makeFile('WGS72.gfc', content));

    expect(header.modelname).toBe('WGS72');
    expect(header.max_degree).toBe('28');
    expect(header.errors).toBe('no');
    expect(header.earth_gravity_constant).toBe('0.3986005E+15');
    expect(header.radius).toBe('0.6378135E+07');
  });

  test('parses EHFM_Earth_7200.gfc header with begin_of_head marker', async () => {
    const content = readExample('EHFM_Earth_7200.gfc');
    const { header } = await parseGfcFiles(makeFile('EHFM_Earth_7200.gfc', content));

    expect(header.modelname).toBe('EHFM_Earth_7200');
    expect(header.max_degree).toBe('7300');
    expect(header.errors).toBe('no');
    expect(header.earth_gravity_constant).toBe('3.986004418E+14');
    expect(header.radius).toBe('6.378137000E+06');
  });

  test('parses dV_ELL header including tide_system', async () => {
    const content = readExample('dV_ELL_Earth2014_5480_plusGRS80.gfc');
    const { header } = await parseGfcFiles(makeFile('dV_ELL_Earth2014_5480_plusGRS80.gfc', content));

    expect(header.modelname).toBe('dV_ELL_Earth2014_5480_plusGRS80');
    expect(header.max_degree).toBe('5480');
    expect(header.tide_system).toBe('tide-free');
    expect(header.errors).toBe('n/a');
    expect(header.earth_gravity_constant).toBe('0.39860050000D+15');
    expect(header.radius).toBe('0.63781370000D+07');
  });

  test('text header overwrites file header when merged', async () => {
    const fileContent = readExample('WGS72.gfc');
    const fileHeader = (await parseGfcFiles(makeFile('WGS72.gfc', fileContent))).header;

    const textHeader = parseRecords([
      'max_degree 99',
      'errors formal',
    ]);

    const merged = { ...fileHeader, ...textHeader };

    expect(merged.max_degree).toBe('99');
    expect(merged.errors).toBe('formal');
    expect(merged.radius).toBe('0.6378135E+07');
  });
});
