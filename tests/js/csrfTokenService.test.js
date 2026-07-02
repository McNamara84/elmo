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
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('fetchAndStoreCsrfToken stores token in the main form field', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({ token: 'shared-token-abc' }),
    });

    const token = await fetchAndStoreCsrfToken('form');

    expect(token).toBe('shared-token-abc');
    expect(document.getElementById(CSRF_FIELD_IDS.form).value).toBe('shared-token-abc');
    expect(global.fetch).toHaveBeenCalledWith(
      'api/csrf_token.php',
      { credentials: 'include' }
    );
  });

  test('fetchAndStoreCsrfToken stores the same session token in the feedback field', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({ token: 'shared-token-abc' }),
    });

    const token = await fetchAndStoreCsrfToken('feedback');

    expect(token).toBe('shared-token-abc');
    expect(document.getElementById(CSRF_FIELD_IDS.feedback).value).toBe('shared-token-abc');
    expect(global.fetch).toHaveBeenCalledWith(
      'api/csrf_token.php',
      { credentials: 'include' }
    );
  });

  test('startInteraction calls interaction_start endpoint', async () => {
    global.fetch.mockResolvedValue({ ok: true });

    await startInteraction(INTERACTION_SCOPES.feedback);

    expect(global.fetch).toHaveBeenCalledWith(
      'api/interaction_start.php?scope=feedback',
      { credentials: 'include' }
    );
  });
});
