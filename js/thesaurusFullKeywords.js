/**
 * Full GCMD breadcrumb helpers for thesaurus trees and Tagify.
 *
 * GGM (and other) UIs show a cut subtree, but saved keyword text must be the
 * unfiltered path including scheme-root (`Science Keywords > …`, `Platforms > …`).
 * These helpers stamp that path on every node, put it on the whitelist, resolve
 * imported tags onto it, and match Tagify values back to filtered-tree nodes.
 */

/**
 * Walks a thesaurus tree and stamps each node with its own full GCMD breadcrumb,
 * including scheme-root (Science Keywords / Platforms). Recurses so every
 * descendant gets its path — GEODETICS and SPHERICAL HARMONIC MODELS do not
 * share a prefix, so a single string cannot be concatenated onto every GGM root.
 *
 * @param {Array<Object>} nodes - Tree nodes (mutated in place).
 * @param {Array<string>} [ancestorTexts] - Texts of ancestors already walked.
 */
export function stampFullKeywords(nodes, ancestorTexts) {
    ancestorTexts = ancestorTexts || [];
    if (!Array.isArray(nodes)) return;
    nodes.forEach(function (node) {
        if (!node) return;
        var fullKeyword = ancestorTexts.concat(node.text || '').join(' > ');
        node.fullKeyword = fullKeyword;
        node.original = Object.assign({}, node.original || {}, { fullKeyword: fullKeyword });
        if (node.children) {
            stampFullKeywords(node.children, ancestorTexts.concat(node.text || ''));
        }
    });
}

/**
 * Returns the stamped full GCMD path for a jsTree node, falling back to empty
 * string when the node was not stamped (tests / unexpected tree shapes).
 *
 * @param {Object} jsTreeInstance - Active jsTree instance.
 * @param {Object} node - jsTree node or get_json flat entry.
 * @returns {string}
 */
export function getNodeFullKeyword(jsTreeInstance, node) {
    if (!node) return '';
    var internal = node;
    if (jsTreeInstance && typeof jsTreeInstance.get_node === 'function' && node.id) {
        internal = jsTreeInstance.get_node(node.id) || node;
    }
    if (internal.original && internal.original.fullKeyword) {
        return internal.original.fullKeyword;
    }
    if (internal.fullKeyword) {
        return internal.fullKeyword;
    }
    return '';
}

/**
 * Whitelist / Tagify value for a tree node: stamped fullKeyword, else a
 * filtered-tree concat used only when stamping did not run.
 *
 * @param {Object} item - Thesaurus node.
 * @param {Array<string>} [parentPath] - Ancestor texts in the (possibly cut) tree.
 * @returns {string}
 */
export function whitelistValueFromNode(item, parentPath) {
    parentPath = parentPath || [];
    if (!item) return '';
    return (item.original && item.original.fullKeyword)
        || item.fullKeyword
        || parentPath.concat(item.text || '').join(' > ');
}

/**
 * Copies canonical whitelist fields onto an imported tag. The whitelist entry
 * is the source of truth for `value` (the full GCMD breadcrumb).
 *
 * @param {Object} tag - Imported Tagify tag.
 * @param {Object} entry - Matching whitelist entry (`value`, `id`, scheme metadata).
 * @returns {Object}
 */
function applyWhitelistEntry(tag, entry) {
    return Object.assign({}, tag, {
        value: entry.value,
        id: tag.id || entry.id,
        scheme: tag.scheme || entry.scheme,
        schemeURI: tag.schemeURI || entry.schemeURI,
        language: tag.language || entry.language
    });
}

/**
 * Maps an imported Tagify tag onto a whitelist entry that was built from
 * stamped `fullKeyword` values. Three consecutive stages; first hit wins.
 *
 *   1. exact match on `entry.value`
 *   2. node.id / valueURI (`tag.id` === `entry.id`)
 *   3. suffix (`entry.value` ends with ` > ` + imported text)
 *
 * The whitelist already contains the full prefixed path by design. This does
 * not add missing keywords — if no stage matches, the concept is not in this
 * tree and enforceWhitelist will drop it on save rather than invent a path.
 *
 * @param {Object} tag - Tagify tag data (`value`, optional `id` / valueURI).
 * @param {Array<Object>} whitelist - Tagify whitelist entries.
 * @returns {Object} Tag data with `value` set to the canonical path when resolved.
 */
