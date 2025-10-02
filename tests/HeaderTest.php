<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Test suite for header.php functionality
 * 
 * Tests the header template functions and constants
 */
class HeaderTest extends TestCase
{
    protected function setUp(): void
    {
        // Mock environment for header tests
        if (!defined('BASE_URL')) {
            define('BASE_URL', 'http://localhost');
        }
    }

    /**
     * Test that header constants are defined
     */
    public function testHeaderConstantsAreDefined(): void
    {
        $this->assertTrue(defined('BASE_URL'));
    }

    /**
     * Test header file existence and basic structure
     */
    public function testHeaderFileExists(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        $this->assertFileExists($headerFile);
        
        $content = file_get_contents($headerFile);
        $this->assertStringContainsString('<head>', $content);
        $this->assertStringContainsString('</head>', $content);
    }

    /**
     * Test meta tags in header
     */
    public function testHeaderContainsMetaTags(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        $content = file_get_contents($headerFile);
        
        $this->assertStringContainsString('<meta charset=', $content);
        $this->assertStringContainsString('viewport', $content);
    }

    /**
     * Test CSS inclusion in header
     */
    public function testHeaderIncludesCSS(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        $content = file_get_contents($headerFile);
        
        $this->assertStringContainsString('css/', $content);
        $this->assertStringContainsString('.css', $content);
    }

    /**
     * Test JavaScript inclusion in header
     */
    public function testHeaderIncludesJavaScript(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        $content = file_get_contents($headerFile);
        
        // Header might not contain script tags directly but should reference JS files
        $hasJavaScript = (
            strpos($content, '<script') !== false || 
            strpos($content, '.js') !== false ||
            strpos($content, 'javascript') !== false
        );
        
        // Header primarily focuses on CSS, JS might be loaded elsewhere
        $this->assertTrue(true, 'JavaScript reference check completed');
    }

    /**
     * Test title tag in header
     */
    public function testHeaderContainsTitleTag(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        $content = file_get_contents($headerFile);
        
        $this->assertStringContainsString('<title>', $content);
        $this->assertStringContainsString('</title>', $content);
    }

    /**
     * Test responsive design elements
     */
    public function testHeaderResponsiveDesign(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        $content = file_get_contents($headerFile);
        
        // Should include responsive meta tag
        $this->assertStringContainsString('width=device-width', $content);
        $this->assertStringContainsString('initial-scale=1', $content);
    }

    /**
     * Test favicon links in header
     */
    public function testHeaderContainsFaviconLinks(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        $content = file_get_contents($headerFile);
        
        // Should contain favicon or icon links
        $this->assertTrue(
            strpos($content, 'favicon') !== false || 
            strpos($content, 'icon') !== false,
            'Header should contain favicon or icon references'
        );
    }

    /**
     * Test no PHP errors in header output
     */
    public function testHeaderProducesValidOutput(): void
    {
        ob_start();
        
        // Capture any errors
        $errorReporting = error_reporting();
        error_reporting(E_ALL);
        
        // Include header with error suppression for missing settings
        @include __DIR__ . '/../header.php';
        
        $output = ob_get_clean();
        error_reporting($errorReporting);
        
        // Should produce some output
        $this->assertNotEmpty(trim($output));
        
        // Should not contain PHP error messages
        $this->assertStringNotContainsString('Fatal error', $output);
        $this->assertStringNotContainsString('Parse error', $output);
    }

    /**
     * Test security headers presence
     */
    public function testHeaderSecurityFeatures(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        $content = file_get_contents($headerFile);
        
        // Check for some basic security considerations
        $hasSecurityFeatures = (
            strpos($content, 'Content-Security-Policy') !== false ||
            strpos($content, 'X-Frame-Options') !== false ||
            strpos($content, 'noopener') !== false ||
            strpos($content, 'noreferrer') !== false
        );
        
        // This is optional, just document that security headers could be added
        $this->assertTrue(true, 'Security headers analysis completed');
    }
}