/**
 * @jest-environment jsdom
 */

import {
  fetchAndStoreCsrfToken,
  startInteraction,
  CSRF_FIELD_IDS,
  INTERACTION_SCOPES,
} from '../../js/services/csrfTokenService.js';

describe('csrfTokenService', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="hidden" id="${CSRF_FIELD_IDS.form}" name="csrf-token" value="">
      <input type="hidden" id="${CSRF_FIELD_IDS.feedback}" name="csrf-token" value="">
    `;
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
    console.error.mockRestore();
  });

  describe('fetchAndStoreCsrfToken (on-demand)', () => {
    test('fetches from api/csrf_token.php with session credentials', async () => {
      global.fetch.mockResolvedValue({
        json: async () => ({ token: 'on-demand-token' }),
      });

      await fetchAndStoreCsrfToken('form');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'api/csrf_token.php',
        { credentials: 'include' }
      );
    });

    test('stores fetched token in the main form field', async () => {
      global.fetch.mockResolvedValue({
        json: async () => ({ token: 'shared-token-abc' }),
      });

      const token = await fetchAndStoreCsrfToken('form');

      expect(token).toBe('shared-token-abc');
      expect(document.getElementById(CSRF_FIELD_IDS.form).value).toBe('shared-token-abc');
    });

    test('stores fetched token in the feedback field', async () => {
      global.fetch.mockResolvedValue({
        json: async () => ({ token: 'shared-token-abc' }),
      });

      const token = await fetchAndStoreCsrfToken('feedback');

      expect(token).toBe('shared-token-abc');
      expect(document.getElementById(CSRF_FIELD_IDS.feedback).value).toBe('shared-token-abc');
    });

    test('always fetches from the server even when the field already has a value', async () => {
      document.getElementById(CSRF_FIELD_IDS.form).value = 'stale-client-token';

      global.fetch.mockResolvedValue({
        json: async () => ({ token: 'fresh-server-token' }),
      });

      const token = await fetchAndStoreCsrfToken('form');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(token).toBe('fresh-server-token');
      expect(document.getElementById(CSRF_FIELD_IDS.form).value).toBe('fresh-server-token');
    });

    test('defaults to the main form target', async () => {
      global.fetch.mockResolvedValue({
        json: async () => ({ token: 'default-form-token' }),
      });

      await fetchAndStoreCsrfToken();

      expect(document.getElementById(CSRF_FIELD_IDS.form).value).toBe('default-form-token');
      expect(document.getElementById(CSRF_FIELD_IDS.feedback).value).toBe('');
    });

    test('returns empty string and does not update the field when fetch fails', async () => {
      document.getElementById(CSRF_FIELD_IDS.form).value = '';

      global.fetch.mockRejectedValue(new Error('network down'));

      const token = await fetchAndStoreCsrfToken('form');

      expect(token).toBe('');
      expect(document.getElementById(CSRF_FIELD_IDS.form).value).toBe('');
      expect(console.error).toHaveBeenCalled();
    });

    test('returns empty string when the API response has no token', async () => {
      global.fetch.mockResolvedValue({
        json: async () => ({ success: true }),
      });

      const token = await fetchAndStoreCsrfToken('form');

      expect(token).toBe('');
      expect(document.getElementById(CSRF_FIELD_IDS.form).value).toBe('');
    });

    test('returns token even when the target field is missing from the DOM', async () => {
      document.getElementById(CSRF_FIELD_IDS.form).remove();

      global.fetch.mockResolvedValue({
        json: async () => ({ token: 'orphan-token' }),
      });

      const token = await fetchAndStoreCsrfToken('form');

      expect(token).toBe('orphan-token');
    });
  });

  describe('startInteraction', () => {
    test('calls interaction_start endpoint for feedback scope', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      await startInteraction(INTERACTION_SCOPES.feedback);

      expect(global.fetch).toHaveBeenCalledWith(
        'api/interaction_start.php?scope=feedback',
        { credentials: 'include' }
      );
    });

    test('swallows fetch errors without throwing', async () => {
      global.fetch.mockRejectedValue(new Error('offline'));

      await expect(startInteraction(INTERACTION_SCOPES.form)).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
