<?php

declare(strict_types=1);

/** Local deterministic ERNIE stub for browser/integration tests; never used by application code. */
header('Content-Type: application/json');
if (($_SERVER['HTTP_X_API_KEY'] ?? '') !== 'license-test-key') {
    http_response_code(401);
    echo '{"error":"Unauthorized"}';
    return;
}
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('~^/api/v1/resource-types/elmo(?:-msl)?$~D', $path)) {
    echo file_get_contents(__DIR__ . '/ernie-licenses/resource-types.json');
    return;
}
if ($path === '/api/v1/title-types/elmo') {
    echo '[{"id":1,"name":"Main Title"},{"id":2,"name":"Alternative Title"},{"id":3,"name":"Translated Title"}]';
    return;
}
if (!preg_match('~^/api/v1/licenses/(elmo|elmo-msl)(?:/([a-z-]+))?$~D', $path, $matches)) {
    http_response_code(404);
    echo '{"error":"Not a license fixture endpoint"}';
    return;
}
$profile = $matches[1];
$scope = $matches[2] ?? 'all';
// A test can control failures/revocations without touching any live ERNIE data.
$stateFile = getenv('ERNIE_LICENSE_TEST_STATE');
$state = $stateFile && is_file($stateFile) ? trim(file_get_contents($stateFile)) : '';
if ($state === 'offline') {
    http_response_code(503);
    echo '{"error":"Fixture outage"}';
    return;
}
if ($state === 'empty') {
    echo '[]';
    return;
}
$fixture = $scope === 'all' ? 'catalog-' . $profile : ($scope === 'software' ? 'software-elmo' : 'dataset-' . $profile);
echo file_get_contents(__DIR__ . '/ernie-licenses/' . $fixture . '.json');
