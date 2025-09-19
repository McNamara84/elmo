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
     * Set up test database before each test.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Load global settings and test database setup
        require_once __DIR__ . '/../helper_functions.php';
        require_once __DIR__ . '/TestDatabaseSetup.php';

        $initial_connection = connectDb();

        
        // call the test database analogous to elmocache
        $dbname = 'elmotest';
        $testUser = 'elmo_tester';
        $testPass = 'test_password';
        if ($initial_connection->select_db($dbname) === false) {
            $initial_connection->query("CREATE DATABASE {$dbname}");
            elmo_log("DB test case setup", "creating test user '$testUser' for '$dbname' ...");
            $initial_connection->query("CREATE USER IF NOT EXISTS '$testUser'@'%' IDENTIFIED BY '$testPass'");
            $initial_connection->query("GRANT ALL PRIVILEGES ON {$dbname}.* TO '$testUser'@'%'");
            $initial_connection->query("FLUSH PRIVILEGES");
            elmo_log("DB test case setup", "test user '$testUser' created and given priveleges");

        }
        // Cave connection as test user specifically
        $initial_connection->close();
        $this->connection = new mysqli(
            'db',  // we need to specify db to run inside the container and localhost to run outside
            $testUser,
            $testPass,
            $dbname
        );

        // Check if connection is successful
        if ($this->connection->connect_error) {
            elmo_log("DB test case setup", "ERROR: Connection failed for test user '$testUser': " . $this->connection->connect_error);
            throw new \Exception("Database connection failed: " . $this->connection->connect_error);
        } else {
            elmo_log("DB test case setup", "Connection for test user '$testUser' created and saved");
        }

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
