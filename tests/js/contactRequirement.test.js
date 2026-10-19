import { countSelectedContacts, hasCompleteContact, updateSharedContactStatus } from '../../js/contactRequirement.js';

describe('shared contact requirement', () => {
  const person = { type: 'person', familyname: 'Doe', email: 'doe@example.org', roles: ['Contact Person'] };
  const institution = { type: 'institution', institutionname: 'Institute', email: 'info@example.org', roles: ['Contact Person'] };
  beforeEach(() => {
    document.body.innerHTML = `<input name="authorsPayload" value="[]"><input name="contributorsPayload" value="[]">
      <span data-author-contact-summary></span><span data-contributor-contact-summary></span>`;
    window.ELMO_FEATURES = { showContactInstitution: false };
  });
  afterEach(() => { delete window.ELMO_FEATURES; });

  test('counts author and contributor contacts together', () => {
    expect(countSelectedContacts([{ type: 'person', isContact: true }], [person, institution], false)).toBe(2);
    expect(countSelectedContacts([], [institution], true)).toBe(1);
  });

  test('requires a name and valid email for a complete contact', () => {
    expect(hasCompleteContact([], [person])).toBe(true);
    expect(hasCompleteContact([], [{ ...person, email: 'broken' }])).toBe(false);
    expect(hasCompleteContact([], [institution], false)).toBe(false);
    expect(hasCompleteContact([], [institution], true)).toBe(true);
  });

  test('keeps both badges equal through changes and translation events', () => {
    const badges = document.querySelectorAll('[data-author-contact-summary], [data-contributor-contact-summary]');
    updateSharedContactStatus();
    expect([...badges].map(node => node.textContent)).toEqual([
      'at least 1 contact required', 'at least 1 contact required'
    ]);
    document.querySelector('[name="contributorsPayload"]').value = JSON.stringify([person]);
    document.dispatchEvent(new CustomEvent('contributorsPayload:updated'));
    expect(badges[0].textContent).toBe('1 contact person');
    expect(badges[1].textContent).toBe(badges[0].textContent);
    document.querySelector('[name="contributorsPayload"]').value = '[]';
    document.dispatchEvent(new CustomEvent('translationsLoaded'));
    expect(badges[0].textContent).toBe('at least 1 contact required');
  });
});
