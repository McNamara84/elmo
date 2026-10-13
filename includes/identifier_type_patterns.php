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

    // Higher priority wins. The comparison is reversed so 30 sorts before 10.
    usort(
        $normalized,
        static fn(array $left, array $right): int => $right['priority'] <=> $left['priority']
    );

    return $normalized;
}

/**
 * Joins several full-value patterns so one HTML pattern attribute accepts any of them.
 *
 * The browser wraps a pattern attribute as ^(?: ... )$. Each alternative is its
 * own group because the source patterns already contain ^ and $. Without the
 * group, ^ in a later alternative would not mean "start of the value".
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

    // A non-empty validation list is left alone. Detection patterns are often
    // prefixes such as ^https?://, and the browser requires the pattern to
    // match the whole value, so they must not replace a real validation regex.
    // Copy detection only when validation itself is empty.
    if ($validation === [] && $detection !== []) {
        $validation = $detection;
    }
    if ($validation === [] && $legacy !== '') {
        $validation = [['pattern' => $legacy, 'priority' => 0]];
    }
    // Detection falls back the other way, including a validation list that was
    // just filled from the legacy field above.
    if ($detection === []) {
        $detection = $validation;
    }

    return [
        'pattern' => combineIdentifierTypePatterns($validation),
        'detectionPatterns' => $detection,
    ];
}
