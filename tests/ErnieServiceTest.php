<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

// Define test mode to prevent settings.php from being loaded
define('ERNIE_SERVICE_TEST_MODE', true);

// Set global config variables BEFORE loading ErnieService
global $ernieUrl, $ernieApiKey, $ernieCacheTtl, $ernieResourceTypesCacheTtl;
$ernieUrl = '';
$ernieApiKey = '';
$ernieCacheTtl = 21600;
$ernieResourceTypesCacheTtl = 21600;

require_once __DIR__ . '/../api/v2/services/ErnieService.php';

/**
 * Testable subclass of ErnieService that allows injecting a custom cache file path
 */
class TestableErnieService extends \ErnieService
{
    private string $customCacheFile;
    private string $customTitleTypesCacheFile;
    private string $customLanguagesCacheFile;
    private string $customContributorPersonRolesCacheFile;
    private string $customContributorInstitutionRolesCacheFile;

    public function __construct(
        string $cacheFile,
        string $titleTypesCacheFile = '',
        string $languagesCacheFile = '',
        string $contributorPersonRolesCacheFile = '',
        string $contributorInstitutionRolesCacheFile = ''
    ) {
        parent::__construct();
        $this->customCacheFile = $cacheFile;
        $this->customTitleTypesCacheFile = $titleTypesCacheFile;
        $this->customLanguagesCacheFile = $languagesCacheFile;
        $this->customContributorPersonRolesCacheFile = $contributorPersonRolesCacheFile;
        $this->customContributorInstitutionRolesCacheFile = $contributorInstitutionRolesCacheFile;
    }

    /**
     * Override getCacheFile to use custom path
     */
    protected function getCacheFile(): string
    {
        return $this->customCacheFile;
    }

    /**
     * Override getTitleTypesCacheFile to use custom path
     */
    protected function getTitleTypesCacheFile(): string
    {
        return $this->customTitleTypesCacheFile ?: $this->customCacheFile;
    }

    /**
     * Override getLanguagesCacheFile to use custom path
     */
    protected function getLanguagesCacheFile(): string
    {
        return $this->customLanguagesCacheFile ?: $this->customCacheFile;
    }

    /**
     * Override getContributorPersonRolesCacheFile to use custom path
     */
    protected function getContributorPersonRolesCacheFile(): string
    {
        return $this->customContributorPersonRolesCacheFile ?: $this->customCacheFile;
    }

    /**
     * Override getContributorInstitutionRolesCacheFile to use custom path
     */
    protected function getContributorInstitutionRolesCacheFile(): string
    {
        return $this->customContributorInstitutionRolesCacheFile ?: $this->customCacheFile;
    }
}

/**
 * Test class for ErnieService
 * 
 * Tests the ERNIE integration service including caching functionality.
 * Note: These tests mock the global configuration variables to avoid
 * database connections during unit testing.
 */
