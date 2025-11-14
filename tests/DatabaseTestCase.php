<?php
declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Abstract base test case that sets up the database connection,
 * initializes the test database, and provides common helpers.
 */
abstract class DatabaseTestCase extends TestCase
{
    /**
     * @var \mysqli Database connection resource.
     */
    protected $connection;

    /**
     * Set up database connection for testing.
     * Uses test_user credentials for CI, elmo credentials for local Docker.
     *
     * @return void
     */
    protected function setUpConnection(): mysqli
    {
        // Check if we're in GitHub Actions or GitLab CI
        $isCI = getenv('CI') !== false || getenv('GITHUB_ACTIONS') !== false;
        
        if ($isCI) {
            // GitHub Actions / GitLab CI: use test_user credentials
            $host = '127.0.0.1';
            $username = 'test_user';
            $password = 'test_password';
        } else {
            // Local Docker development: use elmo credentials
            $host = getenv('DB_HOST') ?: 'db';
            $username = getenv('DB_USER') ?: 'elmo';
            $password = getenv('DB_PASSWORD') ?: 'elmo';
        }
        
        // Create connection without selecting database first
        $conn = new \mysqli($host, $username, $password);
        
        if ($conn->connect_error) {
            $this->fail("Failed to connect to test database: " . $conn->connect_error);
        }
        
        // Create test database if it doesn't exist
        $dbname = 'mde2-msl-test';
        $conn->query("CREATE DATABASE IF NOT EXISTS `{$dbname}`");
        
        // Select the test database
        if ($conn->select_db($dbname) === false) {
            $this->fail("Failed to select test database: " . $conn->error);
        }
        
        return $conn;
    }

    /**
     * Set up test database before each test.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Set up database connection
        $this->connection = $this->setUpConnection();
        
        // Load test database setup
        require_once __DIR__ . '/TestDatabaseSetup.php';

        // Setup test database structure and lookup data
        setupTestDatabase($this->connection);
    }

    /**
     * Clean up test data after each test.
     *
     * @return void
     */
    protected function tearDown(): void
    {
        $this->cleanupTestData();
        parent::tearDown();
    }

    /**
     * Remove all test data from the database.
     *
     * @return void
     */
    protected function cleanupTestData(): void
    {
        $this->connection->query('SET FOREIGN_KEY_CHECKS=0');

        $tables = [
            'Resource_has_Spatial_Temporal_Coverage',
            'Resource_has_Thesaurus_Keywords',
            'Resource_has_Related_Work',
            'Resource_has_Originating_Laboratory',
            'Resource_has_Funding_Reference',
            'Resource_has_Contact_Person',
            'Resource_has_Contributor_Person',
            'Resource_has_Contributor_Institution',
            'Resource_has_Author',
            'Resource_has_Free_Keywords',
            'Author_has_Affiliation',
            'Contact_Person_has_Affiliation',
            'Contributor_Person_has_Affiliation',
            'Contributor_Institution_has_Affiliation',
            'Originating_Laboratory_has_Affiliation',
            'Free_Keywords',
            'Affiliation',
            'Title',
            'Description',
            'Spatial_Temporal_Coverage',
            'Thesaurus_Keywords',
            'Related_Work',
            'Originating_Laboratory',
            'Funding_Reference',
            'Contact_Person',
            'Contributor_Person',
            'Contributor_Institution',
            'Author',
            'Author_person',
            'Author_institution',
            'Resource',
             // ICGEM-specific variables to describe beautiful GGMs 
            'GGM_Properties',
            'Resource_has_GGM_Properties',
            'Model_Type',
            'Mathematical_Representation',
            'File_Format',
        ];

        foreach ($tables as $table) {
            $this->connection->query("DELETE FROM `{$table}`");
        }

        $this->connection->query('SET FOREIGN_KEY_CHECKS=1');
    }

    /**
     * Helper to create a test resource with default properties.
     *
     * @param string $doiSuffix Unique suffix to append to the DOI.
     * @param string $title     Title of the test resource.
     * @return int Inserted resource ID.
     */
    protected function createResource(string $doiSuffix, string $title): int
    {
        require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
        
        $resourceData = [
            'doi' => "10.5880/{$doiSuffix}",
            'year' => 2023,
            'dateCreated' => '2023-06-01',
            'resourcetype' => 1,
            'language' => 1,
            'Rights' => 1,
            'title' => [$title],
            'titleType' => [1],
        ];

        return saveResourceInformationAndRights(
            $this->connection,
            $resourceData
        );
    }
}