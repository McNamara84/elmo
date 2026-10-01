<?php

declare(strict_types=1);

namespace Tests;

/**
 * Covers the complete-install Authors fixture used by local development.
 */
final class InstallationAuthorsSeedTest extends DatabaseTestCase
{
    public function testCompleteInstallationSeedsOrderedSingleTypeAuthors(): void
    {
        insertTestResourceData($this->connection);

        $invalidAuthorCount = (int) $this->connection->query(
            'SELECT COUNT(*) AS invalid_count FROM Author '
            . 'WHERE (Author_Person_author_person_id IS NULL) = '
            . '(Author_Institution_author_institution_id IS NULL)'
        )->fetch_assoc()['invalid_count'];

        self::assertSame(0, $invalidAuthorCount);

        $result = $this->connection->query(
            "SELECT CASE "
            . "WHEN ap.author_person_id IS NOT NULL THEN CONCAT('person:', ap.familyname) "
            . "ELSE CONCAT('institution:', ai.institutionname) END AS author_key, rha.sort_order "
            . 'FROM Resource_has_Author rha '
            . 'JOIN Author a ON a.author_id = rha.Author_author_id '
            . 'LEFT JOIN Author_person ap ON ap.author_person_id = a.Author_Person_author_person_id '
            . 'LEFT JOIN Author_institution ai ON ai.author_institution_id = a.Author_Institution_author_institution_id '
            . 'WHERE rha.Resource_resource_id = 1 '
            . 'ORDER BY rha.sort_order ASC, rha.Resource_has_Author_id ASC'
        );
        $rows = $result->fetch_all(MYSQLI_ASSOC);

        self::assertSame(
            ['person:Goebel', 'institution:Institut für Bauforschung und Bauerhaltung (IBB)'],
            array_column($rows, 'author_key')
        );
        self::assertSame([0, 1], array_map('intval', array_column($rows, 'sort_order')));
    }
}
