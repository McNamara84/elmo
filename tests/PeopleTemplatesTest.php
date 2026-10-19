<?php

declare(strict_types=1);

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PeopleTemplatesTest extends TestCase
{
    public static function featureFlags(): iterable
    {
        foreach ([false, true] as $authors) {
            yield [$authors];
        }
    }

    #[DataProvider('featureFlags')]
    public function testTemplatesRespectFeatureFlagsAndHaveUniqueIds(
        bool $showAuthorInstitution
    ): void {
        ob_start();
        include __DIR__ . '/../formgroups/authors.html';
        include __DIR__ . '/../formgroups/contributors.html';
        $html = (string) ob_get_clean();
        $document = new DOMDocument();
        @$document->loadHTML($html);
        $xpath = new DOMXPath($document);
        $ids = [];
        foreach ($xpath->query('//*[@id]') as $element) {
            $id = $element->getAttribute('id');
            self::assertNotContains($id, $ids, "Duplicate ID: {$id}");
            $ids[] = $id;
        }
        self::assertSame($showAuthorInstitution, $xpath->query('//*[@data-authorinstitution-row]')->length === 1);
        self::assertNotNull($document->getElementById('contributor-person-template'));
        self::assertNotNull($document->getElementById('contributor-institution-template'));
        self::assertNotNull($document->getElementById('contributors-payload'));
        foreach ($xpath->query('//label[@for]') as $label) {
            self::assertContains($label->getAttribute('for'), $ids);
        }
    }
}
