<?php
declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Test suite for generate_xml_files.php
 * 
 * Tests the XML generation script structure, logic, and error handling
 * without requiring full database setup.
 */
class GenerateXmlFilesTest extends TestCase
{
    private string $scriptPath;
    private string $scriptContent;

    /**
     * Set up test environment before each test
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->scriptPath = __DIR__ . '/../generate_xml_files.php';
        $this->scriptContent = file_get_contents($this->scriptPath);
    }

    /**
     * Test that the script file exists and is readable
     */
    public function testScriptFileExists(): void
    {
        $this->assertFileExists($this->scriptPath, 'generate_xml_files.php should exist');
        $this->assertFileIsReadable($this->scriptPath, 'generate_xml_files.php should be readable');
    }

    /**
     * Test script contains required includes
     */
    public function testScriptContainsRequiredIncludes(): void
    {
        $this->assertStringContainsString('settings.php', $this->scriptContent);
        $this->assertStringContainsString('DatasetController', $this->scriptContent);
    }

    /**
     * Test script initializes response array
     */
    public function testScriptInitializesResponseArray(): void
    {
        $this->assertStringContainsString('$response', $this->scriptContent);
        $this->assertStringContainsString("'status'", $this->scriptContent);
        $this->assertStringContainsString("'message'", $this->scriptContent);
        $this->assertStringContainsString("'progress'", $this->scriptContent);
        $this->assertStringContainsString("'details'", $this->scriptContent);
    }

    /**
     * Test script uses database connection
     */
    public function testScriptUsesDatabaseConnection(): void
    {
        $this->assertStringContainsString('connectDb()', $this->scriptContent);
        $this->assertStringContainsString('$connection', $this->scriptContent);
    }

    /**
     * Test script queries resources
     */
    public function testScriptQueriesResources(): void
    {
        $this->assertStringContainsString('SELECT resource_id FROM Resource', $this->scriptContent);
        $this->assertStringContainsString('ORDER BY resource_id', $this->scriptContent);
    }

    /**
     * Test script handles database errors
     */
    public function testScriptHandlesDatabaseErrors(): void
    {
        $this->assertStringContainsString('connect_error', $this->scriptContent);
        $this->assertStringContainsString('Exception', $this->scriptContent);
        $this->assertStringContainsString('try', $this->scriptContent);
        $this->assertStringContainsString('catch', $this->scriptContent);
    }

    /**
     * Test script creates DatasetController instance
     */
    public function testScriptCreatesDatasetControllerInstance(): void
    {
        $this->assertStringContainsString('new DatasetController()', $this->scriptContent);
        $this->assertStringContainsString('$controller', $this->scriptContent);
    }

    /**
     * Test script calls getResourceAsXml method
     */
    public function testScriptCallsGetResourceAsXmlMethod(): void
    {
        $this->assertStringContainsString('getResourceAsXml', $this->scriptContent);
        $this->assertStringContainsString('$connection', $this->scriptContent);
        $this->assertStringContainsString('$resourceId', $this->scriptContent);
    }

    /**
     * Test script tracks success and error counts
     */
    public function testScriptTracksSuccessAndErrorCounts(): void
    {
        $this->assertStringContainsString('$successCount', $this->scriptContent);
        $this->assertStringContainsString('$errorCount', $this->scriptContent);
        $this->assertStringContainsString('$processedCount', $this->scriptContent);
    }

    /**
     * Test script calculates progress
     */
    public function testScriptCalculatesProgress(): void
    {
        $this->assertStringContainsString('progress', $this->scriptContent);
        $this->assertStringContainsString('$processedCount / $totalRecords', $this->scriptContent);
        $this->assertStringContainsString('* 100', $this->scriptContent);
    }

    /**
     * Test script handles empty result set
     */
    public function testScriptHandlesEmptyResultSet(): void
    {
        $this->assertStringContainsString('$totalRecords === 0', $this->scriptContent);
        $this->assertStringContainsString('No resources found', $this->scriptContent);
    }

    /**
     * Test script closes database connection
     */
    public function testScriptClosesDatabaseConnection(): void
    {
        $this->assertStringContainsString('$connection->close()', $this->scriptContent);
    }

    /**
     * Test script outputs JSON
     */
    public function testScriptOutputsJson(): void
    {
        $this->assertStringContainsString('json_encode($response)', $this->scriptContent);
        $this->assertStringContainsString('echo', $this->scriptContent);
    }

    /**
     * Test script logs errors
     */
    public function testScriptLogsErrors(): void
    {
        $this->assertStringContainsString('error_log', $this->scriptContent);
        $this->assertStringContainsString('XML Generation Error', $this->scriptContent);
    }

    /**
     * Test script sets progress to 100 at completion
     */
    public function testScriptSetsProgressTo100AtCompletion(): void
    {
        $this->assertStringContainsString('progress', $this->scriptContent);
        $this->assertStringContainsString('= 100', $this->scriptContent);
    }

