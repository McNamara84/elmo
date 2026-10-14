/**
 * Identifier formats, ambiguity checks and confirmed DOI classification.
 *
 * @typedef {Object} IdentifierType
 * @property {string} name Vocabulary spelling of the identifier type.
 * @property {string} [pattern] Legacy validation expression.
 * @property {{validation?: Array<{pattern: string}>}} [patterns] Grouped ERNIE expressions.
 *
 * @typedef {Object} LocalIdentifierClassification
 * @property {'detected'|'ambiguous'|'invalid'|'unknown'|'lookupRequired'} status
 * @property {string[]} candidates Matching formats, before filtering active types.
 * @property {string|null} doi Bare DOI requiring registry confirmation.
 *
 * @typedef {Object} ConfirmedIdentifierType
 * @property {'detected'} status
 * @property {'DOI'|'IGSN'|'RAiD'} identifierType
 * @property {'datacite'|'crossref'} source
 */
(function (root) {
  /** Removes legacy delimiters without decoding JSON escapes a second time. */
  function normalizePattern(value) {
    if (typeof value !== 'string') return '';
    let source = value.trim();
    if (source.startsWith('"') && source.endsWith('"')) source = source.slice(1, -1);
    const delimited = source.match(/^\/([\s\S]*)\/[iu]*$/);
    return delimited ? delimited[1] : source.replace(/\$\/[iu]*$/, '$');
  }

  /**
   * Reads ERNIE validation alternatives; an explicit empty list stays empty.
   * @param {IdentifierType} type Vocabulary metadata.
   * @returns {string[]} Delivered validation expressions.
   */
  function patternsFor(type) {
    if (type.patterns && Object.hasOwn(type.patterns, 'validation')) {
      const grouped = type.patterns.validation;
      return Array.isArray(grouped)
        ? grouped.map(entry => normalizePattern(entry?.pattern)).filter(Boolean) : [];
    }
    return [normalizePattern(type.pattern)].filter(Boolean);
  }

  /**
   * Matches complete input against a delivered vocabulary expression.
   * @param {string} pattern Expression from ERNIE or its synchronized cache.
   * @param {string} identifier Input to validate.
   * @returns {boolean} Whether the complete input matches.
   */
  function fullMatch(pattern, identifier) {
    try {
      const match = new RegExp('^(?:' + normalizePattern(pattern) + ')$', 'i').exec(identifier);
      return Boolean(match && match.index === 0 && match[0].length === identifier.length);
    } catch (error) {
      console.warn('Invalid identifier pattern:', error);
      return false;
    }
  }

  function parsedUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !/\s/.test(value) ? url : null;
    } catch { return null; }
  }

  /**
   * Extracts a DOI for the registry endpoint; this does not validate a field's format.
   * Accepted input forms and a confirmed subtype still have to match ERNIE's pattern.
   * @param {string} identifier Entered identifier.
   * @returns {string|null} Potential bare DOI for backend verification.
   */
  function normalizeDoi(identifier) {
    let value = String(identifier || '').trim();
    if (value.toLowerCase().startsWith('doi:')) value = value.slice(4).trim();
    const url = parsedUrl(value);
    if (url && ['doi.org', 'dx.doi.org'].includes(url.hostname)
      && !url.username && !url.password && !url.port && !url.search && !url.hash) {
      value = url.pathname.slice(1);
    }
    return value.startsWith('10.') && value.includes('/') && !/\s/.test(value) ? value : null;
  }

  /** @returns {boolean} Whether the unformatted EAN13 check digit is correct. */
  function checksum13(value) {
    if (!/^\d{13}$/.test(value)) return false;
    const sum = [...value.slice(0, 12)].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
    return Number(value[12]) === (10 - sum % 10) % 10;
  }

  /**
   * Checks ISBN arithmetic after removing common prefixes and separators.
   * Prefix/range and separator-format restrictions are supplied by ERNIE.
   * @param {string} value Entered ISBN.
   * @returns {boolean} Whether the ISBN-10/13 check digit is correct.
   */
  function validIsbn(value) {
    const number = value.replace(/^(?:urn:)?isbn(?:-1[03])?:?\s*/i, '').replace(/[- ]/g, '').toUpperCase();
    if (/^\d{9}[\dX]$/.test(number)) {
      return [...number].reduce((sum, digit, i) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - i), 0) % 11 === 0;
    }
    return checksum13(number);
  }

  /**
   * Adds check digits to the vocabulary's format validation.
   * @param {string} identifier Entered identifier.
   * @param {string} name Vocabulary type name.
   * @returns {boolean} Whether the additional semantic checks succeed.
   */
  function passesAdditionalChecks(identifier, name) {
    const value = String(identifier || '').trim();
    switch (String(name).toLowerCase()) {
      case 'isbn': return validIsbn(value);
      case 'ean13': return checksum13(value);
      default: return true;
    }
  }

  /**
   * Requires a delivered format match as well as any supplementary check digits.
   * @param {string} identifier Entered identifier.
   * @param {IdentifierType} type ERNIE metadata for the selected type.
   * @returns {boolean} Whether the vocabulary and semantic checks accept the input.
   */
  function validateIdentifier(identifier, type) {
    const value = String(identifier || '').trim();
    return patternsFor(type).some(pattern => fullMatch(pattern, value)) && passesAdditionalChecks(value, type.name);
  }

  // Recognized namespaces prevent a rejected specific identifier from becoming a generic URL.
  // They do not provide format validators: ERNIE must accept the entire input.
  function resolverType(value) {
    const url = parsedUrl(value);
    if (!url) return null;
    const trusted = !url.username && !url.password && !url.port;
    if (['arxiv.org', 'www.arxiv.org'].includes(url.hostname)) {
      const paths = ['abs', 'pdf', 'html', 'src'];
      if (!paths.some(path => url.pathname.startsWith('/' + path + '/') || url.pathname === '/' + path)) return null;
      return trusted ? 'arXiv' : false;
    }
    if (url.hostname === 'raid.org' && url.pathname !== '/') return trusted ? 'RAiD' : false;
    if (['doi.org', 'dx.doi.org'].includes(url.hostname)) return false;
    return null;
  }

  /**
   * Uses ERNIE format matches, with registry evidence for DOI subtypes and semantic
   * ambiguity safeguards for unqualified ISBN13/EAN13 numbers. No priority wins a tie.
   * @param {string} identifier Entered identifier.
   * @param {IdentifierType[]} [types=[]] Delivered active vocabulary metadata.
   * @returns {LocalIdentifierClassification} Matches or required registry verification.
   */
  function classifyLocal(identifier, types = []) {
    const value = String(identifier || '').trim();
    const result = (status, candidates = [], doi = null) => ({ status, candidates, doi });
    if (!value) return result('unknown');
    const formatMatches = types.filter(type => patternsFor(type).some(pattern => fullMatch(pattern, value)));
    const doi = normalizeDoi(value);
    if (doi) return formatMatches.some(type => ['doi', 'igsn', 'raid'].includes(String(type.name).toLowerCase()))
      ? result('lookupRequired', ['DOI', 'IGSN', 'RAiD'], doi) : result('unknown');
    const namespace = resolverType(value);
    if (namespace === false) return result('invalid');
    const matches = formatMatches.filter(type => passesAdditionalChecks(value, type.name)
      && !(String(type.name).toLowerCase() === 'handle' && /^\d+$/.test(value)));
    if (namespace) {
      return matches.some(type => String(type.name).toLowerCase() === namespace.toLowerCase())
        ? result('detected', [namespace]) : result('invalid');
    }
    // Disabled EAN13/ISBN options must not turn a plain book barcode into certainty.
    if (checksum13(value) && (value.startsWith('978') || (value.startsWith('979') && value[3] !== '0'))
      && matches.some(type => ['isbn', 'ean13'].includes(String(type.name).toLowerCase()))) {
      return result('ambiguous', ['ISBN', 'EAN13']);
    }
    const specific = matches.filter(type => String(type.name).toLowerCase() !== 'url');
    const candidates = (specific.length ? specific : matches).map(type => type.name);
    const unique = [...new Map(candidates.map(name => [name.toLowerCase(), name])).values()];
    if (unique.length > 1) return result('ambiguous', unique);
    if (unique.length === 1 && String(unique[0]).toLowerCase() === 'doi') return result('unknown');
    if (unique.length === 1) return result('detected', unique);
    return result(formatMatches.length ? 'invalid' : 'unknown');
  }

  /** Finds an offered type while preserving ERNIE's spelling. */
  function activeType(name, types) {
    return types.find(type => String(type.name).toLowerCase() === String(name).toLowerCase()) || null;
  }

  /** Shares pending DOI lookups and caches only successful registry confirmations. */
  class IdentifierDetectionService {
    /**
     * @param {Object} [options={}] Transport and clock dependencies.
     * @param {function(string): Promise<Object>} options.request ELMO registry endpoint transport.
     * @param {function(): number} [options.now=Date.now] Current time in milliseconds.
     */
    constructor({ request, now = Date.now } = {}) {
      this.request = request;
      this.now = now;
      this.pending = new Map();
      this.cache = new Map();
    }

    /**
     * Deduplicates case-insensitive requests; failed and unknown results can be retried.
     * @param {string} doi Bare DOI already checked by the local classifier.
     * @returns {Promise<ConfirmedIdentifierType|null>} Trusted confirmation, or null.
     */
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

  const api = { normalizePattern, patternsFor, fullMatch, normalizeDoi, checksum13, validIsbn,
    passesAdditionalChecks, validateIdentifier, classifyLocal, activeType, IdentifierDetectionService };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.elmoIdentifierDetection = api;
})(typeof window !== 'undefined' ? window : null);
