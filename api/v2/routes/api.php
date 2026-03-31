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
require_once __DIR__ . '/../controllers/ICGEMController.php';
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
    ['GET', '/update/ror', [new VocabController(), 'getRorAffiliations']],
    ['GET', '/update/crossref', [new VocabController(), 'getCrossref']],

    // Vocabulary retrieval endpoints
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
    ['GET', '/vocabs/descriptiontypes', [new VocabController(), 'getDescriptionTypes']],

    // Thesauri vocabulary endpoints (ERNIE proxy with caching)
    ['GET', '/vocabs/thesauri/availability', [new VocabController(), 'getThesauriAvailability']],
    ['GET', '/vocabs/thesauri/gcmd-science-keywords', [new VocabController(), 'getGcmdScienceKeywordsFromErnie']],
    ['GET', '/vocabs/thesauri/gcmd-platforms', [new VocabController(), 'getGcmdPlatformsFromErnie']],
    ['GET', '/vocabs/thesauri/gcmd-instruments', [new VocabController(), 'getGcmdInstrumentsFromErnie']],
    ['GET', '/vocabs/thesauri/chronostrat-timescale', [new VocabController(), 'getChronostratTimescale']],
    ['GET', '/vocabs/thesauri/gemet', [new VocabController(), 'getGemet']],

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
    ['GET', '/dataset/icgem_export/{id}', [new ICGEMController(), 'exportICGEMxml']],


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
    ['GET', '/admin/cache/languages/status', [new VocabController(), 'getLanguagesCacheStatus']],

    // PID4INST instruments endpoints
    ['GET', '/vocabs/pid4inst/instruments', [new VocabController(), 'getPid4instInstruments']],
    ['POST', '/admin/cache/pid4inst/refresh', [new VocabController(), 'refreshPid4instCache']],
    ['GET', '/admin/cache/pid4inst/status', [new VocabController(), 'getPid4instCacheStatus']],

    // Contributor roles cache management endpoints
    ['POST', '/admin/cache/roles/contributor-persons/refresh', [new VocabController(), 'refreshContributorPersonRolesCache']],
    ['GET', '/admin/cache/roles/contributor-persons/status', [new VocabController(), 'getContributorPersonRolesCacheStatus']],
    ['POST', '/admin/cache/roles/contributor-institutions/refresh', [new VocabController(), 'refreshContributorInstitutionRolesCache']],
    ['GET', '/admin/cache/roles/contributor-institutions/status', [new VocabController(), 'getContributorInstitutionRolesCacheStatus']],

    // Description types cache management endpoints
    ['POST', '/admin/cache/descriptiontypes/refresh', [new VocabController(), 'refreshDescriptionTypesCache']],
    ['GET', '/admin/cache/descriptiontypes/status', [new VocabController(), 'getDescriptionTypesCacheStatus']],

    // Relation types cache management endpoints
    ['POST', '/admin/cache/relationtypes/refresh', [new VocabController(), 'refreshRelationTypesCache']],
    ['GET', '/admin/cache/relationtypes/status', [new VocabController(), 'getRelationTypesCacheStatus']],

    // Identifier types cache management endpoints
    ['POST', '/admin/cache/identifiertypes/refresh', [new VocabController(), 'refreshIdentifierTypesCache']],
    ['GET', '/admin/cache/identifiertypes/status', [new VocabController(), 'getIdentifierTypesCacheStatus']],

    // Thesauri availability cache management
    ['POST', '/admin/cache/thesauri/availability/refresh', [new VocabController(), 'refreshThesauriAvailabilityCache']],
    ['GET', '/admin/cache/thesauri/availability/status', [new VocabController(), 'getThesauriAvailabilityCacheStatus']]
];