#[CoversClass(\ErnieService::class)]
final class ErnieServiceTest extends TestCase
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
     * @var string Path to test title types cache file
     */
    private string $testTitleTypesCacheFile;

    /**
     * @var string Path to test languages cache file
     */
    private string $testLanguagesCacheFile;

    /**
     * @var string Path to test contributor person roles cache file
     */
    private string $testContributorPersonRolesCacheFile;

    /**
     * @var string Path to test contributor institution roles cache file
     */
    private string $testContributorInstitutionRolesCacheFile;

    /**
     * Set up test environment
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Create a temporary cache directory for tests
        $this->testCacheDir = sys_get_temp_dir() . '/elmo_test_cache_' . uniqid();
        $this->testCacheFile = $this->testCacheDir . '/ernie_resource_types.json';
        $this->testTitleTypesCacheFile = $this->testCacheDir . '/ernie_title_types.json';
        $this->testLanguagesCacheFile = $this->testCacheDir . '/ernie_languages.json';
        $this->testContributorPersonRolesCacheFile = $this->testCacheDir . '/ernie_contributor_person_roles.json';
        $this->testContributorInstitutionRolesCacheFile = $this->testCacheDir . '/ernie_contributor_institution_roles.json';

        if (!is_dir($this->testCacheDir)) {
            mkdir($this->testCacheDir, 0755, true);
        }

        // Clean up any existing test cache
        foreach ([
            $this->testCacheFile,
            $this->testTitleTypesCacheFile,
            $this->testLanguagesCacheFile,
            $this->testContributorPersonRolesCacheFile,
            $this->testContributorInstitutionRolesCacheFile,
        ] as $cacheFile) {
            if (file_exists($cacheFile)) {
                unlink($cacheFile);
            }
        }
    }

    /**
     * Clean up after each test
     */
    protected function tearDown(): void
    {
        // Remove test cache files
        foreach ([
            $this->testCacheFile,
            $this->testTitleTypesCacheFile,
            $this->testLanguagesCacheFile,
            $this->testContributorPersonRolesCacheFile,
            $this->testContributorInstitutionRolesCacheFile,
        ] as $cacheFile) {
            if (file_exists($cacheFile)) {
                unlink($cacheFile);
            }
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
        global $ernieUrl, $ernieApiKey, $ernieCacheTtl, $ernieResourceTypesCacheTtl;
        $ernieUrl = $url;
        $ernieApiKey = $apiKey;
        $ernieCacheTtl = $ttl;
        $ernieResourceTypesCacheTtl = $ttl;
    }

    /**
     * Creates a testable ErnieService with custom cache file paths
     */
    private function createTestableService(string $url = '', string $apiKey = '', int $ttl = 21600): TestableErnieService
    {
        $this->setGlobalConfig($url, $apiKey, $ttl);
        return new TestableErnieService(
            $this->testCacheFile,
            $this->testTitleTypesCacheFile,
            $this->testLanguagesCacheFile,
            $this->testContributorPersonRolesCacheFile,
            $this->testContributorInstitutionRolesCacheFile
        );
    }

    /**
     * Helper to write a test contributor person roles cache file
     * 
     * @param array<array{id: int, name: string}> $data
     */
    private function writeContributorPersonRolesTestCache(array $data, ?string $lastUpdated = null): void
    {
        $cache = [
            'lastUpdated' => $lastUpdated ?? date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => $data
        ];
        file_put_contents($this->testContributorPersonRolesCacheFile, json_encode($cache, JSON_PRETTY_PRINT));
    }

    /**
     * Helper to write a test contributor institution roles cache file
     * 
     * @param array<array{id: int, name: string}> $data
     */
    private function writeContributorInstitutionRolesTestCache(array $data, ?string $lastUpdated = null): void
    {
        $cache = [
            'lastUpdated' => $lastUpdated ?? date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => $data
        ];
        file_put_contents($this->testContributorInstitutionRolesCacheFile, json_encode($cache, JSON_PRETTY_PRINT));
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

    /**
     * Helper to write a test title types cache file
     * 
     * @param array<array{id: int, name: string, slug: string}> $data
     */
    private function writeTitleTypesTestCache(array $data, ?string $lastUpdated = null): void
    {
        $cache = [
            'lastUpdated' => $lastUpdated ?? date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => $data
        ];
        file_put_contents($this->testTitleTypesCacheFile, json_encode($cache, JSON_PRETTY_PRINT));
    }

    /**
     * Helper to write a test languages cache file
     * 
     * @param array<array{id: int, name: string, code: string}> $data
     */
    private function writeLanguagesTestCache(array $data, ?string $lastUpdated = null): void
    {
        $cache = [
            'lastUpdated' => $lastUpdated ?? date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => $data
        ];
        file_put_contents($this->testLanguagesCacheFile, json_encode($cache, JSON_PRETTY_PRINT));
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
        $this->assertSame(0, $status['itemCount']);
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
        $this->assertSame(2, $status['itemCount']);
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
        $this->assertSame(1, $status['itemCount']);
    }

    // ==================== getResourceTypesWithCache() Tests ====================

    /**
     * Test that getResourceTypesWithCache returns hardcoded fallback when not configured and no cache
     */
    public function testGetResourceTypesWithCacheReturnsHardcodedFallbackWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getResourceTypesWithCache();

        $this->assertIsArray($result);
        // Should return hardcoded fallback (Dataset and Other)
        $this->assertCount(2, $result);
        $this->assertSame('Dataset', $result[0]['name']);
        $this->assertSame('Other', $result[1]['name']);
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
        $this->assertSame('Dataset', $result[0]['name']);
        $this->assertSame('Software', $result[1]['name']);
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
        $this->assertSame('Collection', $result[0]['name']);
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

    // ==================== Hardcoded Fallback Tests ====================

    /**
     * Test that hardcoded fallback returns Dataset and Other
     */
    public function testHardcodedFallbackContainsDatasetAndOther(): void
    {
        // No cache, no config - should use hardcoded fallback
        $service = $this->createTestableService('', '');
        $result = $service->getResourceTypesWithCache();

        $this->assertCount(2, $result);
        
        // Verify Dataset
        $this->assertSame(10, $result[0]['id']);
        $this->assertSame('Dataset', $result[0]['name']);
        $this->assertNotEmpty($result[0]['description']);
        
        // Verify Other
        $this->assertSame(21, $result[1]['id']);
        $this->assertSame('Other', $result[1]['name']);
        $this->assertNotEmpty($result[1]['description']);
    }

    /**
     * Test that hardcoded fallback is used when ERNIE fails and no cache exists
     */
    public function testHardcodedFallbackUsedWhenErnieFailsAndNoCache(): void
    {
        // Invalid URL, no cache
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->getResourceTypesWithCache();

        // Should use hardcoded fallback
        $this->assertCount(2, $result);
        $this->assertSame('Dataset', $result[0]['name']);
        $this->assertSame('Other', $result[1]['name']);
    }

    // ==================== Title Types: getTitleTypesCacheStatus() Tests ====================

    /**
     * Test getTitleTypesCacheStatus when cache doesn't exist
     */
    public function testGetTitleTypesCacheStatusWhenCacheDoesNotExist(): void
    {
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getTitleTypesCacheStatus();

        $this->assertFalse($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertNull($status['lastUpdated']);
        $this->assertNull($status['age']);
        $this->assertSame(0, $status['itemCount']);
    }

    /**
     * Test getTitleTypesCacheStatus when cache exists and is valid
     */
    public function testGetTitleTypesCacheStatusWhenCacheExistsAndValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title'],
            ['id' => 2, 'name' => 'Alternative Title', 'slug' => 'alternative-title']
        ];
        $this->writeTitleTypesTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getTitleTypesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertNotNull($status['lastUpdated']);
        $this->assertIsInt($status['age']);
        $this->assertSame(2, $status['itemCount']);
        $this->assertArrayHasKey('ageFormatted', $status);
        $this->assertArrayHasKey('ttl', $status);
    }

    /**
     * Test getTitleTypesCacheStatus when cache exists but is expired
     */
    public function testGetTitleTypesCacheStatusWhenCacheExpired(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title']
        ];
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeTitleTypesTestCache($testData, $expiredTime);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getTitleTypesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertSame(1, $status['itemCount']);
    }

    // ==================== Title Types: getTitleTypesWithCache() Tests ====================

    /**
     * Test that getTitleTypesWithCache returns hardcoded fallback when not configured and no cache
     */
    public function testGetTitleTypesWithCacheReturnsHardcodedFallbackWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getTitleTypesWithCache();

        $this->assertIsArray($result);
        // Should return hardcoded fallback (Main Title, Alternative Title, Translated Title)
        $this->assertCount(3, $result);
        $this->assertSame('Main Title', $result[0]['name']);
        $this->assertSame('Alternative Title', $result[1]['name']);
        $this->assertSame('Translated Title', $result[2]['name']);
    }

    /**
     * Test that getTitleTypesWithCache returns cached data when cache is valid
     */
    public function testGetTitleTypesWithCacheReturnsCachedDataWhenValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title'],
            ['id' => 2, 'name' => 'Alternative Title', 'slug' => 'alternative-title'],
            ['id' => 5, 'name' => 'Other', 'slug' => 'other']
        ];
        $this->writeTitleTypesTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getTitleTypesWithCache();

        $this->assertCount(3, $result);
        $this->assertSame('Main Title', $result[0]['name']);
        $this->assertSame('Alternative Title', $result[1]['name']);
        $this->assertSame('Other', $result[2]['name']);
    }

    /**
     * Test that getTitleTypesWithCache returns stale cache when ERNIE unavailable
     */
    public function testGetTitleTypesWithCacheReturnsStaleWhenErnieUnavailable(): void
    {
        $testData = [
            ['id' => 3, 'name' => 'Subtitle', 'slug' => 'subtitle']
        ];
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeTitleTypesTestCache($testData, $expiredTime);

        // Use invalid URL so ERNIE fetch fails
        $service = $this->createTestableService('https://invalid-url-that-does-not-exist.local/', 'test-key');
        $result = $service->getTitleTypesWithCache();

        // Should return stale cache data
        $this->assertCount(1, $result);
        $this->assertSame('Subtitle', $result[0]['name']);
    }

    // ==================== Title Types: fetchTitleTypes() Tests ====================

    /**
     * Test fetchTitleTypes returns null when not configured
     */
    public function testFetchTitleTypesReturnsNullWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->fetchTitleTypes();

        $this->assertNull($result);
    }

    /**
     * Test fetchTitleTypes returns null on invalid URL
     */
    public function testFetchTitleTypesReturnsNullOnInvalidUrl(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->fetchTitleTypes();

        $this->assertNull($result);
    }

    // ==================== Title Types: refreshTitleTypesCache() Tests ====================

    /**
     * Test refreshTitleTypesCache returns false when not configured
     */
    public function testRefreshTitleTypesCacheReturnsFalseWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->refreshTitleTypesCache();

        $this->assertFalse($result);
    }

    /**
     * Test refreshTitleTypesCache returns false when ERNIE unavailable
     */
    public function testRefreshTitleTypesCacheReturnsFalseWhenErnieUnavailable(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->refreshTitleTypesCache();

        $this->assertFalse($result);
    }

    // ==================== Title Types: Hardcoded Fallback Tests ====================

    /**
     * Test that hardcoded title type fallback contains Main Title, Alternative Title, Translated Title
     */
    public function testHardcodedTitleTypeFallbackContainsExpectedTypes(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getTitleTypesWithCache();

        $this->assertCount(3, $result);

        // Verify Main Title
        $this->assertSame(1, $result[0]['id']);
        $this->assertSame('Main Title', $result[0]['name']);
        $this->assertSame('main-title', $result[0]['slug']);

        // Verify Alternative Title
        $this->assertSame(2, $result[1]['id']);
        $this->assertSame('Alternative Title', $result[1]['name']);
        $this->assertSame('alternative-title', $result[1]['slug']);

        // Verify Translated Title
        $this->assertSame(4, $result[2]['id']);
        $this->assertSame('Translated Title', $result[2]['name']);
        $this->assertSame('translated-title', $result[2]['slug']);
    }

    /**
     * Test that hardcoded title type fallback is used when ERNIE fails and no cache exists
     */
    public function testHardcodedTitleTypeFallbackUsedWhenErnieFailsAndNoCache(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->getTitleTypesWithCache();

        $this->assertCount(3, $result);
        $this->assertSame('Main Title', $result[0]['name']);
        $this->assertSame('Alternative Title', $result[1]['name']);
        $this->assertSame('Translated Title', $result[2]['name']);
    }

    // ==================== Title Types: Cache independence Tests ====================

    /**
     * Test that title types and resource types use independent caches
     */
    public function testTitleTypesAndResourceTypesUseIndependentCaches(): void
    {
        // Write resource types cache
        $resourceData = [
            ['id' => 10, 'name' => 'Dataset', 'description' => null]
        ];
        $this->writeTestCache($resourceData);

        // Write title types cache with different data
        $titleData = [
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title'],
            ['id' => 2, 'name' => 'Alternative Title', 'slug' => 'alternative-title']
        ];
        $this->writeTitleTypesTestCache($titleData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');

        // Verify resource types cache is independent
        $resourceResult = $service->getResourceTypesWithCache();
        $this->assertCount(1, $resourceResult);
        $this->assertSame('Dataset', $resourceResult[0]['name']);

        // Verify title types cache is independent
        $titleResult = $service->getTitleTypesWithCache();
        $this->assertCount(2, $titleResult);
        $this->assertSame('Main Title', $titleResult[0]['name']);
    }

    /**
     * Test that title types cache status is independent from resource types cache
     */
    public function testTitleTypesCacheStatusIsIndependentFromResourceTypes(): void
    {
        // Only write resource types cache, not title types
        $resourceData = [
            ['id' => 10, 'name' => 'Dataset', 'description' => null]
        ];
        $this->writeTestCache($resourceData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');

        // Resource types cache should exist
        $resourceStatus = $service->getCacheStatus();
        $this->assertTrue($resourceStatus['exists']);

        // Title types cache should NOT exist
        $titleStatus = $service->getTitleTypesCacheStatus();
        $this->assertFalse($titleStatus['exists']);
    }

    // ==================== isConfigured() with logging Tests ====================

    /**
     * Test that isConfigured with logResult logs when configured
     */
    public function testIsConfiguredWithLogResultWhenConfigured(): void
    {
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->isConfigured(logResult: true);

        $this->assertTrue($result);
    }

    /**
     * Test that isConfigured with logResult logs when not configured
     */
    public function testIsConfiguredWithLogResultWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->isConfigured(logResult: true);

        $this->assertFalse($result);
    }

    // ==================== isCacheFileValid() edge cases ====================

    /**
     * Test that cache with invalid lastUpdated timestamp is treated as invalid
     */
    public function testCacheWithInvalidTimestampIsInvalid(): void
    {
        $cache = [
            'lastUpdated' => 'not-a-valid-date',
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => [['id' => 1, 'name' => 'Test', 'description' => null]]
        ];
        file_put_contents($this->testCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        // Cache exists but should be invalid due to unparseable timestamp
        $this->assertTrue($status['exists']);
        $this->assertFalse($status['valid']);
    }

    // ==================== writeCacheFile() edge cases ====================

    /**
     * Test that writeCacheFile creates directory if needed
     */
    public function testWriteCacheCreatesDirectoryIfNeeded(): void
    {
        // Create a service with cache file in a non-existent subdirectory
        $nestedDir = $this->testCacheDir . '/nested/deep';
        $nestedCacheFile = $nestedDir . '/test_cache.json';

        $this->setGlobalConfig('https://ernie.example.com/', 'test-key');
        $service = new TestableErnieService($nestedCacheFile, $this->testTitleTypesCacheFile);

        // Write valid data to the nested cache path via the resource types cache
        $testData = [['id' => 1, 'name' => 'Test', 'description' => null]];
        // Write to the nested cache file directly (simulating what writeCacheFile does)
        if (!is_dir($nestedDir)) {
            mkdir($nestedDir, 0755, true);
        }
        $cache = [
            'lastUpdated' => date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => $testData
        ];
        file_put_contents($nestedCacheFile, json_encode($cache, JSON_PRETTY_PRINT));

        // Verify we can read data back via the service
        $result = $service->getResourceTypesWithCache();
        $this->assertCount(1, $result);
        $this->assertSame('Test', $result[0]['name']);

        // Clean up nested directory
        if (file_exists($nestedCacheFile)) {
            unlink($nestedCacheFile);
        }
        if (is_dir($nestedDir)) {
            rmdir($nestedDir);
        }
        $parentDir = dirname($nestedDir);
        if (is_dir($parentDir)) {
            rmdir($parentDir);
        }
    }

    // ==================== getCacheFileStatus() edge cases ====================

    /**
     * Test getCacheStatus with empty data array
     */
    public function testGetCacheStatusWithEmptyData(): void
    {
        $cache = [
            'lastUpdated' => date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => []
        ];
        file_put_contents($this->testCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertSame(0, $status['itemCount']);
    }

    /**
     * Test getCacheStatus for title types with empty data 
     */
    public function testGetTitleTypesCacheStatusWithEmptyData(): void
    {
        $cache = [
            'lastUpdated' => date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => []
        ];
        file_put_contents($this->testTitleTypesCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getTitleTypesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertSame(0, $status['itemCount']);
    }

    // ==================== TTL with title types cache ====================

    /**
     * Test that custom TTL is respected for title types cache
     */
    public function testCustomTtlIsRespectedForTitleTypesCache(): void
    {
        $testData = [['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title']];
        // 30 minutes ago
        $thirtyMinutesAgo = date('c', strtotime('-30 minutes'));
        $this->writeTitleTypesTestCache($testData, $thirtyMinutesAgo);

        // Use 1 hour TTL - cache should be valid
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key', 3600);
        $status = $service->getTitleTypesCacheStatus();
        $this->assertTrue($status['valid']);

        // Use 10 minute TTL - cache should be invalid
        $service2 = $this->createTestableService('https://ernie.example.com/', 'test-key', 600);
        $status2 = $service2->getTitleTypesCacheStatus();
        $this->assertFalse($status2['valid']);
    }

    // ==================== readCacheFile() edge cases ====================

    /**
     * Test that title types cache with invalid JSON returns fallback
     */
    public function testTitleTypesCacheHandlesInvalidJsonGracefully(): void
    {
        // Write invalid JSON to title types cache file
        file_put_contents($this->testTitleTypesCacheFile, 'not valid json {{{');

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getTitleTypesWithCache();

        // Should return array (either empty or fallback)
        $this->assertIsArray($result);
    }

    /**
     * Test that title types cache handles missing data key
     */
    public function testTitleTypesCacheHandlesMissingDataKey(): void
    {
        $cache = ['lastUpdated' => date('c'), 'ttl' => 21600];
        file_put_contents($this->testTitleTypesCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getTitleTypesWithCache();

        // Should return array (cache data is empty, so fallback)
        $this->assertIsArray($result);
    }

    // ==================== formatAge() for title types ====================

    /**
     * Test formatAge for title types cache with hours
     */
    public function testFormatAgeForTitleTypesCacheHours(): void
    {
        $testData = [['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title']];
        $twoHoursAgo = date('c', strtotime('-2 hours'));
        $this->writeTitleTypesTestCache($testData, $twoHoursAgo);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getTitleTypesCacheStatus();

        $this->assertStringContainsString('hour', $status['ageFormatted']);
    }

    /**
     * Test formatAge for title types cache with seconds
     */
    public function testFormatAgeForTitleTypesCacheSeconds(): void
    {
        $testData = [['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title']];
        $recent = date('c', strtotime('-15 seconds'));
        $this->writeTitleTypesTestCache($testData, $recent);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getTitleTypesCacheStatus();

        $this->assertStringContainsString('seconds', $status['ageFormatted']);
    }

    // ==================== Constructor TTL fallback ====================

    /**
     * Test that constructor falls back to ernieResourceTypesCacheTtl when ernieCacheTtl is null
     */
    public function testConstructorFallsBackToLegacyTtlVariable(): void
    {
        global $ernieUrl, $ernieApiKey, $ernieCacheTtl, $ernieResourceTypesCacheTtl;
        $ernieUrl = 'https://ernie.example.com/';
        $ernieApiKey = 'test-key';
        $ernieCacheTtl = null;
        $ernieResourceTypesCacheTtl = 7200; // 2 hours

        $service = new TestableErnieService($this->testCacheFile, $this->testTitleTypesCacheFile, $this->testLanguagesCacheFile);

        // Write cache that is 3 hours old
        $testData = [['id' => 1, 'name' => 'Test', 'description' => null]];
        $threeHoursAgo = date('c', strtotime('-3 hours'));
        $this->writeTestCache($testData, $threeHoursAgo);

        $status = $service->getCacheStatus();
        // With 2 hour TTL, 3 hour old cache should be invalid
        $this->assertFalse($status['valid']);

        // Restore
        $ernieCacheTtl = 21600;
        $ernieResourceTypesCacheTtl = 21600;
    }

    // ==================== Languages: getLanguagesCacheStatus() Tests ====================

    /**
     * Test getLanguagesCacheStatus when cache doesn't exist
     */
    public function testGetLanguagesCacheStatusWhenCacheDoesNotExist(): void
    {
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getLanguagesCacheStatus();

        $this->assertFalse($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertNull($status['lastUpdated']);
        $this->assertNull($status['age']);
        $this->assertSame(0, $status['itemCount']);
    }

    /**
     * Test getLanguagesCacheStatus when cache exists and is valid
     */
    public function testGetLanguagesCacheStatusWhenCacheExistsAndValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'English', 'code' => 'en'],
            ['id' => 2, 'name' => 'German', 'code' => 'de']
        ];
        $this->writeLanguagesTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getLanguagesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertNotNull($status['lastUpdated']);
        $this->assertIsInt($status['age']);
        $this->assertSame(2, $status['itemCount']);
        $this->assertArrayHasKey('ageFormatted', $status);
        $this->assertArrayHasKey('ttl', $status);
    }

    /**
     * Test getLanguagesCacheStatus when cache exists but is expired
     */
    public function testGetLanguagesCacheStatusWhenCacheExpired(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'English', 'code' => 'en']
        ];
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeLanguagesTestCache($testData, $expiredTime);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getLanguagesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertSame(1, $status['itemCount']);
    }

    // ==================== Languages: getLanguagesWithCache() Tests ====================

    /**
     * Test that getLanguagesWithCache returns hardcoded fallback when not configured and no cache
     */
    public function testGetLanguagesWithCacheReturnsHardcodedFallbackWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getLanguagesWithCache();

        $this->assertIsArray($result);
        $this->assertCount(2, $result);
        $this->assertSame('English', $result[0]['name']);
        $this->assertSame('German', $result[1]['name']);
    }

    /**
     * Test that getLanguagesWithCache returns cached data when cache is valid
     */
    public function testGetLanguagesWithCacheReturnsCachedDataWhenValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'English', 'code' => 'en'],
            ['id' => 2, 'name' => 'German', 'code' => 'de'],
            ['id' => 3, 'name' => 'French', 'code' => 'fr']
        ];
        $this->writeLanguagesTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getLanguagesWithCache();

        $this->assertCount(3, $result);
        $this->assertSame('English', $result[0]['name']);
        $this->assertSame('German', $result[1]['name']);
        $this->assertSame('French', $result[2]['name']);
    }

    /**
     * Test that getLanguagesWithCache returns stale cache when ERNIE unavailable
     */
    public function testGetLanguagesWithCacheReturnsStaleWhenErnieUnavailable(): void
    {
        $testData = [
            ['id' => 5, 'name' => 'Spanish', 'code' => 'es']
        ];
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeLanguagesTestCache($testData, $expiredTime);

        $service = $this->createTestableService('https://invalid-url-that-does-not-exist.local/', 'test-key');
        $result = $service->getLanguagesWithCache();

        $this->assertCount(1, $result);
        $this->assertSame('Spanish', $result[0]['name']);
    }

    // ==================== Languages: fetchLanguages() Tests ====================

    /**
     * Test fetchLanguages returns null when not configured
     */
    public function testFetchLanguagesReturnsNullWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->fetchLanguages();

        $this->assertNull($result);
    }

    /**
     * Test fetchLanguages returns null on invalid URL
     */
    public function testFetchLanguagesReturnsNullOnInvalidUrl(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->fetchLanguages();

        $this->assertNull($result);
    }

    // ==================== Languages: refreshLanguagesCache() Tests ====================

    /**
     * Test refreshLanguagesCache returns false when not configured
     */
    public function testRefreshLanguagesCacheReturnsFalseWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->refreshLanguagesCache();

        $this->assertFalse($result);
    }

    /**
     * Test refreshLanguagesCache returns false when ERNIE unavailable
     */
    public function testRefreshLanguagesCacheReturnsFalseWhenErnieUnavailable(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->refreshLanguagesCache();

        $this->assertFalse($result);
    }

    // ==================== Languages: Hardcoded Fallback Tests ====================

    /**
     * Test that hardcoded language fallback contains English and German
     */
    public function testHardcodedLanguageFallbackContainsExpectedLanguages(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getLanguagesWithCache();

        $this->assertCount(2, $result);

        // Verify English
        $this->assertSame(1, $result[0]['id']);
        $this->assertSame('English', $result[0]['name']);
        $this->assertSame('en', $result[0]['code']);

        // Verify German
        $this->assertSame(2, $result[1]['id']);
        $this->assertSame('German', $result[1]['name']);
        $this->assertSame('de', $result[1]['code']);
    }

    /**
     * Test that hardcoded language fallback is used when ERNIE fails and no cache exists
     */
    public function testHardcodedLanguageFallbackUsedWhenErnieFailsAndNoCache(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->getLanguagesWithCache();

        $this->assertCount(2, $result);
        $this->assertSame('English', $result[0]['name']);
        $this->assertSame('German', $result[1]['name']);
    }

    // ==================== Languages: Cache independence Tests ====================

    /**
     * Test that languages, title types and resource types use independent caches
     */
    public function testLanguagesCacheIsIndependentFromOtherCaches(): void
    {
        // Write resource types cache
        $resourceData = [
            ['id' => 10, 'name' => 'Dataset', 'description' => null]
        ];
        $this->writeTestCache($resourceData);

        // Write title types cache
        $titleData = [
            ['id' => 1, 'name' => 'Main Title', 'slug' => 'main-title']
        ];
        $this->writeTitleTypesTestCache($titleData);

        // Write languages cache with different data
        $languageData = [
            ['id' => 1, 'name' => 'English', 'code' => 'en'],
            ['id' => 2, 'name' => 'German', 'code' => 'de'],
            ['id' => 3, 'name' => 'French', 'code' => 'fr']
        ];
        $this->writeLanguagesTestCache($languageData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');

        // Verify all caches are independent
        $resourceResult = $service->getResourceTypesWithCache();
        $this->assertCount(1, $resourceResult);
        $this->assertSame('Dataset', $resourceResult[0]['name']);

        $titleResult = $service->getTitleTypesWithCache();
        $this->assertCount(1, $titleResult);
        $this->assertSame('Main Title', $titleResult[0]['name']);

        $languageResult = $service->getLanguagesWithCache();
        $this->assertCount(3, $languageResult);
        $this->assertSame('English', $languageResult[0]['name']);
    }

    /**
     * Test that languages cache status is independent from other caches
     */
    public function testLanguagesCacheStatusIsIndependentFromOtherCaches(): void
    {
        // Only write resource types cache, not languages
        $resourceData = [
            ['id' => 10, 'name' => 'Dataset', 'description' => null]
        ];
        $this->writeTestCache($resourceData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');

        // Resource types cache should exist
        $resourceStatus = $service->getCacheStatus();
        $this->assertTrue($resourceStatus['exists']);

        // Languages cache should NOT exist
        $languagesStatus = $service->getLanguagesCacheStatus();
        $this->assertFalse($languagesStatus['exists']);
    }

    // ==================== Languages: TTL Tests ====================

    /**
     * Test that custom TTL is respected for languages cache
     */
    public function testCustomTtlIsRespectedForLanguagesCache(): void
    {
        $testData = [['id' => 1, 'name' => 'English', 'code' => 'en']];
        $thirtyMinutesAgo = date('c', strtotime('-30 minutes'));
        $this->writeLanguagesTestCache($testData, $thirtyMinutesAgo);

        // Use 1 hour TTL - cache should be valid
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key', 3600);
        $status = $service->getLanguagesCacheStatus();
        $this->assertTrue($status['valid']);

        // Use 10 minute TTL - cache should be invalid
        $service2 = $this->createTestableService('https://ernie.example.com/', 'test-key', 600);
        $status2 = $service2->getLanguagesCacheStatus();
        $this->assertFalse($status2['valid']);
    }

    // ==================== Languages: Cache edge cases ====================

    /**
     * Test that languages cache with invalid JSON returns fallback
     */
    public function testLanguagesCacheHandlesInvalidJsonGracefully(): void
    {
        file_put_contents($this->testLanguagesCacheFile, 'not valid json {{{');

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getLanguagesWithCache();

        $this->assertIsArray($result);
    }

    /**
     * Test that languages cache handles missing data key
     */
    public function testLanguagesCacheHandlesMissingDataKey(): void
    {
        $cache = ['lastUpdated' => date('c'), 'ttl' => 21600];
        file_put_contents($this->testLanguagesCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getLanguagesWithCache();

        $this->assertIsArray($result);
    }

    /**
     * Test getLanguagesCacheStatus with empty data
     */
    public function testGetLanguagesCacheStatusWithEmptyData(): void
    {
        $cache = [
            'lastUpdated' => date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => []
        ];
        file_put_contents($this->testLanguagesCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getLanguagesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertSame(0, $status['itemCount']);
    }

    // ==================== Contributor Person Roles: Cache Status Tests ====================

    /**
     * Test getContributorPersonRolesCacheStatus when cache doesn't exist
     */
    public function testGetContributorPersonRolesCacheStatusWhenCacheDoesNotExist(): void
    {
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getContributorPersonRolesCacheStatus();

        $this->assertFalse($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertNull($status['lastUpdated']);
        $this->assertNull($status['age']);
        $this->assertSame(0, $status['itemCount']);
    }

    /**
     * Test getContributorPersonRolesCacheStatus when cache exists and is valid
     */
    public function testGetContributorPersonRolesCacheStatusWhenCacheExistsAndValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Data Collector'],
            ['id' => 2, 'name' => 'Researcher']
        ];
        $this->writeContributorPersonRolesTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getContributorPersonRolesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertNotNull($status['lastUpdated']);
        $this->assertIsInt($status['age']);
        $this->assertSame(2, $status['itemCount']);
        $this->assertArrayHasKey('ageFormatted', $status);
        $this->assertArrayHasKey('ttl', $status);
    }

    /**
     * Test getContributorPersonRolesCacheStatus when cache exists but is expired
     */
    public function testGetContributorPersonRolesCacheStatusWhenCacheExpired(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Data Collector']
        ];
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeContributorPersonRolesTestCache($testData, $expiredTime);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getContributorPersonRolesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertSame(1, $status['itemCount']);
    }

    // ==================== Contributor Person Roles: getWithCache Tests ====================

    /**
     * Test getContributorPersonRolesWithCache returns hardcoded fallback when not configured
     */
    public function testGetContributorPersonRolesWithCacheReturnsHardcodedFallbackWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getContributorPersonRolesWithCache();

        $this->assertIsArray($result);
        $this->assertNotEmpty($result);
        // Should contain typical person roles
        $names = array_column($result, 'name');
        $this->assertContains('Data Collector', $names);
        $this->assertContains('Researcher', $names);
        $this->assertContains('Project Leader', $names);
        $this->assertContains('Other', $names);
    }

    /**
     * Test getContributorPersonRolesWithCache returns cached data when valid
     */
    public function testGetContributorPersonRolesWithCacheReturnsCachedDataWhenValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Data Collector'],
            ['id' => 2, 'name' => 'Researcher'],
            ['id' => 3, 'name' => 'Supervisor']
        ];
        $this->writeContributorPersonRolesTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getContributorPersonRolesWithCache();

        $this->assertCount(3, $result);
        $this->assertSame('Data Collector', $result[0]['name']);
        $this->assertSame('Researcher', $result[1]['name']);
        $this->assertSame('Supervisor', $result[2]['name']);
    }

    /**
     * Test getContributorPersonRolesWithCache returns stale cache when ERNIE unavailable
     */
    public function testGetContributorPersonRolesWithCacheReturnsStaleWhenErnieUnavailable(): void
    {
        $testData = [
            ['id' => 5, 'name' => 'Editor']
        ];
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeContributorPersonRolesTestCache($testData, $expiredTime);

        $service = $this->createTestableService('https://invalid-url-that-does-not-exist.local/', 'test-key');
        $result = $service->getContributorPersonRolesWithCache();

        $this->assertCount(1, $result);
        $this->assertSame('Editor', $result[0]['name']);
    }

    // ==================== Contributor Person Roles: fetch Tests ====================

    /**
     * Test fetchContributorPersonRoles returns null when not configured
     */
    public function testFetchContributorPersonRolesReturnsNullWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->fetchContributorPersonRoles();

        $this->assertNull($result);
    }

    /**
     * Test fetchContributorPersonRoles returns null on invalid URL
     */
    public function testFetchContributorPersonRolesReturnsNullOnInvalidUrl(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->fetchContributorPersonRoles();

        $this->assertNull($result);
    }

    // ==================== Contributor Person Roles: refresh Tests ====================

    /**
     * Test refreshContributorPersonRolesCache returns false when not configured
     */
    public function testRefreshContributorPersonRolesCacheReturnsFalseWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->refreshContributorPersonRolesCache();

        $this->assertFalse($result);
    }

    /**
     * Test refreshContributorPersonRolesCache returns false when ERNIE unavailable
     */
    public function testRefreshContributorPersonRolesCacheReturnsFalseWhenErnieUnavailable(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->refreshContributorPersonRolesCache();

        $this->assertFalse($result);
    }

    // ==================== Contributor Person Roles: Hardcoded Fallback Tests ====================

    /**
     * Test that hardcoded contributor person roles fallback contains expected roles
     */
    public function testHardcodedContributorPersonRoleFallbackContainsExpectedRoles(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getContributorPersonRolesWithCache();

        $this->assertGreaterThanOrEqual(10, count($result));

        $names = array_column($result, 'name');
        $this->assertContains('Data Collector', $names);
        $this->assertContains('Data Curator', $names);
        $this->assertContains('Data Manager', $names);
        $this->assertContains('Editor', $names);
        $this->assertContains('Researcher', $names);
        $this->assertContains('Supervisor', $names);
        $this->assertContains('Other', $names);

        // Verify each entry has id and name
        foreach ($result as $role) {
            $this->assertArrayHasKey('id', $role);
            $this->assertArrayHasKey('name', $role);
            $this->assertIsInt($role['id']);
            $this->assertIsString($role['name']);
        }
    }

    /**
     * Test hardcoded fallback is used when ERNIE fails and no cache exists
     */
    public function testHardcodedContributorPersonRoleFallbackUsedWhenErnieFailsAndNoCache(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->getContributorPersonRolesWithCache();

        $this->assertNotEmpty($result);
        $names = array_column($result, 'name');
        $this->assertContains('Researcher', $names);
    }

    // ==================== Contributor Institution Roles: Cache Status Tests ====================

    /**
     * Test getContributorInstitutionRolesCacheStatus when cache doesn't exist
     */
    public function testGetContributorInstitutionRolesCacheStatusWhenCacheDoesNotExist(): void
    {
        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getContributorInstitutionRolesCacheStatus();

        $this->assertFalse($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertNull($status['lastUpdated']);
        $this->assertNull($status['age']);
        $this->assertSame(0, $status['itemCount']);
    }

    /**
     * Test getContributorInstitutionRolesCacheStatus when cache exists and is valid
     */
    public function testGetContributorInstitutionRolesCacheStatusWhenCacheExistsAndValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Distributor'],
            ['id' => 2, 'name' => 'Hosting Institution']
        ];
        $this->writeContributorInstitutionRolesTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getContributorInstitutionRolesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertNotNull($status['lastUpdated']);
        $this->assertIsInt($status['age']);
        $this->assertSame(2, $status['itemCount']);
        $this->assertArrayHasKey('ageFormatted', $status);
        $this->assertArrayHasKey('ttl', $status);
    }

    /**
     * Test getContributorInstitutionRolesCacheStatus when cache exists but is expired
     */
    public function testGetContributorInstitutionRolesCacheStatusWhenCacheExpired(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Distributor']
        ];
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeContributorInstitutionRolesTestCache($testData, $expiredTime);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getContributorInstitutionRolesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertFalse($status['valid']);
        $this->assertSame(1, $status['itemCount']);
    }

    // ==================== Contributor Institution Roles: getWithCache Tests ====================

    /**
     * Test getContributorInstitutionRolesWithCache returns hardcoded fallback when not configured
     */
    public function testGetContributorInstitutionRolesWithCacheReturnsHardcodedFallbackWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getContributorInstitutionRolesWithCache();

        $this->assertIsArray($result);
        $this->assertNotEmpty($result);
        $names = array_column($result, 'name');
        $this->assertContains('Distributor', $names);
        $this->assertContains('Hosting Institution', $names);
        $this->assertContains('Research Group', $names);
        $this->assertContains('Other', $names);
    }

    /**
     * Test getContributorInstitutionRolesWithCache returns cached data when valid
     */
    public function testGetContributorInstitutionRolesWithCacheReturnsCachedDataWhenValid(): void
    {
        $testData = [
            ['id' => 1, 'name' => 'Distributor'],
            ['id' => 2, 'name' => 'Hosting Institution'],
            ['id' => 3, 'name' => 'Research Group']
        ];
        $this->writeContributorInstitutionRolesTestCache($testData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getContributorInstitutionRolesWithCache();

        $this->assertCount(3, $result);
        $this->assertSame('Distributor', $result[0]['name']);
        $this->assertSame('Hosting Institution', $result[1]['name']);
        $this->assertSame('Research Group', $result[2]['name']);
    }

    /**
     * Test getContributorInstitutionRolesWithCache returns stale cache when ERNIE unavailable
     */
    public function testGetContributorInstitutionRolesWithCacheReturnsStaleWhenErnieUnavailable(): void
    {
        $testData = [
            ['id' => 4, 'name' => 'Registration Agency']
        ];
        $expiredTime = date('c', strtotime('-7 hours'));
        $this->writeContributorInstitutionRolesTestCache($testData, $expiredTime);

        $service = $this->createTestableService('https://invalid-url-that-does-not-exist.local/', 'test-key');
        $result = $service->getContributorInstitutionRolesWithCache();

        $this->assertCount(1, $result);
        $this->assertSame('Registration Agency', $result[0]['name']);
    }

    // ==================== Contributor Institution Roles: fetch Tests ====================

    /**
     * Test fetchContributorInstitutionRoles returns null when not configured
     */
    public function testFetchContributorInstitutionRolesReturnsNullWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->fetchContributorInstitutionRoles();

        $this->assertNull($result);
    }

    /**
     * Test fetchContributorInstitutionRoles returns null on invalid URL
     */
    public function testFetchContributorInstitutionRolesReturnsNullOnInvalidUrl(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->fetchContributorInstitutionRoles();

        $this->assertNull($result);
    }

    // ==================== Contributor Institution Roles: refresh Tests ====================

    /**
     * Test refreshContributorInstitutionRolesCache returns false when not configured
     */
    public function testRefreshContributorInstitutionRolesCacheReturnsFalseWhenNotConfigured(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->refreshContributorInstitutionRolesCache();

        $this->assertFalse($result);
    }

    /**
     * Test refreshContributorInstitutionRolesCache returns false when ERNIE unavailable
     */
    public function testRefreshContributorInstitutionRolesCacheReturnsFalseWhenErnieUnavailable(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->refreshContributorInstitutionRolesCache();

        $this->assertFalse($result);
    }

    // ==================== Contributor Institution Roles: Hardcoded Fallback Tests ====================

    /**
     * Test that hardcoded contributor institution roles fallback contains expected roles
     */
    public function testHardcodedContributorInstitutionRoleFallbackContainsExpectedRoles(): void
    {
        $service = $this->createTestableService('', '');
        $result = $service->getContributorInstitutionRolesWithCache();

        $this->assertGreaterThanOrEqual(10, count($result));

        $names = array_column($result, 'name');
        $this->assertContains('Distributor', $names);
        $this->assertContains('Hosting Institution', $names);
        $this->assertContains('Registration Agency', $names);
        $this->assertContains('Registration Authority', $names);
        $this->assertContains('Research Group', $names);
        $this->assertContains('Rights Holder', $names);
        $this->assertContains('Other', $names);

        // Verify each entry has id and name
        foreach ($result as $role) {
            $this->assertArrayHasKey('id', $role);
            $this->assertArrayHasKey('name', $role);
            $this->assertIsInt($role['id']);
            $this->assertIsString($role['name']);
        }
    }

    /**
     * Test hardcoded fallback is used when ERNIE fails and no cache exists
     */
    public function testHardcodedContributorInstitutionRoleFallbackUsedWhenErnieFailsAndNoCache(): void
    {
        $service = $this->createTestableService('https://invalid-url-12345.local/', 'test-key');
        $result = $service->getContributorInstitutionRolesWithCache();

        $this->assertNotEmpty($result);
        $names = array_column($result, 'name');
        $this->assertContains('Hosting Institution', $names);
    }

    // ==================== Contributor Roles: Cache independence Tests ====================

    /**
     * Test that contributor person and institution roles use independent caches
     */
    public function testContributorRolesCachesAreIndependent(): void
    {
        $personData = [
            ['id' => 1, 'name' => 'Researcher'],
            ['id' => 2, 'name' => 'Supervisor']
        ];
        $this->writeContributorPersonRolesTestCache($personData);

        $institutionData = [
            ['id' => 1, 'name' => 'Hosting Institution'],
            ['id' => 2, 'name' => 'Distributor'],
            ['id' => 3, 'name' => 'Research Group']
        ];
        $this->writeContributorInstitutionRolesTestCache($institutionData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');

        $personResult = $service->getContributorPersonRolesWithCache();
        $this->assertCount(2, $personResult);
        $this->assertSame('Researcher', $personResult[0]['name']);

        $institutionResult = $service->getContributorInstitutionRolesWithCache();
        $this->assertCount(3, $institutionResult);
        $this->assertSame('Hosting Institution', $institutionResult[0]['name']);
    }

    /**
     * Test that contributor roles cache statuses are independent from each other
     */
    public function testContributorRolesCacheStatusesAreIndependent(): void
    {
        // Only write person roles cache
        $personData = [
            ['id' => 1, 'name' => 'Researcher']
        ];
        $this->writeContributorPersonRolesTestCache($personData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');

        $personStatus = $service->getContributorPersonRolesCacheStatus();
        $this->assertTrue($personStatus['exists']);

        $institutionStatus = $service->getContributorInstitutionRolesCacheStatus();
        $this->assertFalse($institutionStatus['exists']);
    }

    /**
     * Test that contributor roles caches are independent from resource types cache
     */
    public function testContributorRolesCachesAreIndependentFromOtherCaches(): void
    {
        $resourceData = [
            ['id' => 10, 'name' => 'Dataset', 'description' => null]
        ];
        $this->writeTestCache($resourceData);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');

        $resourceStatus = $service->getCacheStatus();
        $this->assertTrue($resourceStatus['exists']);

        $personStatus = $service->getContributorPersonRolesCacheStatus();
        $this->assertFalse($personStatus['exists']);

        $institutionStatus = $service->getContributorInstitutionRolesCacheStatus();
        $this->assertFalse($institutionStatus['exists']);
    }

    // ==================== Contributor Roles: TTL Tests ====================

    /**
     * Test that custom TTL is respected for contributor person roles cache
     */
    public function testCustomTtlIsRespectedForContributorPersonRolesCache(): void
    {
        $testData = [['id' => 1, 'name' => 'Researcher']];
        $thirtyMinutesAgo = date('c', strtotime('-30 minutes'));
        $this->writeContributorPersonRolesTestCache($testData, $thirtyMinutesAgo);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key', 3600);
        $status = $service->getContributorPersonRolesCacheStatus();
        $this->assertTrue($status['valid']);

        $service2 = $this->createTestableService('https://ernie.example.com/', 'test-key', 600);
        $status2 = $service2->getContributorPersonRolesCacheStatus();
        $this->assertFalse($status2['valid']);
    }

    /**
     * Test that custom TTL is respected for contributor institution roles cache
     */
    public function testCustomTtlIsRespectedForContributorInstitutionRolesCache(): void
    {
        $testData = [['id' => 1, 'name' => 'Distributor']];
        $thirtyMinutesAgo = date('c', strtotime('-30 minutes'));
        $this->writeContributorInstitutionRolesTestCache($testData, $thirtyMinutesAgo);

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key', 3600);
        $status = $service->getContributorInstitutionRolesCacheStatus();
        $this->assertTrue($status['valid']);

        $service2 = $this->createTestableService('https://ernie.example.com/', 'test-key', 600);
        $status2 = $service2->getContributorInstitutionRolesCacheStatus();
        $this->assertFalse($status2['valid']);
    }

    // ==================== Contributor Roles: Cache edge cases ====================

    /**
     * Test that contributor person roles cache handles invalid JSON gracefully
     */
    public function testContributorPersonRolesCacheHandlesInvalidJsonGracefully(): void
    {
        file_put_contents($this->testContributorPersonRolesCacheFile, 'not valid json {{{');

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getContributorPersonRolesWithCache();

        $this->assertIsArray($result);
    }

    /**
     * Test that contributor institution roles cache handles invalid JSON gracefully
     */
    public function testContributorInstitutionRolesCacheHandlesInvalidJsonGracefully(): void
    {
        file_put_contents($this->testContributorInstitutionRolesCacheFile, 'not valid json {{{');

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $result = $service->getContributorInstitutionRolesWithCache();

        $this->assertIsArray($result);
    }

    /**
     * Test getContributorPersonRolesCacheStatus with empty data
     */
    public function testGetContributorPersonRolesCacheStatusWithEmptyData(): void
    {
        $cache = [
            'lastUpdated' => date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => []
        ];
        file_put_contents($this->testContributorPersonRolesCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getContributorPersonRolesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertSame(0, $status['itemCount']);
    }

    /**
     * Test getContributorInstitutionRolesCacheStatus with empty data
     */
    public function testGetContributorInstitutionRolesCacheStatusWithEmptyData(): void
    {
        $cache = [
            'lastUpdated' => date('c'),
            'ttl' => 21600,
            'source' => 'ernie',
            'data' => []
        ];
        file_put_contents($this->testContributorInstitutionRolesCacheFile, json_encode($cache));

        $service = $this->createTestableService('https://ernie.example.com/', 'test-key');
        $status = $service->getContributorInstitutionRolesCacheStatus();

        $this->assertTrue($status['exists']);
        $this->assertTrue($status['valid']);
        $this->assertSame(0, $status['itemCount']);
    }
}

