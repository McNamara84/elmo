<?php
require_once('../settings.php');

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

// Return the API key as JSON
echo json_encode(['apiKey' => $apiKeyTimezone]);