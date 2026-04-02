/**
 * Service for looking up DOI metadata from the DataCite API via the ELMO backend proxy.
 * Also supports fetching contact person data (email/website) from the local database.
 */
class DoiLookupService {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiBaseUrl] - Base URL for the API (auto-detected from <base> tag).
   * @param {Function} [options.fetch] - Custom fetch implementation (for testing).
   */
  constructor(options = {}) {
    this.fetchImpl = options.fetch || (typeof window !== 'undefined' ? window.fetch.bind(window) : null);
    this.apiBaseUrl = this.normalizeBaseUrl(options.apiBaseUrl ?? this.detectDefaultBaseUrl());
  }

  /**
   * Detects the API base URL from the page's <base> tag or falls back to a relative path.
   * @returns {string}
   */
  detectDefaultBaseUrl() {
    if (typeof document !== 'undefined') {
      const baseTag = document.querySelector('base[href]');
      if (baseTag) {
        const href = baseTag.getAttribute('href');
        try {
          const resolved = new URL(href, window.location.origin);
          return resolved.href.replace(/\/$/, '') + '/api/v2';
        } catch {
          // fall through
        }
      }
    }
    return './api/v2';
  }

  /**
   * Ensures the base URL has no trailing slash.
   * @param {string} url
   * @returns {string}
   */
  normalizeBaseUrl(url) {
    return url.replace(/\/+$/, '');
  }

  /**
   * Looks up DOI metadata from the DataCite API via the ELMO backend proxy.
   *
   * @param {string} doi - The DOI to look up (e.g. "10.14454/qdd3-ps68").
   * @returns {Promise<{found: boolean, attributes?: Object}>}
   */
  async lookupDoi(doi) {
    const url = `${this.apiBaseUrl}/doi/lookup/${doi}`;

    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok && response.status !== 200) {
      throw new Error(`DOI lookup failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Looks up contact person data (email, website) from the local database.
   *
   * @param {Object} params
   * @param {string} [params.orcid] - ORCID identifier.
   * @param {string} [params.familyname] - Family name for name-based lookup.
   * @param {string} [params.givenname] - Given name for name-based lookup.
   * @returns {Promise<{email: string|null, website: string|null}>}
   */
  async lookupContacts({ orcid, familyname, givenname } = {}) {
    const params = new URLSearchParams();
    if (orcid) params.set('orcid', orcid);
    if (familyname) params.set('familyname', familyname);
    if (givenname) params.set('givenname', givenname);

    const url = `${this.apiBaseUrl}/doi/contacts?${params.toString()}`;

    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return { email: null, website: null };
    }

    return response.json();
  }
}

// Export for testing (CommonJS) and browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DoiLookupService };
}
