const detection = require('../../js/services/identifierDetectionService.js');

const types = ['DOI', 'IGSN', 'RAiD', 'arXiv', 'ISBN', 'EAN13', 'Handle', 'URL'].map(name => ({ name, pattern: '.*' }));

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
    ['978--3-510-96872-5', 'invalid', []],
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
    expect(detection.classifyLocal('9783831048069', [{ name: 'ISBN' }]).status).toBe('ambiguous');
  });
  test('disabling a subtype never selects a generic URL', () => {
    const result = detection.classifyLocal('https://arxiv.org/abs/2507.21532', [{ name: 'URL' }]);
    expect(detection.activeType(result.candidates[0], [{ name: 'URL' }])).toBeNull();
  });
  test.each(['0706.0001', '1501.00001', 'arXiv:2507.21532v2', 'hep-th/9603067', 'math.GT/0309136v2'])('accepts arXiv %s', value => {
    expect(detection.validArxiv(value)).toBe(true);
  });
  test.each(['0703.0001', '1412.00001', '1501.0001', '2513.21532', '2500.21532', '2507.00000', '2507.21532v0', 'hep-th/0713067', 'hep-th/0801067'])('rejects arXiv %s', value => {
    expect(detection.validArxiv(value)).toBe(false);
  });
  test.each(['https://arxiv.org/pdf/2507.21532v1.pdf', 'https://arxiv.org/abs/hep-th/9603067', 'https://www.arxiv.org/html/2507.21532'])('recognizes resolver %s', value => {
    expect(detection.classifyLocal(value).candidates).toEqual(['arXiv']);
  });
  test.each(['https://arxiv.org.evil.org/abs/2507.21532', 'https://arxiv.org@evil.org/abs/2507.21532'])('does not trust spoofed host %s', value => {
    expect(detection.classifyLocal(value).candidates).toEqual(['URL']);
  });
  test.each(['https://user@arxiv.org/abs/2507.21532', 'https://raid.org:444/10.82210/162fda4d'])('rejects altered resolver %s', value => {
    expect(detection.classifyLocal(value).status).toBe('invalid');
  });
  test.each(['978-3-510-96872-5', '978 3 510 96872 5', '0306406152', '0-8044-2957-X', 'ISBN:9783831048069', 'urn:isbn:9783831048069'])('validates ISBN %s', value => {
    expect(detection.validIsbn(value)).toBe(true);
  });
  test.each(['9783831048068', '9790060115615', '0--8044-2957-X', '030640615X', '123X456789', 'ISBN:'])('rejects ISBN %s', value => {
    expect(detection.validIsbn(value)).toBe(false);
  });
  test('accepts manual ISBN and EAN13 decisions for the same valid number', () => {
    expect(detection.validateIdentifier('9783831048069', 'ISBN')).toBe(true);
    expect(detection.validateIdentifier('9783831048069', 'EAN13')).toBe(true);
  });
  test.each(['DOI', 'IGSN', 'RAiD'])('validates a DOI resolver URL for %s', name => {
    expect(detection.validateIdentifier('HTTPS://DOI.ORG/10.60510/gf1211s-47', name)).toBe(true);
  });
  test.each(['10.1234/ABC', 'https://doi.org/10.1234/ABC', 'https://dx.doi.org/10.1234/ABC', 'doi: 10.1234/ABC'])('normalizes DOI %s', value => {
    expect(detection.normalizeDoi(value)).toBe('10.1234/ABC');
  });
  test('does not interpret text in a DOI suffix as an arXiv identifier', () => {
    expect(detection.classifyLocal('10.48550/arXiv.2507.21532').status).toBe('lookupRequired');
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
  test('active type comparisons preserve the vocabulary spelling', () => {
    expect(detection.activeType('raid', types).name).toBe('RAiD');
    expect(detection.validateIdentifier('value', 'Custom')).toBeNull();
    expect(detection.validateIdentifier('1234', 'Handle')).toBe(false);
    expect(detection.validateIdentifier('javascript:alert(1)', 'URL')).toBe(false);
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
