import {
    GFC_EXTENSION_ERROR,
    validateGfcFileExtension,
    parseGfcFiles,
    extractSections,
    parseRecords,
    Parser,
} from '../../js/fileUpload.js';

describe('fileUpload.js GFC extension validation', () => {
    test('validateGfcFileExtension accepts .gfc files', () => {
        const file = { name: 'model.gfc' };
        expect(() => validateGfcFileExtension(file)).not.toThrow();
    });

    test('validateGfcFileExtension rejects non-.gfc files', () => {
        const file = { name: 'model.txt' };
        expect(() => validateGfcFileExtension(file)).toThrow(GFC_EXTENSION_ERROR);
    });

    test('parseGfcFiles rejects non-.gfc files before reading', async () => {
        const file = { name: 'model.csv', size: 0 };
        await expect(parseGfcFiles(file)).rejects.toThrow(GFC_EXTENSION_ERROR);
    });
});

describe('fileUpload.js readFile size limit', () => {
    const ONE_MB = 1024 * 1024;

    test('strict=true rejects files larger than maxSizeInMB', async () => {
        const parser = new Parser();
        const content = 'a'.repeat(ONE_MB + 10);
        const file = new File([content], 'big.gfc', { type: 'text/plain' });

        await expect(parser.readFile(file, 1, true)).rejects.toThrow(
            'File size exceeds the limit of 1 MB.'
        );
    });

    test('strict=false reads only the first maxSizeInMB bytes', async () => {
        const parser = new Parser();
        const content = `${'a'.repeat(ONE_MB)}SHOULD_NOT_APPEAR`;
        const file = new File([content], 'big.gfc', { type: 'text/plain' });

        const text = await parser.readFile(file, 1, false);

        expect(text.length).toBe(ONE_MB);
        expect(text).not.toContain('SHOULD_NOT_APPEAR');
    });

    test('parseGfcFiles truncates oversized .gfc files and still parses the header', async () => {
        const header = [
            'begin_of_head',
            'modelname BigModel',
            'max_degree 42',
            'errors no',
            'radius 6.3E+06',
            'earth_gravity_constant 3.9E+14',
            'end_of_head',
        ].join('\n');
        const padding = 'x'.repeat(ONE_MB);
        const file = new File([`${header}\n${padding}`], 'big.gfc', { type: 'text/plain' });

        const { header: parsed } = await parseGfcFiles(file);

        expect(parsed.modelname.trim()).toBe('BigModel');
        expect(parsed.max_degree.trim()).toBe('42');
        expect(parsed.errors.trim()).toBe('no');
    });
});

describe('fileUpload.js GFC header parsing without section markers', () => {
    const unmarkedHeader = [
        'Author citation line',
        'Another comment line',
        'product_type                gravity_field',
        'earth_gravity_constant      3.986004418E+14',
        'radius                      6.378137000E+06',
        'max_degree                  7200',
        'errors                      no',
        'format                      icgem2.0',
        'tide_system                 tide-free',
        'gfc    0    0     1.0000e+00     0.0000e+00',
    ];

    test('extractSections falls back to header key matching when markers are absent', () => {
        const { headerLines, commentLines } = extractSections(unmarkedHeader);

        expect(headerLines).toHaveLength(7);
        expect(commentLines.join('')).toContain('Author citation line');
        expect(commentLines.join('')).toContain('Another comment line');
        expect(headerLines.some((line) => line.includes('max_degree'))).toBe(true);
        expect(headerLines.some((line) => line.includes('gfc'))).toBe(false);
    });

    test('parseRecords extracts values from fallback header lines', () => {
        const { headerLines } = extractSections(unmarkedHeader);
        const records = parseRecords(headerLines);

        expect(records.product_type).toBe('gravity_field');
        expect(records.max_degree).toBe('7200');
        expect(records.tide_system).toBe('tide-free');
    });
});
