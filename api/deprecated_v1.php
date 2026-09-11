<?php
////////////////////////////////////////////////////////////////////////////////////////
// This script was for the APIv1 endpoints and is now deprecated.
// All vocabulary endpoints have been migrated to APIv2.
// GCMD, Chronostrat, GEMET and CGI vocabularies are now served via ERNIE proxy.
// See: api/v2/routes/api.php
////////////////////////////////////////////////////////////////////////////////////////

http_response_code(410);
header('Content-Type: application/json');
echo json_encode([
    'error' => 'API v1 is deprecated. Please use API v2.',
    'documentation' => 'api/v2/docs/index.html'
]);
