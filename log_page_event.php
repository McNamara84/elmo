<?php
require_once __DIR__ . '/../settings.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $event = $data['event'] ?? 'unknown';
    $timestamp = $data['timestamp'] ?? date('c');
    
    error_log("[📝PAGE_EVENT] Event: $event | Timestamp: $timestamp");
    
    header('Content-Type: application/json');
    echo json_encode(['status' => 'logged']);
    exit();
}
?>