export function resolveTagAgainstWhitelist(tag, whitelist) {
    if (!tag || !Array.isArray(whitelist) || whitelist.length === 0) return tag;

    var xmlText = tag.value || '';

    // Stage 1 — exact match: ELMO-saved XML already stores the full breadcrumb
    // (`Platforms > Space-based Platforms > …`, `Science Keywords > …`).
    if (xmlText) {
        var exact = whitelist.find(function (entry) {
            return entry && entry.value === xmlText;
        });
        if (exact) return applyWhitelistEntry(tag, exact);
    }

    // Stage 2 — node.id / valueURI: ICGEM subject text may omit the scheme-root
    // while still carrying the GCMD concept URI that matches `entry.id`.
    if (tag.id) {
        var byId = whitelist.find(function (entry) {
            return entry && entry.id === tag.id;
        });
        if (byId) return applyWhitelistEntry(tag, byId);
    }

    // Stage 3 — suffix: `Space-based Platforms > GRACE` matches
    // `Platforms > Space-based Platforms > GRACE`. Ambiguous when more than
    // one whitelist entry shares that ending.
    if (xmlText) {
        var suffix = ' > ' + xmlText;
        var suffixMatches = whitelist.filter(function (entry) {
            return entry && entry.value && entry.value.endsWith(suffix);
        });
        if (suffixMatches.length > 0) {
            var matchedValues = suffixMatches.map(function (entry) {
                return entry.value;
            });
            console.warn(
                'Thesaurus keyword matched by suffix; this can be imprecise.',
                { imported: xmlText, matched: matchedValues }
            );
            return applyWhitelistEntry(tag, suffixMatches[0]);
        }
    }

    return tag;
}

/**
 * After the vocab whitelist is applied, rewrite any already-imported tags to
 * the stamped fullKeyword so save writes the same string that is in the
 * whitelist (and therefore uploadable later with a plain addTags).
 *
 * @param {Object} tagifyInstance - Tagify instance.
 * @param {Array<Object>} whitelist - Canonical whitelist entries.
 */
export function upgradeExistingTagsToFullKeywords(tagifyInstance, whitelist) {
    if (!tagifyInstance || !Array.isArray(tagifyInstance.value) || tagifyInstance.value.length === 0) {
        return;
    }
    if (!Array.isArray(whitelist) || whitelist.length === 0) return;

    var upgraded = tagifyInstance.value.map(function (tag) {
        return resolveTagAgainstWhitelist(tag, whitelist);
    });
    var changed = upgraded.some(function (tag, index) {
        return tag.value !== tagifyInstance.value[index].value;
    });
    if (!changed) return;

    tagifyInstance.removeAllTags();
    tagifyInstance.addTags(upgraded);
}

/**
 * Finds a jsTree node for a Tagify value. Three consecutive stages; first
 * hit wins.
 *
 *   1. exact — stamped original.fullKeyword
 *   2. exact — filtered-tree get_path
 *   3. suffix — full Tagify path ends with the visible tree path
 *
 * Tagify stores the unfiltered GCMD breadcrumb; the visible tree may be a
 * cut GGM subtree whose get_path is only the suffix.
 *
 * @param {Object} jsTreeInstance - Active jsTree instance.
 * @param {string} path - Full breadcrumb path using ` > ` separators.
 * @returns {Object|null} Matching jsTree node, or null when no match exists.
 */
export function findNodeByPath(jsTreeInstance, path) {
    if (!jsTreeInstance || !path) return null;
    var nodes = jsTreeInstance.get_json("#", { flat: true }) || [];
    return nodes.find(function (n) {
        var fullKeyword = getNodeFullKeyword(jsTreeInstance, n);
        var treePath = typeof jsTreeInstance.get_path === 'function'
            ? jsTreeInstance.get_path(n, " > ")
            : '';

        // Stage 1 — exact match on the stamped full GCMD breadcrumb.
        if (fullKeyword === path) return true;
        // Stage 2 — exact match on the filtered-tree get_path (cut subtree).
        if (treePath === path) return true;
        // Stage 3 — suffix: Tagify full path ends with the visible tree path.
        if (treePath && path.endsWith(' > ' + treePath)) return true;
        return false;
    }) || null;
}
