<?php

declare(strict_types=1);

/**
 * Return a human-readable violation or null when the file name is valid or out of scope.
 */
function elmoFileNameViolation(string $path): ?string
{
    $normalizedPath = str_replace('\\', '/', trim($path));
    if ($normalizedPath === '' || elmoFileNameCheckIsExcluded($normalizedPath)) {
        return null;
    }

    if ($normalizedPath === 'ci-router.php') {
        return null;
    }

    $extension = strtolower((string) pathinfo($normalizedPath, PATHINFO_EXTENSION));
    $fileName = (string) pathinfo($normalizedPath, PATHINFO_FILENAME);

    if ($extension === 'php') {
        $isClassFile = false;
        if (is_file($normalizedPath)) {
            $contents = file_get_contents($normalizedPath);
            $isClassFile = is_string($contents)
                && preg_match('/\b(?:abstract\s+|final\s+)?(?:class|interface|trait|enum)\s+[A-Za-z_]/', $contents) === 1;
        } else {
            $isClassFile = preg_match('/Test$/', $fileName) === 1;
        }

        $pattern = $isClassFile
            ? '/^[A-Z][A-Za-z0-9]*$/'
            : '/^[a-z0-9]+(?:_[a-z0-9]+)*$/';

        if (preg_match($pattern, $fileName) !== 1) {
            return $isClassFile
                ? 'PHP classes and tests must use PascalCase.php'
                : 'procedural PHP files must use snake_case.php';
        }

        return null;
    }

    if ($extension === 'js') {
        if (str_ends_with($fileName, '.test')) {
            return preg_match('/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)*\.test$/', $fileName) === 1
                ? null
                : 'Jest tests must use dot-delimited camelCase.test.js';
        }

        return preg_match('/^[a-z][A-Za-z0-9]*$/', $fileName) === 1
            ? null
            : 'JavaScript modules must use camelCase.js';
    }

    if ($extension === 'ts' && str_ends_with($fileName, '.spec')) {
        $specName = substr($fileName, 0, -5);
        return preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $specName) === 1
            ? null
            : 'Playwright specifications must use kebab-case.spec.ts';
    }

    if (in_array($extension, ['html', 'png', 'svg', 'ico'], true)) {
        return preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $fileName) === 1
            ? null
            : 'HTML files and static browser assets must use kebab-case';
    }

    return null;
}

function elmoFileNameCheckIsExcluded(string $path): bool
{
    $excludedPrefixes = [
        'vendor/',
        'node_modules/',
        'coverage/',
        'coverage-',
        'playwright-report/',
        'test-results/',
        'storage/',
        'xml/',
    ];

    foreach ($excludedPrefixes as $prefix) {
        if (str_starts_with($path, $prefix)) {
            return true;
        }
    }

    return false;
}

/**
 * @param list<string> $arguments
 * @return list<string>
 */
function elmoFilesToCheck(array $arguments): array
{
    if (in_array('--all', $arguments, true)) {
        return elmoRunGitNameCommand('git ls-files');
    }

    foreach ($arguments as $argument) {
        if (str_starts_with($argument, '--base=')) {
            $base = substr($argument, strlen('--base='));
            if ($base === '' || preg_match('/^[A-Za-z0-9._\/-]+$/', $base) !== 1) {
                throw new InvalidArgumentException('Invalid --base revision.');
            }

            return elmoRunGitNameCommand(
                'git diff --name-only --diff-filter=ACMR ' . escapeshellarg($base . '...HEAD')
            );
        }
    }

    $files = array_merge(
        elmoRunGitNameCommand('git diff --name-only --diff-filter=ACMR HEAD'),
        elmoRunGitNameCommand('git diff --cached --name-only --diff-filter=ACMR'),
        elmoRunGitNameCommand('git ls-files --others --exclude-standard')
    );

    return array_values(array_unique($files));
}

/**
 * @return list<string>
 */
function elmoRunGitNameCommand(string $command): array
{
    $output = [];
    $exitCode = 0;
    exec($command, $output, $exitCode);
    if ($exitCode !== 0) {
        throw new RuntimeException('Could not determine files with: ' . $command);
    }

    return array_values(array_filter(array_map('trim', $output), static fn (string $path): bool => $path !== ''));
}

/**
 * @param list<string> $arguments
 */
function elmoRunFileNameCheck(array $arguments): int
{
    try {
        $files = elmoFilesToCheck($arguments);
    } catch (Throwable $exception) {
        fwrite(STDERR, $exception->getMessage() . PHP_EOL);
        return 2;
    }

    $violations = [];
    foreach ($files as $file) {
        $violation = elmoFileNameViolation($file);
        if ($violation !== null) {
            $violations[$file] = $violation;
        }
    }

    if ($violations === []) {
        fwrite(STDOUT, sprintf("File-name check passed for %d file(s).%s", count($files), PHP_EOL));
        return 0;
    }

    fwrite(STDERR, "File-name convention violations:" . PHP_EOL);
    foreach ($violations as $file => $violation) {
        fwrite(STDERR, sprintf("- %s: %s%s", $file, $violation, PHP_EOL));
    }

    return 1;
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $arguments = [];
    foreach ($_SERVER['argv'] ?? [] as $argument) {
        if (is_string($argument)) {
            $arguments[] = $argument;
        }
    }

    exit(elmoRunFileNameCheck($arguments));
}
