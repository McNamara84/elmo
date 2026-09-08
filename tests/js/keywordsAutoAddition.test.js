/**
 * @jest-environment jsdom
 */

const MASCON_UUID = 'https://gcmd.earthdata.nasa.gov/kms/concept/97576e51-28b5-4ae0-af33-fbb00fd5996b';
const MASCON_ENTRY = {
  id: MASCON_UUID,
  value: 'MASS CONCENTRATION (MASCON) MODELS',
  scheme: 'GCMD',
  schemeURI: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords',
};

class MockTagify {
  constructor(el, settings = {}) {
    this.el = el;
    this.settings = { whitelist: [], ...settings };
    this.value = [];
  }
  addTags(items) {
    const arr = Array.isArray(items) ? items : [items];
    arr.forEach((item) => {
      const tag = typeof item === 'string' ? { value: item } : item;
      if (!this.value.some((existing) => existing.id === tag.id || existing.value === tag.value)) {
        this.value.push(tag);
      }
    });
  }
  removeTag(tag) {
    this.value = this.value.filter((item) => item.value !== tag);
  }
}

describe('keywordsAutoAddition.js', () => {
  let $;
  let keywordsAutoAddition;

  function attachScienceTagify(whitelist = [MASCON_ENTRY]) {
    const input = document.getElementById('input-sciencekeyword');
    const tagify = new MockTagify(input, { whitelist });
    input._tagify = tagify;
    return tagify;
  }

  beforeAll(async () => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    keywordsAutoAddition = await import('../../js/eventhandlers/keywordsAutoAddition.js');
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="input-mathematical-representation">
        <option value="" selected>Choose...</option>
        <option value="MASCON">MASCON</option>
        <option value="Spherical harmonics">Spherical harmonics</option>
      </select>
      <input id="input-sciencekeyword" />
    `;
    keywordsAutoAddition.resetKeywordAutoAddition();
  });

  afterEach(() => {
    keywordsAutoAddition.resetKeywordAutoAddition();
  });

  test('catalogue quartet maps MASCON to the science-keyword UUID', () => {
    expect(keywordsAutoAddition.KEYWORDS_CATALOGUE).toEqual([
      ['input-mathematical-representation', 'MASCON', 'input-sciencekeyword', MASCON_UUID],
    ]);
  });

  test('addKeywordByUuid adds the whitelist entry with the matching id', async () => {
    const tagify = attachScienceTagify();
    const added = await keywordsAutoAddition.addKeywordByUuid('input-sciencekeyword', MASCON_UUID);
    expect(added).toBe(true);
    expect(tagify.value).toEqual(expect.arrayContaining([expect.objectContaining({ id: MASCON_UUID })]));
  });

  test('addKeywordByUuid does not duplicate a keyword that is already present', async () => {
    const tagify = attachScienceTagify();
    await keywordsAutoAddition.addKeywordByUuid('input-sciencekeyword', MASCON_UUID);
    await keywordsAutoAddition.addKeywordByUuid('input-sciencekeyword', MASCON_UUID);
    expect(tagify.value.filter((tag) => tag.id === MASCON_UUID)).toHaveLength(1);
  });

  test('addKeywordByUuid returns false when the UUID is not in the whitelist', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    attachScienceTagify();
    const added = await keywordsAutoAddition.addKeywordByUuid('input-sciencekeyword', 'missing-uuid');
    expect(added).toBe(false);
    warn.mockRestore();
  });

  test('addKeywordByUuid returns false when the Tagify input is missing', async () => {
    const added = await keywordsAutoAddition.addKeywordByUuid('input-does-not-exist', MASCON_UUID);
    expect(added).toBe(false);
  });

  test('removeKeywordByUuid removes the tag with the matching id', async () => {
    const tagify = attachScienceTagify();
    await keywordsAutoAddition.addKeywordByUuid('input-sciencekeyword', MASCON_UUID);
    const removed = keywordsAutoAddition.removeKeywordByUuid('input-sciencekeyword', MASCON_UUID);
    expect(removed).toBe(true);
    expect(tagify.value.some((tag) => tag.id === MASCON_UUID)).toBe(false);
  });

  test('removeKeywordByUuid returns false when no matching tag exists', () => {
    attachScienceTagify();
    expect(keywordsAutoAddition.removeKeywordByUuid('input-sciencekeyword', 'missing-uuid')).toBe(false);
  });

  test('keywordsReady binds listeners that add the keyword when MASCON is selected', async () => {
    const tagify = attachScienceTagify();
    document.dispatchEvent(new CustomEvent(keywordsAutoAddition.KEYWORDS_READY_EVENT));

    $('#input-mathematical-representation').val('MASCON').trigger('change');
    await Promise.resolve();

    expect(tagify.value.some((tag) => tag.id === MASCON_UUID)).toBe(true);
  });

  test('changing away from MASCON removes the keyword by UUID', async () => {
    const tagify = attachScienceTagify();
    document.dispatchEvent(new CustomEvent(keywordsAutoAddition.KEYWORDS_READY_EVENT));

    $('#input-mathematical-representation').val('MASCON').trigger('change');
    await Promise.resolve();
    $('#input-mathematical-representation').val('Spherical harmonics').trigger('change');

    expect(tagify.value.some((tag) => tag.id === MASCON_UUID)).toBe(false);
  });

  test('keywordsReady adds the keyword when MASCON is already selected', async () => {
    const tagify = attachScienceTagify();
    $('#input-mathematical-representation').val('MASCON');
    document.dispatchEvent(new CustomEvent(keywordsAutoAddition.KEYWORDS_READY_EVENT));
    await Promise.resolve();

    expect(tagify.value.some((tag) => tag.id === MASCON_UUID)).toBe(true);
  });

  test('keywordsReady does not remove an existing tag when the trigger does not match', () => {
    const tagify = attachScienceTagify();
    tagify.addTags([MASCON_ENTRY]);
    document.dispatchEvent(new CustomEvent(keywordsAutoAddition.KEYWORDS_READY_EVENT));

    expect(tagify.value.some((tag) => tag.id === MASCON_UUID)).toBe(true);
  });

  test('does not bind a quartet whose trigger input is missing', async () => {
    document.body.innerHTML = '<input id="input-sciencekeyword" />';
    const tagify = attachScienceTagify();
    document.dispatchEvent(new CustomEvent(keywordsAutoAddition.KEYWORDS_READY_EVENT));
    await Promise.resolve();

    expect(tagify.value).toHaveLength(0);
  });

  test('does not attach duplicate change listeners when keywordsReady fires twice', async () => {
    const tagify = attachScienceTagify();
    const addTags = jest.spyOn(tagify, 'addTags');
    document.dispatchEvent(new CustomEvent(keywordsAutoAddition.KEYWORDS_READY_EVENT));
    document.dispatchEvent(new CustomEvent(keywordsAutoAddition.KEYWORDS_READY_EVENT));

    $('#input-mathematical-representation').val('MASCON').trigger('change');
    await Promise.resolve();

    expect(addTags).toHaveBeenCalledTimes(1);
  });

  test('toggleKeywordsInThesaurus ignores an incomplete quartet', () => {
    const tagify = attachScienceTagify();
    keywordsAutoAddition.toggleKeywordsInThesaurus(['input-mathematical-representation', 'MASCON']);
    expect(tagify.value).toHaveLength(0);
  });
});
