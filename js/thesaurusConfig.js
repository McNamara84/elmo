/**
 * Static thesaurus definitions shared by thesauri.js and doiPrefill.js.
 * Kept separate so DOI import can read the selectors without running
 * thesauri.js document.ready side effects.
 */
export const THESAURUS_CONFIG = {
    science_keywords: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-science-keywords',
        inputName: 'gcmdScienceKeywords',
        inputId: 'input-sciencekeyword',
        modalId: 'modal-sciencekeyword',
        jsTreeId: 'jstree-sciencekeyword',
        searchInputId: 'input-sciencekeyword-thesaurussearch',
        selectedListId: 'selected-keywords-sciencekeyword',
        helpSectionId: 'help-scienceKeywords-keyword',
        stateKey: 'input-sciencekeyword'
    },
    platforms: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-platforms',
        inputName: 'platforms',
        inputId: 'input-platforms',
        modalId: 'modal-platforms',
        jsTreeId: 'jstree-platforms',
        searchInputId: 'input-platforms-thesaurussearch',
        selectedListId: 'selected-keywords-platforms',
        helpSectionId: 'help-gcmd-platforms-keyword',
        stateKey: 'input-platforms'
    },
    instruments: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-instruments',
        inputName: 'instruments',
        inputId: 'input-instruments',
        modalId: 'modal-instruments',
        jsTreeId: 'jstree-instruments',
        searchInputId: 'input-instruments-thesaurussearch',
        selectedListId: 'selected-keywords-instruments',
        helpSectionId: 'help-gcmd-instruments-keyword',
        stateKey: 'input-instruments'
    },
    chronostratigraphy: {
        apiEndpoint: 'api/v2/vocabs/thesauri/chronostrat-timescale',
        inputName: 'chronostratKeywords',
        inputId: 'input-chronostratigraphy',
        modalId: 'modal-chronostratigraphy',
        jsTreeId: 'jstree-chronostratigraphy',
        searchInputId: 'input-chronostratigraphy-thesaurussearch',
        selectedListId: 'selected-keywords-chronostratigraphy',
        helpSectionId: 'help-chronostratigraphy-keyword',
        stateKey: 'input-chronostratigraphy'
    },
    gemet: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gemet',
        inputName: 'gemetKeywords',
        inputId: 'input-gemet',
        modalId: 'modal-gemet',
        jsTreeId: 'jstree-gemet',
        searchInputId: 'input-gemet-thesaurussearch',
        selectedListId: 'selected-keywords-gemet',
        helpSectionId: 'help-gemet-keyword',
        stateKey: 'input-gemet'
    },
    satellitePlatforms: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-platforms',
        rootNodeId: 'https://gcmd.earthdata.nasa.gov/kms/concept/b39a69b4-c3b9-4a94-b296-bbbbe5e4c847',
        // Datasource controls are pre-rendered outside the generic thesauri generator, so this dynamic config keeps selectors.
        modalId: '#modal-platforms-datasource',
        jsTreeId: '#jstree-platforms-datasource',
        searchInputId: '#input-platforms-thesaurussearch-ds',
        selectedListId: 'selected-keywords-platforms-ds',
        stateKey: 'satellitePlatforms',
        dynamicOnly: true
    }
};
