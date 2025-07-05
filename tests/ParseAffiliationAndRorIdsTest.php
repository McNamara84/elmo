<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/formgroups/save_affiliations.php';
/**
 * Test cases for parsing affiliation names and ROR identifiers.
 *
 * @package Tests
 */

class ParseAffiliationAndRorIdsTest extends TestCase
{
    /**
     * Parses a valid JSON string into an array of affiliation names.
     *
     * @return void
     */
    public function testParseAffiliationDataWithValidJson(): void
    {
        $input = '[{"value":"University of Applied Sciences Potsdam"},{"value":"GFZ Helmholtz Centre for Geosciences"}]';
        $expected = ['University of Applied Sciences Potsdam', 'GFZ Helmholtz Centre for Geosciences'];
        $this->assertEquals($expected, parseAffiliationData($input));
    }

    /**
     * Ensures invalid JSON input returns an empty array.
     *
     * @return void
     */
    public function testParseAffiliationDataWithInvalidJson(): void
    {
        $this->assertEquals([], parseAffiliationData('invalid-json'));
    }

    /**
     * Verifies an empty string yields an empty array.
     *
     * @return void
     */
    public function testParseAffiliationDataWithEmptyString(): void
    {
        $this->assertEquals([], parseAffiliationData(''));
    }

    /**
     * Verifies passing null returns an empty array.
     *
     * @return void
     */
    public function testParseAffiliationDataWithNull(): void
    {
        $this->assertEquals([], parseAffiliationData(null));
    }

    /**
     * Parses ROR IDs from a mix of URLs and plain IDs.
     *
     * @return void
     */
    public function testParseRorIdsWithUrlsAndIds(): void
    {
        $input = 'https://ror.org/03yrm5c26,02nr0ka47, https://ror.org/0168r3w48';
        $expected = ['03yrm5c26', '02nr0ka47', '0168r3w48'];
        $this->assertEquals($expected, parseRorIds($input));
    }

    /**
     * Handles trailing commas and spaces in the input string.
     *
     * @return void
     */
    public function testParseRorIdsWithTrailingCommaAndSpaces(): void
    {
        $input = '03yrm5c26, ';
        $expected = ['03yrm5c26', null];
        $this->assertEquals($expected, parseRorIds($input));
    }

    /**
     * Ensures an empty string results in an empty array.
     *
     * @return void
     */
    public function testParseRorIdsWithEmptyString(): void
    {
        $this->assertEquals([], parseRorIds(''));
    }

    /**
     * Ensures null input results in an empty array.
     *
     * @return void
     */
    public function testParseRorIdsWithNull(): void
    {
        $this->assertEquals([], parseRorIds(null));
    }
}