<?php
/**
 * Entry point for API version 2.
 */

// Define the API version.
$version = 'v2';

/**
 * Include necessary dependencies and controller classes.
 */
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/controllers/GeneralController.php';
require_once __DIR__ . '/controllers/VocabController.php';
require_once __DIR__ . '/controllers/DatasetController.php';
require_once __DIR__ . '/controllers/ValidationController.php';
require_once __DIR__ . '/controllers/DraftController.php';

use FastRoute\Dispatcher;
use FastRoute\RouteCollector;

/**
 * Load the API routes from the routes configuration file.
 */
$routes = require __DIR__ . '/routes/api.php';

/**
 * Process the URI
 */
$uri = $_SERVER['REQUEST_URI'];

// Strip query string and decode
if (false !== $pos = strpos($uri, '?')) {
    $uri = substr($uri, 0, $pos);
}
$uri = rawurldecode($uri);

// Extract the path after /api/v2/
if (preg_match('#^.*?/api/v2(/.*)?$#', $uri, $matches)) {
    $uri = $matches[1] ?? '/';
} else {
    $uri = '/';
}

/**
 * Initialize the FastRoute dispatcher
 */
$dispatcher = FastRoute\simpleDispatcher(function (RouteCollector $r) use ($routes) {
    foreach ($routes as $route) {
        $r->addRoute($route[0], $route[1], $route[2]);
    }
});

$httpMethod = $_SERVER['REQUEST_METHOD'];
$routeInfo = $dispatcher->dispatch($httpMethod, $uri);

switch ($routeInfo[0]) {
    case Dispatcher::NOT_FOUND:
        http_response_code(404);
        echo json_encode(['error' => 'Not Found']);
        break;

    case Dispatcher::METHOD_NOT_ALLOWED:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
        break;

    case Dispatcher::FOUND:
        $handler = $routeInfo[1];
        $vars = $routeInfo[2];

        try {
            if (is_array($handler) && is_object($handler[0])) {
                $handler[0]->{$handler[1]}($vars);
            } else {
                call_user_func($handler, $vars);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Internal Server Error']);
        }
        break;
}