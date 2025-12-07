<?php
namespace Tests;

use PHPUnit\Framework\TestCase;
use PHPMailer\PHPMailer\PHPMailer;

define('PHPUNIT_RUNNING', true);
require_once __DIR__ . '/../send_xml_file.php';

/**
 * Test class for XML filename generation logic.
 *
 * This class contains several test cases to verify that the filename
 * for XML attachments is generated correctly from POST-like data,
 * including author name, title truncation and space handling.
 *
 */
class GenerateXmlFilenameTest extends TestCase
{

    /**
     * Tests filename generation for a simple title.
     */
    public function testSimpleTitle(): void
    {
        $resource_id = 3;
        $postData = [
            'familynames' => ['Mohammed'],
            'title'       => ['This is a simple title'],
        ];

        $xmlContent = '<xml>dummy</xml>'; // Dummy XML content
        $mail = new PHPMailer(false); // Dummy mail object

        $filename = createAndAttachXmlFile($mail, $xmlContent, $resource_id, $postData);

        $this->assertSame(
            'metadata3-Mohammed_This_is_a_simple_title.xml',
            $filename,
            'Simple file name should be generated correctly.'
        );
    }
    /**
    * Tests that the title part of the filename is truncated to 30 characters.
     */
    public function testTitleIsTruncatedTo30Chars(): void
    {
        $resource_id = 5;
        $postData = [
            'familynames' => ['Schmidt'],
            'title'       => ['This is a very very long title that needs to be truncated'],
        ];

        $xmlContent = '<xml>dummy</xml>'; // Dummy XML content
        $mail = new PHPMailer(false); // Dummy mail object

        $filename = createAndAttachXmlFile($mail, $xmlContent, $resource_id, $postData);

        $expectedTitle = substr($postData['title'][0], 0, 30);
        $expectedTitle = str_replace(' ', '_', $expectedTitle);

        $expected = "metadata5-Schmidt_{$expectedTitle}.xml";

        $this->assertSame(
            $expected,
            $filename,
            'Title should be truncated to 30 characters and spaces should be replaced by underscores.'
        );
    }

    /**
     * Tests that umlauts in the author name are preserved in the filename.
     */
    public function testUmlautsInAuthorArePreserved(): void
    {
        $resource_id = 7;
        $postData = [
            'familynames' => ['Müller'],
            'title'       => ['Phosphorus in soils'],
        ];

        $xmlContent = '<xml>dummy</xml>'; // Dummy XML content
        $mail = new PHPMailer(false); // Dummy mail object

        $filename = createAndAttachXmlFile($mail, $xmlContent, $resource_id, $postData);

        $this->assertStringContainsString(
            'Müller',
            $filename,
            'Umlauts in the author name should be preserved in the generated filename.'
        );

        $this->assertSame(
            'metadata7-Müller_Phosphorus_in_soils.xml',
            $filename,
            'Filename with umlauts and a simple title should match the expected pattern.'
        );
    }

    /**
     * Tests that every space in the title is converted to an underscore.
     *
     */
    public function testMultipleSpacesAreConvertedToMultipleUnderscores(): void
    {
        $resource_id = 9;
        $postData = [
            'familynames' => ['Ali'],
            'title'       => ['a b  c   d'],
        ];

        $xmlContent = '<xml>dummy</xml>'; // Dummy XML content
        $mail = new PHPMailer(false); // Dummy mail object

        $filename = createAndAttachXmlFile($mail, $xmlContent, $resource_id, $postData);

        $this->assertSame(
            'metadata9-Ali_a_b__c___d.xml',
            $filename,
            'Each space in the title should be converted to a single underscore in the filename.'
        );
    }

}
