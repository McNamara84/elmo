<?php

declare(strict_types=1);

require_once __DIR__ . '/LicenseValidationException.php';

/**
 * ERNIE license contract and resource-type identity.
 *
 * Metadata is independent of temporary database IDs. Only ERNIE snapshots
 * establish permission; imported metadata can be retained without granting it.
 */
final class LicenseService
{
    /**
     * Validate once before saving, and replace browser metadata with the allowed record.
     * The caller supplies the trusted submission context; POST action/flags are irrelevant.
     *
     * @param array<string, mixed> $postData
     * @return array<string, mixed> Canonical metadata and its current local mapping.
     */
    public static function prepareSubmission(
        mysqli $connection, array $postData, ErnieService $ernie, bool $required, ?string $automaticLicense = null
    ): array {
        try {
            $metadata = self::metadataFromPost($connection, $postData);
        } catch (InvalidArgumentException $error) {
            throw new LicenseValidationException($error->getMessage());
        }
        if ($metadata === null && $required) {
            throw new LicenseValidationException('Choose a license allowed for this Resource Type before submitting.');
        }
        $automatic = $metadata === null && $automaticLicense !== null && $automaticLicense !== '';
        if ($metadata === null && !$automatic) {
            return self::withMetadata($postData, null, null);
        }
        try {
            $slug = self::resolveResourceType($connection, $postData['resourcetype'] ?? null);
        } catch (InvalidArgumentException | OutOfBoundsException $error) {
            throw new LicenseValidationException($error->getMessage());
        }
        $snapshot = $ernie->getLicensesWithCache($slug);
        if ($snapshot['availability'] === 'unavailable') {
            if ($automatic) {
                return self::withMetadata($postData, null, null);
            }
            throw new LicenseValidationException('Allowed licenses are currently unavailable. Please try again later.', 503);
        }
        $matches = [];
        foreach ($snapshot['licenses'] as $license) {
            if ($automatic
                ? self::isSpdxScheme($license['scheme_uri']) && strcasecmp($license['identifier'], $automaticLicense) === 0
                : self::matchesMetadata($metadata, $license)) {
                $matches[] = $license;
            }
        }
        if (count($matches) !== 1) {
            if ($automatic) {
                return self::withMetadata($postData, null, null);
            }
            throw new LicenseValidationException('This license is not currently allowed for this Resource Type. Please choose an allowed license.');
        }
        require_once __DIR__ . '/LicenseRepository.php';
        $mapped = (new LicenseRepository($connection))->map($matches, $ernie->getLicenseOrigin());
        return self::withMetadata($postData, self::normalizeMetadata($matches[0]), $mapped[0]['rights_id']);
    }

    /**
     * @param array<string, mixed> $selection
     * @param array<string, mixed> $allowed
     */
    public static function matchesMetadata(array $selection, array $allowed): bool
    {
        if ($selection['identifier'] !== null) {
            return self::identityKey($selection['identifier'], $selection['scheme_uri'])
                === self::identityKey($allowed['identifier'], $allowed['scheme_uri'])
                && ($selection['uri'] === null || $selection['uri'] === $allowed['uri']);
        }
        return $selection['uri'] !== null && $selection['uri'] === $allowed['uri'];
    }

    /**
     * @param array<string, mixed> $postData
     * @param array<string, mixed>|null $metadata
     * @return array<string, mixed>
     */
    private static function withMetadata(array $postData, ?array $metadata, ?int $id): array
    {
        $postData['licensePayload'] = json_encode(['version' => 1, 'license' => $metadata], JSON_THROW_ON_ERROR);
        $postData['Rights'] = $id;
        return $postData;
    }

