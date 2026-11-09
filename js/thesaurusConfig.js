/**
 * Canonical registry for every ERNIE-backed thesaurus consumer.
 *
 * Keep routing and DOM metadata here so XML upload, DOI prefill, Tagify and
 * jsTree do not maintain parallel maps:
 * - inputId identifies the Tagify source input (stored without "#").
 * - inputName is the submitted form field name and a DOM lookup fallback.
 * - searchInputId identifies the modal's text-search input, not a Tagify input.
 * - schemeURIs / subjectSchemes classify imported DataCite subjects.
 *
 * `satellitePlatforms` is dynamicOnly because datasource rows own their Tagify
 * inputs. MSL remains outside this registry because initMslKeywords has its own
 * non-ERNIE lifecycle.
 */
export const THESAURUS_CONFIG = {
    science_keywords: {
        apiEndpoint: 'api/v2/vocabs/thesauri/gcmd-science-keywords',
        inputName: 'gcmdScienceKeywords',
        inputId: 'input-sciencekeyword',
        schemeURIs: ['https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords'],
        subjectSchemes: ['NASA/GCMD Earth Science Keywords'],
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
        schemeURIs: ['https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms'],
        subjectSchemes: ['NASA/GCMD Platforms', 'GCMD Platforms'],
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
        schemeURIs: ['https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments'],
        subjectSchemes: ['NASA/GCMD Instruments', 'GCMD Instruments'],
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
        schemeURIs: ['http://resource.geosciml.org/vocabulary/timescale/gts2020'],
        subjectSchemes: ['International Chronostratigraphic Chart', 'Chronostratigraphic Chart'],
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
        schemeURIs: [
            'http://www.eionet.europa.eu/gemet/gemetThesaurus',
            'http://www.eionet.europa.eu/gemet/concept/'
        ],
        subjectSchemes: ['GEMET - Concepts'],
        subjectSchemePrefixes: ['GEMET'],
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
