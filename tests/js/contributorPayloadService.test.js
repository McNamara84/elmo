import { synchronizeContributorsPayload } from '../../js/services/contributorPayloadService.js';

describe('synchronizeContributorsPayload', () => {
  beforeEach(() => { document.body.innerHTML = '<form><input name="contributorsPayload" value="stale"></form>'; });
  afterEach(() => { delete window.contributorStack; });

  test('uses the current card order', () => {
    const payload = [{ type: 'institution', institutionname: 'A' }, { type: 'person', familyname: 'B' }];
    window.contributorStack = { updatePayload: jest.fn(() => payload) };
    expect(synchronizeContributorsPayload(document.querySelector('form'))).toEqual(payload);
    expect(JSON.parse(document.querySelector('input').value)).toEqual(payload);
  });

  test('rejects an uninitialized stack while allowing a disabled group', () => {
    expect(() => synchronizeContributorsPayload(document)).toThrow('stack is not initialized');
    document.querySelector('input').remove();
    expect(synchronizeContributorsPayload(document)).toBeNull();
  });
});
