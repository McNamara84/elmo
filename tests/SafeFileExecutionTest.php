<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Tests that execute actual file operations and content analysis
 * These tests analyze file content without including PHP files to avoid function redeclaration
 */
class SafeFileExecutionTest extends TestCase
{
    /**
     * Test that settings file exists and contains expected content
     */
    public function testSettingsFileExecution(): void
    {
        $settingsFile = __DIR__ . '/../settings.php';
        
        $this->assertFileExists($settingsFile, 'Settings file exists');
        $this->assertFileIsReadable($settingsFile, 'Settings file is readable');
        
        $content = file_get_contents($settingsFile);
        $this->assertNotEmpty($content, 'Settings file contains content');
        $this->assertStringContainsString('<?php', $content, 'Settings file contains PHP code');
        $this->assertStringContainsString('connectDb', $content, 'Settings file contains connectDb function');
        $this->assertStringContainsString('new mysqli', $content, 'Settings file creates MySQL connection');
        $hasDbConfig = (
            strpos($content, 'DB_') !== false ||
            strpos($content, "getenv('DB_") !== false ||
            strpos($content, 'getenv("DB_') !== false
        );
        $this->assertTrue($hasDbConfig, 'Settings file references database configuration');
    }

    /**
     * Test header.php file content analysis
     */
    public function testHeaderFileExecution(): void
    {
        $headerFile = __DIR__ . '/../header.php';
        
        $this->assertFileExists($headerFile, 'Header file exists');
        $this->assertFileIsReadable($headerFile, 'Header file is readable');
        
        $content = file_get_contents($headerFile);
        $this->assertNotEmpty($content, 'Header file contains content');
        $this->assertStringContainsString('<?php', $content, 'Header file contains PHP code');
        $this->assertStringContainsString('<html', $content, 'Header file contains HTML');
        $this->assertStringContainsString('<head>', $content, 'Header file contains head section');
        $this->assertStringContainsString('<title>', $content, 'Header file contains title');
        $this->assertStringContainsString('.css', $content, 'Header file references CSS');
    }

    /**
     * Test feature toggles file content
     */
    public function testFeatureTogglesExecution(): void
    {
        $featureFile = __DIR__ . '/../includes/feature_toggles.php';
        
        if (file_exists($featureFile)) {
            $this->assertFileExists($featureFile, 'Feature toggles file exists');
            $this->assertFileIsReadable($featureFile, 'Feature toggles file is readable');
            
            $content = file_get_contents($featureFile);
            $this->assertNotEmpty($content, 'Feature toggles file contains content');
            $this->assertStringContainsString('<?php', $content, 'Feature toggles file contains PHP code');
            $this->assertStringContainsString('function', $content, 'Feature toggles file contains functions');
        } else {
            $this->markTestSkipped('Feature toggles file not found');
        }
    }

    /**
     * Test modals HTML file
     */
    public function testModalsFileExecution(): void
    {
        $modalsFile = __DIR__ . '/../modals.html';
        
        if (file_exists($modalsFile)) {
            $this->assertFileExists($modalsFile, 'Modals file exists');
            $this->assertFileIsReadable($modalsFile, 'Modals file is readable');
            
            $content = file_get_contents($modalsFile);
            $this->assertNotEmpty($content, 'Modals file contains content');
            $this->assertStringContainsString('modal', strtolower($content), 'Modals file contains modal elements');
            $this->assertStringContainsString('<div', $content, 'Modals file contains HTML divs');
        } else {
            $this->markTestSkipped('Modals file not found');
        }
    }

    /**
     * Test footer HTML file
     */
    public function testFooterFileExecution(): void
    {
        $footerFile = __DIR__ . '/../footer.html';
        
        if (file_exists($footerFile)) {
            $this->assertFileExists($footerFile, 'Footer file exists');
            $this->assertFileIsReadable($footerFile, 'Footer file is readable');
            
            $content = file_get_contents($footerFile);
            $this->assertNotEmpty($content, 'Footer file contains content');
            
            // Test for common footer elements
            $hasFooterElements = (
                strpos($content, '</body>') !== false ||
                strpos($content, '</html>') !== false ||
                strpos($content, '<script') !== false ||
                strpos($content, 'footer') !== false
            );
            $this->assertTrue($hasFooterElements, 'Should contain footer HTML elements');
        } else {
            $this->markTestSkipped('Footer file not found');
        }
    }

    /**
     * Test form group HTML files content
     */
    public function testFormGroupExecution(): void
    {
        $formGroups = [
            'resourceInformation.html',
            'rights.html', 
            'authors.html',
            'descriptions.html',
            'dates.html'
        ];
        
        $foundFiles = 0;
        foreach ($formGroups as $formGroup) {
            $formFile = __DIR__ . '/../formgroups/' . $formGroup;
            
            if (file_exists($formFile)) {
                $foundFiles++;
                $this->assertFileExists($formFile, "Form group {$formGroup} exists");
                $this->assertFileIsReadable($formFile, "Form group {$formGroup} is readable");
                
                $content = file_get_contents($formFile);
                $this->assertNotEmpty(trim($content), "Form group {$formGroup} should contain content");
                
                // Test for common form elements
                $hasFormElements = (
                    strpos($content, 'input') !== false ||
                    strpos($content, 'select') !== false ||
                    strpos($content, 'textarea') !== false ||
                    strpos($content, 'button') !== false ||
                    strpos($content, 'form') !== false ||
                    strpos($content, 'class=') !== false
                );
                $this->assertTrue($hasFormElements, "Form group {$formGroup} should contain form elements");
            }
        }
        
        $this->assertGreaterThan(0, $foundFiles, 'At least one form group file should be found');
    }

    /**
     * Test API-related files exist and have content
     */
    public function testApiFileExecution(): void
    {
        $apiFiles = [
            'api.php',
            'api_functions.php',
            'send_xml_file.php',
            'generate_xml_files.php'
        ];
        
        $foundFiles = 0;
        foreach ($apiFiles as $apiFile) {
            $filePath = __DIR__ . '/../' . $apiFile;
            
            if (file_exists($filePath)) {
                $foundFiles++;
                $this->assertFileExists($filePath, "{$apiFile} exists");
                $this->assertFileIsReadable($filePath, "{$apiFile} is readable");
                
                $content = file_get_contents($filePath);
                $this->assertNotEmpty($content, "{$apiFile} contains content");
                $this->assertStringContainsString('<?php', $content, "{$apiFile} contains PHP code");
                
                // Test for common API patterns
                $hasApiElements = (
                    strpos($content, 'function') !== false ||
                    strpos($content, 'class') !== false ||
                    strpos($content, '$_POST') !== false ||
                    strpos($content, '$_GET') !== false ||
                    strpos($content, 'json_') !== false ||
                    strpos($content, 'header') !== false
                );
                $this->assertTrue($hasApiElements, "{$apiFile} should contain API-related code");
            }
        }
        
        $this->assertGreaterThan(0, $foundFiles, 'At least one API file should be found');
    }
}