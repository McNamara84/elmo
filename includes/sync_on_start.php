<?php
// try running all the syncToDb methods from ERNIE service.
// on error, fetch them with onFreshData parameter.
require_once __DIR__ . '/../api/v2/controllers/VocabController.php';
require_once __DIR__ . '/../api/v2/services/ErnieService.php';
require_once __DIR__ . '/../api/v2/services/LicenseRepository.php';

try {
    $controller = new VocabController();
    $service = new ErnieService();

    // License availability must never prevent the other vocabularies from starting.
    try {
        $licenses = $service->getLicensesWithCache();
        (new LicenseRepository($connection))->map($licenses['licenses'], $service->getLicenseOrigin());
    } catch (Exception $error) {
        error_log('License mapping could not be initialized: ' . $error->getMessage());
    }

    $controller->syncRolesToDb($service->getContributorPersonRolesWithCache(), 0);
    $controller->syncRolesToDb($service->getContributorInstitutionRolesWithCache(), 1);
    $controller->syncResourceTypesFromErnie($service->getResourceTypesWithCache());
    $controller->syncTitleTypesFromErnie($service->getTitleTypesWithCache());
    $controller->syncRelationTypesFromErnie($service->getRelationTypesWithCache());
    $controller->syncLanguagesToDb($service->getLanguagesWithCache());
} catch (Exception $e) {
    error_log("Error during sync on start: " . $e->getMessage());
}
