<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
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
#[CoversFunction('createAndAttachXmlFile')]
final class GenerateXmlFilenameTest extends TestCase
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

        $expectedDateTime = date('Y-m-d_H-i-s');
        $this->assertSame(
        "metadata3-Mohammed-This_is_a_simple_title-{$expectedDateTime}.xml",
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

        $expectedDateTime = date('Y-m-d_H-i-s');
        $expectedTitle = trim(preg_replace('/_+/', '_', str_replace(' ', '_', substr($postData['title'][0], 0, 30))), '_');
        $expected = "metadata5-Schmidt-{$expectedTitle}-{$expectedDateTime}.xml";

        $this->assertSame(
            $expected,
            $filename,
            'Title should be truncated to 30 characters and spaces should be replaced by underscores.'
        );
    }

    /**
     * Tests that umlauts in the author name are preserved in the filename.
     */
    public function testUmlautReplacement(): void
    {
        $resource_id = 7;
        $postData = [
            'familynames' => ['Müller'],
            'title'       => ['Phosphorus in soils'],
        ];

        $xmlContent = '<xml>dummy</xml>'; // Dummy XML content
        $mail = new PHPMailer(false); // Dummy mail object

        $filename = createAndAttachXmlFile($mail, $xmlContent, $resource_id, $postData);

        $this->assertStringNotContainsString('ü', $filename, 'Umlauts will be replaced');
        $this->assertStringContainsString('Mueller', $filename, 'Müller becomes Mueller');
    
        $expectedDateTime = date('Y-m-d_H-i-s');
        $this->assertSame(
        "metadata7-Mueller-Phosphorus_in_soils-{$expectedDateTime}.xml",
        $filename
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

        $expectedDateTime = date('Y-m-d_H-i-s');
        $this->assertSame(
        "metadata9-Ali-a_b_c_d-{$expectedDateTime}.xml",
        $filename,
        'Multiple spaces are combined into ONE underscore.'
        );
    }

    /**
    * Tests that dangerous characters in author/title are sanitized from filename.
    */
    public function testDangerousCharactersAreSanitized(): void
    {
        $resource_id = 10;
        $postData = [
            'familynames' => ['Müller/evil:script'],
            'title'       => ['Test?titel<>"\\|*?'],
        ];

        $xmlContent = '<xml>dummy</xml>'; // Dummy XML content
        $mail = new PHPMailer(false); // Dummy mail object

        $filename = createAndAttachXmlFile($mail, $xmlContent, $resource_id, $postData);

        $dangerous = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
        foreach ($dangerous as $char) {
        $this->assertStringNotContainsString($char, $filename, "{$char} will be removed");
        }

        $expectedDateTime = date('Y-m-d_H-i-s');
        $this->assertSame(
        "metadata10-Mueller_evil_script-Test_titel-{$expectedDateTime}.xml",
        $filename
        );
    }
}
