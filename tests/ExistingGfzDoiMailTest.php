<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/mail_helper.php';

final class ExistingGfzDoiMailTest extends TestCase
{
    public function testCurationNoticeIsReadableInHtmlAndPlainText(): void
    {
        $mail = generateEmailText(['resourceId' => 42], [
            'doi' => '10.5880/example',
            'existingGfzDoi' => true,
            'showGGMsProperties' => false,
        ]);

        self::assertStringContainsString('10.5880/example und neue Hauptversion prüfen', $mail['html']);
        self::assertStringContainsString('10.5880/example und neue Hauptversion prüfen', $mail['text']);
        self::assertStringNotContainsString('prÃ¼fen', $mail['html']);
    }
}
