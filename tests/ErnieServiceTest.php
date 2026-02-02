<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Test class for ErnieService
 * 
 * Tests the ERNIE integration service including caching functionality.
 * Note: These tests mock the global configuration variables to avoid
 * database connections during unit testing.
 */
class ErnieServiceTest extends TestCase
{
    /**
     * @var string Path to test cache file
     */
    private string $testCacheFile;

    /**
     * Set up test environment
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Create a temporary cache directory for tests
        $this->testCacheFile = sys_get_temp_dir() . '/elmo_test_cache/ernie_resource_types.json';
        $testCacheDir = dirname($this->testCacheFile);

        if (!is_dir($testCacheDir)) {
            mkdir($testCacheDir, 0755, true);
        }

        // Clean up any existing test cache
        if (file_exists($this->testCacheFile)) {
            unlink($this->testCacheFile);
        }
    }

    /**
     * Clean up after each test
     */
    protected function tearDown(): void
    {
        // Remove test cache file
        if (file_exists($this->testCacheFile)) {
            unlink($this->testCacheFile);
        }

        parent::tearDown();
    }

    /**
     * Helper to set global config variables without loading settings.php
     */
    private function setGlobalConfig(string $url, string $apiKey, int $ttl = 21600): void
    {
        global $ernieUrl, $ernieApiKey, $ernieResourceTypesCacheTtl;
        $ernieUrl = $url;
        $ernieApiKey = $apiKey;
        $ernieResourceTypesCacheTtl = $ttl;
    }

    /**
     * Test that isConfigured returns true when both URL and API key are set
     */
    public function testIsConfiguredReturnsTrueWhenConfigured(): void
    {
        $this->setGlobalConfig('https://ernie.example.com/', 'test-key');

        // Load service without requiring settings.php
        $serviceCode = file_get_contents(__DIR__ . '/../api/v2/services/ErnieService.php');
        // Remove the require_once line for testing
        $serviceCode = preg_replace('/require_once.*settings\.php.*;\s*/', '', $serviceCode);
        $serviceCode = str_replace('<?php', '', $serviceCode);
        
        // Only evaluate if class doesn't exist
        if (!class_exists('ErnieService', false)) {
            eval($serviceCode);
        }

        $service = new \ErnieService();
        $this->assertTrue($service->isConfigured());
    }

    /**
     * Test that isConfigured returns false when URL is missing
     */
    public function testIsConfiguredReturnsFalseWhenUrlMissing(): void
    {
        $this->setGlobalConfig('', 'test-key');

        $service = new \ErnieService();
        $this->assertFalse($service->isConfigured());
    }

    /**
     * Test that isConfigured returns false when API key is missing
     */
    public function testIsConfiguredReturnsFalseWhenApiKeyMissing(): void
    {
        $this->setGlobalConfig('https://ernie.example.com/', '');

        $service = new \ErnieService();
        $this->assertFalse($service->isConfigured());
    }

    /**
     * Test getCacheStatus when cache doesn't exist
     */
    public function testGetCacheStatusWhenCacheDoesNotExist(): void
    {
        $this->setGlobalConfig('https://ernie.example.com/', 'test-key');

        $service = new \ErnieService();
        $status = $service->getCacheStatus();

        $this->assertFalse($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertEquals(0, $status['itemCount']);
    }

    /**
     * Test that getResourceTypesWithCache returns empty array when not configured and no cache
     */
    public function testGetResourceTypesWithCacheReturnsEmptyWhenNotConfigured(): void
    {
        $this->setGlobalConfig('', '');

        $service = new \ErnieService();
        $result = $service->getResourceTypesWithCache();

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }
}
