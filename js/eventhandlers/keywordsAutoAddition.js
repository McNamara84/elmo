/**
 * Automatically adds and removes thesaurus keywords from a shared catalogue
 * of quartets. Each quartet is:
 *   [triggerInputId, triggerValue, thesaurusInputId, keywordUuid]
 *
 * After thesauri fire `keywordsReady`, a change listener is bound for every
 * quartet whose trigger field is on the page. Matching the trigger value adds
 * the keyword by UUID; any other value removes it by UUID.
 */

export const KEYWORDS_READY_EVENT = 'keywordsReady';

export const MASCON_SCIENCE_KEYWORD_UUID = 'https://gcmd.earthdata.nasa.gov/kms/concept/97576e51-28b5-4ae0-af33-fbb00fd5996b';

/**
 * Shared catalogue of keyword auto-addition rules.
 * Add a quartet here to reuse the same listener wiring on another field.
 *
 * @type {Array<[string, string, string, string]>}
 */
export const KEYWORDS_CATALOGUE = [
    ['input-mathematical-representation', 'MASCON', 'input-sciencekeyword', MASCON_SCIENCE_KEYWORD_UUID],
];

const boundQuartetKeys = new Set();
const pendingKeywordAdds = new Map();
const WHITELIST_WAIT_MS = 10000;
const WHITELIST_POLL_MS = 50;

function normalizeValue(value) {
    return (value || '').toString().trim().toLowerCase();
}

function quartetKey(quartet) {
    return quartet.join('\0');
}

function isValidQuartet(quartet) {
    return Array.isArray(quartet) && quartet.length === 4 && quartet.every(function (part) {
        return typeof part === 'string' && part.length > 0;
    });
}

function matchesTrigger($input, expectedValue) {
    if (!$input.length) return false;

    const expected = normalizeValue(expectedValue);
    const value = normalizeValue($input.val());
    if (value === expected) return true;

    if ($input.is('select')) {
        return normalizeValue($input.find('option:selected').text()) === expected;
    }
    return false;
}

function inputSelector(inputId) {
    return inputId.startsWith('#') ? inputId : '#' + inputId;
}

function getTagifyForInput(inputId) {
    const input = document.querySelector(inputSelector(inputId));
    return input?._tagify || input?.tagify || null;
}

function tagHasUuid(tagify, uuid) {
    return Boolean(tagify && (tagify.value || []).some(function (tag) {
        return tag && tag.id === uuid;
    }));
}

function getWhitelist(tagify) {
    return (tagify && (tagify.settings?.whitelist || tagify.whitelist)) || [];
}

function findWhitelistEntry(tagify, uuid) {
    return getWhitelist(tagify).find(function (item) {
        return item && item.id === uuid;
    }) || null;
}

/**
 * Asks thesauri.js to lazy-load vocabulary by focusing the Tagify wrapper,
 * which is the existing on-demand load trigger.
 */
function requestThesaurusLoad(inputId) {
    const input = document.querySelector(inputSelector(inputId));
    if (!input) return;

    const tagifyWrapper = input.closest('.tagify')
        || input.parentElement?.querySelector('.tagify')
        || input;
    tagifyWrapper.dispatchEvent(new Event('focus', { bubbles: false }));
}

function waitForWhitelist(tagify, timeoutMs) {
    if (getWhitelist(tagify).length > 0) {
        return Promise.resolve(getWhitelist(tagify));
    }

    return new Promise(function (resolve) {
        const startedAt = Date.now();
        const timer = setInterval(function () {
            const whitelist = getWhitelist(tagify);
            if (whitelist.length > 0 || Date.now() - startedAt >= timeoutMs) {
                clearInterval(timer);
                resolve(whitelist);
            }
        }, WHITELIST_POLL_MS);
    });
}

/**
 * Adds a thesaurus keyword to the given Tagify input by concept UUID.
 * Triggers the existing lazy-load path when the whitelist is still empty.
 *
 * @param {string} inputId - Thesaurus input id (e.g. 'input-sciencekeyword').
 * @param {string} uuid - Concept UUID / valueURI of the keyword.
 * @returns {Promise<boolean>} True when the keyword is present after the call.
 */
