/** Identifier formats, ambiguity checks and confirmed DOI classification. */
(function (root) {
  const DOI_PATTERN = '^(?:https?:\\/\\/(?:dx\\.)?doi\\.org\\/|doi:\\s*)?10\\.\\d{4,9}\\/[^\\s]+$';
  const DOI_REGEX = new RegExp(DOI_PATTERN, 'i');
  const LEGACY_IGSN = /^(?:[A-Z]{5}[A-Z0-9]{4}|(?:AU|SSH|BGR[A-Z]?|ICDP|CSR[A-Z]?|GFZ|MBCR|ARDC)[A-Z0-9]{2,12})$/i;
  const SPECIAL_TYPES = new Set(['doi', 'igsn', 'raid', 'arxiv', 'isbn', 'ean13', 'handle', 'url']);

  function normalizePattern(value) {
    let source = String(value || '').trim();
    if (source.startsWith('"') && source.endsWith('"')) source = source.slice(1, -1);
    const delimited = source.match(/^\/([\s\S]*)\/[iu]*$/);
    if (delimited) return delimited[1];
    // Old ELMO seeds used an unmatched delimiter immediately after the end anchor.
    return source.replace(/\$\/[iu]*$/, '$');
  }

  function patternsFor(type) {
    const grouped = type.patterns?.validation;
    return Array.isArray(grouped) && grouped.length
      ? grouped.map(entry => normalizePattern(entry.pattern)).filter(Boolean)
      : [normalizePattern(type.pattern)].filter(Boolean);
  }

  function fullMatch(pattern, identifier) {
    try {
      const match = new RegExp('(?:' + normalizePattern(pattern) + ')', 'i').exec(identifier);
      return Boolean(match && match.index === 0 && match[0].length === identifier.length);
    } catch (error) {
      console.warn('Invalid identifier pattern:', error);
      return false;
    }
  }

  function normalizeDoi(identifier) {
    const value = String(identifier || '').trim();
    return DOI_REGEX.test(value)
      ? value.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '')
      : null;
  }

  function validArxiv(value) {
    const identifier = value.replace(/^arxiv:\s*/i, '');
    const modern = identifier.match(/^(\d{2})(\d{2})\.(\d{4,5})(?:v([1-9]\d*))?$/);
    if (modern) {
      const date = Number(modern[1] + modern[2]);
      return Number(modern[2]) >= 1 && Number(modern[2]) <= 12 && date >= 704
        && modern[3].length === (date < 1501 ? 4 : 5) && Number(modern[3]) > 0;
    }
    const legacy = identifier.match(/^[a-z-]+(?:\.[a-z]{2})?\/(\d{2})(\d{2})(\d{3})(?:v([1-9]\d*))?$/i);
    if (!legacy) return false;
    const year = Number(legacy[1]) >= 91 ? 1900 + Number(legacy[1]) : 2000 + Number(legacy[1]);
    const date = year * 100 + Number(legacy[2]);
    return date >= 199107 && date <= 200703 && Number(legacy[2]) >= 1
      && Number(legacy[2]) <= 12 && Number(legacy[3]) > 0;
  }

  function checksum13(value) {
    if (!/^\d{13}$/.test(value)) return false;
    const sum = [...value.slice(0, 12)].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
    return Number(value[12]) === (10 - sum % 10) % 10;
  }

  function isbnValue(value) {
    const number = value.replace(/^(?:urn:)?isbn(?:-1[03])?:?\s*/i, '');
    if (!/^(?:\d+[- ])*[\dXx]+$/.test(number)) return null;
    return number.replace(/[- ]/g, '').toUpperCase();
  }

  function validIsbn(value) {
    const number = isbnValue(value);
    if (!number) return false;
    if (/^\d{9}[\dX]$/.test(number)) {
      return [...number].reduce((sum, digit, i) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - i), 0) % 11 === 0;
    }
    return /^(?:978|979[1-9])\d+$/.test(number) && checksum13(number);
  }

  function parsedUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !/\s/.test(value) ? url : null;
    } catch { return null; }
  }

  function resolverType(value) {
    const url = parsedUrl(value);
    if (!url) return null;
    const trusted = !url.username && !url.password && !url.port;
    if (['arxiv.org', 'www.arxiv.org'].includes(url.hostname)) {
      const path = url.pathname.match(/^\/(?:abs|pdf|html|src)\/(.+)$/);
      if (!path) return /^\/(?:abs|pdf|html|src)(?:\/|$)/.test(url.pathname) ? false : null;
      return trusted && validArxiv(path[1].replace(/\.pdf$/, '')) ? 'arXiv' : false;
    }
    if (url.hostname === 'raid.org') {
      if (url.pathname === '/') return null;
      return trusted && /^10\.\d{4,9}\/[A-Za-z0-9._-]+$/.test(url.pathname.slice(1)) ? 'RAiD' : false;
    }
    if (['doi.org', 'dx.doi.org'].includes(url.hostname)) return false;
    return null;
  }

  /** null means this type needs its vocabulary-provided validator. */
  function validateIdentifier(identifier, name) {
    const value = String(identifier || '').trim();
    switch (String(name).toLowerCase()) {
      case 'doi': return normalizeDoi(value) !== null;
      case 'igsn': return normalizeDoi(value) !== null || LEGACY_IGSN.test(value);
      case 'raid': return normalizeDoi(value) !== null || resolverType(value) === 'RAiD';
      case 'arxiv': return validArxiv(value) || resolverType(value) === 'arXiv';
      case 'isbn': return validIsbn(value);
      case 'ean13': return checksum13(value);
      case 'handle': return /^(?:hdl:|https?:\/\/hdl\.handle\.net\/)?\d+(?:\.\w+)*\/\S+$/i.test(value);
      case 'url': return parsedUrl(value) !== null;
      default: return null;
    }
  }

  function classifyLocal(identifier, types = []) {
    const value = String(identifier || '').trim();
    const result = (status, candidates = [], doi = null) => ({ status, candidates, doi });
    if (!value) return result('unknown');
    const doi = normalizeDoi(value);
    if (doi) return result('lookupRequired', ['DOI', 'IGSN', 'RAiD'], doi);
    const resolver = resolverType(value);
    if (resolver === false) return result('invalid');
    if (resolver) return result('detected', [resolver]);

    const candidates = [];
    if (validArxiv(value)) candidates.push('arXiv');
    if (LEGACY_IGSN.test(value)) candidates.push('IGSN');
    if (validIsbn(value)) candidates.push('ISBN');
    if (checksum13(value)) candidates.push('EAN13');
    if (validateIdentifier(value, 'Handle')) candidates.push('Handle');
    for (const type of types) {
      if (!SPECIAL_TYPES.has(String(type.name).toLowerCase()) && patternsFor(type).some(pattern => fullMatch(pattern, value))) {
        candidates.push(type.name);
      }
    }
    const unique = [...new Map(candidates.map(name => [name.toLowerCase(), name])).values()];
    if (unique.length > 1) return result('ambiguous', unique);
    if (unique.length === 1) return result('detected', unique);
    if (/^(?:urn:)?isbn/i.test(value) || /^[\dXx -]{10,}$/.test(value)
      || /^arxiv:/i.test(value) || /^10\./.test(value)) return result('invalid');
    return parsedUrl(value) ? result('detected', ['URL']) : result('unknown');
  }

  function activeType(name, types) {
    return types.find(type => String(type.name).toLowerCase() === String(name).toLowerCase()) || null;
  }

  class IdentifierDetectionService {
    constructor({ request, now = Date.now } = {}) {
      this.request = request;
      this.now = now;
      this.pending = new Map();
      this.cache = new Map();
    }

    lookup(doi) {
      const key = doi.toLowerCase();
      const cached = this.cache.get(key);
      if (cached && cached.expires > this.now()) return Promise.resolve(cached.result);
      if (this.pending.has(key)) return this.pending.get(key);
      const request = Promise.resolve().then(() => this.request(doi)).then(result => {
        if (result?.status !== 'detected' || !['DOI', 'IGSN', 'RAiD'].includes(result.identifierType)
          || !['datacite', 'crossref'].includes(result.source)) return null;
        this.cache.set(key, { result, expires: this.now() + 21600000 });
        return result;
      }).catch(() => null).finally(() => this.pending.delete(key));
      this.pending.set(key, request);
      return request;
    }
  }

  const api = { DOI_PATTERN, normalizePattern, patternsFor, fullMatch, normalizeDoi, validArxiv,
    checksum13, validIsbn, validateIdentifier, classifyLocal, activeType, IdentifierDetectionService };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.elmoIdentifierDetection = api;
})(typeof window !== 'undefined' ? window : null);
