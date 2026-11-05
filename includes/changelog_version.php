<?php

/**
 * Read the version shown in the footer from the changelog's single data source.
 * Return null when the file is unavailable or inconsistent.
 *
 * @param string $path Absolute path to the changelog JSON file.
 * @return string|null The current release version, or null if it cannot be trusted.
 */
function elmoChangelogVersion(string $path): ?string
{
    $contents = @file_get_contents($path);
    if ($contents === false) {
        return null;
    }

    $data = json_decode($contents, true);
    if (!is_array($data) || !isset($data['releases']) || !is_array($data['releases'])) {
        return null;
    }
    $version = $data['currentVersion'] ?? null;
    $listed = false;
    foreach ($data['releases'] as $release) {
        if (is_array($release) && ($release['version'] ?? null) === $version) {
            $listed = true;
            break;
        }
    }
    if (!is_string($version) || !preg_match('/^\d+\.\d+\.\d+(?:RC\d+|dev)?$/', $version) || !$listed) {
        return null;
    }

    return $version;
}
