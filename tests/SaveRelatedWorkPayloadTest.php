<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../save/formgroups/save_relatedwork.php';

final class SaveRelatedWorkPayloadTest extends DatabaseTestCase
{
    public function testSaveStructuredRelatedWorksPayload(): void
    {
        $resourceId = $this->createResource(
            'GFZ.TEST.STRUCTURED.RELATED.PAYLOAD',
            'Test Structured Related Work Payload'
        );
        $relation = $this->connection
            ->query('SELECT relation_id, name FROM Relation ORDER BY relation_id ASC LIMIT 1')
            ->fetch_assoc();

        $this->assertNotFalse($relation, 'The relation lookup table should contain fixture data.');

        $postData = [
            'relatedWorksPayload' => json_encode([
                [
                    'entryKey' => 'related-work-0',
                    'order' => 100,
                    'identifier' => '10.1234/payload-first',
                    'relation' => $relation['name'],
                    'relationId' => (string) $relation['relation_id'],
                    'identifierType' => 'DOI',
                ],
                [
                    'entryKey' => 'related-work-1',
                    'order' => -1,
                    'identifier' => 'https://example.org/payload-second',
                    'relation' => $relation['name'],
                    'relationId' => '999999999',
                    'identifierType' => 'URL',
                ],
            ], JSON_THROW_ON_ERROR),
        ];

        $this->assertTrue(saveRelatedWork($this->connection, $postData, $resourceId));

        $stmt = $this->connection->prepare(
            'SELECT rw.Identifier, rw.relation_fk, it.name AS identifier_type '
            . 'FROM Resource_has_Related_Work rhrw '
            . 'JOIN Related_Work rw ON rw.related_work_id = rhrw.Related_Work_related_work_id '
            . 'LEFT JOIN Identifier_Type it ON it.identifier_type_id = rw.identifier_type_fk '
            . 'WHERE rhrw.Resource_resource_id = ? '
            . 'ORDER BY rw.related_work_id ASC'
        );
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        $this->assertSame(
            ['10.1234/payload-first', 'https://example.org/payload-second'],
            array_column($rows, 'Identifier')
        );
        $this->assertSame(
            [(int) $relation['relation_id'], (int) $relation['relation_id']],
            array_map('intval', array_column($rows, 'relation_fk')),
            'An invalid relationId should fall back to the canonical relation name.'
        );
        $this->assertSame(['DOI', 'URL'], array_column($rows, 'identifier_type'));
    }

    public function testExplicitEmptyPayloadDoesNotSaveStaleLegacyRows(): void
    {
        $resourceId = $this->createResource(
            'GFZ.TEST.EMPTY.RELATED.PAYLOAD',
            'Test Empty Related Work Payload'
        );

        $postData = [
            'relatedWorksPayload' => '[]',
            'rIdentifier' => ['10.1234/stale'],
            'relation' => ['1'],
            'rIdentifierType' => ['DOI'],
        ];

        $this->assertTrue(saveRelatedWork($this->connection, $postData, $resourceId));
        $this->assertSame(0, $this->countRelatedWorkLinks($resourceId));
    }

    public function testSubmitRejectsIncompleteStructuredPayloadEntry(): void
    {
        $resourceId = $this->createResource(
            'GFZ.TEST.INCOMPLETE.RELATED.PAYLOAD',
            'Test Incomplete Related Work Payload'
        );

        $postData = [
            'action' => 'submit',
            'relatedWorksPayload' => json_encode([
                [
                    'identifier' => '10.1234/incomplete',
                    'relation' => '',
                    'relationId' => '',
                    'identifierType' => 'DOI',
                ],
            ], JSON_THROW_ON_ERROR),
        ];

        $this->assertFalse(saveRelatedWork($this->connection, $postData, $resourceId));
        $this->assertSame(0, $this->countRelatedWorkLinks($resourceId));
    }

    private function countRelatedWorkLinks(int $resourceId): int
    {
        $stmt = $this->connection->prepare(
            'SELECT COUNT(*) AS count FROM Resource_has_Related_Work WHERE Resource_resource_id = ?'
        );
        $stmt->bind_param('i', $resourceId);
        $stmt->execute();
        $count = (int) $stmt->get_result()->fetch_assoc()['count'];
        $stmt->close();

        return $count;
    }
}
