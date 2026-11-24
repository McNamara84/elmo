<?php

declare(strict_types=1);

/** Database startup coordination and the container-local readiness check. */

function containerTimeout(string $name, int $default): int
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        return $default;
    }
    $timeout = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 3600]]);
    if ($timeout === false) {
        throw new InvalidArgumentException("$name must be an integer between 1 and 3600 seconds.");
    }
    return $timeout;
}

function containerInstallAction(string $action): string
{
    if (!in_array($action, ['basic', 'complete', 'skip'], true)) {
        throw new InvalidArgumentException('INSTALL_ACTION must be basic, complete, or skip.');
    }
    return $action;
}

function containerDatabaseConnect(int $readTimeout, bool $serverOnly = false): mysqli
{
    $database = mysqli_init();
    if ($database === false) {
        throw new RuntimeException('Cannot initialize the database connection.');
    }
    $database->options(MYSQLI_OPT_CONNECT_TIMEOUT, 2);
    $database->options(MYSQLI_OPT_READ_TIMEOUT, $readTimeout);
    $database->real_connect(
        getenv('DB_HOST') ?: 'db',
        $serverOnly ? 'root' : (getenv('DB_USER') ?: ''),
        $serverOnly ? (getenv('ROOT_PASSWORD') ?: '') : (getenv('DB_PASSWORD') ?: ''),
        $serverOnly ? '' : (getenv('DB_NAME') ?: ''),
        (int) (getenv('DB_PORT') ?: 3306)
    );
    return $database;
}

function waitForContainerDatabase(int $timeout, int $readTimeout, bool $serverOnly = false): mysqli
{
    $deadline = microtime(true) + $timeout;
    do {
        try {
            return containerDatabaseConnect($readTimeout, $serverOnly);
        } catch (mysqli_sql_exception $exception) {
            if (microtime(true) >= $deadline) {
                throw new RuntimeException('Timed out waiting for authenticated database access.', 0, $exception);
            }
            usleep(200000);
        }
    } while (true);
}

function containerDatabaseLockName(): string
{
    // MySQL also supports this name length. Separate databases do not block each other.
    return 'elmo-startup-' . sha1(getenv('DB_NAME') ?: '');
}

function containerDatabaseLock(mysqli $database, int $timeout): bool
{
    $result = $database->execute_query('SELECT GET_LOCK(?, ?)', [containerDatabaseLockName(), $timeout]);
    if (!$result instanceof mysqli_result) {
        throw new RuntimeException('Cannot inspect the database startup lock.');
    }
    return (int) ($result->fetch_row()[0] ?? 0) === 1;
}

function releaseContainerDatabaseLock(mysqli $database): void
{
    $database->execute_query('SELECT RELEASE_LOCK(?)', [containerDatabaseLockName()]);
}

function containerDatabaseSchemaReady(mysqli $database): bool
{
    try {
        // An open TCP connection or SELECT 1 alone does not establish schema readiness.
        $database->query('SELECT 1 FROM Resource, Resource_Type, Rights, Language, Role, Title_Type LIMIT 0');
        return true;
    } catch (mysqli_sql_exception $exception) {
        if ($exception->getCode() !== 1146) { // Missing table while waiting for an initializer.
            throw $exception;
        }
        return false;
    }
}

function lockReadyContainerDatabase(mysqli $database, int $timeout, bool $needsSchema): void
{
    $deadline = microtime(true) + $timeout;
    do {
        $remaining = max(0, (int) ceil($deadline - microtime(true)));
        if (!containerDatabaseLock($database, $remaining)) {
            throw new RuntimeException('Timed out waiting for the database startup lock.');
        }
        if (!$needsSchema || containerDatabaseSchemaReady($database)) {
            return; // Caller keeps the connection and lock throughout reset and sync.
        }
        releaseContainerDatabaseLock($database);
        if (microtime(true) >= $deadline) {
            throw new RuntimeException('Timed out waiting for an initialized database schema.');
        }
        usleep(200000);
    } while (true);
}

function containerHttpReady(): bool
{
    $port = (int) (getenv('APACHE_PORT') ?: 80);
    $context = stream_context_create(['http' => ['timeout' => 2, 'follow_location' => 0]]);
    $response = @file_get_contents("http://127.0.0.1:$port/api/v2/general/alive", false, $context);
    // @phpstan-ignore nullCoalesce.variable (PHP 8.3 fallback; absent on transport failure.)
    $headers = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : ($http_response_header ?? []);
    return $response !== false
        && preg_match('~^HTTP/\S+ 200(?: |$)~', $headers[0] ?? '') === 1
        && (json_decode($response, true)['message'] ?? null) === "I'm still alive...";
}

$isContainerDatabaseRequest = realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__;
if ($isContainerDatabaseRequest && PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit();
}

if ($isContainerDatabaseRequest) {
    $startupConnection = null;
    try {
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        $command = $_SERVER['argv'][1] ?? '';
        if (!in_array($command, ['wait', 'wait-server', 'initialize', 'healthcheck'], true)) {
            throw new InvalidArgumentException('Usage: php scripts/container_database.php <wait|wait-server|initialize|healthcheck> [basic|complete|skip]');
        }
        if ($command === 'healthcheck') {
            if (!is_file('/tmp/elmo-startup-ready')) {
                throw new RuntimeException('Container initialization has not finished.');
            }
            $startupConnection = containerDatabaseConnect(2);
            if (!containerDatabaseLock($startupConnection, 0)
                || !containerDatabaseSchemaReady($startupConnection) || !containerHttpReady()) {
                throw new RuntimeException('Container HTTP/database readiness check failed.');
            }
        } else {
            if ($command === 'initialize' && is_file('/tmp/elmo-startup-ready')) {
                unlink('/tmp/elmo-startup-ready');
            }
            $action = containerInstallAction($_SERVER['argv'][2] ?? 'basic');
            $initTimeout = containerTimeout('DB_INIT_TIMEOUT', 180);
            $startupConnection = waitForContainerDatabase(
                containerTimeout('DB_WAIT_TIMEOUT', 120), $initTimeout + 5, $command === 'wait-server'
            );
            if ($command === 'initialize') {
                lockReadyContainerDatabase($startupConnection, $initTimeout, $action === 'skip');
                require_once dirname(__DIR__) . '/settings.php';
                if (!isset($connection) || !$connection instanceof mysqli) {
                    throw new RuntimeException('settings.php did not provide a database connection.');
                }
                if ($action !== 'skip') {
                    require_once __DIR__ . '/install.php';
                    echo "Resetting database cache ($action)...\n";
                    $result = processInstallation($connection, $action);
                    if ($result['status'] !== 'success') {
                        throw new RuntimeException((string) $result['message']);
                    }
                    echo $result['message'] . PHP_EOL;
                } else {
                    echo "Using the initialized shared database (skip).\n";
                }
                // Keep the named DB lock on its own connection: included services may
                // create other connections, but must not release this process's lock.
                require dirname(__DIR__) . '/includes/sync_on_start.php';
                if (!containerDatabaseSchemaReady($startupConnection)
                    || file_put_contents('/tmp/elmo-startup-ready', "ready\n") === false) {
                    throw new RuntimeException('Cannot mark container initialization as ready.');
                }
            }
        }
    } catch (Throwable $exception) {
        fwrite(STDERR, $exception->getMessage() . PHP_EOL);
        exit(1); // Closing the process also releases its connection-scoped lock.
    } finally {
        if ($startupConnection instanceof mysqli) {
            $startupConnection->close(); // Releases GET_LOCK on success and on failure.
        }
    }
}
