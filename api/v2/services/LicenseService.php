<?php

declare(strict_types=1);

/**
 * ERNIE license contract and resource-type identity.
 *
 * Licenses are not fetched or persisted here yet. These checks are shared by
 * the upcoming cache, temporary database mapping and submission integration.
 */
final class LicenseService
{
    /** @return list<string> Verified license endpoint scopes. */
    public static function resourceTypeSlugs(): array
    {
        return array_keys(self::RESOURCE_TYPES);
    }

    /**
     * Explicit ERNIE slugs with their DataCite tokens and ERNIE display names.
     * Source: ERNIE ResourceTypeSeeder at e00b0f76120dd412b3732bff8625d8b0b019995c.
     * Unknown labels must not manufacture a valid-looking endpoint.
     *
     * @var array<string, list<string>>
     */
    private const RESOURCE_TYPES = [
        'audiovisual' => ['Audiovisual'],
        'award' => ['Award'],
        'book' => ['Book'],
        'book-chapter' => ['BookChapter', 'Book Chapter'],
        'collection' => ['Collection'],
        'computational-notebook' => ['ComputationalNotebook', 'Computational Notebook'],
        'conference-paper' => ['ConferencePaper', 'Conference Paper'],
        'conference-proceeding' => ['ConferenceProceeding', 'Conference Proceeding'],
        'data-paper' => ['DataPaper', 'Data Paper'],
        'dataset' => ['Dataset'],
        'dissertation' => ['Dissertation'],
        'event' => ['Event'],
        'image' => ['Image'],
        'instrument' => ['Instrument'],
        'interactive-resource' => ['InteractiveResource', 'Interactive Resource'],
        'journal' => ['Journal'],
        'journal-article' => ['JournalArticle', 'Journal Article'],
        'model' => ['Model'],
        'output-management-plan' => ['OutputManagementPlan', 'Output Management Plan'],
        'peer-review' => ['PeerReview', 'Peer Review'],
        'physical-object' => ['PhysicalObject', 'Physical Object'],
        'poster' => ['Poster'],
        'preprint' => ['Preprint'],
        'presentation' => ['Presentation'],
        'project' => ['Project'],
        'report' => ['Report'],
        'service' => ['Service'],
        'software' => ['Software'],
        'sound' => ['Sound'],
        'standard' => ['Standard'],
        'study-registration' => ['StudyRegistration', 'Study Registration'],
        'text' => ['Text'],
        'workflow' => ['Workflow'],
        'other' => ['Other'],
    ];

    /**
     * Resolve a server-side resource type name, never a browser-supplied path.
     *
     * @param string $resourceType Canonical DataCite token or known ERNIE display name.
     * @return string|null Verified ERNIE slug, or null for an unknown name.
     */
    public static function resourceTypeSlug(string $resourceType): ?string
    {
        $resourceType = trim($resourceType);
        foreach (self::RESOURCE_TYPES as $slug => $names) {
            if (in_array($resourceType, $names, true)) {
                return $slug;
            }
        }

        return null;
    }

    /**
     * Decode the complete license response before publishing it as a cache.
     *
     * An empty JSON list is a successful empty grant, whereas an empty object
     * or an error document is invalid. Objects are therefore retained during
     * JSON decoding. Invalid rows reject the entire response, not just a row.
     * Identical duplicates are collapsed without changing the response order.
     * Additional fields are ignored for forward compatibility.
     *
     * @param string $json Raw JSON response; decoding preserves the list/object distinction.
     * @return list<array{id: int, identifier: string, name: string, uri: ?string, scheme_uri: ?string}>
     * @throws UnexpectedValueException When the response cannot be trusted.
     */
    public static function decodeLicenses(string $json): array
    {
        try {
            $payload = json_decode($json, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new UnexpectedValueException('Invalid ERNIE license JSON.', 0, $error);
        }

        if (!is_array($payload)) {
            throw new UnexpectedValueException('ERNIE licenses must be a JSON list.');
        }

        $licenses = [];
        $identities = [];
        foreach ($payload as $index => $row) {
            $license = self::licenseFromRow($row, $index);
            $id = $license['id'];
            $identity = self::identityKey($license['identifier'], $license['scheme_uri']);
            if (isset($licenses[$id]) && $licenses[$id] !== $license) {
                throw new UnexpectedValueException("Conflicting ERNIE license ID at index {$index}.");
            }
            if (isset($identities[$identity]) && $identities[$identity] !== $id) {
                throw new UnexpectedValueException("Conflicting ERNIE license identifier at index {$index}.");
            }
            $licenses[$id] = $license;
            $identities[$identity] = $id;
        }

        return array_values($licenses);
    }

    /** @return array{id: int, identifier: string, name: string, uri: ?string, scheme_uri: ?string} */
    private static function licenseFromRow(mixed $row, int $index): array
    {
        if (!$row instanceof stdClass) {
            throw new UnexpectedValueException("Invalid ERNIE license object at index {$index}.");
        }
        if (!isset($row->id) || !is_int($row->id) || $row->id <= 0) {
            throw new UnexpectedValueException("Invalid ERNIE license ID at index {$index}.");
        }

        return [
            'id' => $row->id,
            'identifier' => self::requiredText($row, 'identifier', $index),
            'name' => self::requiredText($row, 'name', $index),
            'uri' => self::nullableUri($row, 'uri', $index),
            'scheme_uri' => self::nullableUri($row, 'scheme_uri', $index),
        ];
    }

    private static function requiredText(stdClass $row, string $field, int $index): string
    {
        if (!isset($row->{$field}) || !is_string($row->{$field}) || trim($row->{$field}) === '') {
            throw new UnexpectedValueException("Invalid ERNIE license {$field} at index {$index}.");
        }

        return $row->{$field};
    }

    private static function nullableUri(stdClass $row, string $field, int $index): ?string
    {
        if (!property_exists($row, $field)
            || ($row->{$field} !== null && !self::isAbsoluteUri($row->{$field}))) {
            throw new UnexpectedValueException("Invalid ERNIE license {$field} at index {$index}.");
        }

        return $row->{$field};
    }

    private static function identityKey(string $identifier, ?string $scheme): string
    {
        // SPDX identifiers are case-insensitive; custom identifiers are not.
        if ($scheme === 'https://spdx.org/licenses/' || $scheme === 'https://spdx.org/licenses') {
            $scheme = 'https://spdx.org/licenses/';
            $identifier = strtolower($identifier);
        }

        return json_encode([$scheme, $identifier], JSON_THROW_ON_ERROR);
    }

    /** Validate absolute URIs, including custom URNs, without fetching them. */
    private static function isAbsoluteUri(mixed $value): bool
    {
        if (!is_string($value)
            || preg_match('~^[a-zA-Z][a-zA-Z0-9+.-]*:[^\x00-\x20\x7f<>"{}|\\\\^`]+$~D', $value) !== 1
            || preg_match('/%(?![0-9a-fA-F]{2})/', $value) === 1) {
            return false;
        }

        $parts = parse_url($value);
        if ($parts === false) {
            return false;
        }
        if (in_array(strtolower($parts['scheme']), ['http', 'https', 'ftp', 'ftps'], true)) {
            return filter_var($value, FILTER_VALIDATE_URL) !== false;
        }

        return true;
    }
}