    /**
     * Test script handles fatal errors with try-catch
     */
    public function testScriptHandlesFatalErrorsWithTryCatch(): void
    {
        $matches = preg_match_all('/try\s*{/i', $this->scriptContent);
        $this->assertGreaterThan(0, $matches, 'Script should have at least one try block');
        
        $matches = preg_match_all('/catch\s*\(/i', $this->scriptContent);
        $this->assertGreaterThan(0, $matches, 'Script should have at least one catch block');
    }

    /**
     * Test script sets warning status when some operations fail
     */
    public function testScriptSetsWarningStatusWhenSomeOperationsFail(): void
    {
        $this->assertStringContainsString('warning', $this->scriptContent);
        $this->assertStringContainsString('if ($errorCount > 0)', $this->scriptContent);
    }

    /**
     * Test script provides detailed error messages
     */
    public function testScriptProvidesDetailedErrorMessages(): void
    {
        $this->assertStringContainsString('Error processing resource ID', $this->scriptContent);
        $this->assertStringContainsString('getMessage()', $this->scriptContent);
    }

    /**
     * Test script checks for empty XML content
     */
    public function testScriptChecksForEmptyXmlContent(): void
    {
        $this->assertStringContainsString('if ($xmlContent)', $this->scriptContent);
        $this->assertStringContainsString('Warning: Empty XML generated', $this->scriptContent);
    }

    /**
     * Test script fetches resources from database query
     */
    public function testScriptFetchesResourcesFromDatabaseQuery(): void
    {
        $this->assertStringContainsString('$result->fetch_assoc()', $this->scriptContent);
        $this->assertStringContainsString('while', $this->scriptContent);
    }

    /**
     * Test script initializes response with starting message
     */
    public function testScriptInitializesResponseWithStartingMessage(): void
    {
        $this->assertStringContainsString('XML generation started', $this->scriptContent);
    }

    /**
     * Test script provides completion summary
     */
    public function testScriptProvidesCompletionSummary(): void
    {
        $this->assertStringContainsString('XML generation completed', $this->scriptContent);
        $this->assertStringContainsString('Successful:', $this->scriptContent);
        $this->assertStringContainsString('Errors:', $this->scriptContent);
        $this->assertStringContainsString('Total:', $this->scriptContent);
    }

    /**
     * Test script adds details for each processed resource
     */
    public function testScriptAddsDetailsForEachProcessedResource(): void
    {
        $this->assertStringContainsString('$response[\'details\'][]', $this->scriptContent);
        $this->assertStringContainsString('Successfully generated XML for resource ID', $this->scriptContent);
    }

    /**
     * Test script handles query failures
     */
    public function testScriptHandlesQueryFailures(): void
    {
        $this->assertStringContainsString('if (!$result)', $this->scriptContent);
        $this->assertStringContainsString('Failed to fetch resource IDs', $this->scriptContent);
    }

    /**
     * Test script uses error reporting
     */
    public function testScriptUsesErrorReporting(): void
    {
        $this->assertStringContainsString('error_reporting', $this->scriptContent);
        $this->assertStringContainsString('display_errors', $this->scriptContent);
    }

    /**
     * Test script initializes counts to zero
     */
    public function testScriptInitializesCountsToZero(): void
    {
        $this->assertStringContainsString('$successCount = 0', $this->scriptContent);
        $this->assertStringContainsString('$errorCount = 0', $this->scriptContent);
        $this->assertStringContainsString('$processedCount = 0', $this->scriptContent);
    }

    /**
     * Test script increments process count
     */
    public function testScriptIncrementsProcessCount(): void
    {
        $this->assertStringContainsString('$processedCount++', $this->scriptContent);
    }

    /**
     * Test script exits after outputting response
     */
    public function testScriptExitsAfterOutputtingResponse(): void
    {
        $this->assertStringContainsString('exit', $this->scriptContent);
    }

    /**
     * Test script reports total records found
     */
    public function testScriptReportsTotalRecordsFound(): void
    {
        $this->assertStringContainsString('Found {$totalRecords} resources to process', $this->scriptContent);
    }

    /**
     * Test script handles individual resource errors without stopping
     */
    public function testScriptHandlesIndividualResourceErrorsWithoutStopping(): void
    {
        // Should have a try-catch inside the loop
        $pattern = '/while.*?\{.*?try.*?catch/s';
        $this->assertMatchesRegularExpression($pattern, $this->scriptContent, 
            'Script should have error handling inside the processing loop');
    }

    /**
     * Test DatasetController class is available
     */
    public function testDatasetControllerClassIsAvailable(): void
    {
        require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';
        $this->assertTrue(
            class_exists('DatasetController'),
            'DatasetController class should exist'
        );
    }

    /**
     * Test script sets error status on fatal error
     */
    public function testScriptSetsErrorStatusOnFatalError(): void
    {
        $this->assertStringContainsString('error', $this->scriptContent);
        $this->assertStringContainsString('Fatal error during XML generation', $this->scriptContent);
    }

    /**
     * Test script provides helpful error messages in catch block
     */
    public function testScriptProvidesHelpfulErrorMessagesInCatchBlock(): void
    {
        $this->assertStringContainsString('$e->getMessage()', $this->scriptContent);
        $this->assertMatchesRegularExpression('/catch.*Exception.*\$e/s', $this->scriptContent);
    }
}
