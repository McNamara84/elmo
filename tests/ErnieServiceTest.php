<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

// Define test mode to prevent settings.php from being loaded
define('ERNIE_SERVICE_TEST_MODE', true);

// Set global config variables BEFORE loading ErnieService
global $ernieUrl, $ernieApiKey, $ernieResourceTypesCacheTtl;
$ernieUrl = '';
$ernieApiKey = '';
$ernieResourceTypesCacheTtl = 21600;

require_once __DIR__ . '/../api/v2/services/ErnieService.php';

/**
 * Testable subclass of ErnieService that allows injecting a custom cache file path
 */
class TestableErnieService extends \ErnieService
{
    private string $customCacheFile;

    public function __construct(string $cacheFile)
    {
        parent::__construct();
        $this->customCacheFile = $cacheFile;
    }

    /**
     * Override getCacheFile to use custom path
     */
    protected function getCacheFile(): string
    {
        return $this->customCacheFile;
    }
}

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
     * @var string Path to test cache directory
     */
    private string $testCacheDir;

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
        $this->testCacheDir = sys_get_temp_dir() . '/elmo_test_cache_' . uniqid();
        $this->testCacheFile = $this->testCacheDir . '/ernie_resource_types.json';

        if (!is_dir($this->testCacheDir)) {
            mkdir($this->testCacheDir, 0755, true);
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

        // Remove test cache directory
        if (is_dir($this->testCacheDir)) {
            rmdir($this->testCacheDir);
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
     * Creates a testable ErnieService with custom cache file path
     */
    private function createTestableService(string $url = '', string $apiKey = '', int $ttl = 21600): TestableErnieService
    {
        $this->setGlobalConfig($url, $apiKey, $ttl);
        return new TestableErnieService($this->testCacheFile);
    }

    /**
     * Helper to write a test cache file
     * 
     * @param array<array{id: int, name: string, description: string|null}> $data
     */
    private function writeTestCache(array $data, ?string $lastUpdated = null): void
    {
        $cache = [
            'lastUpdated' => $lastUpdated ?? date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => $data
        ];
        file_put_contents($this->testCacheFile, json_encode($cache, JSON_PRETTY_PRINT));
    }

    // ==================== isConfigured() Tests ====================

    /**
     * Test that isConfigured returns true when both URL and API key are set
     */
    public function testIsConfiguredReturnsTrueWhenConfigured(): void
    {
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $this->assertTrue($service->isConfigured());
    }

    /**
     * Test that isConfigured returns false when URL is missing
     */
    public function testIsConfiguredReturnsFalseWhenUrlMissing(): void
    {
        $service = $this->createTestableService('', 'test-key');
        $this->assertFalse($service->isConfigured());
    }

    /**
     * Test that isConfigured returns false when API key is missing
     */
    public function testIsConfiguredReturnsFalseWhenApiKeyMissing(): void
    {
        $service = $this->createTestableService('https://ernie.example.com/', '');
        $this->assertFalse($service->isConfigured());
    }

    /**
     * Test that isConfigured returns false when both URL and API key are missing
     */
    public function testIsConfiguredReturnsFalseWhenBothMissing(): void
    {
        $service = $this->createTestableService('', '');
        $this->assertFalse($service->isConfigured());
    }

    // ==================== getCacheStatus() Tests ====================

    /**
     * Test getCacheStatus when cache doesn't exist
     */
    public function testGetCacheStatusWhenCacheDoesNotExist(): void
    {
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        $this->assertFalse($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertNull($status['lastUpdated']);
        $this->assertNull($status['age']);
        $this->assertEquals(0, $status['itemCount']);
    }

    /**
     * Test getCacheStatus when cache exists and is valid
     */
    public function testGetCacheStatusWhenCacheExistsAndValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Dataset', 'description' => null],
            ['id' => 2, 'name' => 'Software', 'description' => 'Software description']
        ];
        $this->writeTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertNotNull($status['lastUpdated']);
        $this->assertIsInt($status['age']);
        $this->assertEquals(2, $status['itemCount']);
        $this->assertArrayHasKey('ageFormatted', $status);
        $this->assertArrayHasKey('ttl', $status);
    }

    /**
     * Test getCacheStatus when cache exists but is expired
     */
    public function testGetCacheStatusWhenCacheExpired(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Dataset', 'description' => null]
        ];
        // Set lastUpdated to 7 hours ago (beyond 6 hour TTL)
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeTestCache($testData, $expiredTime);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertEquals(1, $status['itemCount']);
    }

    // ==================== getResourceTypesWithCache() Tests ====================

    /**
     * Test that getResourceTypesWithCache returns empty array when not configured and no cache
     */
    public function testGetResourceTypesWithCacheReturnsEmptyWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getResourceTypesWithCache();

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    /**
     * Test that getResourceTypesWithCache returns cached data when cache is valid
     */
    public function testGetResourceTypesWithCacheReturnsCachedDataWhenValid(): void
    {
        $testData = [
            ['id' => 10, 'name' => 'Dataset', 'description' => null],
            ['id' => 26, 'name' => 'Software', 'description' => 'Test']
        ];
        $this->writeTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getResourceTypesWithCache();

        $this->assertCount(2, $result);
        $this->assertEquals('Dataset', $result[0]['name']);
        $this->assertEquals('Software', $result[1]['name']);
    }

    /**
     * Test that getResourceTypesWithCache returns stale cache when ERNIE unavailable
     */
    public function testGetResourceTypesWithCacheReturnsStaleWhenErnieUnavailable(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Collection', 'description' => null]
        ];
        // Expired cache
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeTestCache($testData, $expiredTime);

        // Use invalid URL so ERNIE fetch fails
        $service = $this->createTestableService('https://invalid-url-that-does-not-exist.local/', 'test-key');
        $result = $service->getResourceTypesWithCache();

        // Should return stale cache data
        $this->assertCount(1, $result);
        $this->assertEquals('Collection', $result[0]['name']);
    }

    // ==================== fetchResourceTypes() Tests ====================

    /**
     * Test fetchResourceTypes returns null when not configured
     */
    public function testFetchResourceTypesReturnsNullWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->fetchResourceTypes();

        $this->assertNull($result);
    }

    /**
     * Test fetchResourceTypes returns null on invalid URL
     */
    public function testFetchResourceTypesReturnsNullOnInvalidUrl(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->fetchResourceTypes();

        $this->assertNull($result);
    }

    // ==================== refreshCache() Tests ====================

    /**
     * Test refreshCache returns false when not configured
     */
    public function testRefreshCacheReturnsFalseWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->refreshCache();

        $this->assertFalse($result);
    }

    /**
     * Test refreshCache returns false when ERNIE unavailable
     */
    public function testRefreshCacheReturnsFalseWhenErnieUnavailable(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->refreshCache();

        $this->assertFalse($result);
    }

    // ==================== formatAge() Tests (via getCacheStatus) ====================

    /**
     * Test formatAge formats seconds correctly
     */
    public function testFormatAgeFormatsSecondsCorrectly(): void
    {
        $testData = [['id' => 1, 'name' => 'Test', 'description' => null]];
        // 30 seconds ago
        $recentTime = date('c', strtotime('-30 seconds'));
        $this->writeTestCache($testData, $recentTime);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        $this->assertStringContainsString('seconds', $status['ageFormatted']);
    }

    /**
     * Test formatAge formats minutes correctly
     */
    public function testFormatAgeFormatsMinutesCorrectly(): void
    {
        $testData = [['id' => 1, 'name' => 'Test', 'description' => null]];
        // 5 minutes ago
        $fiveMinutesAgo = date('c', strtotime('-5 minutes'));
        $this->writeTestCache($testData, $fiveMinutesAgo);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        $this->assertStringContainsString('minute', $status['ageFormatted']);
    }

    /**
     * Test formatAge formats hours correctly
     */
    public function testFormatAgeFormatsHoursCorrectly(): void
    {
        $testData = [['id' => 1, 'name' => 'Test', 'description' => null]];
        // 2 hours ago
        $twoHoursAgo = date('c', strtotime('-2 hours'));
        $this->writeTestCache($testData, $twoHoursAgo);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        $this->assertStringContainsString('hour', $status['ageFormatted']);
    }

    /**
     * Test formatAge handles singular minute correctly
     */
    public function testFormatAgeHandlesSingularMinute(): void
    {
        $testData = [['id' => 1, 'name' => 'Test', 'description' => null]];
        // 1 minute ago
        $oneMinuteAgo = date('c', strtotime('-1 minute'));
        $this->writeTestCache($testData, $oneMinuteAgo);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        // Should be "1 minute" not "1 minutes"
        $this->assertMatchesRegularExpression('/1 minute[^s]/', $status['ageFormatted'] . ' ');
    }

    // ==================== Cache File Handling Tests ====================

    /**
     * Test that cache handles invalid JSON gracefully
     */
    public function testCacheHandlesInvalidJsonGracefully(): void
    {
        // Write invalid JSON to cache file
        file_put_contents($this->testCacheFile, 'not valid json {{{');

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getResourceTypesWithCache();

        // Should return empty array since cache is invalid and ERNIE won't be available
        $this->assertIsArray($result);
    }

    /**
     * Test that cache handles missing data key gracefully
     */
    public function testCacheHandlesMissingDataKeyGracefully(): void
    {
        // Write cache without 'data' key
        $cache = ['lastUpdated' => date('c'), 'ttl' => 21600];
        file_put_contents($this->testCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getResourceTypesWithCache();

        // Should return empty array
        $this->assertIsArray($result);
    }

    /**
     * Test that cache handles missing lastUpdated gracefully
     */
    public function testCacheHandlesMissingLastUpdatedGracefully(): void
    {
        $testData = [['id' => 1, 'name' => 'Test', 'description' => null]];
        // Write cache without 'lastUpdated' key
        $cache = ['ttl' => 21600, 'data' => $testData];
        file_put_contents($this->testCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        // Cache exists but is invalid due to missing lastUpdated
        $this->assertTrue($status['exists']);
        $this->assertFalse($status['valid']);
    }

    // ==================== TTL Configuration Tests ====================

    /**
     * Test that custom TTL is respected
     */
    public function testCustomTtlIsRespected(): void
    {
        $testData = [['id' => 1, 'name' => 'Test', 'description' => null]];
        // 30 minutes ago
        $thirtyMinutesAgo = date('c', strtotime('-30 minutes'));
        $this->writeTestCache($testData, $thirtyMinutesAgo);

        // Use 1 hour TTL - cache should be valid
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key', 3600);
        $status = $service->getCacheStatus();

        $this->assertTrue($status['valid']);

        // Use 10 minute TTL - cache should be invalid
        $service2 = $this->createTestableService('https://ernie.example.com/', 'test-key', 600);
        $status2 = $service2->getCacheStatus();

        $this->assertFalse($status2['valid']);
    }
}

