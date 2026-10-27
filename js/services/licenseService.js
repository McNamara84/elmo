/** Shared resource-type license selection, portable metadata and request ordering. */
(function (root) {
  'use strict';

  const messages = {
    chooseType: 'Choose a Resource Type first.',
    loading: 'Loading licenses...',
    empty: 'No licenses are currently allowed for this Resource Type.',
    unavailable: 'Licenses are currently unavailable. Please try again later.',
    retained: 'This license is not currently allowed. You can keep it in a draft or export, but must choose an allowed license before submitting.',
    choose: 'Choose a license...',
  };
  const spdx = scheme => ['https://spdx.org/licenses', 'https://spdx.org/licenses/'].includes(scheme);
  const metadata = row => ({
    identifier: row.identifier ?? row.rightsIdentifier ?? null,
    name: row.name ?? row.text ?? '',
    uri: row.uri ?? row.rightsURI ?? null,
    scheme_uri: row.scheme_uri ?? row.schemeURI ?? null,
    scheme_name: row.scheme_name ?? row.schemeName ?? null,
  });
  const identity = row => JSON.stringify([
    spdx(row.scheme_uri) ? 'SPDX' : row.scheme_uri,
    spdx(row.scheme_uri) ? row.identifier?.toLowerCase() : row.identifier,
  ]);

  /** @param {object} saved Portable license metadata. @param {object} candidate API metadata. */
  function matches(saved, candidate) {
    if (saved.identifier) {
      return identity(saved) === identity(candidate) && (!saved.uri || saved.uri === candidate.uri);
    }
    return Boolean(saved.uri && saved.uri === candidate.uri);
  }

  class LicenseSelection {
    constructor() {
      this.selection = null;
      this.rows = [];
      this.state = 'chooseType';
      this.revision = 0;
      this.ready = Promise.resolve();
      this.allowDefault = true;
    }

    get select() { return document.getElementById('input-rights-license'); }

    /** Initialize lazily so the same service works in full forms and import fixtures. */
    bind() {
      const select = this.select;
      if (!select || select.dataset.licenseBound) return;
      select.dataset.licenseBound = 'true';
      const changed = () => {
        const row = this.rows.find(item => String(item.rights_id) === select.value);
        if (row) this.selection = metadata(row);
        else if (!select.value) this.selection = null;
        this.render();
      };
      // jQuery-triggered changes are used by existing import/form code as well.
      if (root.jQuery) root.jQuery(select).on('change.licenseSelection', changed);
      else select.addEventListener('change', changed);
    }

    text(key) { return root.translations?.rights?.availability?.[key] || messages[key]; }

    /** @returns {Promise<void>} Resolves after the latest resource-type list is rendered. */
    load(resourceTypeId = document.getElementById('input-resourceinformation-resourcetype')?.value) {
      this.bind();
      const revision = ++this.revision;
      this.rows = [];
      this.state = resourceTypeId ? 'loading' : 'chooseType';
      this.render();
      if (!resourceTypeId || !this.select) return (this.ready = Promise.resolve());
      this.ready = (async () => {
        try {
          const response = await root.fetch('api/v2/vocabs/licenses/resource-type/' + encodeURIComponent(resourceTypeId));
          const body = await response.json();
          if (revision !== this.revision) return;
          if (!response.ok || !Array.isArray(body.licenses) || !['available', 'empty'].includes(body.availability)) {
            throw new Error('License list unavailable.');
          }
          this.rows = body.licenses;
          this.state = this.rows.length ? 'available' : 'empty';
          this.selectDefault();
        } catch (_) {
          if (revision !== this.revision) return;
          this.state = 'unavailable';
          this.rows = [];
        }
        this.render();
      })();
      return this.ready;
    }

    /** Default only an empty selection, using an explicitly allowed SPDX license. */
    selectDefault() {
      if (!this.allowDefault || this.selection || this.state !== 'available') return;
      const row = this.rows.find(item => item.rightsIdentifier?.toUpperCase() === 'CC-BY-4.0' && spdx(item.schemeURI));
      if (row) this.selection = metadata(row);
    }

    /** Preserve imported metadata, even when it is absent from current grants. */
    setMetadata(value) {
      this.allowDefault = false;
      this.selection = value ? metadata(value) : null;
      return this.load();
    }

    /** @returns {object|null} Metadata independent of any temporary local ID. */
    getMetadata() { return this.selection ? { ...this.selection } : null; }

    reset() {
      this.allowDefault = true;
      this.selection = null;
      return this.load();
    }

    render() {
      const select = this.select;
      if (!select) { this.syncPayload(); return; }
      const candidates = this.selection ? this.rows.filter(row => matches(this.selection, metadata(row))) : [];
      const chosen = candidates.length === 1 ? candidates[0] : null;
      const retained = this.selection && !chosen;
      select.replaceChildren(new Option(this.text(this.state === 'available' ? 'choose' : this.state), ''));
      for (const row of this.rows) {
        select.add(new Option(row.text + (row.rightsIdentifier ? ' (' + row.rightsIdentifier + ')' : ''), String(row.rights_id)));
      }
      if (retained) {
        select.add(new Option(this.selection.name || this.selection.identifier || this.selection.uri, '__retained__'));
      }
      select.value = chosen ? String(chosen.rights_id) : (retained ? '__retained__' : '');
      select.disabled = ['loading', 'chooseType'].includes(this.state);
      const problem = retained ? 'retained' : (this.state === 'available' ? null : this.state);
      select.setCustomValidity(problem ? this.text(problem) : '');
      const status = document.getElementById('license-availability');
      if (status) status.textContent = problem ? this.text(problem) : '';
      this.syncPayload();
    }

    /** Keep portable metadata in FormData even when the license group is hidden. */
    syncPayload() {
      let payload = document.querySelector('[name="licensePayload"]');
      if (!payload) {
        const parent = this.select?.parentElement || document.querySelector('form');
        if (!parent) return;
        payload = document.createElement('input');
        payload.type = 'hidden';
        payload.name = 'licensePayload';
        parent.append(payload);
      }
      payload.value = JSON.stringify({ version: 1, license: this.selection });
    }
  }

  root.elmo = root.elmo || {};
  root.elmo.licenses = new LicenseSelection();
  document.addEventListener('translationsLoaded', () => root.elmo.licenses.render());
  if (typeof module !== 'undefined' && module.exports) module.exports = { LicenseSelection, matches, metadata };
})(typeof window !== 'undefined' ? window : globalThis);
