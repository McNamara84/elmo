<?php
require_once('settings.php');

header('Content-Type: application/json');

// Return the API key as JSON
echo json_encode(['apiKey' => $apiKeyTimezone]);