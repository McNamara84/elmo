<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../includes/save_to_db_helper.php';

/**
 * Verifies that JSON-LD downloads use the current Authors form payload while
 * retaining the established database fallback when no payload is supplied.
 */
final class DatasetJsonLdAuthorsIntegrationTest extends DatabaseTestCase
{
    private int $resourceId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resourceId = $this->createDatabaseBackedResource();
    }

    public function testJsonLdUsesCurrentMixedAuthorsPayloadInsteadOfStoredAuthors(): void
    {
        $generated = generateDatasetPayloadByResourceId($this->resourceId, [
            'format' => 'jsonld',
            'postData' => [
                'authorsPayload' => json_encode([
                    [
                        'type' => 'person',
                        'familyname' => 'Payload',
                        'givenname' => 'Jane',
                        'orcid' => 'https://orcid.org/0000-0002-1825-0097',
                        'isContact' => true,
                        'email' => 'jane@example.org',
                        'website' => 'https://example.org/jane',
                        'affiliations' => [
                            ['label' => 'GFZ', 'rorId' => '04z8jg394'],
                            ['label' => 'University of Potsdam', 'rorId' => '012m9bp23'],
                        ],
                    ],
                    [
                        'type' => 'institution',
                        'institutionname' => 'Payload Institute',
                        'affiliations' => [],
                    ],
                    [
                        'type' => 'person',
                        'familyname' => 'Sukarno',
                        'givenname' => '',
                        'orcid' => '',
                        'isContact' => false,
                        'affiliations' => [],
                    ],
                ], JSON_THROW_ON_ERROR),
            ],
        ]);

        $payload = json_decode($generated['payload'], true, 512, JSON_THROW_ON_ERROR);
        $creators = $payload['creators']['creator'];

        self::assertSame('application/ld+json', $generated['contentType']);
        self::assertSame('jsonld', $generated['extension']);
        self::assertSame('dataset-jsonld', $generated['generator']);
        self::assertSame(
            ['Payload, Jane', 'Payload Institute', 'Sukarno'],
            array_column(array_column($creators, 'creatorName'), 'value')
        );
        self::assertSame('Personal', $creators[0]['creatorName']['attrs']['nameType']);
        self::assertSame('0000-0002-1825-0097', $creators[0]['nameIdentifier']['value']);
        self::assertSame('https://ror.org/04z8jg394', $creators[0]['affiliation'][0]['attrs']['affiliationIdentifier']);
        self::assertSame('Organizational', $creators[1]['creatorName']['attrs']['nameType']);
        self::assertArrayNotHasKey('givenName', $creators[2]);
        self::assertSame('ContactPerson', $payload['contributors']['contributor']['attrs']['contributorType']);
        self::assertSame('Payload', $payload['contributors']['contributor']['familyName']['value']);
        self::assertStringNotContainsString('StoredDatabaseAuthor', $generated['payload']);
        self::assertStringNotContainsString('jane@example.org', $generated['payload']);
        self::assertStringNotContainsString('https://example.org/jane', $generated['payload']);
    }

    public function testJsonLdFallsBackToStoredAuthorsWithoutCurrentPayload(): void
    {
        $generated = generateDatasetPayloadByResourceId($this->resourceId, ['format' => 'jsonld']);
        $payload = json_decode($generated['payload'], true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(
            'StoredDatabaseAuthor',
            $payload['creators']['creator']['familyName']['value']
        );
    }

    public function testJsonLdFallsBackToStoredAuthorsForEmptyPayload(): void
    {
        $generated = generateDatasetPayloadByResourceId($this->resourceId, [
            'format' => 'jsonld',
            'postData' => ['authorsPayload' => '[]'],
        ]);
        $payload = json_decode($generated['payload'], true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(
            'StoredDatabaseAuthor',
            $payload['creators']['creator']['familyName']['value']
        );
    }

    /**
     * Creates a minimal resource containing an intentionally stale database author.
     *
     * @return int Database identifier of the created resource.
     *
     * @throws \mysqli_sql_exception When fixture creation fails.
     */
    private function createDatabaseBackedResource(): int
    {
        $resourceTypeId = (int) $this->connection
            ->query("SELECT resource_name_id FROM Resource_Type WHERE resource_type_general = 'Dataset'")
            ->fetch_assoc()['resource_name_id'];
        $languageId = (int) $this->connection
            ->query("SELECT language_id FROM Language WHERE code = 'en'")
            ->fetch_assoc()['language_id'];
        $rightsId = (int) $this->connection
            ->query('SELECT rights_id FROM Rights ORDER BY rights_id ASC LIMIT 1')
            ->fetch_assoc()['rights_id'];

        $stmt = $this->connection->prepare(
            'INSERT INTO Resource '
            . '(doi, version, year, dateCreated, Rights_rights_id, Resource_Type_resource_name_id, Language_language_id) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $doi = '10.5880/GFZ.TEST.JSONLD.AUTHORS.PAYLOAD';
        $version = 1.0;
        $year = 2026;
        $dateCreated = '2026-07-22';
        $stmt->bind_param('sdisiii', $doi, $version, $year, $dateCreated, $rightsId, $resourceTypeId, $languageId);
        $stmt->execute();
        $resourceId = (int) $this->connection->insert_id;
        $stmt->close();

        $titleTypeId = (int) $this->connection
            ->query("SELECT title_type_id FROM Title_Type WHERE name = 'Main Title'")
            ->fetch_assoc()['title_type_id'];
        $stmt = $this->connection->prepare(
            'INSERT INTO Title (text, Title_Type_fk, Resource_resource_id) VALUES (?, ?, ?)'
        );
        $title = 'JSON-LD Authors Payload Test';
        $stmt->bind_param('sii', $title, $titleTypeId, $resourceId);
        $stmt->execute();
        $stmt->close();

        $this->connection->query(
            "INSERT INTO Author_person (familyname, givenname, orcid) "
            . "VALUES ('StoredDatabaseAuthor', 'Old', '')"
        );
        $personId = (int) $this->connection->insert_id;
        $stmt = $this->connection->prepare(
            'INSERT INTO Author (Author_Person_author_person_id, Author_Institution_author_institution_id) '
            . 'VALUES (?, NULL)'
        );
        $stmt->bind_param('i', $personId);
        $stmt->execute();
        $authorId = (int) $this->connection->insert_id;
        $stmt->close();

        $stmt = $this->connection->prepare(
            'INSERT INTO Resource_has_Author (Resource_resource_id, Author_author_id, sort_order) '
            . 'VALUES (?, ?, 0)'
        );
        $stmt->bind_param('ii', $resourceId, $authorId);
        $stmt->execute();
        $stmt->close();

        return $resourceId;
    }
}
