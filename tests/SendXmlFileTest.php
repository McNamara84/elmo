<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPUnit\Framework\TestCase;

if (!defined('ELMO_XML_SUBMISSION_SKIP_EXECUTION')) {
    define('ELMO_XML_SUBMISSION_SKIP_EXECUTION', true);
}

if (!defined('ELMO_XML_SUBMISSION_SKIP_DB_CONNECT')) {
    define('ELMO_XML_SUBMISSION_SKIP_DB_CONNECT', true);
}

require_once __DIR__ . '/../send_xml_file.php';

final class SendXmlFileTest extends TestCase
{
    public function testValidateAndFormatDataUrlAddsScheme(): void
    {
        $normalized = elmoValidateAndFormatDataUrl('example.com/resource');

        $this->assertSame('https://example.com/resource', $normalized);
    }

    public function testValidateAndFormatDataUrlAllowsEmpty(): void
    {
        $normalized = elmoValidateAndFormatDataUrl('');

        $this->assertSame('', $normalized);
    }

    public function testValidateAndFormatDataUrlRejectsInvalidUrl(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Invalid data URL provided');

        elmoValidateAndFormatDataUrl('not a valid url');
    }

    public function testValidateAndFormatDataUrlRejectsWhitespaceOnlyChanges(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Invalid data URL provided');

        elmoValidateAndFormatDataUrl("example.com/data sheet");
    }

    public function testCreateMailBodiesReflectsAttachments(): void
    {
        $resourceId = 42;
        $urgencyWeeks = 3;
        $dataUrl = 'https://example.com/data';

        $mailBodies = elmoCreateMailBodies($resourceId, $urgencyWeeks, $dataUrl, true);

        $this->assertStringContainsString('Ressource ID in ELMO Datenbank', $mailBodies['html']);
        $this->assertStringContainsString('Datenbeschreibung', $mailBodies['html']);
        $this->assertSame('3 weeks', $mailBodies['urgencyText']);
        $this->assertSame(getPriorityText($urgencyWeeks), $mailBodies['priorityText']);
        $this->assertSame($dataUrl, $mailBodies['dataUrlText']);
    }

    public function testAttachDataDescriptionAcceptsAllowedTypes(): void
    {
        $mail = new PHPMailer(true);

        $tmpFile = tempnam(sys_get_temp_dir(), 'elmo_pdf_');
        file_put_contents($tmpFile, "%PDF-1.4\n%");

        $filesData = [
            'dataDescription' => [
                'tmp_name' => $tmpFile,
                'name' => 'description.pdf',
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($tmpFile),
            ],
        ];

        $attached = elmoAttachDataDescription($mail, $filesData, 123);

        $this->assertTrue($attached);
        $this->assertCount(1, $mail->getAttachments());

        unlink($tmpFile);
    }

    public function testAttachDataDescriptionRejectsInvalidMimeType(): void
    {
        $mail = new PHPMailer(true);

        $tmpFile = tempnam(sys_get_temp_dir(), 'elmo_txt_');
        file_put_contents($tmpFile, 'plain text');

        $filesData = [
            'dataDescription' => [
                'tmp_name' => $tmpFile,
                'name' => 'description.txt',
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($tmpFile),
            ],
        ];

        try {
            elmoAttachDataDescription($mail, $filesData, 123);
            $this->fail('Expected exception for invalid MIME type');
        } catch (RuntimeException $exception) {
            $this->assertSame('Invalid file type. Only PDF, DOC, and DOCX files are allowed.', $exception->getMessage());
        } finally {
            unlink($tmpFile);
        }
    }
}