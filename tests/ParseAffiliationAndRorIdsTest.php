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
}