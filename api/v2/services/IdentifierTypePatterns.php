<?php

declare(strict_types=1);

/** Adapts ERNIE's grouped patterns and keeps ELMO input forms compatible. */
final class IdentifierTypePatterns
{
    /** @return array<string, string> */
    public static function supported(): array
    {
        $doi = '10\.\d{4,9}/[^\s]+';
        $doiInput = '(?:https?://(?:dx\.)?doi\.org/|doi:\s*)?' . $doi;
        $arxiv = '(?:\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?/\d{7})(?:v[1-9]\d*)?';
        return [
            'DOI' => '^' . $doiInput . '$',
            'IGSN' => '^(?:' . $doiInput . '|[A-Z]{5}[A-Z0-9]{4}|(?:AU|SSH|BGR[A-Z]?|ICDP|CSR[A-Z]?|GFZ|MBCR|ARDC)[A-Z0-9]{2,12})$',
            'RAiD' => '^(?:' . $doiInput . '|https?://raid\.org/' . $doi . ')$',
            'arXiv' => '^(?:(?:arxiv:\s*)?' . $arxiv . '|https?://(?:www\.)?arxiv\.org/(?:abs|pdf|html|src)/' . $arxiv . '(?:\.pdf)?)$',
            'ISBN' => '^(?:(?:urn:)?isbn(?:-1[03])?:?\s*)?(?:(?:\d[- ]?){9}[\dXx]|978(?:[- ]?\d){10}|979[- ]?[1-9](?:[- ]?\d){9})$',
            'EAN13' => '^\d{13}$',
            'Handle' => '^(?:hdl:|https?://hdl\.handle\.net/)?\d+(?:\.\w+)*/[^\s]+$',
            'URL' => '^https?://[^\s]+$',
        ];
    }

    /** @param array<mixed> $type */
    public static function validationPattern(array $type): string
    {
        foreach (self::supported() as $name => $pattern) {
            if (strcasecmp((string) ($type['name'] ?? ''), $name) === 0) return $pattern;
        }
        $grouped = $type['patterns']['validation'] ?? [];
        $patterns = [];
        if (is_array($grouped)) {
            foreach ($grouped as $entry) {
                if (is_array($entry) && is_string($entry['pattern'] ?? null) && $entry['pattern'] !== '') {
                    $patterns[] = '(?:' . self::normalize($entry['pattern']) . ')';
                }
            }
        }
        return $patterns !== [] ? '^(?:' . implode('|', $patterns) . ')$' : self::normalize((string) ($type['pattern'] ?? ''));
    }

    public static function normalize(string $pattern): string
    {
        $pattern = trim($pattern);
        if (str_starts_with($pattern, '"') && str_ends_with($pattern, '"')) $pattern = substr($pattern, 1, -1);
        if (preg_match('~^/(.*)/[iu]*$~sD', $pattern, $matches) === 1) return $matches[1];
        return preg_replace('~\$/[iu]*$~D', '$', $pattern) ?? '';
    }
}
