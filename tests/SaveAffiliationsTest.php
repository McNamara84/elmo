<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../save/formgroups/save_affiliations.php';

/**
 * Test class for save_affiliations.php
 * 
 * Tests the affiliation saving and parsing functions
 */
final class SaveAffiliationsTest extends DatabaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Clear test data
        $this->connection->query("DELETE FROM Author_has_Affiliation");
        $this->connection->query("DELETE FROM Affiliation WHERE name LIKE 'Test%'");
        $this->connection->query("DELETE FROM Author WHERE author_id >= 1000");
        $this->connection->query("DELETE FROM Author_person WHERE author_person_id >= 1000");

        // Create test author (including orcid which is NOT NULL)
        $this->connection->query("INSERT INTO Author_person (author_person_id, familyname, givenname, orcid) VALUES (1000, 'TestFamily', 'TestGiven', '')");
        $this->connection->query("INSERT INTO Author (author_id, Author_Person_author_person_id) VALUES (1000, 1000)");
    }

    public function testSaveAffiliationsCreatesNewAffiliation(): void
    {
        $affiliationData = json_encode([['value' => 'Test University']]);
        $rorIdData = 'https://ror.org/12345678';

        saveAffiliations(
            $this->connection,
            1000,
            $affiliationData,
            $rorIdData,
            'Author_has_Affiliation',
            'Author_author_id'
        );

        // Verify affiliation was created
        $result = $this->connection->query("SELECT * FROM Affiliation WHERE name = 'Test University'");
        $this->assertEquals(1, $result->num_rows);

        $affiliation = $result->fetch_assoc();
        $this->assertEquals('12345678', $affiliation['rorId']);

        // Verify link was created
        $linkResult = $this->connection->query("SELECT * FROM Author_has_Affiliation WHERE Author_author_id = 1000");
        $this->assertEquals(1, $linkResult->num_rows);
    }

    public function testSaveAffiliationsUpdatesExistingAffiliation(): void
    {
        // Create existing affiliation without ROR ID
        $this->connection->query("INSERT INTO Affiliation (affiliation_id, name) VALUES (1000, 'Test Existing University')");

        $affiliationData = json_encode([['value' => 'Test Existing University']]);
        $rorIdData = 'https://ror.org/98765432';

        saveAffiliations(
            $this->connection,
            1000,
            $affiliationData,
            $rorIdData,
            'Author_has_Affiliation',
            'Author_author_id'
        );

        // Verify affiliation ROR ID was updated
        $result = $this->connection->query("SELECT rorId FROM Affiliation WHERE name = 'Test Existing University'");
        $affiliation = $result->fetch_assoc();
        $this->assertEquals('98765432', $affiliation['rorId']);
    }

    public function testSaveAffiliationsKeepsRorIdWhenLabelChanges(): void
    {
        $this->connection->query(
            "INSERT INTO Affiliation (affiliation_id, name, rorId) VALUES (1001, 'GFZ Helmholtz Centre for Geosciences', '04z8jg394')"
        );

        $affiliationData = json_encode([
            ['value' => 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany']
        ]);

        saveAffiliations(
            $this->connection,
            1000,
            $affiliationData,
            'https://ror.org/04z8jg394',
            'Author_has_Affiliation',
            'Author_author_id'
        );

        $result = $this->connection->query("SELECT name, rorId FROM Affiliation WHERE rorId = '04z8jg394' ORDER BY affiliation_id ASC");
        $rows = $result->fetch_all(MYSQLI_ASSOC);

        $this->assertSame(
            [
                [
                    'name' => 'GFZ Helmholtz Centre for Geosciences, Potsdam, Germany',
                    'rorId' => '04z8jg394'
                ]
            ],
            $rows,
            'An edited affiliation label should update the row identified by the stable ROR ID instead of creating a duplicate.'
        );
    }

    public function testSaveAffiliationsHandlesMultipleAffiliations(): void
    {
        $affiliationData = json_encode([
            ['value' => 'Test Uni A'],
            ['value' => 'Test Uni B'],
            ['value' => 'Test Uni C']
        ]);
        $rorIdData = 'https://ror.org/aaa,https://ror.org/bbb,https://ror.org/ccc';

        saveAffiliations(
            $this->connection,
            1000,
            $affiliationData,
            $rorIdData,
            'Author_has_Affiliation',
            'Author_author_id'
        );

        // Verify all three affiliations were created
        $result = $this->connection->query("SELECT * FROM Affiliation WHERE name LIKE 'Test Uni%'");
        $this->assertEquals(3, $result->num_rows);
    }

    public function testSaveAffiliationsSkipsEmptyNames(): void
    {
        $affiliationData = json_encode([
            ['value' => ''],
            ['value' => 'Test Valid Uni']
        ]);
        $rorIdData = 'https://ror.org/xxx,https://ror.org/yyy';

        saveAffiliations(
            $this->connection,
            1000,
            $affiliationData,
            $rorIdData,
            'Author_has_Affiliation',
            'Author_author_id'
        );

        // Should only create one affiliation
        $result = $this->connection->query("SELECT * FROM Author_has_Affiliation WHERE Author_author_id = 1000");
        $this->assertEquals(1, $result->num_rows);
    }

    public function testSaveAffiliationsDoesNotDuplicateLinks(): void
    {
        $affiliationData = json_encode([['value' => 'Test Duplicate Uni']]);
        $rorIdData = '';

        // Save twice
        saveAffiliations(
            $this->connection,
            1000,
            $affiliationData,
            $rorIdData,
            'Author_has_Affiliation',
            'Author_author_id'
        );

        saveAffiliations(
            $this->connection,
            1000,
            $affiliationData,
            $rorIdData,
            'Author_has_Affiliation',
            'Author_author_id'
        );

        // Should only have one link
        $result = $this->connection->query("
            SELECT COUNT(*) as cnt FROM Author_has_Affiliation aha
            JOIN Affiliation a ON aha.Affiliation_affiliation_id = a.affiliation_id
            WHERE a.name = 'Test Duplicate Uni' AND aha.Author_author_id = 1000
        ");
        $row = $result->fetch_assoc();
        $this->assertEquals(1, $row['cnt']);
    }

    public function testParseAffiliationDataWithJsonArray(): void
    {
        $jsonInput = json_encode([
            ['value' => 'University A'],
            ['value' => 'University B']
        ]);

        $result = parseAffiliationData($jsonInput);

        $this->assertIsArray($result);
        $this->assertCount(2, $result);
        $this->assertEquals('University A', $result[0]);
        $this->assertEquals('University B', $result[1]);
    }

    public function testParseAffiliationDataWithPlainString(): void
    {
        // Plain strings (non-JSON) return empty array as they can't be parsed
        $plainInput = 'Simple University Name';

        $result = parseAffiliationData($plainInput);

        $this->assertIsArray($result);
        $this->assertCount(0, $result);  // Non-JSON returns empty array
    }

    public function testParseAffiliationDataWithEmptyInput(): void
    {
        $result = parseAffiliationData('');

        $this->assertIsArray($result);
        $this->assertCount(0, $result);  // Empty input returns empty array
    }

    public function testParseRorIdsWithCommaDelimited(): void
    {
        $input = 'https://ror.org/abc,https://ror.org/def';

        $result = parseRorIds($input);

        $this->assertIsArray($result);
        $this->assertCount(2, $result);
        // Function extracts ID part only, strips URL prefix
        $this->assertEquals('abc', $result[0]);
        $this->assertEquals('def', $result[1]);
    }

    public function testParseRorIdsWithSemicolonDelimited(): void
    {
        // Function only splits on comma, not semicolon
        $input = 'https://ror.org/111;https://ror.org/222';

        $result = parseRorIds($input);

        $this->assertIsArray($result);
        // Semicolon is NOT a delimiter, so this is treated as one entry
        $this->assertCount(1, $result);
    }

    public function testParseRorIdsWithEmptyInput(): void
    {
        $result = parseRorIds('');

        $this->assertIsArray($result);
    }
}
