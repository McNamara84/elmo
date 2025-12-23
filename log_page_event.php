<?php
require_once __DIR__ . '/settings.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Allow only known events
    $allowedEvents = ['page loaded', 'save', 'submit'];
    $eventRaw = $_POST['event'] ?? '';
    $event = in_array($eventRaw, $allowedEvents, true) ? $eventRaw : 'unknown';

    // Validate ISO 8601 timestamps coming from Date().toISOString(); fall back to server time
    $timestampRaw = $_POST['timestamp'] ?? '';
    $isoPattern = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/';
    $timestamp = preg_match($isoPattern, $timestampRaw) === 1 ? $timestampRaw : date('c');

    // Strip control characters to avoid log injection
    $eventSafe = preg_replace('/[\x00-\x1F\x7F]/', '', $event);
    $timestampSafe = preg_replace('/[\x00-\x1F\x7F]/', '', $timestamp);

    error_log("[PAGE_EVENT📝] Event: {$eventSafe} | Timestamp: {$timestampSafe}");
    
    header('Content-Type: application/json');
    echo json_encode(['status' => 'logged']);
    exit();
}
?>