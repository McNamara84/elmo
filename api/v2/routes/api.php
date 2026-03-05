<?php
/**
 *
 * This file defines the routing configuration for API version 2.
 * It maps HTTP methods and URL patterns to specific controller methods.
 *
 */

require_once __DIR__ . '/../controllers/GeneralController.php';
require_once __DIR__ . '/../controllers/VocabController.php';
require_once __DIR__ . '/../controllers/ValidationController.php';
require_once __DIR__ . '/../controllers/DatasetController.php';
require_once __DIR__ . '/../controllers/DraftController.php';
require_once __DIR__ . '/../controllers/AffiliationController.php';

return [
    // General endpoints
    ['GET', '/general/alive', [new GeneralController(), 'getAlive']],

    // Affiliation search endpoint (server-side search for performance)
    ['GET', '/affiliations/search', [new AffiliationController(), 'search']],

    // Vocabulary update endpoints
    ['GET', '/update/vocabs/msl/labs', [new VocabController(), 'updateMslLabs']],
    ['GET', '/update/vocabs/msl', [new VocabController(), 'getMslVocab']],
    ['GET', '/update/timezones', [new VocabController(), 'updateTimezones']],
    ['GET', '/update/vocabs/gcmd', [new VocabController(), 'updateGcmdVocabs']],
    ['GET', '/update/vocabs/cgi', [new VocabController(), 'updateCGIKeywords']],
    ['GET', '/update/ror', [new VocabController(), 'getRorAffiliations']],
    ['GET', '/update/crossref', [new VocabController(), 'getCrossref']],

    // Vocabulary retrieval endpoints
    ['GET', '/vocabs/sciencekeywords', [new VocabController(), 'getGcmdScienceKeywords']],
    ['GET', '/vocabs/cgi', [new VocabController(), 'getCGIKeywords']],
    ['GET', '/vocabs/roles[/{type}]', [new VocabController(), 'getRoles']],
    ['GET', '/vocabs/relations', [new VocabController(), 'getRelations']],
    ['GET', '/vocabs/licenses/all', [new VocabController(), 'getAllLicenses']],
    ['GET', '/vocabs/licenses/software', [new VocabController(), 'getSoftwareLicenses']],
    ['GET', '/vocabs/freekeywords/all', [new VocabController(), 'getAllFreeKeywords']],
    ['GET', '/vocabs/freekeywords/curated', [new VocabController(), 'getCuratedFreeKeywords']],
    ['GET', '/vocabs/freekeywords/uncurated', [new VocabController(), 'getUncuratedFreeKeywords']],
    ['GET', '/vocabs/resourcetypes', [new VocabController(), 'getResourceTypes']],
    ['GET', '/vocabs/languages', [new VocabController(), 'getLanguages']],
    ['GET', '/vocabs/titletypes', [new VocabController(), 'getTitleTypes']],

    // Vocabulary retrieval for ICGEM implementation
    ['GET', '/vocabs/icgemformats', [new VocabController(), 'getICGEMFileFormats']],
    ['GET', '/vocabs/modeltypes', [new VocabController(), 'getICGEMModelTypes']],
    ['GET', '/vocabs/mathreps', [new VocabController(), 'getMathRepresentations']],

    // Validation endpoints
    ['GET', '/validation/patterns[/{type}]', [new ValidationController(), 'getPattern']],
    ['GET', '/validation/identifiertypes/all', [new ValidationController(), 'getIdentifierTypes']],
    ['GET', '/validation/identifiertypes/active', [new ValidationController(), 'getActiveIdentifierTypes']],
    ['GET', '/validation/identifiertypes/inactive', [new ValidationController(), 'getInactiveIdentifierTypes']],

    // Dataset export endpoints
    ['GET', '/dataset/export/{id}/all/download', [new DatasetController(), 'exportAllDownload']],
    ['GET', '/dataset/export/{id}/all', [new DatasetController(), 'exportAll']],
    ['GET', '/dataset/export/{id}/{scheme}/download', [new DatasetController(), 'exportResourceDownload']],
    ['GET', '/dataset/export/{id}/{scheme}', [new DatasetController(), 'exportResource']],


    // Export base xml for data mapping to the ICGEM metadatabase
    ['GET', '/dataset/icgem_export/{id}', [new DatasetController(), 'exportICGEMxml']],


    // Draft autosave endpoints
    ['POST', '/drafts', [new DraftController(), 'create']],
    ['PUT', '/drafts/{id}', [new DraftController(), 'update']],
    ['DELETE', '/drafts/{id}', [new DraftController(), 'delete']],
    ['GET', '/drafts/session/latest', [new DraftController(), 'latestForSession']],
    ['GET', '/drafts/{id}', [new DraftController(), 'get']],

    // ERNIE cache management endpoints
    ['POST', '/admin/cache/resourcetypes/refresh', [new VocabController(), 'refreshResourceTypesCache']],
    ['GET', '/admin/cache/resourcetypes/status', [new VocabController(), 'getResourceTypesCacheStatus']],
    ['POST', '/admin/cache/titletypes/refresh', [new VocabController(), 'refreshTitleTypesCache']],
    ['GET', '/admin/cache/titletypes/status', [new VocabController(), 'getTitleTypesCacheStatus']],
    ['POST', '/admin/cache/languages/refresh', [new VocabController(), 'refreshLanguagesCache']],
    ['GET', '/admin/cache/languages/status', [new VocabController(), 'getLanguagesCacheStatus']]
];
