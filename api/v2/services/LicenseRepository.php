<?php

declare(strict_types=1);

require_once __DIR__ . '/LicenseService.php';

/** Reconstructible local IDs for export metadata; rows never imply permission. */
final class LicenseRepository
{
    public function __construct(private mysqli $connection)
    {
    }

    /**
     * Keep metadata variants separate so a later catalog cannot rewrite a saved draft.
     * A completed mapping is read-only; the unique hash also handles concurrent rebuilds.
     *
     * @param list<array<string, mixed>> $licenses Validated ERNIE rows.
     * @return list<array<string, mixed>> Existing ELMO fields plus external identity and schema.
     */
    public function map(array $licenses, string $origin): array
    {
        $mapped = [];
        foreach ($licenses as $license) {
            $metadata = LicenseService::normalizeMetadata($license);
            $id = $this->store($metadata, (int) $license['id'], $origin);
            $mapped[] = $this->adapter($id, $metadata, (int) $license['id']);
        }
        return $mapped;
    }

    /** @param array<string, mixed> $metadata Imported/draft metadata, without any grant. */
    public function storeImported(array $metadata): int
    {
        return $this->store(LicenseService::normalizeMetadata($metadata), null, null);
    }

    /** @return array<string, mixed>|null */
    public function find(int $id): ?array
    {
        $statement = $this->connection->prepare('SELECT * FROM Rights WHERE rights_id = ?');
        $statement->bind_param('i', $id);
        $statement->execute();
        $row = $statement->get_result()->fetch_assoc();
        $statement->close();
        return $row === null ? null : $row;
    }

    /** @param array<string, mixed> $metadata */
    private function store(array $metadata, ?int $ernieId, ?string $origin): int
    {
        $key = hash('sha256', json_encode([$origin, $ernieId, $metadata], JSON_THROW_ON_ERROR));
        $statement = $this->connection->prepare('SELECT rights_id FROM Rights WHERE mapping_key = ?');
        $statement->bind_param('s', $key);
        $statement->execute();
        $row = $statement->get_result()->fetch_assoc();
        $statement->close();
        if ($row !== null) {
            return (int) $row['rights_id'];
        }

        $statement = $this->connection->prepare(
            'INSERT INTO Rights (text, rightsIdentifier, rightsURI, schemeURI, schemeName, ernie_id, ernie_source, mapping_key) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rights_id = LAST_INSERT_ID(rights_id)'
        );
        $statement->bind_param('sssssiss', $metadata['name'], $metadata['identifier'], $metadata['uri'],
            $metadata['scheme_uri'], $metadata['scheme_name'], $ernieId, $origin, $key);
        $statement->execute();
        $id = (int) $this->connection->insert_id;
        $statement->close();
        return $id;
    }

    /**
     * @param array<string, mixed> $metadata
     * @return array<string, mixed>
     */
    private function adapter(int $id, array $metadata, int $ernieId): array
    {
        return [
            'rights_id' => $id, 'text' => $metadata['name'], 'rightsIdentifier' => $metadata['identifier'],
            'rightsURI' => $metadata['uri'], 'schemeURI' => $metadata['scheme_uri'],
            'schemeName' => $metadata['scheme_name'], 'ernie_id' => $ernieId,
        ];
    }
}
