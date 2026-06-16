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
     * @var \mysqli|null Shared database connection across all tests in a class.
     */
    protected static $sharedConnection = null;

    /**
     * @var \mysqli Database connection resource for instance use.
     */
    protected $connection;

    /**
     * Set up database connection once for all tests in the class.
     * This runs before any test methods.
     *
     * @return void
     */
    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();
        // Load .env file manually since we don't use vlucas/phpdotenv
        $envFile = __DIR__ . '/../.env';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
                    [$key, $value] = explode('=', $line, 2);
                    $key = trim($key);
                    $value = trim($value);
                    if (!getenv($key)) {
                        putenv("{$key}={$value}");
                    }
                }
            }
        }
        
        // Check if we're in GitHub Actions or GitLab CI
        $isCI = getenv('CI') !== false || getenv('GITHUB_ACTIONS') !== false;
        
        $dbname = 'mde2-msl-test';
        
        if ($isCI) {
            // GitHub Actions / GitLab CI: use test_user credentials
            $host = '127.0.0.1';
            $username = 'test_user';
            $password = 'test_password';
            
            // In CI, test_user already has all privileges, just create connection
            $conn = new \mysqli($host, $username, $password);
            
            if ($conn->connect_error) {
                throw new \RuntimeException("Failed to connect to database in CI: " . $conn->connect_error);
            }
            
            // Create test database if it doesn't exist
            $conn->query("CREATE DATABASE IF NOT EXISTS `{$dbname}`");
            $conn->select_db($dbname);
            
        } else {
            // Local Docker development: use root to create database, then switch to elmo user
            $host = getenv('DB_HOST') ?: 'db';
            $rootPassword = getenv('ROOT_PASSWORD') ?: 'root';
            $username = getenv('DB_USER') ?: 'elmo';
            $password = getenv('DB_PASSWORD') ?: 'elmo';
            
            // Connect as root to create database and grant privileges
            $rootConn = new \mysqli($host, 'root', $rootPassword);
            
            if ($rootConn->connect_error) {
                throw new \RuntimeException("Failed to connect as root: " . $rootConn->connect_error);
            }
            
            // Create test database if it doesn't exist
            $result = $rootConn->query("CREATE DATABASE IF NOT EXISTS `{$dbname}`");
            if (!$result) {
                throw new \RuntimeException("Failed to create database {$dbname}: " . $rootConn->error);
            }
            
            // Grant full privileges to elmo user on test database
            $rootConn->query("GRANT ALL PRIVILEGES ON `{$dbname}`.* TO '{$username}'@'%'");
            $rootConn->query("FLUSH PRIVILEGES");
            $rootConn->close();
            
            // Now connect as elmo user to the test database
            $conn = new \mysqli($host, $username, $password, $dbname);
            
            if ($conn->connect_error) {
                throw new \RuntimeException("Failed to connect as {$username} to {$dbname}: " . $conn->connect_error);
            }
        }
        
        // Store the shared connection
        self::$sharedConnection = $conn;
        
        // At this point, connection is established to mde2-msl-test database
        // Now populate with structure and lookup data
        
        // Define constant to prevent install.php from requiring settings.php
        if (!defined('INCLUDED_FROM_TEST')) {
            define('INCLUDED_FROM_TEST', true);
        }
    }

    /**
     * Set up test database before each test.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

         // Use the shared connection
        // Verify connection is alive and is NOT root
        if (self::$sharedConnection === null) {
            throw new \RuntimeException("Shared connection not initialized in setUpBeforeClass");
        }

        $this->connection = self::$sharedConnection;    
        // Drop existing tables to ensure clean state
        require_once __DIR__ . '/../install.php';
        dropTables($this->connection);
        
        // Create database structure
        $result = createDatabaseStructure($this->connection);
        if ($result['status'] === 'error') {
            throw new \RuntimeException("Failed to create database structure: " . $result['message']);
        }
        
        // Insert lookup data
        insertLookupData($this->connection);

        // IMPORTANT: Set global $connection for legacy code that uses global variables
        // Many save functions like save_resourceinformation_and_rights.php use global $connection
        $GLOBALS['connection'] = $this->connection;
    }
    
    /**
     * Clean up test data after each test.
     *
     * @return void
     */
    protected function tearDown(): void
    {
        // Clean up global connection reference
        unset($GLOBALS['connection']);
        parent::tearDown();
    }

    /**
     * Close the database connection after all tests in the class.
     *
     * @return void
     */
    public static function tearDownAfterClass(): void
    {
        // uncomment the next line when you are done with testing
        //$this->cleanupTestData();
        if (self::$sharedConnection !== null) {
            self::$sharedConnection->close();
            self::$sharedConnection = null;
        }
        parent::tearDownAfterClass();
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
            'Rate_Limit',
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
            'Topographic_Models_Properties',
            'Resource_has_Topographic_Model_Properties',
            'Temporal_Model_Properties',
            'Resource_has_Temporal_Model_Properties',
            'Static_Model_Properties',
            'Resource_has_Static_Model_Properties',
            'Ellipsoidal_Parameters',
            'Resource_has_Ellipsoidal_Parameters',
            'Data_Sources',
            'Resource_has_Data_Sources',
            'GGM_Definition',
            'Resource_has_GGM_Definition'
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