    /**
     * Portable payload takes precedence over legacy IDs, including explicit null.
     * Legacy IDs are usable only while the corresponding local row still exists.
     *
     * @param array<string, mixed> $postData
     * @return array<string, mixed>|null
     */
    public static function metadataFromPost(mysqli $connection, array $postData): ?array
    {
        if (array_key_exists('licensePayload', $postData)) {
            if (!is_string($postData['licensePayload']) || strlen($postData['licensePayload']) > 200000) {
                throw new InvalidArgumentException('Invalid license payload.');
            }
            try {
                $payload = json_decode($postData['licensePayload'], true, 32, JSON_THROW_ON_ERROR);
            } catch (JsonException $error) {
                throw new InvalidArgumentException('Invalid license payload.', 0, $error);
            }
            if (!is_array($payload) || ($payload['version'] ?? null) !== 1 || !array_key_exists('license', $payload)
                || ($payload['license'] !== null && !is_array($payload['license']))) {
                throw new InvalidArgumentException('Unsupported license payload.');
            }
            return $payload['license'] === null ? null : self::normalizeMetadata($payload['license']);
        }
        $id = filter_var($postData['Rights'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id <= 0) {
            return null;
        }
        require_once __DIR__ . '/LicenseRepository.php';
        $row = (new LicenseRepository($connection))->find($id);
        return $row === null ? null : self::normalizeMetadata([
            'identifier' => $row['rightsIdentifier'], 'name' => $row['text'], 'uri' => $row['rightsURI'],
            'scheme_uri' => $row['schemeURI'], 'scheme_name' => $row['schemeName'],
        ]);
    }

    /** @param array<string, mixed> $postData Resolve drafts without granting submission permission. */
    public static function draftRightsId(mysqli $connection, array $postData): ?int
    {
        $metadata = self::metadataFromPost($connection, $postData);
        if ($metadata === null) {
            return null;
        }
        require_once __DIR__ . '/LicenseRepository.php';
        // Existing live legacy clients can still refer to their current local mapping.
        if (!array_key_exists('licensePayload', $postData)) {
            return (int) $postData['Rights'];
        }
        return (new LicenseRepository($connection))->storeImported($metadata);
    }

    /** Resolve a local ID on the server; browser-provided slugs are never trusted. */
    public static function resolveResourceType(mysqli $connection, mixed $id): string
    {
        if ((!is_string($id) && !is_int($id)) || !preg_match('/^[1-9][0-9]*$/D', (string) $id)
            || filter_var($id, FILTER_VALIDATE_INT) === false) {
            throw new InvalidArgumentException('Select a valid resource type.');
        }
        $statement = $connection->prepare('SELECT resource_type_general FROM Resource_Type WHERE resource_name_id = ?');
        $statement->bind_param('i', $id);
        $statement->execute();
        $row = $statement->get_result()->fetch_assoc();
        $statement->close();
        $slug = $row === null ? null : self::resourceTypeSlug($row['resource_type_general']);
        if ($slug === null) {
            throw new OutOfBoundsException('Unknown resource type.');
        }
        return $slug;
    }

    /**
     * Normalize a portable license payload without inventing missing metadata.
     * Limits are byte-based and below the database TEXT capacity, including UTF-8.
     *
     * @param array<string, mixed> $metadata
     * @return array{identifier: ?string, name: string, uri: ?string, scheme_uri: ?string, scheme_name: ?string}
     */
    public static function normalizeMetadata(array $metadata): array
    {
        $result = [];
        foreach (['identifier', 'name', 'uri', 'scheme_uri', 'scheme_name'] as $key) {
            $value = $metadata[$key] ?? ($key === 'name' ? '' : null);
            if ($value !== null && (!is_string($value) || strlen($value) > 32768
                || preg_match('//u', $value) !== 1 || str_contains($value, "\0"))) {
                throw new InvalidArgumentException('Invalid license metadata: ' . $key);
            }
            $result[$key] = $value === '' && $key !== 'name' ? null : $value;
        }
        foreach (['uri', 'scheme_uri'] as $key) {
            if ($result[$key] !== null && !self::isAbsoluteUri($result[$key])) {
                throw new InvalidArgumentException('Invalid license URI: ' . $key);
            }
        }
        if ($result['identifier'] === null && trim($result['name']) === '' && $result['uri'] === null) {
            throw new InvalidArgumentException('License metadata is empty.');
        }
        if ($result['scheme_name'] === null && self::isSpdxScheme($result['scheme_uri'])) {
            $result['scheme_name'] = 'SPDX';
        }
        return $result;
    }

    public static function isSpdxScheme(?string $scheme): bool
    {
        return in_array($scheme, ['https://spdx.org/licenses/', 'https://spdx.org/licenses'], true);
    }

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
        if (self::isSpdxScheme($scheme)) {
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
