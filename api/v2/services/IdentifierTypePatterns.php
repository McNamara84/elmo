<?php

declare(strict_types=1);

/** Adapts ERNIE validation patterns without replacing their format rules. */
final class IdentifierTypePatterns
{
    /**
     * Flattens ERNIE validation alternatives for ELMO's legacy pattern field.
     * Every delivered type uses its own expressions. An explicit empty or invalid
     * validation list stays empty; detection priorities do not validate input.
     *
     * @param array<mixed> $type Metadata from ERNIE or the locally synchronized database.
     */
    public static function validationPattern(array $type): string
    {
        $groups = $type['patterns'] ?? null;
        if (!is_array($groups) || !array_key_exists('validation', $groups)) {
            return self::normalize(is_string($type['pattern'] ?? null) ? $type['pattern'] : '');
        }
        $patterns = [];
        if (is_array($groups['validation'])) {
            foreach ($groups['validation'] as $entry) {
                if (is_array($entry) && is_string($entry['pattern'] ?? null)) {
                    $pattern = self::normalize($entry['pattern']);
                    if ($pattern !== '') $patterns[] = '(?:' . $pattern . ')';
                }
            }
        }
        return $patterns !== [] ? '^(?:' . implode('|', $patterns) . ')$' : '';
    }

    /** Removes legacy quotes and PCRE delimiters while preserving decoded backslashes. */
    public static function normalize(string $pattern): string
    {
        $pattern = trim($pattern);
        if (str_starts_with($pattern, '"') && str_ends_with($pattern, '"')) $pattern = substr($pattern, 1, -1);
        if (preg_match('~^/(.*)/[iu]*$~sD', $pattern, $matches) === 1) return $matches[1];
        return preg_replace('~\$/[iu]*$~D', '$', $pattern) ?? '';
    }
}
