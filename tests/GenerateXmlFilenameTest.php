<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

class GenerateXmlFilenameTest extends TestCase
{
    /**
     * Help function ONLY for testing.
     */
    private function buildXmlFilename(int $resource_id, array $postData): string
    {
        $firstAuthor = $postData['familynames'][0];
        $mainTitle   = $postData['title'][0];

        $abbreviateTitle = substr($mainTitle, 0, 30);
        $cleanTitle      = str_replace(' ', '_', $abbreviateTitle);

        return "metadata{$resource_id}-{$firstAuthor}_{$cleanTitle}.xml";
    }

    public function testSimpleAsciiTitle(): void
    {
        $resource_id = 3;
        $postData = [
            'familynames' => ['Mohammed'],
            'title'       => ['This is a simple title'],
        ];

        $filename = $this->buildXmlFilename($resource_id, $postData);

        $this->assertSame(
            'metadata3-Mohammed_This_is_a_simple_title.xml',
            $filename,
            'Simple file name should be generated correctly..'
        );
    }
    public function testTitleIsTruncatedTo30Chars(): void
    {
        $resource_id = 5;
        $postData = [
            'familynames' => ['Schmidt'],
            'title'       => ['This is a very very long title that needs to be truncated'],
        ];

        $filename = $this->buildXmlFilename($resource_id, $postData);

        $expectedTitle = substr($postData['title'][0], 0, 30);
        $expectedTitle = str_replace(' ', '_', $expectedTitle);

        $expected = "metadata5-Schmidt_{$expectedTitle}.xml";

        $this->assertSame(
            $expected,
            $filename,
            'Title should be truncated to 30 characters and spaces should be replaced by underscores.'
        );
    }

}
