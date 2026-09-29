<?php

/**
 * Read the version shown in the footer from the changelog's single data source.
 * Return null when the file is unavailable or inconsistent.
 */
function elmoChangelogVersion(string $path): ?string
{
    $contents = @file_get_contents($path);
    if ($contents === false) {
        return null;
    }

    $data = json_decode($contents, true);
    $version = $data['currentVersion'] ?? null;
    $latest = $data['releases'][0]['version'] ?? null;
    if (!is_string($version) || !preg_match('/^\d+\.\d+\.\d+(?:RC\d+)?$/', $version) || $latest !== $version) {
        return null;
    }

    return $version;
}
