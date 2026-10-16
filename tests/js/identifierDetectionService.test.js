const detection = require('../../js/services/identifierDetectionService.js');

const types = require('../fixtures/identifier-types.json');

describe('identifier formats and ambiguity', () => {
  test.each([
    ['10.60510/gf1211s-47', 'lookupRequired', ['DOI', 'IGSN', 'RAiD']],
    ['https://doi.org/10.60510/gf1211s-47', 'lookupRequired', ['DOI', 'IGSN', 'RAiD']],
    ['978-3-510-96872-5', 'detected', ['ISBN']],
    ['9783831048069', 'ambiguous', ['ISBN', 'EAN13']],
    ['https://raid.org/10.82210/162fda4d', 'detected', ['RAiD']],
    ['https://arxiv.org/abs/2507.21532', 'detected', ['arXiv']],
    ['4006381333931', 'detected', ['EAN13']],
    ['0-8044-2957-X', 'detected', ['ISBN']],
    ['https://example.org/paper', 'detected', ['URL']],
    ['hdl:1234/suffix', 'detected', ['Handle']],
    ['1234/suffix', 'detected', ['Handle']],
    ['GFZABC123', 'detected', ['IGSN']],
    ['9783831048068', 'invalid', []],
    ['978--3-510-96872-5', 'unknown', []],
    ['https://arxiv.org/abs/invalid', 'invalid', []],
    ['https://arxiv.org/abs', 'invalid', []],
    ['https://arxiv.org/', 'detected', ['URL']],
    ['https://raid.org/', 'detected', ['URL']],
    ['https://raid.org/10.82210/', 'invalid', []],
    ['https://doi.org/nonsense', 'invalid', []],
    ['', 'unknown', []],
    ['unrecognized identifier', 'unknown', []],
  ])('%s → %s', (value, status, candidates) => {
    expect(detection.classifyLocal(value, types)).toMatchObject({ status, candidates });
  });

  test('disabling EAN13 does not make ISBN13 unambiguous', () => {
    expect(detection.classifyLocal('9783831048069', types.filter(type => type.name === 'ISBN')).status).toBe('ambiguous');
  });
  test('disabling a subtype never selects a generic URL', () => {
    const result = detection.classifyLocal('https://arxiv.org/abs/2507.21532', types.filter(type => type.name === 'URL'));
    expect(detection.activeType(result.candidates[0], [{ name: 'URL' }])).toBeNull();
  });
  test.each(['arXiv', 'IGSN', 'Handle', 'URL'])('accepts centrally changed formats for %s', name => {
    const metadata = [{ name, pattern: '^central-new-format$' }];
    expect(detection.classifyLocal('central-new-format', metadata).candidates).toEqual([name]);
    expect(detection.validateIdentifier('central-new-format', metadata[0])).toBe(true);
  });
  test.each(['https://arxiv.org/pdf/2507.21532v1.pdf', 'https://arxiv.org/abs/hep-th/9603067', 'https://www.arxiv.org/html/2507.21532'])('recognizes resolver %s', value => {
    expect(detection.classifyLocal(value, types).candidates).toEqual(['arXiv']);
  });
  test.each(['https://arxiv.org.evil.org/abs/2507.21532', 'https://arxiv.org@evil.org/abs/2507.21532'])('does not trust spoofed host %s', value => {
    expect(detection.classifyLocal(value, types).candidates).toEqual(['URL']);
  });
  test.each(['https://user@arxiv.org/abs/2507.21532', 'https://raid.org:444/10.82210/162fda4d'])('rejects altered resolver %s', value => {
    expect(detection.classifyLocal(value, types).status).toBe('invalid');
  });
  test.each(['978-3-510-96872-5', '978 3 510 96872 5', '0306406152', '0-8044-2957-X', 'ISBN:9783831048069', 'urn:isbn:9783831048069'])('validates ISBN %s', value => {
    expect(detection.validateIdentifier(value, detection.activeType('ISBN', types))).toBe(true);
  });
  test.each(['9783831048068', '9790060115615', '0--8044-2957-X', '030640615X', '123X456789', 'ISBN:'])('rejects ISBN %s', value => {
    expect(detection.validateIdentifier(value, detection.activeType('ISBN', types))).toBe(false);
  });
  test('accepts manual ISBN and EAN13 decisions for the same valid number', () => {
    expect(detection.validateIdentifier('9783831048069', detection.activeType('ISBN', types))).toBe(true);
    expect(detection.validateIdentifier('9783831048069', detection.activeType('EAN13', types))).toBe(true);
  });
  test.each(['DOI', 'IGSN', 'RAiD'])('validates a DOI resolver URL for %s', name => {
    expect(detection.validateIdentifier('HTTPS://DOI.ORG/10.60510/gf1211s-47', detection.activeType(name, types))).toBe(true);
  });
  test.each(['10.1234/ABC', 'https://doi.org/10.1234/ABC', 'https://dx.doi.org/10.1234/ABC', 'doi: 10.1234/ABC'])('normalizes DOI %s', value => {
    expect(detection.normalizeDoi(value)).toBe('10.1234/ABC');
  });
  test.each([
    ['https://doi.org/10.60510/gf1211s%2D47', '10.60510/gf1211s-47'],
    ['https://dx.doi.org/10.60510%2Fgf1211s%2d47', '10.60510/gf1211s-47'],
    ['https://doi.org/10.1234/a%252Db', '10.1234/a%2Db'],
    ['10.1234/a%2Db', '10.1234/a%2Db'],
  ])('decodes only the resolver path once: %s', (value, expected) => {
    expect(detection.normalizeDoi(value)).toBe(expected);
  });
  test.each(['%', '%2', '%GG', '%C3%28', '%20', '%0A'])('rejects malformed or whitespace resolver escapes %s', suffix => {
    expect(detection.normalizeDoi('https://doi.org/10.1234/test' + suffix)).toBeNull();
    expect(detection.classifyLocal('https://doi.org/10.1234/test' + suffix, types).status).toBe('invalid');
  });
  test('does not interpret text in a DOI suffix as an arXiv identifier', () => {
    expect(detection.classifyLocal('10.48550/arXiv.2507.21532', types).status).toBe('lookupRequired');
  });
  test.each([
    [], [{ name: 'DOI' }], [{ name: 'DOI', pattern: '^other-format$' }],
    [{ name: 'URL', pattern: '^https://doi\\.org/.+$' }],
  ].map(metadata => [metadata]))('does not start a registry lookup without a matching ERNIE DOI-family format: %j', metadata => {
    expect(detection.classifyLocal('https://doi.org/10.60510/gf1211s-47', metadata).status).toBe('unknown');
  });
  test('multiple vocabulary matches stay ambiguous and priority is ignored', () => {
    expect(detection.classifyLocal('urn:test:value', [
      { name: 'URN', patterns: { validation: [{ pattern: '^urn:.+$', priority: 100 }] } },
      { name: 'Custom', pattern: '^urn:test:value$', priority: 1 },
    ]).status).toBe('ambiguous');
  });
  test('only full matches count, including newline suffixes', () => {
    expect(detection.fullMatch('^abc$', 'abc\nx')).toBe(false);
    expect(detection.fullMatch('abc', 'xabc')).toBe(false);
    expect(detection.fullMatch('abc', 'abc')).toBe(true);
    expect(detection.fullMatch('abc|abcd', 'abcd')).toBe(true);
  });
  test('handles grouped patterns and preserves decoded backslashes', () => {
    expect(detection.patternsFor({ patterns: { validation: [{ pattern: '^foo$' }, { pattern: '^bar$' }] } })).toEqual(['^foo$', '^bar$']);
    expect(detection.normalizePattern(String.raw`^a\\b$`)).toBe(String.raw`^a\\b$`);
    expect(detection.normalizePattern(String.raw`/^\d{13}$/i`)).toBe(String.raw`^\d{13}$`);
    expect(detection.normalizePattern(String.raw`^\d{13}$/`)).toBe(String.raw`^\d{13}$`);
    expect(detection.normalizePattern('"^test$"')).toBe('^test$');
  });
  test('malformed and empty patterns produce no suggestions', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(detection.classifyLocal('xyz', [{ name: 'Broken', pattern: '(' }, { name: 'Empty' }]).status).toBe('unknown');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  test.each(types)('a narrow ERNIE pattern is not replaced for $name', type => {
    const knownInputs = {
      DOI: '10.1234/value', IGSN: 'GFZABC123', RAiD: 'https://raid.org/10.82210/162fda4d',
      arXiv: '2507.21532', ISBN: '978-3-510-96872-5', EAN13: '4006381333931',
      Handle: '1234/value', URL: 'https://example.org/page',
    };
    expect(detection.validateIdentifier(knownInputs[type.name], type)).toBe(true);
    const narrowed = { name: type.name, pattern: '^new-central-only$' };
    expect(detection.validateIdentifier(knownInputs[type.name], narrowed)).toBe(false);
  });
  test('empty or invalid grouped patterns cannot revive a legacy format', () => {
    for (const validation of [[], null, [null, {}, {pattern: ' '} ]]) {
      const type = {name: 'IGSN', pattern: '^GFZABC123$', patterns: {validation}};
      expect(detection.patternsFor(type)).toEqual([]);
      expect(detection.classifyLocal('GFZABC123', [type]).status).toBe('unknown');
    }
  });
  test('checksum rules supplement a permissive ERNIE format instead of being bypassed', () => {
    for (const name of ['ISBN', 'EAN13']) {
      expect(detection.validateIdentifier('9783831048068', {name, pattern: '^.+$'})).toBe(false);
    }
  });
  test('an unqualified number is not automatically a Handle even if its source pattern is broad', () => {
    expect(detection.classifyLocal('1234567890', [{name: 'Handle', pattern: '^\\d+$'}]).status).toBe('invalid');
  });
  test('active type comparisons preserve the vocabulary spelling', () => {
    expect(detection.activeType('raid', types).name).toBe('RAiD');
    expect(detection.validateIdentifier('value', {name: 'Custom'})).toBe(false);
    expect(detection.validateIdentifier('1234', detection.activeType('Handle', types))).toBe(false);
    expect(detection.validateIdentifier('javascript:alert(1)', detection.activeType('URL', types))).toBe(false);
  });
});

describe('confirmed registry lookup', () => {
  const confirmed = { status: 'detected', identifierType: 'IGSN', source: 'datacite' };
  test('deduplicates case-insensitive DOI requests and expires successful results', async () => {
    let now = 0;
    const request = jest.fn(async () => confirmed);
    const service = new detection.IdentifierDetectionService({ request, now: () => now });
    await Promise.all([service.lookup('10.1234/ABC'), service.lookup('10.1234/abc')]);
    await service.lookup('10.1234/ABC');
    expect(request).toHaveBeenCalledTimes(1);
    now = 21600001;
    await service.lookup('10.1234/abc');
    expect(request).toHaveBeenCalledTimes(2);
  });
  test.each([null, {}, { status: 'unknown', identifierType: 'DOI' }, { ...confirmed, source: 'unknown' }, { ...confirmed, identifierType: 'URL' }])('rejects unconfirmed responses %j and retries', async result => {
    const request = jest.fn(async () => result);
    const service = new detection.IdentifierDetectionService({ request });
    expect(await service.lookup('10.1234/abc')).toBeNull();
    await service.lookup('10.1234/abc');
    expect(request).toHaveBeenCalledTimes(2);
  });
  test('network failures do not select a type or poison retries', async () => {
    const request = jest.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(confirmed);
    const service = new detection.IdentifierDetectionService({ request });
    expect(await service.lookup('10.1234/abc')).toBeNull();
    expect(await service.lookup('10.1234/abc')).toEqual(confirmed);
  });
});
