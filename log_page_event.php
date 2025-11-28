<?php
require_once __DIR__ . '/settings.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Handle both JSON and form-urlencoded data
    $event = $_POST['event'] ?? 'unknown';
    $timestamp = $_POST['timestamp'] ?? date('c');
    
    error_log("[PAGE_EVENT📝] Event: $event | Timestamp: $timestamp");
    
    header('Content-Type: application/json');
    echo json_encode(['status' => 'logged']);
    exit();
}
?>