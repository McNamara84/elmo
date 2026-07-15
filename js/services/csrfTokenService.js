/**
 * Shared CSRF token helpers for save, submit, and feedback actions.
 * Tokens are fetched from the server only when an action is committed.
 */

export const CSRF_FIELD_IDS = {
  form: 'input-csrf-token',
  feedback: 'input-feedback-csrf-token',
};

export const INTERACTION_SCOPES = {
  form: 'form',
  feedback: 'feedback',
};

/**
 * Fetches the session CSRF token and stores it in the target hidden field.
 *
 * @param {'form' | 'feedback'} target Which form field should receive the token
 * @returns {Promise<string>} The CSRF token, or an empty string on failure
 */
export async function fetchAndStoreCsrfToken(target = 'form') {
  const fieldId = target === 'feedback'
    ? CSRF_FIELD_IDS.feedback
    : CSRF_FIELD_IDS.form;
  const field = document.getElementById(fieldId);

  try {
    const response = await fetch('api/csrf_token.php', { credentials: 'include' });
    const data = await response.json();
    const token = (data.token || '').toString();

    if (token && field) {
      field.value = token;
    }

    return token;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return '';
  }
}

/**
 * Starts the server-side interaction timer for an operation scope.
 *
 * @param {string} scope Interaction scope (`form` or `feedback`)
 * @returns {Promise<void>}
 */
export async function startInteraction(scope = INTERACTION_SCOPES.form) {
  try {
    await fetch(
      `api/interaction_start.php?scope=${encodeURIComponent(scope)}`,
      { credentials: 'include' }
    );
  } catch (error) {
    console.error(`Failed to start interaction timer for scope "${scope}":`, error);
  }
}
