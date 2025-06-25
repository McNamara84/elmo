<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/formgroups/save_affiliations.php';

class ParseAffiliationAndRorIdsTest extends TestCase
{
    public function testParseAffiliationDataWithValidJson(): void
    {
        $input = '[{"value":"University of Applied Sciences Potsdam"},{"value":"GFZ Helmholtz Centre for Geosciences"}]';
        $expected = ['University of Applied Sciences Potsdam', 'GFZ Helmholtz Centre for Geosciences'];
        $this->assertEquals($expected, parseAffiliationData($input));
    }

    public function testParseAffiliationDataWithInvalidJson(): void
    {
        $this->assertEquals([], parseAffiliationData('invalid-json'));
    }

    public function testParseAffiliationDataWithEmptyString(): void
    {
        $this->assertEquals([], parseAffiliationData(''));
    }

    public function testParseAffiliationDataWithNull(): void
    {
        $this->assertEquals([], parseAffiliationData(null));
    }

    public function testParseRorIdsWithUrlsAndIds(): void
    {
        $input = 'https://ror.org/03yrm5c26,02nr0ka47, https://ror.org/0168r3w48';
        $expected = ['03yrm5c26', '02nr0ka47', '0168r3w48'];
        $this->assertEquals($expected, parseRorIds($input));
    }

    public function testParseRorIdsWithTrailingCommaAndSpaces(): void
    {
        $input = '03yrm5c26, ';
        $expected = ['03yrm5c26', null];
        $this->assertEquals($expected, parseRorIds($input));
    }

    public function testParseRorIdsWithEmptyString(): void
    {
        $this->assertEquals([], parseRorIds(''));
    }
}