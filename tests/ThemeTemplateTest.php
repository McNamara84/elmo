<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ThemeTemplateTest extends TestCase
{
    public function testEditorAppliesThemeBeforeStylesAndVersionsEveryThemeAsset(): void
    {
        $instanceTitle = 'Theme test';
        $showMslLogo = false;
        ob_start();
        try {
            include __DIR__ . '/../header.php';
            $html = (string) ob_get_contents();
        } finally {
            ob_end_clean();
        }

        $scriptPosition = strpos($html, 'js/themeInit.js?v=');
        $stylePosition = strpos($html, 'bootstrap.min.css');
        self::assertNotFalse($scriptPosition);
        self::assertNotFalse($stylePosition);
        self::assertLessThan($stylePosition, $scriptPosition);
        foreach (['js/themeInit.js', 'css/gfz-cd.css', 'css/tagify-adj.css', 'css/darkmode.css'] as $asset) {
            $version = substr(hash_file('sha256', __DIR__ . '/../' . $asset), 0, 12);
            self::assertStringContainsString($asset . '?v=' . $version, $html);
        }
        self::assertStringContainsString('class="elmo-subheader', $html);
        self::assertSame(3, preg_match_all(
            '/<button type="button" class="dropdown-item(?: active)?" data-bs-theme-value=/',
            $html
        ));
    }

    public function testFooterVersionsImportedModulesAndLayoutScript(): void
    {
        $showFeedbackLink = false;
        $maxTitles = 2;
        ob_start();
        try {
            include __DIR__ . '/../footer.html';
            $html = (string) ob_get_contents();
        } finally {
            ob_end_clean();
        }
        self::assertSame(1, preg_match('/<script type="importmap">\s*(.*?)\s*<\/script>/s', $html, $match));
        $imports = json_decode($match[1], true, 512, JSON_THROW_ON_ERROR)['imports'];
        foreach ([
            'js/eventhandlers/formgroups/authorStack.js',
            'js/eventhandlers/formgroups/contributorStack.js',
            'js/eventhandlers/formgroups/relatedwork.js',
            'js/submitHandler.js',
        ] as $asset) {
            $version = substr(hash_file('sha256', __DIR__ . '/../' . $asset), 0, 12);
            self::assertSame('./' . $asset . '?v=' . $version, $imports['./' . $asset]);
        }
        $version = substr(hash_file('sha256', __DIR__ . '/../js/footerLayout.js'), 0, 12);
        self::assertStringContainsString('js/footerLayout.js?v=' . $version, $html);
    }

    public function testGuideIncludesTheSharedThemeBeforeStyles(): void
    {
        $maxTitles = 2;
        $previousDirectory = getcwd();
        chdir(__DIR__ . '/../doc');
        ob_start();
        try {
            include __DIR__ . '/../doc/help.php';
            $html = (string) ob_get_contents();
        } finally {
            ob_end_clean();
            chdir($previousDirectory);
        }
        $scriptPosition = strpos($html, '../js/themeInit.js?v=');
        $stylePosition = strpos($html, 'bootstrap.min.css');
        self::assertNotFalse($scriptPosition);
        self::assertNotFalse($stylePosition);
        self::assertLessThan($stylePosition, $scriptPosition);
        foreach (['js/themeInit.js', 'css/help.css', 'css/gfz-cd.css', 'css/darkmode.css'] as $asset) {
            $version = substr(hash_file('sha256', __DIR__ . '/../' . $asset), 0, 12);
            self::assertStringContainsString('../' . $asset . '?v=' . $version, $html);
        }
    }
}
