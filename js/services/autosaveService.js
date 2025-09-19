class AutosaveService {
  constructor(formId, options = {}) {
    this.form = typeof formId === 'string' ? document.getElementById(formId) : formId;
    this.statusElement = this.resolveElement(options.statusElementId || 'autosave-status', options.statusElement);
    this.statusTextElement = this.resolveElement(options.statusTextId || 'autosave-status-text');
    this.statusLabelElement = this.resolveElement(options.statusLabelId || 'autosave-status-label', options.statusLabelElement);
    this.statusHeadingElement = this.resolveElement(options.statusHeadingId || 'autosave-status-heading', options.statusHeadingElement);
    this.restoreModalId = options.restoreModalId || 'modal-restore-draft';
    this.restoreApplyId = options.restoreApplyButtonId || 'button-restore-apply';
    this.restoreDismissId = options.restoreDismissButtonId || 'button-restore-dismiss';
    this.fetchImpl = options.fetch || (typeof window !== 'undefined' ? window.fetch.bind(window) : null);
    this.apiBaseUrl = this.normalizeBaseUrl(options.apiBaseUrl ?? this.detectDefaultBaseUrl());
    this.throttleMs = options.throttleMs ?? 15000;
    this.localStorageKey = options.localStorageKey || 'elmo.autosave.draftId';

    this.translationFn = this.resolveTranslator(options.translate);
    this.activeTranslations = options.translations || null;
    this.currentState = 'idle';
    this.currentDetail = '';

    this.pendingTimeout = null;
    this.isSaving = false;
    this.activeRequest = null;
    this.draftId = this.readStoredDraftId();
    this.lastSavedPayloadHash = null;
    this.lastSavedAt = null;
    this.pendingRestoreRecord = null;

    this.handleInput = this.handleInput.bind(this);
    this.applyPendingRestore = this.applyPendingRestore.bind(this);
    this.handleRestoreDismiss = this.handleRestoreDismiss.bind(this);
    this.boundHandleTranslationsLoaded = this.handleTranslationsLoaded.bind(this);

    this.restoreModal = null;
    this.restoreDescriptionElement = null;

    if (typeof document !== 'undefined') {
      document.addEventListener('translationsLoaded', this.boundHandleTranslationsLoaded, { passive: true });
    }
  }

  resolveElement(id, explicit) {
    if (explicit) {
      return explicit;
    }
    return id ? document.getElementById(id) : null;
  }

  detectDefaultBaseUrl() {
    if (typeof document !== 'undefined') {
      const baseTag = document.querySelector('base[href]');
      const baseHref = baseTag ? baseTag.getAttribute('href') : null;

      if (baseHref) {
        if (/^https?:\/\//i.test(baseHref) || baseHref.startsWith('//')) {
          try {
            const resolved = new URL(baseHref, typeof window !== 'undefined' ? window.location.origin : undefined);
            return `${resolved.origin}${resolved.pathname.replace(/\/+$/, '')}/api/v2`;
          } catch (error) {
            // Fall back to relative default below.
          }
        }

        if (baseHref.startsWith('/')) {
          return `${baseHref.replace(/\/+$/, '')}/api/v2`;
        }

        if (baseHref.startsWith('./') || baseHref.startsWith('../')) {
          return `${baseHref.replace(/\/+$/, '')}/api/v2`;
        }
      }
    }

    return './api/v2';
  }

  normalizeBaseUrl(url) {
    if (!url) {
      return '';
    }

    const trimmed = url.trim();
    if (trimmed === '') {
      return '';
    }

    const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

    if (/^https?:\/\//i.test(withoutTrailingSlash) || withoutTrailingSlash.startsWith('//')) {
      return withoutTrailingSlash;
    }

    if (withoutTrailingSlash.startsWith('/')) {
      return withoutTrailingSlash;
    }

    if (withoutTrailingSlash.startsWith('./') || withoutTrailingSlash.startsWith('../')) {
      return withoutTrailingSlash;
    }

    return `./${withoutTrailingSlash}`;
  }

  buildUrl(path) {
    const safePath = String(path ?? '').replace(/^\/+/, '');
    if (!safePath) {
      return this.apiBaseUrl || '';
    }

    if (!this.apiBaseUrl) {
      return `/${safePath}`;
    }

    return `${this.apiBaseUrl}/${safePath}`;
  }

  start() {
    if (!this.form || !this.fetchImpl) {
      return;
    }

    this.registerRestoreModal();
    this.form.addEventListener('input', this.handleInput, true);
    this.form.addEventListener('change', this.handleInput, true);

    this.updateStatus('idle');
    this.refreshTranslations();
    this.checkForExistingDraft();
  }

  registerRestoreModal() {
    const modalElement = document.getElementById(this.restoreModalId);
    if (modalElement && typeof bootstrap !== 'undefined' && typeof bootstrap.Modal === 'function') {
      this.restoreModal = new bootstrap.Modal(modalElement, { backdrop: 'static' });
      this.restoreDescriptionElement = modalElement.querySelector('#modal-restore-draft-description');
    }

    const applyButton = document.getElementById(this.restoreApplyId);
    const dismissButton = document.getElementById(this.restoreDismissId);

    if (applyButton) {
      applyButton.addEventListener('click', this.applyPendingRestore);
    }

    if (dismissButton) {
      dismissButton.addEventListener('click', this.handleRestoreDismiss);
    }
  }

  handleInput() {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
    }

    this.pendingTimeout = window.setTimeout(() => {
      this.pendingTimeout = null;
      this.persistDraft();
    }, this.throttleMs);

    this.updateStatus('pending');
  }

  async persistDraft(force = false) {
    if (!this.form || !this.fetchImpl) {
      return Promise.resolve();
    }

    if (this.isSaving) {
      return this.activeRequest ?? Promise.resolve();
    }

    const values = this.serializeValues();
    const payloadHash = JSON.stringify(values);

    if (!force && payloadHash === this.lastSavedPayloadHash) {
      this.updateStatus('synced');
      return Promise.resolve();
    }

    const body = {
      payload: {
        values,
        timestamp: new Date().toISOString()
      }
    };

    const url = this.draftId
      ? this.buildUrl(`drafts/${this.draftId}`)
      : this.buildUrl('drafts');
    const method = this.draftId ? 'PUT' : 'POST';

    this.isSaving = true;
    this.updateStatus('saving');

    const request = this.fetchImpl(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorMessage = await this.extractErrorMessage(response);
          throw new Error(errorMessage || `Autosave failed with status ${response.status}`);
        }

        const data = response.status === 204 ? null : await response.json();
        this.draftId = data?.id || this.draftId;
        this.storeDraftId(this.draftId);
        this.lastSavedPayloadHash = payloadHash;
        this.lastSavedAt = data?.updatedAt ? new Date(data.updatedAt) : new Date();
        this.updateStatus('synced');
      })
      .catch((error) => {
        this.updateStatus('error', error.message);
      })
      .finally(() => {
        this.isSaving = false;
        this.activeRequest = null;
      });

    this.activeRequest = request;
    return request;
  }

  async flushPending() {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
      return this.persistDraft(true);
    }

    if (this.activeRequest) {
      return this.activeRequest;
    }

    return Promise.resolve();
  }

  async markManualSave() {
    await this.flushPending();
    if (this.lastSavedAt) {
      this.updateStatus('manual');
    }
  }

  async clearDraft() {
    if (!this.fetchImpl) {
      return;
    }

    if (this.draftId) {
      try {
        await this.fetchImpl(this.buildUrl(`drafts/${this.draftId}`), {
          method: 'DELETE',
          credentials: 'include'
        });
      } catch (error) {
        this.updateStatus('error', error.message);
        return;
      }
    }

    this.draftId = null;
    this.lastSavedPayloadHash = null;
    this.lastSavedAt = null;
    this.removeStoredDraftId();
    this.updateStatus('cleared');
  }

  async checkForExistingDraft() {
    if (!this.fetchImpl) {
      return;
    }

    const endpoint = this.draftId
      ? this.buildUrl(`drafts/${this.draftId}`)
      : this.buildUrl('drafts/session/latest');

    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.status === 204 || response.status === 404) {
        return;
      }

      if (!response.ok) {
        const errorMessage = await this.extractErrorMessage(response);
        this.updateStatus('error', errorMessage || 'Unable to load autosaved draft');
        return;
      }

      const record = await response.json();
      if (!record || !record.payload || !record.payload.values) {
        return;
      }

      this.draftId = record.id;
      this.storeDraftId(this.draftId);

      const currentHash = JSON.stringify(this.serializeValues());
      const savedHash = JSON.stringify(record.payload.values);

      if (currentHash === savedHash) {
        this.lastSavedPayloadHash = savedHash;
        this.lastSavedAt = record.updatedAt ? new Date(record.updatedAt) : new Date();
        this.updateStatus('synced');
        return;
      }

      this.pendingRestoreRecord = record;
      this.promptRestore(record);
    } catch (error) {
      this.updateStatus('error', error.message);
    }
  }

  promptRestore(record) {
    const message = this.getRestoreMessage(record);

    if (this.restoreDescriptionElement) {
      this.restoreDescriptionElement.textContent = message;
    }

    if (this.restoreModal) {
      this.restoreModal.show();
    } else if (typeof window !== 'undefined' && window.confirm) {
      const accept = window.confirm(message);
      if (accept) {
        this.applyPendingRestore();
      } else {
        this.handleRestoreDismiss();
      }
    }
  }

  applyPendingRestore() {
    if (!this.pendingRestoreRecord || !this.pendingRestoreRecord.payload) {
      return;
    }

    this.applyDraftValues(this.pendingRestoreRecord.payload.values || {});
    this.lastSavedPayloadHash = JSON.stringify(this.pendingRestoreRecord.payload.values || {});
    this.lastSavedAt = this.pendingRestoreRecord.updatedAt
      ? new Date(this.pendingRestoreRecord.updatedAt)
      : new Date();
    this.draftId = this.pendingRestoreRecord.id || this.draftId;
    this.storeDraftId(this.draftId);
    this.pendingRestoreRecord = null;

    if (this.restoreModal) {
      this.restoreModal.hide();
    }

    this.updateStatus('synced');
  }

  handleRestoreDismiss() {
    this.pendingRestoreRecord = null;
    if (this.restoreModal) {
      this.restoreModal.hide();
    }
    this.clearDraft();
  }

  applyDraftValues(values) {
    if (!this.form || !values) {
      return;
    }

    this.prepareArrayFields(values);

    const elements = Array.from(this.form.elements);
    const handledNames = new Set(Object.keys(values));
    const arrayPositions = new Map();

    elements.forEach((element) => {
      if (!element.name || element.disabled) {
        return;
      }

      const type = (element.type || element.tagName).toLowerCase();
      const value = values[element.name];
      const isArrayField = Array.isArray(value) && this.isArrayFieldName(element.name);

      if (type === 'checkbox') {
        const expected = Array.isArray(value) ? value : [];
        element.checked = expected.includes(element.value);
      } else if (type === 'radio') {
        element.checked = value === element.value;
      } else if (element.multiple) {
        const options = Array.isArray(value) ? value : [];
        Array.from(element.options).forEach((option) => {
          option.selected = options.includes(option.value);
        });
      } else if (isArrayField) {
        const index = arrayPositions.get(element.name) ?? 0;
        const nextValue = value[index];
        arrayPositions.set(element.name, index + 1);
        element.value = nextValue ?? '';
      } else if (value !== undefined) {
        element.value = value;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Uncheck checkboxes or radios that were not part of the saved values
    elements.forEach((element) => {
      if (!element.name || element.disabled) {
        return;
      }
      const type = (element.type || element.tagName).toLowerCase();
      if (!handledNames.has(element.name)) {
        if (type === 'checkbox' || type === 'radio') {
          element.checked = false;
        }
      }
    });
  }

  serializeValues() {
    if (!this.form) {
      return {};
    }

    const values = {};
    const elements = Array.from(this.form.elements);

    elements.forEach((element) => {
      if (!element.name || element.disabled) {
        return;
      }

      const type = (element.type || element.tagName).toLowerCase();
      if (['submit', 'button', 'reset', 'image'].includes(type)) {
        return;
      }

      if (type === 'file') {
        return;
      }

      if (type === 'checkbox') {
        const arr = Array.isArray(values[element.name]) ? values[element.name] : [];
        if (element.checked) {
          arr.push(element.value);
        }
        values[element.name] = arr;
        return;
      }

      if (type === 'radio') {
        if (!Object.prototype.hasOwnProperty.call(values, element.name)) {
          values[element.name] = null;
        }
        if (element.checked) {
          values[element.name] = element.value;
        }
        return;
      }

      if (element.multiple) {
        values[element.name] = Array.from(element.selectedOptions).map((option) => option.value);
        return;
      }

      if (this.isArrayFieldName(element.name)) {
        const arr = Array.isArray(values[element.name]) ? values[element.name] : [];
        arr.push(element.value);
        values[element.name] = arr;
        return;
      }

      values[element.name] = element.value;
    });

    return values;
  }

  prepareArrayFields(values) {
    if (!this.form || !values) {
      return;
    }

    const repeatableEntries = Object.entries(values)
      .filter(([name, value]) => this.isArrayFieldName(name) && Array.isArray(value) && value.length > 1)
      .sort(([, valueA], [, valueB]) => valueB.length - valueA.length);

    repeatableEntries.forEach(([name, value]) => {
      this.ensureArrayFieldCapacity(name, value.length);
    });
  }

  ensureArrayFieldCapacity(name, requiredCount) {
    if (!this.form || !name || requiredCount <= 1) {
      return;
    }

    const safeName = this.escapeNameForSelector(name);
    if (!safeName) {
      return;
    }

    let elements = this.form.querySelectorAll(`[name="${safeName}"]`);
    if (!elements.length) {
      return;
    }

    const addButton = this.findAddButtonForElement(elements[0]);
    let previousLength = elements.length;

    while (elements.length < requiredCount) {
      let changed = false;

      if (addButton) {
        addButton.click();
        elements = this.form.querySelectorAll(`[name="${safeName}"]`);
        if (elements.length > previousLength) {
          previousLength = elements.length;
          changed = true;
        }
      }

      if (!changed) {
        const expanded = this.requestArrayFieldExpansion(name, requiredCount, elements.length, elements[0] || null);
        elements = this.form.querySelectorAll(`[name="${safeName}"]`);

        if (!expanded || elements.length === previousLength) {
          break;
        }

        previousLength = elements.length;
      }
    }
  }

  requestArrayFieldExpansion(name, requiredCount, currentCount, referenceElement) {
    if (typeof document === 'undefined' || typeof CustomEvent !== 'function') {
      return false;
    }

    const detail = {
      name,
      requiredCount,
      currentCount: currentCount ?? 0,
      formId: this.form ? this.form.id : null
    };

    const event = new CustomEvent('autosave:ensure-array-field', {
      bubbles: true,
      cancelable: false,
      detail
    });

    if (referenceElement && typeof referenceElement.dispatchEvent === 'function') {
      referenceElement.dispatchEvent(event);
    } else if (this.form && typeof this.form.dispatchEvent === 'function') {
      this.form.dispatchEvent(event);
    } else {
      document.dispatchEvent(event);
    }

    return true;
  }

  findAddButtonForElement(element) {
    if (!element || !element.closest) {
      return null;
    }

    const selectors = ['[data-autosave-add]', '.add-button'];
    let current = element.parentElement;

    while (current && current !== this.form) {
      for (const selector of selectors) {
        const button = current.querySelector(selector);
        if (button && this.isElementInsideForm(button)) {
          return button;
        }
      }

      current = current.parentElement;
    }

    return null;
  }

  isElementInsideForm(element) {
    if (!element) {
      return false;
    }

    return element.closest('form') === this.form;
  }

  escapeNameForSelector(name) {
    if (typeof name !== 'string') {
      return '';
    }

    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(name);
    }

    return name.replace(/([\0-\x1F\x7F"'\\#.:;,!?+*~=<>^$\[\](){}|\/\s-])/g, '\\$1');
  }

  updateStatus(state, detail = '') {
    if (!this.statusElement) {
      return;
    }

    const effectiveState = state || 'idle';
    this.currentState = effectiveState;
    this.currentDetail = detail ?? '';

    const stateClasses = [
      'autosave-status--idle',
      'autosave-status--pending',
      'autosave-status--saving',
      'autosave-status--synced',
      'autosave-status--error',
      'autosave-status--cleared'
    ];

    this.statusElement.classList.remove(...stateClasses);
    this.statusElement.dataset.state = effectiveState;
    this.statusElement.setAttribute('aria-busy', effectiveState === 'saving' ? 'true' : 'false');

    let message = '';
    const timestamp = this.lastSavedAt instanceof Date && !Number.isNaN(this.lastSavedAt.valueOf())
      ? this.formatTime(this.lastSavedAt)
      : null;

    switch (effectiveState) {
      case 'pending':
        message = this.translate('autosave.status.pending', 'Autosave scheduled.');
        this.statusElement.classList.add('autosave-status--pending');
        break;
      case 'saving':
        message = this.translate('autosave.status.saving', 'Autosaving…');
        this.statusElement.classList.add('autosave-status--saving');
        break;
      case 'synced':
        message = timestamp
          ? this.translate('autosave.status.syncedWithTime', 'Draft saved at {time}.', { time: timestamp })
          : this.translate('autosave.status.synced', 'Draft saved.');
        this.statusElement.classList.add('autosave-status--synced');
        break;
      case 'manual':
        message = timestamp
          ? this.translate('autosave.status.manualWithTime', 'Saved manually at {time}.', { time: timestamp })
          : this.translate('autosave.status.manual', 'Saved manually.');
        this.statusElement.classList.add('autosave-status--synced');
        break;
      case 'error':
        if (detail) {
          message = this.translate('autosave.status.error', 'Autosave failed: {detail}', {
            detail
          });
        } else {
          message = this.translate('autosave.status.errorNoDetail', 'Autosave failed.');
        }
        this.statusElement.classList.add('autosave-status--error');
        break;
      case 'cleared':
        message = this.translate('autosave.status.cleared', 'Autosave draft cleared.');
        this.statusElement.classList.add('autosave-status--cleared');
        break;
      case 'idle':
      default:
        message = this.translate('autosave.status.idle', 'Autosave ready.');
        this.statusElement.classList.add('autosave-status--idle');
        break;
    }

    if (this.statusTextElement) {
      this.statusTextElement.textContent = message;
    } else {
      this.statusElement.textContent = message;
    }
  }

  refreshTranslations() {
    if (this.statusLabelElement) {
      const fallbackLabel = this.statusLabelElement.getAttribute('data-default-text') || 'Autosave status:';
      const translatedLabel = this.translate('autosave.status.label', fallbackLabel);
      this.statusLabelElement.textContent = translatedLabel;
      this.statusLabelElement.setAttribute('data-default-text', fallbackLabel);
    }

    if (this.statusHeadingElement) {
      const fallbackHeading = this.statusHeadingElement.getAttribute('data-default-text') || 'Autosave';
      const translatedHeading = this.translate('autosave.status.heading', fallbackHeading);
      this.statusHeadingElement.textContent = translatedHeading;
      this.statusHeadingElement.setAttribute('data-default-text', fallbackHeading);
    }

    this.updateStatus(this.currentState, this.currentDetail);

    if (this.pendingRestoreRecord && this.restoreDescriptionElement) {
      this.restoreDescriptionElement.textContent = this.getRestoreMessage(this.pendingRestoreRecord);
    }
  }

  handleTranslationsLoaded(event) {
    if (event?.detail?.translations) {
      this.activeTranslations = event.detail.translations;
    }
    this.refreshTranslations();
  }

  resolveTranslator(candidate) {
    if (typeof candidate === 'function') {
      return candidate;
    }

    if (typeof window !== 'undefined') {
      const elmoTranslator = window.elmo && typeof window.elmo.translate === 'function'
        ? window.elmo.translate.bind(window.elmo)
        : null;
      if (elmoTranslator) {
        return elmoTranslator;
      }

      if (typeof window.getNestedValue === 'function' && typeof window.translations !== 'undefined') {
        return (key) => window.getNestedValue(window.translations, key);
      }
    }

    return null;
  }

  lookupTranslation(key) {
    if (!this.activeTranslations || !key) {
      return undefined;
    }

    return key.split('.').reduce((accumulator, segment) => {
      if (accumulator && Object.prototype.hasOwnProperty.call(accumulator, segment)) {
        return accumulator[segment];
      }
      return undefined;
    }, this.activeTranslations);
  }

  translate(key, fallback, variables = {}) {
    let template;

    if (this.translationFn) {
      template = this.translationFn(key, variables, this.activeTranslations);
    }

    if (template === undefined || template === null || template === '') {
      template = this.lookupTranslation(key);
    }

    if (template === undefined || template === null || template === '') {
      template = fallback ?? '';
    }

    if (typeof template !== 'string') {
      return template;
    }

    return this.interpolate(template, variables);
  }

  interpolate(template, variables = {}) {
    if (typeof template !== 'string') {
      return template;
    }

    return Object.keys(variables).reduce((result, placeholder) => {
      const value = variables[placeholder];
      const replacement = value === undefined || value === null ? '' : String(value);
      const pattern = new RegExp(`\\{${placeholder}\\}`, 'g');
      return result.replace(pattern, replacement);
    }, template);
  }

  getRestoreMessage(record) {
    const timestamp = record?.updatedAt ? new Date(record.updatedAt) : null;

    if (timestamp) {
      const formatted = this.formatLong(timestamp);
      return this.translate(
        'autosave.restore.foundWithTimestamp',
        `We found an autosaved draft from ${formatted}. Would you like to restore it?`,
        { timestamp: formatted }
      );
    }

    return this.translate(
      'autosave.restore.foundWithoutTimestamp',
      'We found an autosaved draft from a previous session. Would you like to restore it?'
    );
  }

  isArrayFieldName(name) {
    return typeof name === 'string' && /\[\]$/.test(name);
  }

  formatTime(date) {
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return date.toISOString();
    }
  }

  formatLong(date) {
    try {
      return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    } catch (error) {
      return date.toISOString();
    }
  }

  extractErrorMessage(response) {
    return response.text().then((text) => {
      if (!text) {
        return '';
      }
      try {
        const data = JSON.parse(text);
        return data.error || data.message || text;
      } catch (error) {
        return text;
      }
    });
  }

  readStoredDraftId() {
    try {
      return window.localStorage.getItem(this.localStorageKey);
    } catch (error) {
      return null;
    }
  }

  storeDraftId(id) {
    if (!id) {
      return;
    }
    try {
      window.localStorage.setItem(this.localStorageKey, id);
    } catch (error) {
      // Ignore storage errors silently
    }
  }

  removeStoredDraftId() {
    try {
      window.localStorage.removeItem(this.localStorageKey);
    } catch (error) {
      // Ignore
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutosaveService;
}

export default AutosaveService;