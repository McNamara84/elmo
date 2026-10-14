<?php

declare(strict_types=1);

namespace Tests;

use IdentifierTypePatterns;
use PHPUnit\Framework\Attributes\CoversFunction;

require_once __DIR__ . '/../scripts/update_identifier_patterns.php';

#[CoversFunction('updateIdentifierPatterns')]
final class UpdateIdentifierPatternsTest extends DatabaseTestCase
{
    public function testRepairsExistingPatternsWithoutChangingIdsOrVisibility(): void
    {
        $this->connection->query("UPDATE Identifier_Type SET pattern = '^obsolete$', isShown = 0 WHERE name = 'IGSN'");
        $before = $this->connection->query("SELECT identifier_type_id, isShown, ernie_id, description FROM Identifier_Type WHERE name = 'IGSN'")->fetch_assoc();
        self::assertGreaterThan(0, updateIdentifierPatterns($this->connection));
        $after = $this->connection->query("SELECT identifier_type_id, isShown, ernie_id, description, pattern FROM Identifier_Type WHERE name = 'IGSN'")->fetch_assoc();
        self::assertSame(IdentifierTypePatterns::supported()['IGSN'], $after['pattern']);
        unset($after['pattern']);
        self::assertSame($before, $after);
        self::assertSame(0, updateIdentifierPatterns($this->connection));
    }
}
