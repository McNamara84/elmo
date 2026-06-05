<?php
if (!defined('UNIT_TESTING')) {
    require_once __DIR__ . '/settings.php';
}

if (!function_exists('handle_log_page_event')) {
    /**
     * Process a page event log request.
     * The function outputs 2 parts: even and status. The event is one of the allowed events, and describes the type of page action. Stat
     * @param array $post Incoming POST data
     * @param array $server Server context (expects REQUEST_METHOD)
     * @param callable|null $logger Logger callback; defaults to error_log
     * @param callable|null $nowProvider Time provider; defaults to date('c')
     * @return array{status:string,event?:string,timestamp?:string}
     */
    function handle_log_page_event(array $post, array $server, ?callable $logger = null, ?callable $nowProvider = null): array
    {
        if (($server['REQUEST_METHOD'] ?? '') !== 'POST') {
            return ['status' => 'ignored'];
        }

        $allowedEvents = ['page loaded', 'save', 'submit'];
        $eventRaw = $post['event'] ?? '';
        $event = in_array($eventRaw, $allowedEvents, true) ? $eventRaw : 'unknown';

        $timestampRaw = $post['timestamp'] ?? '';
        $isoPattern = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/';
        $timestamp = preg_match($isoPattern, $timestampRaw) === 1
            ? $timestampRaw
            : ($nowProvider ? $nowProvider() : date('c'));

        $eventSafe = preg_replace('/[\x00-\x1F\x7F]/', '', $event);
        $timestampSafe = preg_replace('/[\x00-\x1F\x7F]/', '', $timestamp);
        
        $statusRaw = $post['status'] ?? '';
        $statusSafe = preg_replace('/[\x00-\x1F\x7F]/', '', $statusRaw);

        $logMessage = "[PAGE_EVENT📝] Type: {$eventSafe} | Message: {$statusSafe} | Timestamp: {$timestampSafe}";
        ($logger ?? 'error_log')($logMessage);

        return [
            'status' => 'logged',
            'event' => $eventSafe,
            'timestamp' => $timestampSafe,
        ];
    }
}

$result = handle_log_page_event($_POST, $_SERVER);

if (($result['status'] ?? '') === 'logged') {
    header('Content-Type: application/json');
    echo json_encode(['response' => 'logged']);
}

if (!defined('UNIT_TESTING')) {
    exit();
}

return $result;
?>