<?php

declare(strict_types=1);

/**
 * Open a MySQL connection from DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, and DB_PORT.
 *
 * The returned object may still carry a connect_error. Callers decide how to report that.
 */
function connectDb(): mysqli
{
    $host = getenv('DB_HOST') ?: 'localhost';
    $username = getenv('DB_USER') ?: 'your_database_username';
    $password = getenv('DB_PASSWORD') ?: 'your_database_password';
    $database = getenv('DB_NAME') ?: 'your_database_name';
    $port = getenv('DB_PORT') ? (int) getenv('DB_PORT') : 3306;

    return new mysqli($host, $username, $password, $database, $port);
}

/**
 * Return the request or test connection, opening one only when none is stored yet.
 */
function getConnection(): mysqli
{
    $existing = $GLOBALS['connection'] ?? null;
    if ($existing instanceof mysqli) {
        return $existing;
    }

    $GLOBALS['connection'] = connectDb();

    return $GLOBALS['connection'];
}