export function addKeywordByUuid(inputId, uuid) {
    if (!inputId || !uuid) return Promise.resolve(false);

    const pendingKey = String(inputId).replace(/^#/, '') + '\0' + uuid;
    if (pendingKeywordAdds.has(pendingKey)) {
        return pendingKeywordAdds.get(pendingKey);
    }

    const work = Promise.resolve().then(function () {
        const tagify = getTagifyForInput(inputId);
        if (!tagify || typeof tagify.addTags !== 'function') {
            return false;
        }
        if (tagHasUuid(tagify, uuid)) {
            return true;
        }

        const existing = findWhitelistEntry(tagify, uuid);
        if (existing) {
            tagify.addTags([existing]);
            return tagHasUuid(tagify, uuid);
        }

        if (getWhitelist(tagify).length > 0) {
            console.warn('Keyword UUID not found in thesaurus whitelist:', uuid);
            return false;
        }

        requestThesaurusLoad(inputId);
        return waitForWhitelist(tagify, WHITELIST_WAIT_MS).then(function () {
            if (tagHasUuid(tagify, uuid)) {
                return true;
            }
            const entry = findWhitelistEntry(tagify, uuid);
            if (!entry) {
                console.warn('Keyword UUID not found in thesaurus whitelist:', uuid);
                return false;
            }
            tagify.addTags([entry]);
            return tagHasUuid(tagify, uuid);
        });
    }).catch(function (error) {
        console.error('Failed to add keyword by UUID:', uuid, error);
        return false;
    }).finally(function () {
        pendingKeywordAdds.delete(pendingKey);
    });

    pendingKeywordAdds.set(pendingKey, work);
    return work;
}

/**
 * Removes a thesaurus keyword from the given Tagify input by concept UUID.
 *
 * @param {string} inputId - Thesaurus input id (e.g. 'input-sciencekeyword').
 * @param {string} uuid - Concept UUID / valueURI of the keyword.
 * @returns {boolean} True when a matching tag was removed.
 */
export function removeKeywordByUuid(inputId, uuid) {
    if (!inputId || !uuid) return false;

    const tagify = getTagifyForInput(inputId);
    if (!tagify || typeof tagify.removeTag !== 'function') {
        return false;
    }

    const tag = (tagify.value || []).find(function (item) {
        return item && item.id === uuid;
    });
    if (!tag) return false;

    tagify.removeTag(tag.value);
    return !tagHasUuid(tagify, uuid);
}

/**
 * Adds or removes the quartet's keyword according to the current trigger value.
 *
 * @param {[string, string, string, string]} quartet
 * @param {HTMLElement} [triggerElement]
 */
export function toggleKeywordsInThesaurus(quartet, triggerElement) {
    if (!isValidQuartet(quartet)) return;

    const $trigger = $(triggerElement || ('#' + quartet[0]));
    const thesaurusInputId = quartet[2];
    const uuid = quartet[3];

    if (matchesTrigger($trigger, quartet[1])) {
        addKeywordByUuid(thesaurusInputId, uuid);
    } else {
        removeKeywordByUuid(thesaurusInputId, uuid);
    }
}

/**
 * Binds a delegated change listener for one catalogue quartet.
 *
 * @param {[string, string, string, string]} quartet
 */
export function setupEventListenersForKeywordAddition(quartet) {
    if (!isValidQuartet(quartet)) return;

    $(document).on('change.keywordsAutoAddition', '#' + quartet[0], function () {
        toggleKeywordsInThesaurus(quartet, this);
    });
}

/**
 * Wires catalogue listeners once thesauri Tagify inputs exist.
 * Safe to call more than once: existing listeners are not duplicated.
 */
export function bindKeywordAutoAddition() {
    KEYWORDS_CATALOGUE.forEach(function (quartet) {
        if (!isValidQuartet(quartet)) return;
        if (!$('#' + quartet[0]).length) return;

        const key = quartetKey(quartet);
        if (!boundQuartetKeys.has(key)) {
            setupEventListenersForKeywordAddition(quartet);
            boundQuartetKeys.add(key);
        }

        const $trigger = $('#' + quartet[0]);
        if (matchesTrigger($trigger, quartet[1])) {
            addKeywordByUuid(quartet[2], quartet[3]);
        }
    });
}

function handleKeywordsReady() {
    bindKeywordAutoAddition();
}

document.addEventListener(KEYWORDS_READY_EVENT, handleKeywordsReady);

/**
 * Clears bound change listeners. Used by unit tests to restore document handlers.
 */
export function resetKeywordAutoAddition() {
    boundQuartetKeys.clear();
    $(document).off('change.keywordsAutoAddition');
}
