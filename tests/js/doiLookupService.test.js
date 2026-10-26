const { requireFresh } = require('./utils');

let DoiLookupService;

function loadScript() {
  ({ DoiLookupService } = requireFresh('../../js/services/doiLookupService'));
}

describe('doiLookupService.js', () => {
  beforeEach(() => {
    document.head.innerHTML = '<base href="http://localhost/">';
    global.fetch = jest.fn();
    loadScript();
  });

  afterEach(() => {
    delete global.fetch;
  });

  describe('constructor', () => {
    test('uses base href with /api/v2 as default apiBaseUrl', () => {
      const service = new DoiLookupService();
      expect(service.apiBaseUrl).toBe('http://localhost/api/v2');
    });

    test('accepts custom apiBaseUrl and strips trailing slash', () => {
      const service = new DoiLookupService({ apiBaseUrl: 'https://example.com/' });
      expect(service.apiBaseUrl).toBe('https://example.com');
    });

    test('preserves apiBaseUrl without trailing slash', () => {
      const service = new DoiLookupService({ apiBaseUrl: 'https://example.com' });
      expect(service.apiBaseUrl).toBe('https://example.com');
    });
  });

  describe('lookupDoi', () => {
    test('calls correct URL with unencoded DOI', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ found: true, attributes: { doi: '10.1234/test' } }),
      });

      const service = new DoiLookupService({ apiBaseUrl: 'http://localhost/api/v2' });
      const result = await service.lookupDoi('10.1234/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost/api/v2/doi/lookup/10.1234/test',
        expect.objectContaining({ method: 'GET' })
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.found).toBe(true);
      expect(result.attributes.doi).toBe('10.1234/test');
    });

    test('preserves slashes in DOI path', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ found: true }),
      });

      const service = new DoiLookupService({ apiBaseUrl: 'http://localhost/api/v2' });
      await service.lookupDoi('10.1234/test');

      const url = global.fetch.mock.calls[0][0];
      expect(url).toBe('http://localhost/api/v2/doi/lookup/10.1234/test');
    });

    test('throws on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      });

      const service = new DoiLookupService({ apiBaseUrl: 'http://localhost/api/v2' });
      await expect(service.lookupDoi('10.1234/test')).rejects.toThrow('DOI lookup failed');
    });

    test('returns not-found result when DOI does not exist', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ found: false }),
      });

      const service = new DoiLookupService({ apiBaseUrl: 'http://localhost/api/v2' });
      const result = await service.lookupDoi('10.1234/notfound');

      expect(result.found).toBe(false);
    });
  });
});
