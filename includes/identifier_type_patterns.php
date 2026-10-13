<?php

/**
 * Reads ERNIE identifier-type patterns.
 *
 * ERNIE stores them as patterns.validation and patterns.detection, each a list
 * of {pattern, priority}. Older records use a single pattern string.
 */

/**
 * @param mixed $entries Pattern list from ERNIE or a legacy string.
 * @return list<array{pattern: string, priority: int}> Highest priority first.
 */
function identifierTypePatternEntries(mixed $entries): array
{
    if (is_string($entries)) {
        $entries = [['pattern' => $entries, 'priority' => 0]];
    }
    if (!is_array($entries)) {
        return [];
    }

    $normalized = [];
    foreach ($entries as $entry) {
        if (is_string($entry)) {
            $pattern = trim($entry);
            $priority = 0;
        } elseif (is_array($entry)) {
            $pattern = trim((string) ($entry['pattern'] ?? ''));
            $priority = (int) ($entry['priority'] ?? 0);
        } else {
            continue;
        }
        if ($pattern === '') {
            continue;
        }
        $normalized[] = ['pattern' => $pattern, 'priority' => $priority];
    }

    usort(
        $normalized,
        static fn(array $left, array $right): int => $right['priority'] <=> $left['priority']
    );

    return $normalized;
}

/**
 * Joins several full-value patterns so one HTML pattern attribute accepts any of them.
 *
 * @param list<array{pattern: string, priority: int}> $entries
 */
function combineIdentifierTypePatterns(array $entries): string
{
    $patterns = array_map(static fn(array $entry): string => $entry['pattern'], $entries);
    if (count($patterns) === 0) {
        return '';
    }
    if (count($patterns) === 1) {
        return $patterns[0];
    }

    return implode('|', array_map(static fn(string $pattern): string => '(?:' . $pattern . ')', $patterns));
}

/**
 * Validation uses patterns.validation. An empty validation list falls back to
 * detection, then to the legacy pattern field. Detection uses patterns.detection
 * and falls back the other way.
 *
 * @param array<string, mixed> $type
 * @return array{pattern: string, detectionPatterns: list<array{pattern: string, priority: int}>}
 */
function resolveIdentifierTypePatterns(array $type): array
{
    $patterns = $type['patterns'] ?? null;
    $validation = identifierTypePatternEntries(is_array($patterns) ? ($patterns['validation'] ?? []) : []);
    $detection = identifierTypePatternEntries(is_array($patterns) ? ($patterns['detection'] ?? []) : []);
    $legacy = trim((string) ($type['pattern'] ?? ''));

    if ($validation === [] && $detection !== []) {
        $validation = $detection;
    }
    if ($validation === [] && $legacy !== '') {
        $validation = [['pattern' => $legacy, 'priority' => 0]];
    }
    if ($detection === []) {
        $detection = $validation;
    }

    return [
        'pattern' => combineIdentifierTypePatterns($validation),
        'detectionPatterns' => $detection,
    ];
}
