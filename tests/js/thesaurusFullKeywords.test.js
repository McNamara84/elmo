/**
 * @jest-environment jsdom
 */

const {
  stampFullKeywords,
  getNodeFullKeyword,
  whitelistValueFromNode,
  resolveTagAgainstWhitelist,
  upgradeExistingTagsToFullKeywords,
  findNodeByPath,
} = require('../../js/thesaurusFullKeywords.js');

describe('thesaurusFullKeywords', () => {
  describe('stampFullKeywords', () => {
    test('stamps each descendant with its own unfiltered breadcrumb', () => {
      const tree = [{
        id: 'sk',
        text: 'Science Keywords',
        children: [{
          id: 'es',
          text: 'EARTH SCIENCE',
          children: [{ id: 'geo', text: 'GEODETICS', children: [] }],
        }],
      }];

      stampFullKeywords(tree);

      expect(tree[0].original.fullKeyword).toBe('Science Keywords');
      expect(tree[0].children[0].original.fullKeyword).toBe('Science Keywords > EARTH SCIENCE');
      expect(tree[0].children[0].children[0].original.fullKeyword).toBe(
        'Science Keywords > EARTH SCIENCE > GEODETICS'
      );
    });
  });

  describe('whitelistValueFromNode', () => {
    test('prefers stamped fullKeyword over filtered concat', () => {
      expect(whitelistValueFromNode({
        text: 'GEODETICS',
        original: { fullKeyword: 'Science Keywords > EARTH SCIENCE > GEODETICS' },
      }, [])).toBe('Science Keywords > EARTH SCIENCE > GEODETICS');
    });
  });

  describe('resolveTagAgainstWhitelist', () => {
    const graceFull = 'Platforms > Space-based Platforms > Earth Observation Satellites > GRACE';
    const whitelist = [
      { value: graceFull, id: 'uri:grace' },
      { value: 'Science Keywords > EARTH SCIENCE > GEODETICS', id: 'uri:geo' },
    ];

    test('stage 1 exact match leaves a full breadcrumb unchanged', () => {
      const resolved = resolveTagAgainstWhitelist({ value: graceFull, id: 'uri:grace' }, whitelist);
      expect(resolved.value).toBe(graceFull);
    });

    test('stage 2 matches by node.id / valueURI', () => {
      const resolved = resolveTagAgainstWhitelist(
        { value: 'GRACE', id: 'uri:grace' },
        whitelist
      );
      expect(resolved.value).toBe(graceFull);
    });

    test('stage 3 suffix match warns because it can be imprecise', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const resolved = resolveTagAgainstWhitelist(
        { value: 'Space-based Platforms > Earth Observation Satellites > GRACE' },
        whitelist
      );
      expect(resolved.value).toBe(graceFull);
      expect(warn).toHaveBeenCalledWith(
        'Thesaurus keyword matched by suffix; this can be imprecise.',
        expect.objectContaining({
          imported: 'Space-based Platforms > Earth Observation Satellites > GRACE',
          matched: [graceFull],
        })
      );
      warn.mockRestore();
    });

    test('stage 3 warns with every candidate when the suffix is ambiguous', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const ambiguous = [
        { value: 'Science Keywords > A > LEAF', id: 'a' },
        { value: 'Science Keywords > B > LEAF', id: 'b' },
      ];
      const resolved = resolveTagAgainstWhitelist({ value: 'LEAF' }, ambiguous);
      expect(resolved.value).toBe('Science Keywords > A > LEAF');
      expect(warn.mock.calls[0][1].matched).toEqual([
        'Science Keywords > A > LEAF',
        'Science Keywords > B > LEAF',
      ]);
      warn.mockRestore();
    });
  });

  describe('upgradeExistingTagsToFullKeywords', () => {
    test('rewrites Tagify values to the whitelist fullKeyword', () => {
      const tagify = {
        value: [{ value: 'Child', id: 'child' }],
        removeAllTags: jest.fn(function () { this.value = []; }),
        addTags: jest.fn(function (tags) { this.value = tags; }),
      };
      upgradeExistingTagsToFullKeywords(tagify, [
        { value: 'Parent > Child', id: 'child' },
      ]);
      expect(tagify.value[0].value).toBe('Parent > Child');
    });
  });

  describe('findNodeByPath', () => {
    function treeStub(nodes) {
      return {
        get_json: () => nodes,
        get_path: (n) => n.filteredPath,
        get_node: (id) => nodes.find((n) => n.id === id),
      };
    }

    test('stage 1 matches stamped fullKeyword', () => {
      const node = {
        id: 'geo',
        original: { fullKeyword: 'Science Keywords > EARTH SCIENCE > GEODETICS' },
        filteredPath: 'GEODETICS',
      };
      expect(findNodeByPath(treeStub([node]), node.original.fullKeyword).id).toBe('geo');
    });

    test('stage 3 matches when the full Tagify path ends with the filtered tree path', () => {
      const node = {
        id: 'geo',
        original: { fullKeyword: 'Science Keywords > EARTH SCIENCE > GEODETICS' },
        filteredPath: 'GEODETICS',
      };
      // Use a path that is not equal to fullKeyword or filteredPath alone...
      // fullKeyword exact would hit stage 1. Use a value that only suffix-matches:
      const longer = 'EXTRA > GEODETICS';
      node.original.fullKeyword = 'Science Keywords > EARTH SCIENCE > GEODETICS';
      expect(findNodeByPath(treeStub([node]), longer).id).toBe('geo');
    });
  });

  describe('getNodeFullKeyword', () => {
    test('reads original.fullKeyword via get_node', () => {
      const node = { id: 'n1', original: { fullKeyword: 'A > B' } };
      const tree = { get_node: () => node };
      expect(getNodeFullKeyword(tree, { id: 'n1' })).toBe('A > B');
    });
  });
});
