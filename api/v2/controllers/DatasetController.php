<?php
require_once __DIR__ . '/../../../helper_functions.php';

class DatasetController
{
    private $connection;

    public function __construct()
    {
        global $connection;
        $this->connection = $connection;
    }

    /**
     * Loads and parses the lastUpdated information from thesauri JSON files.
     * 
     * This method reads the lastUpdated timestamps from various JSON files containing
     * keyword definitions. It handles GCMD Platform, Instrument, and Science keywords,
     * as well as MSL vocabularies.
     *
     * @return array An associative array where keys are the JSON filename bases (without extension)
     *               and values are their corresponding lastUpdated timestamps.
     *               Format: [
     *                   'gcmdPlatformsKeywords' => 'YYYY-MM-DD',
     *                   'gcmdInstrumentsKeywords' => 'YYYY-MM-DD',
     *                   'gcmdScienceKeywords' => 'YYYY-MM-DD',
     *                   'msl-vocabularies' => 'YYYY-MM-DD'
     *               ]
     */
    private function loadThesauriData()
    {
        $baseDir = realpath(dirname(dirname(dirname(__DIR__))));
        $jsonDir = $baseDir . '/json/thesauri'; // Path to the 'thesauri' folder

        $keywordData = [];

        // Scan the directory for all .json files inside the thesauri folder
        $files = glob($jsonDir . '/*.json');  // Match all .json files in thesauri

        foreach ($files as $file) {
            $fileNameBase = basename($file, '.json'); // Extract the file name without extension
            $data = json_decode(file_get_contents($file), true);

            if ($data && isset($data['lastUpdated'])) {
                $keywordData[$fileNameBase] = $data['lastUpdated']; // Store lastUpdated for each file
            }
        }

        return $keywordData;
    }

    /**
     * Retrieves thesaurus keywords for a given resource.
     * 
     * This method fetches thesaurus keywords from the database based on the resource ID.
     *
     * @param mysqli $connection The database connection
     * @param int    $resource_id The ID of the resource
     * 
     * @return array An array of thesaurus keywords, each containing:
     *               - All original database fields from the Thesaurus_Keywords table
     *               
     * Example return structure:
     * [
     *     [
     *         'thesaurus_keywords_id' => 1,
     *         'keyword' => 'Example Keyword',
     *         'scheme' => 'NASA/GCMD Earth Platforms Keywords',
     *         'schemeURI' => 'https://example.com/scheme',
     *         'valueURI' => 'https://example.com/value',
     *         'language' => 'en'
     *     ],
     *     // ... more keywords
     * ]
     */
    function getThesaurusKeywords($connection, $resource_id)
    {
        $stmt = $connection->prepare("
        SELECT tk.*
        FROM Resource_has_Thesaurus_Keywords rhtk
        JOIN Thesaurus_Keywords tk ON rhtk.Thesaurus_Keywords_thesaurus_keywords_id = tk.thesaurus_keywords_id
        WHERE rhtk.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $keywords = $stmt->get_result();

        return $keywords->fetch_all(MYSQLI_ASSOC);
    }

    /**
     * Retrieves related data for a single record from a specified table.
     *
     * @param mysqli $connection The database connection.
     * @param string $table The name of the table.
     * @param string $idColumn The name of the ID column.
     * @param int $id The ID value to search for.
     * @return array|null An associative array of the related data, or null if not found.
     */
    function getRelatedData($connection, $table, $idColumn, $id)
    {
        $stmt = $connection->prepare("SELECT * FROM $table WHERE $idColumn = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_assoc();
    }

    /**
     * Retrieves multiple related data records from a specified table.
     *
     * @param mysqli $connection The database connection.
     * @param string $table The name of the table.
     * @param string $foreignKeyColumn The name of the foreign key column.
     * @param int $id The ID value to search for.
     * @return array An array of associative arrays containing the related data.
     */
    function getRelatedDataMultiple($connection, $table, $foreignKeyColumn, $id)
    {
        $stmt = $connection->prepare("SELECT * FROM $table WHERE $foreignKeyColumn = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    /**
     * Retrieves affiliations for a given author.
     *
     * @param mysqli $connection The database connection.
     * @param int $author_id The ID of the author.
     * @return array An array of affiliations for the author.
     */
    function getAuthorAffiliations($connection, $author_id)
    {
        $affiliations = [];
        $stmt = $connection->prepare("
        SELECT a.*
        FROM Affiliation a
        JOIN Author_has_Affiliation aha ON a.affiliation_id = aha.Affiliation_affiliation_id
        WHERE aha.Author_author_id = ?
    ");
        $stmt->bind_param('i', $author_id);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $affiliations[] = $row;
        }
        return $affiliations;
    }

    /**
     * Retrieves authors for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of authors with their details and affiliations.
     */
    function getAuthors($connection, $resource_id)
    {
        $authors = [];
        $stmt = $connection->prepare("
        SELECT 
            a.author_id,
            ap.familyname,
            ap.givenname,
            ap.orcid,
            ai.institutionname
        FROM Author a
        LEFT JOIN Author_person ap ON a.Author_Person_author_person_id = ap.author_person_id
        LEFT JOIN Author_institution ai ON a.Author_Institution_author_institution_id = ai.author_institution_id
        JOIN Resource_has_Author rha ON a.author_id = rha.Author_author_id
        WHERE rha.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            // Prüfen: Ist es ein Person-Author?
            if (!empty($row['familyname']) || !empty($row['givenname'])) {
                $authors[] = [
                    'type' => 'person',
                    'familyname' => $row['familyname'],
                    'givenname' => $row['givenname'],
                    'orcid' => $row['orcid'] ?? null,
                    'Affiliations' => $this->getAuthorAffiliations($connection, $row['author_id'])
                ];
            } elseif (!empty($row['institutionname'])) {
                $authors[] = [
                    'type' => 'institution',
                    'institutionname' => $row['institutionname'],
                    'Affiliations' => $this->getAuthorAffiliations($connection, $row['author_id'])
                ];
            }
        }

        return $authors;
    }

    /**
     * Retrieves titles for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of titles with their types.
     */
    function getTitles($connection, $resource_id)
    {
        $stmt = $connection->prepare("
        SELECT t.*, tt.name as title_type_name
        FROM Title t
        JOIN Title_Type tt ON t.Title_Type_fk = tt.title_type_id
        WHERE t.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    /**
     * Retrieves descriptions for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of descriptions.
     */
    function getDescriptions($connection, $resource_id)
    {
        $stmt = $connection->prepare("
        SELECT * FROM Description
        WHERE resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    /**
     * Retrieves affiliations for a given contributor person.
     *
     * @param mysqli $connection The database connection.
     * @param int $contributor_person_id The ID of the contributor person.
     * @return array An array of affiliations for the contributor person.
     */
    function getContributorPersonAffiliations($connection, $contributor_person_id)
    {
        $affiliations = [];
        $stmt = $connection->prepare("
        SELECT a.affiliation_id, a.name, a.rorId
        FROM Affiliation a
        JOIN Contributor_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
        WHERE cpha.Contributor_Person_contributor_person_id = ?
    ");
        $stmt->bind_param('i', $contributor_person_id);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $affiliations[] = [
                'affiliation_id' => $row['affiliation_id'] ?? null,
                'name' => $row['name'] ?? null,
                'rorId' => $row['rorId'] ?? null
            ];
        }
        return $affiliations;
    }

    /**
     * Retrieves roles for a given contributor person.
     *
     * @param mysqli $connection The database connection.
     * @param int $contributor_person_id The ID of the contributor person.
     * @return array An array of roles for the contributor person.
     */
    function getContributorPersonRoles($connection, $contributor_person_id)
    {
        $roles = [];
        $stmt = $connection->prepare("
        SELECT r.*
        FROM Role r
        JOIN Contributor_Person_has_Role cphr ON r.role_id = cphr.Role_role_id
        WHERE cphr.Contributor_Person_contributor_person_id = ?
    ");
        $stmt->bind_param('i', $contributor_person_id);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $roles[] = [
                'name' => $row['name'] ?? null
            ];
        }
        return $roles;
    }

    /**
     * Retrieves affiliations for a given contributor institution.
     *
     * @param mysqli $connection The database connection.
     * @param int $contributor_institution_id The ID of the contributor institution.
     * @return array An array of affiliations for the contributor institution.
     */
    function getContributorInstitutionAffiliations($connection, $contributor_institution_id)
    {
        $affiliations = [];
        $stmt = $connection->prepare("
        SELECT a.affiliation_id, a.name, a.rorId
        FROM Affiliation a
        JOIN Contributor_Institution_has_Affiliation ciha ON a.affiliation_id = ciha.Affiliation_affiliation_id
        WHERE ciha.Contributor_Institution_contributor_institution_id = ?
    ");
        $stmt->bind_param('i', $contributor_institution_id);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $affiliations[] = [
                'affiliation_id' => $row['affiliation_id'] ?? null,
                'name' => $row['name'] ?? null,
                'rorId' => $row['rorId'] ?? null
            ];
        }
        return $affiliations;
    }

    /**
     * Retrieves roles for a given contributor institution.
     *
     * @param mysqli $connection The database connection.
     * @param int $contributor_institution_id The ID of the contributor institution.
     * @return array An array of roles for the contributor institution.
     */
    function getContributorInstitutionRoles($connection, $contributor_institution_id)
    {
        $roles = [];
        $stmt = $connection->prepare("
        SELECT r.*
        FROM Role r
        JOIN Contributor_Institution_has_Role cihr ON r.role_id = cihr.Role_role_id
        WHERE cihr.Contributor_Institution_contributor_institution_id = ?
    ");
        $stmt->bind_param('i', $contributor_institution_id);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $roles[] = [
                'name' => $row['name'] ?? null
            ];
        }
        return $roles;
    }

    /**
     * Retrieves contributors (persons and institutions) for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array containing two sub-arrays: 'persons' and 'institutions'.
     */
    function getContributors($connection, $resource_id)
    {
        $contributors = ['persons' => [], 'institutions' => []];
        $stmt = $connection->prepare("
        SELECT cp.*, rhcp.Resource_has_Contributor_Person_id
        FROM Contributor_Person cp
        JOIN Resource_has_Contributor_Person rhcp ON cp.contributor_person_id = rhcp.Contributor_Person_contributor_person_id
        WHERE rhcp.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $person = [
                'familyname' => $row['familyname'] ?? null,
                'givenname' => $row['givenname'] ?? null,
                'orcid' => $row['orcid'] ?? null,
                'Affiliations' => $this->getContributorPersonAffiliations($connection, $row['contributor_person_id']),
                'Roles' => $this->getContributorPersonRoles($connection, $row['contributor_person_id'])
            ];
            $contributors['persons'][] = $person;
        }
        $stmt = $connection->prepare("
        SELECT ci.*, rhci.Resource_has_Contributor_Institution_id
        FROM Contributor_Institution ci
        JOIN Resource_has_Contributor_Institution rhci ON ci.contributor_institution_id = rhci.Contributor_Institution_contributor_institution_id
        WHERE rhci.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $institution = [
                'name' => $row['name'] ?? null,
                'Affiliations' => $this->getContributorInstitutionAffiliations($connection, $row['contributor_institution_id']),
                'Roles' => $this->getContributorInstitutionRoles($connection, $row['contributor_institution_id'])
            ];
            $contributors['institutions'][] = $institution;
        }
        return $contributors;
    }

    /**
     * Retrieves contact persons for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of contact persons with their details and affiliations.
     */
    function getContactPersons($connection, $resource_id)
    {
        $contactPersons = [];
        $stmt = $connection->prepare("
        SELECT cp.*, rhcp.Resource_has_Contact_Person_id
        FROM Contact_Person cp
        JOIN Resource_has_Contact_Person rhcp ON cp.contact_person_id = rhcp.Contact_Person_contact_person_id
        WHERE rhcp.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $contactPerson = [
                'familyname' => $row['familyname'] ?? null,
                'givenname' => $row['givenname'] ?? null,
                'orcid' => $row['orcid'] ?? null,
                'email' => $row['email'] ?? null,
                'website' => $row['website'] ?? null,
                'Affiliations' => $this->getContactPersonAffiliations($connection, $row['contact_person_id']) ?? null
            ];
            $contactPersons[] = $contactPerson;
        }
        return $contactPersons;
    }

    /**
     * Retrieves affiliations for a given contact person.
     *
     * @param mysqli $connection The database connection.
     * @param int $contact_person_id The ID of the contact person.
     * @return array An array of affiliations for the contact person.
     */
    function getContactPersonAffiliations($connection, $contact_person_id)
    {
        $affiliations = [];
        $stmt = $connection->prepare("
        SELECT a.affiliation_id, a.name, a.rorId
        FROM Affiliation a
        JOIN Contact_Person_has_Affiliation cpha ON a.affiliation_id = cpha.Affiliation_affiliation_id
        WHERE cpha.Contact_Person_contact_person_id = ?
    ");
        $stmt->bind_param('i', $contact_person_id);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $affiliations[] = [
                'affiliation_id' => $row['affiliation_id'] ?? null,
                'name' => $row['name'] ?? null,
                'rorId' => $row['rorId'] ?? null
            ];
        }
        return $affiliations;
    }

    /**
     * Retrieves funding references for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of funding references.
     */
    function getFundingReferences($connection, $resource_id)
    {
        $funding_references = $this->getRelatedDataMultiple($connection, 'Resource_has_Funding_Reference', 'Resource_resource_id', $resource_id);
        foreach ($funding_references as &$reference) {
            $reference_data = $this->getRelatedData($connection, 'Funding_Reference', 'funding_reference_id', $reference['Funding_Reference_funding_reference_id']);
            if ($reference_data) {
                $reference = array_merge($reference, $reference_data);
            }
        }
        return $funding_references;
    }

    /**
     * Retrieves related works for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of related works with their identifiers, relations, and identifier types.
     */
    function getRelatedWorks($connection, $resource_id)
    {
        $stmt = $connection->prepare("
        SELECT rw.*, r.name as relation_name, it.name as identifier_type_name
        FROM Resource_has_Related_Work rhrw
        JOIN Related_Work rw ON rhrw.Related_Work_related_work_id = rw.related_work_id
        LEFT JOIN Relation r ON rw.relation_fk = r.relation_id
        LEFT JOIN Identifier_Type it ON rw.identifier_type_fk = it.identifier_type_id
        WHERE rhrw.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $relatedWorks = [];
        while ($row = $result->fetch_assoc()) {
            $relatedWorks[] = [
                'Identifier' => $row['Identifier'],
                'Relation' => ['name' => $row['relation_name']],
                'IdentifierType' => ['name' => $row['identifier_type_name']]
            ];
        }
        return $relatedWorks;
    }

    /**
     * Retrieves spatial temporal coverage for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of spatial temporal coverage data.
     */
    function getSpatialTemporalCoverage($connection, $resource_id)
    {
        $stmt = $connection->prepare("
        SELECT stc.*
        FROM Resource_has_Spatial_Temporal_Coverage rhstc
        JOIN Spatial_Temporal_Coverage stc ON rhstc.Spatial_Temporal_Coverage_spatial_temporal_coverage_id = stc.spatial_temporal_coverage_id
        WHERE rhstc.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    /**
     * Retrieves free keywords for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of free keywords.
     */
    function getFreeKeywords($connection, $resource_id)
    {
        $stmt = $connection->prepare("
        SELECT fk.free_keywords_id, fk.free_keyword, fk.isCurated
        FROM Free_Keywords fk
        JOIN Resource_has_Free_Keywords rhfk ON fk.free_keywords_id = rhfk.Free_Keywords_free_keywords_id
        WHERE rhfk.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    /**
     * Retrieves originating laboratories for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array An array of originating laboratories with their details and affiliations.
     */
    function getOriginatingLaboratories($connection, $resource_id)
    {
        $laboratories = [];
        $stmt = $connection->prepare("
        SELECT ol.*
        FROM Originating_Laboratory ol
        JOIN Resource_has_Originating_Laboratory rhol ON ol.Originating_Laboratory_id = rhol.Originating_Laboratory_originating_laboratory_id
        WHERE rhol.Resource_resource_id = ?
    ");
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $laboratory = [
                'laboratoryname' => $row['laboratoryname'],
                'labId' => $row['labId'],
                'Affiliations' => $this->getOriginatingLaboratoryAffiliations($connection, $row['originating_laboratory_id'])
            ];
            $laboratories[] = $laboratory;
        }
        return $laboratories;
    }

    /**
     * Retrieves affiliations for a given originating laboratory.
     *
     * @param mysqli $connection The database connection.
     * @param int $originating_laboratory_id The ID of the originating laboratory.
     * @return array An array of affiliations for the originating laboratory.
     */
    function getOriginatingLaboratoryAffiliations($connection, $originating_laboratory_id)
    {
        $affiliations = [];
        $stmt = $connection->prepare("
        SELECT a.*
        FROM Affiliation a
        JOIN Originating_Laboratory_has_Affiliation olha ON a.affiliation_id = olha.Affiliation_affiliation_id
        WHERE olha.Originating_Laboratory_originating_laboratory_id = ?
    ");
        $stmt->bind_param('i', $originating_laboratory_id);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $affiliations[] = $row;
        }
        return $affiliations;
    }
    /**
     * Retrieves GGM essential variables for a given resource id
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource in question.
     * @return array An array of affiliations for the originating laboratory.
     */
        private function getGGMData(mysqli $connection, int $resource_id): ?array
    {
        $ggmData = [];

        // Get Model_Type, Mathematical_Representation, File_Format names by joining with Resource
        $stmtResourceFKs = $connection->prepare("
            SELECT 
                mt.name as model_type_name, 
                mr.name as mathematical_representation_name, 
                ff.name as file_format_name
            FROM Resource r
            LEFT JOIN Model_Type mt ON r.Model_type_id = mt.Model_type_id
            LEFT JOIN Mathematical_Representation mr ON r.Mathematical_Representation_id = mr.Mathematical_representation_id
            LEFT JOIN File_Format ff ON r.File_format_id = ff.File_format_id
            WHERE r.resource_id = ?
        ");
        if (!$stmtResourceFKs) {
            $this->logger && $this->logger->error("Prepare failed for Resource FKs in getGGMData: " . $connection->error);
            // Depending on strictness, you might throw an exception or return null
            return null;
        }
        $stmtResourceFKs->bind_param('i', $resource_id);
        $stmtResourceFKs->execute();
        $resourceFksResult = $stmtResourceFKs->get_result()->fetch_assoc();
        $stmtResourceFKs->close();

        if ($resourceFksResult) {
            foreach ($resourceFksResult as $key => $value) {
                if ($value !== null) { // Only add if value is not null
                    $ggmData[$key] = $value;
                }
            }
        }

        // Get Model_Name, Celestial_Body, Product_Type from GGM_Properties table
        $stmtGGMProps = $connection->prepare("
            SELECT 
                ggm.Model_Name as model_name, 
                ggm.Product_Type as product_type 
            FROM GGM_Properties ggm
            JOIN Resource_has_GGM_Properties rhg ON ggm.GGM_Properties_id = rhg.GGM_Properties_GGM_Properties_id
            WHERE rhg.Resource_resource_id = ?
        ");
        if (!$stmtGGMProps) {
            $this->logger && $this->logger->error("Prepare failed for GGM_Properties in getGGMData: " . $connection->error);
            // If essential GGM props fail, but we have FKs, decide on return.
            // For now, return what we have or null if nothing.
            return !empty($ggmData) ? $ggmData : null;
        }
        $stmtGGMProps->bind_param('i', $resource_id);
        $stmtGGMProps->execute();
        $ggmSpecificResult = $stmtGGMProps->get_result()->fetch_assoc();
        $stmtGGMProps->close();

        if ($ggmSpecificResult) {
            foreach ($ggmSpecificResult as $key => $value) {
                if ($value !== null) { // Only add if value is not null
                    $ggmData[$key] = $value;
                }
            }
        }
        
        return !empty($ggmData) ? $ggmData : null;
    }
        /**
     * Generates a uniform path for the base XML file of a resource.
     *
     * @param int $id The identifier of the resource.
     * @return string The absolute path to the XML file.
     * @throws Exception If the XML directory cannot be created.
     */
    private function generate_xml_path($id, $prefix = null)
    {
        $baseDir = realpath(dirname(dirname(dirname(__DIR__))));
        $outputDir = $baseDir . '/xml';

        // Generate folder if it doesn't exist
        if (!file_exists($outputDir)) {
            if (!mkdir($outputDir, 0777, true)) {
                throw new Exception("Could not create XML directory.");
            }
            chmod($outputDir, 0777);
        }
        // Especially for saving xml transformed in different schemas
        $filename = "resource_$id.xml";
        if ($prefix) {
            $filename = $outputDir . "/" . $prefix . "_" . $filename;
        }

        return $outputDir . "/" . $filename;
    }

    /**
     * Generates an XML representation of a resource and saves it to a xml file without any scheme.
     *
     * @param mysqli $connection The database connection.
     * @param int $id The ID of the resource.
     * @return string The XML representation of the resource as a string.
     * @throws Exception If the resource is not found.
     */
    function getResourceAsXml($connection, $id, $includeGGMData = true)
    {
        $stmt = $connection->prepare('SELECT * FROM Resource WHERE resource_id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $resource = $result->fetch_assoc();

        if (!$resource) {
            throw new Exception("Resource nicht gefunden!");
        }

        $xml = new SimpleXMLElement('<Resource/>');
        $xml->addChild('currentDate', date('Y-m-d'));

        // Resource Information
        if ($resource['doi']) {
            $xml->addChild('doi', htmlspecialchars($resource['doi']));
        }
        if ($resource['version']) {
            $xml->addChild('version', htmlspecialchars($resource['version']));
        }
        $xml->addChild('year', htmlspecialchars($resource['year']));
        $xml->addChild('dateCreated', htmlspecialchars($resource['dateCreated']));
        if ($resource['dateEmbargoUntil']) {
            $xml->addChild('dateEmbargoUntil', htmlspecialchars($resource['dateEmbargoUntil']));
        }

        // Rights
        $rights = $this->getRelatedData($connection, 'Rights', 'rights_id', $resource['Rights_rights_id']);
        if ($rights) {
            $rightsXml = $xml->addChild('Rights');
            foreach ($rights as $key => $value) {
                $rightsXml->addChild($key, htmlspecialchars($value ?? ''));
            }
        }

        // Resource Type
        $resourceType = $this->getRelatedData($connection, 'Resource_Type', 'resource_name_id', $resource['Resource_Type_resource_name_id']);
        $resourceTypeXml = $xml->addChild('ResourceType');
        foreach ($resourceType as $key => $value) {
            $resourceTypeXml->addChild($key, htmlspecialchars($value ?? ''));
        }

        // Language
        $language = $this->getRelatedData($connection, 'Language', 'language_id', $resource['Language_language_id']);
        $languageXml = $xml->addChild('Language');
        foreach ($language as $key => $value) {
            $languageXml->addChild($key, htmlspecialchars($value ?? ''));
        }

        // Titles
        $titles = $this->getTitles($connection, $id);
        $titlesXml = $xml->addChild('Titles');
        foreach ($titles as $title) {
            $titleXml = $titlesXml->addChild('Title');
            $titleXml->addChild('text', htmlspecialchars($title['text'] ?? ''));
            $titleXml->addChild('type', htmlspecialchars($title['title_type_name'] ?? ''));
        }

        // Authors
        $authors = $this->getAuthors($connection, $id);
        $authorsXml = $xml->addChild('Authors');

        foreach ($authors as $author) {
            if (!empty($author['familyname']) || !empty($author['givenname'])) {
                // Person
                $authorXml = $authorsXml->addChild('AuthorPerson');
                $authorXml->addChild('familyname', htmlspecialchars($author['familyname'] ?? ''));
                $authorXml->addChild('givenname', htmlspecialchars($author['givenname'] ?? ''));
                if (!empty($author['orcid'])) {
                    $authorXml->addChild('orcid', htmlspecialchars($author['orcid']));
                }
            } elseif (!empty($author['institutionname'])) {
                // Institution
                $authorXml = $authorsXml->addChild('AuthorInstitution');
                $authorXml->addChild('institutionname', htmlspecialchars($author['institutionname']));
            }

            if (!empty($author['Affiliations'])) {
                $affiliationsXml = $authorXml->addChild('Affiliations');
                foreach ($author['Affiliations'] as $affiliation) {
                    $affiliationXml = $affiliationsXml->addChild('Affiliation');
                    foreach ($affiliation as $key => $value) {
                        // Skip adding <rorId> if it's empty or not set
                        if ($key === 'rorId' && (empty($value) || $value === null)) {
                            continue;
                        }
                        $affiliationXml->addChild($key, htmlspecialchars($value ?? ''));
                    }
                }
            }
        }

        // Contact Persons
        // Get contact persons
        $contactPersons = $this->getContactPersons($connection, $id);

        // Check if there is any valid contact person data
        $validContactPersons = false;
        foreach ($contactPersons as $contactPerson) {
            if (
                !empty($contactPerson['familyname']) ||
                !empty($contactPerson['givenname']) ||
                !empty($contactPerson['orcid']) ||
                !empty($contactPerson['email']) ||
                !empty($contactPerson['website']) ||
                !empty($contactPerson['Affiliations'])
            ) {
                $validContactPersons = true;
                break;  // Exit the loop once we find a valid contact person
            }
        }

        if ($validContactPersons) {
            $contactPersonsXml = $xml->addChild('ContactPersons');

            // Iterate over contact persons and add them to XML
            foreach ($contactPersons as $contactPerson) {
                if (
                    !empty($contactPerson['familyname']) ||
                    !empty($contactPerson['givenname']) ||
                    !empty($contactPerson['orcid']) ||
                    !empty($contactPerson['email']) ||
                    !empty($contactPerson['website']) ||
                    !empty($contactPerson['Affiliations'])
                ) {
                    // Add ContactPerson element if there's data
                    $contactPersonXml = $contactPersonsXml->addChild('ContactPerson');

                    if ($contactPerson['familyname']) {
                        $contactPersonXml->addChild('familyname', htmlspecialchars($contactPerson['familyname']));
                    }
                    if ($contactPerson['givenname']) {
                        $contactPersonXml->addChild('givenname', htmlspecialchars($contactPerson['givenname']));
                    }
                    if ($contactPerson['orcid']) {
                        $contactPersonXml->addChild('orcid', htmlspecialchars($contactPerson['orcid']));
                    }
                    if ($contactPerson['email']) {
                        $contactPersonXml->addChild('email', htmlspecialchars($contactPerson['email']));
                    }
                    if ($contactPerson['website']) {
                        $contactPersonXml->addChild('website', htmlspecialchars($contactPerson['website']));
                    }

                    if ($contactPerson['Affiliations']) {
                        $affiliationsXml = $contactPersonXml->addChild('Affiliations');
                        foreach ($contactPerson['Affiliations'] as $affiliation) {
                            $affiliationXml = $affiliationsXml->addChild('Affiliation');
                            foreach ($affiliation as $key => $value) {
                                // Skip adding <rorId> if it's empty or not set
                                if ($key === 'rorId' && (empty($value) || $value === null)) {
                                    continue;
                                }
                                $affiliationXml->addChild($key, htmlspecialchars($value ?? ''));
                            }
                        }
                    }
                }
            }
        }
        // Originating Laboratory
        $originatingLaboratories = $this->getOriginatingLaboratories($connection, $id);
        if ($originatingLaboratories) {
            $originatingLaboratoriesXml = $xml->addChild('OriginatingLaboratories');
            foreach ($originatingLaboratories as $laboratory) {
                $laboratoryXml = $originatingLaboratoriesXml->addChild('OriginatingLaboratory');
                $laboratoryXml->addChild('laboratoryname', htmlspecialchars($laboratory['laboratoryname']));
                $laboratoryXml->addChild('labId', htmlspecialchars($laboratory['labId'] ?? ''));
                if (isset($laboratory['Affiliations'])) {
                    $affiliationsXml = $laboratoryXml->addChild('Affiliations');
                    foreach ($laboratory['Affiliations'] as $affiliation) {
                        $affiliationXml = $affiliationsXml->addChild('Affiliation');
                        foreach ($affiliation as $key => $value) {
                            // Skip adding <rorId> if it's empty or not set
                            if ($key === 'rorId' && (empty($value) || $value === null)) {
                                continue;
                            }
                            $affiliationXml->addChild($key, htmlspecialchars($value ?? ''));
                        }
                    }
                }
            }
        }
        // Contributors
        $contributors = $this->getContributors($connection, $id);
        if (!empty($contributors['persons']) || !empty($contributors['institutions'])) {
            $contributorsXml = $xml->addChild('Contributors');
        }
        // Contributor Persons
        if (!empty($contributors['persons'])) {
            $personsXml = $contributorsXml->addChild('Persons');
            foreach ($contributors['persons'] as $person) {

                $personXml = $personsXml->addChild('Person');
                if (!empty($person['familyname'])) {
                    $personXml->addChild('familyname', htmlspecialchars($person['familyname']));
                }
                if (!empty($person['givenname'])) {
                    $personXml->addChild('givenname', htmlspecialchars($person['givenname']));
                }

                if (!empty($person['orcid']) && $person['orcid'] !== '') {
                    $personXml->addChild('orcid', htmlspecialchars($person['orcid']));
                }
                if (isset($person['Affiliations'])) {
                    $affiliationsXml = $personXml->addChild('Affiliations');
                    foreach ($person['Affiliations'] as $affiliation) {
                        $affiliationXml = $affiliationsXml->addChild('Affiliation');
                        foreach ($affiliation as $key => $value) {
                            // Skip adding <rorId> if it's empty or not set
                            if ($key === 'rorId' && (empty($value) || $value === null)) {
                                continue;
                            }
                            $affiliationXml->addChild($key, htmlspecialchars($value ?? ''));
                        }
                    }
                }
                if (isset($person['Roles'])) {
                    $rolesXml = $personXml->addChild('Roles');
                    foreach ($person['Roles'] as $role) {
                        $roleXml = $rolesXml->addChild('Role');
                        $roleXml->addChild('name', htmlspecialchars($role['name'] ?? ''));
                    }
                }
            }
        }

        // Contributor Institutions
        if (!empty($contributors['institutions'])) {
            $institutionsXml = $contributorsXml->addChild('Institutions');
            foreach ($contributors['institutions'] as $institution) {
                $institutionXml = $institutionsXml->addChild('Institution');
                $institutionXml->addChild('name', htmlspecialchars($institution['name'] ?? ''));
                if (isset($institution['Affiliations'])) {
                    $affiliationsXml = $institutionXml->addChild('Affiliations');
                    foreach ($institution['Affiliations'] as $affiliation) {
                        $affiliationXml = $affiliationsXml->addChild('Affiliation');
                        foreach ($affiliation as $key => $value) {
                            // Skip adding <rorId> if it's empty or not set
                            if ($key === 'rorId' && (empty($value) || $value === null)) {
                                continue;
                            }
                            $affiliationXml->addChild($key, htmlspecialchars($value ?? ''));
                        }
                    }
                }
                if (isset($institution['Roles'])) {
                    $rolesXml = $institutionXml->addChild('Roles');
                    foreach ($institution['Roles'] as $role) {
                        $roleXml = $rolesXml->addChild('Role');
                        $roleXml->addChild('name', htmlspecialchars($role['name'] ?? ''));
                    }
                }
            }
        }

        // Descriptions
        $descriptions = $this->getDescriptions($connection, $id);
        $descriptionsXml = $xml->addChild('Descriptions');
        foreach ($descriptions as $description) {
            $descriptionXml = $descriptionsXml->addChild('Description');
            $descriptionXml->addChild('type', htmlspecialchars($description['type']));
            $descriptionXml->addChild('description', htmlspecialchars($description['description']));
        }

        // Thesaurus Keywords
        $thesaurusKeywords = $this->getThesaurusKeywords($connection, $id);
        if ($thesaurusKeywords) {
            $keywordsXml = $xml->addChild('ThesaurusKeywords');

            // Add individual keywords
            foreach ($thesaurusKeywords as $keyword) {
                $keywordXml = $keywordsXml->addChild('Keyword');
                foreach ($keyword as $key => $value) {
                    if ($value !== null) {
                        $keywordXml->addChild($key, htmlspecialchars($value));
                    }
                }
            }

            // Load lastUpdated data from JSON files
            $keywordData = $this->loadThesauriData();

            // Map JSON file keys to XSD element names
            $lastUpdatedMapping = [
                'gcmdPlatformsKeywords' => 'lastUpdatedGcmdPlatformsKeywords',
                'gcmdInstrumentsKeywords' => 'lastUpdatedGcmdInstrumentsKeywords',
                'gcmdScienceKeywords' => 'lastUpdatedGcmdScienceKeywords',
                'msl-vocabularies' => 'lastUpdatedMslVocabularies'
            ];

            // Add lastUpdated elements if data is available
            foreach ($lastUpdatedMapping as $jsonKey => $xmlElement) {
                if (!empty($keywordData[$jsonKey])) {
                    $keywordsXml->addChild($xmlElement, date('Y-m-d', strtotime($keywordData[$jsonKey])));
                }
            }
        }


        // Free Keywords
        $freeKeywords = $this->getFreeKeywords($connection, $id);
        if ($freeKeywords) {
            $freeKeywordsXml = $xml->addChild('FreeKeywords');
            foreach ($freeKeywords as $keyword) {
                $keywordXml = $freeKeywordsXml->addChild('Keyword');
                $keywordXml->addChild('free_keywords_id', htmlspecialchars($keyword['free_keywords_id']));
                $keywordXml->addChild('free_keyword', htmlspecialchars($keyword['free_keyword']));
                $keywordXml->addChild('isCurated', htmlspecialchars($keyword['isCurated']));
            }
        }

        // Spatial Temporal Coverages
        $spatialTemporalCoverages = $this->getSpatialTemporalCoverage($connection, $id);
        $coveragesXml = $xml->addChild('SpatialTemporalCoverages');
        foreach ($spatialTemporalCoverages as $coverage) {
            $coverageXml = $coveragesXml->addChild('SpatialTemporalCoverage');
            foreach ($coverage as $key => $value) {
                // Check if max value and not empty
                if (in_array($key, ['latitudeMax', 'longitudeMax'])) {
                    if (!empty($value)) {
                        $coverageXml->addChild($key, htmlspecialchars($value));
                    }
                } else if (in_array($key, ['dateStart', 'dateEnd', 'timeStart', 'timeEnd'])) {
                    if (!empty($value)) {
                        $coverageXml->addChild($key, htmlspecialchars($value));
                    }
                } else {
                    if ($value !== null) {
                        $coverageXml->addChild($key, htmlspecialchars($value));
                    }
                }
            }
        }

        // Related Works
        $relatedWorks = $this->getRelatedWorks($connection, $id);
        if ($relatedWorks) {
            $relatedWorksXml = $xml->addChild('RelatedWorks');
            foreach ($relatedWorks as $work) {
                $workXml = $relatedWorksXml->addChild('RelatedWork');
                $workXml->addChild('Identifier', htmlspecialchars($work['Identifier']));
                $relationXml = $workXml->addChild('Relation');
                $relationXml->addChild('name', htmlspecialchars($work['Relation']['name']));
                $identifierTypeXml = $workXml->addChild('IdentifierType');
                $identifierTypeXml->addChild('name', htmlspecialchars($work['IdentifierType']['name']));
            }
        }

        // Funding References
        $fundingReferences = $this->getFundingReferences($connection, $id);
        if ($fundingReferences) {
            $fundingReferencesXml = $xml->addChild('FundingReferences');
            foreach ($fundingReferences as $reference) {
                $referenceXml = $fundingReferencesXml->addChild('FundingReference');
                foreach ($reference as $key => $value) {
                    if ($key === 'funderid' && (empty($value) || $value === null)) {
                        continue;
                    }
                    if ($key === 'funderidtyp' && (empty($value) || $value === null)) {
                        continue;
                    }
                    if ($key === 'grantnumber' && (empty($value) || $value === null)) {
                        continue;
                    }
                    if ($key === 'grantname' && (empty($value) || $value === null)) {
                        continue;
                    }
                    if ($key === 'awarduri' && (empty($value) || $value === null)) {
                        continue;
                    }
                    $referenceXml->addChild($key, htmlspecialchars($value ?? ''));
                }
            }
        }
        // Add GGM Properties to the base XML
        if ($includeGGMData) {
            $ggmDataForXml = $this->getGGMData($connection, $id);
            if ($ggmDataForXml) {
                $ggmPropertiesXml = $xml->addChild('ggm_properties');
                if (!empty($ggmDataForXml['model_name'])) {
                    $ggmPropertiesXml->addChild('model_name', htmlspecialchars($ggmDataForXml['model_name']));
                }
                if (!empty($ggmDataForXml['model_type_name'])) {
                    $ggmPropertiesXml->addChild('model_type', htmlspecialchars($ggmDataForXml['model_type_name']));
                }
                if (!empty($ggmDataForXml['mathematical_representation_name'])) {
                    $ggmPropertiesXml->addChild('mathematical_representation', htmlspecialchars($ggmDataForXml['mathematical_representation_name']));
                }
                if (!empty($ggmDataForXml['file_format_name'])) {
                    $ggmPropertiesXml->addChild('file_format', htmlspecialchars($ggmDataForXml['file_format_name']));
                }
                if (!empty($ggmDataForXml['product_type'])) {
                    $ggmPropertiesXml->addChild('product_type', htmlspecialchars($ggmDataForXml['product_type']));
                }
                // Add any other GGM fields as needed
            }
        }
        // XML formating
        $dom = dom_import_simplexml($xml)->ownerDocument;
        $dom->formatOutput = true;


        $outputFile = $this->generate_xml_path($id);
        // It saves the in-memory XML to a file on the disk.
        if (!@$dom->save($outputFile)) {
            throw new Exception("Konnte XML-Datei nicht speichern: " . error_get_last()['message']);
        }

        // DB-Verbindung schließen
        $stmt->close();
        // Return the XML as a string (additionally to saving it)
        return $xml->asXML();
    }

    /**
     * Transforms an XML resource using an XSLT stylesheet and either saves or downloads the result.
     *
     * @param int    $id       The identifier of the resource.
     * @param string $format   The format to which the XML should be transformed ('dif', 'iso', 'datacite').
     * @param bool   $download Optional. If true, the transformed XML will be downloaded; if false, it will be returned as a string. Default is false.
     *
     * @throws Exception If the format is invalid, required files are missing, or the XSLT transformation fails.
     *
     * @return string|null The transformed XML as a string if $download is false; null if the XML is downloaded.
     */
    function transformAndSaveOrDownloadXml($id, $format, $download = false)
    {
        $baseDir = realpath(dirname(dirname(dirname(__DIR__))));

        $formatInfo = [
            'dif' => [
                'xsltFile' => 'MappingMapToDIF.xslt',
                'outputPrefix' => 'dif'
            ],
            'iso' => [
                'xsltFile' => 'MappingMapToIso.xslt',
                'outputPrefix' => 'iso'
            ],
            'datacite' => [
                'xsltFile' => 'MappingMapToDataCiteSchema45.xslt',
                'outputPrefix' => 'datacite'
            ]
        ];

        if (!isset($formatInfo[$format])) {
            throw new Exception("Invalid format.");
        }
        
        // Temporarily create FreestyleXML
        $this->getResourceAsXml($GLOBALS['connection'], $id, false);
        $inputXmlPath = $this->generate_xml_path($id);
        $xsltPath = $baseDir . "/schemas/XSLT/" . $formatInfo[$format]['xsltFile'];
        $outputXmlPath = $this->generate_xml_path($id, $formatInfo[$format]['outputPrefix']);
        //REPLACES $baseDir . "/xml/" . $formatInfo[$format]['outputPrefix'] . "_resource_$id.xml";

        // Check if the input XML and XSLT files exist
        if (!file_exists($inputXmlPath) || !file_exists($xsltPath)) {
            throw new Exception("Required files are missing. xmlpath is {$inputXmlPath}, xsltpath is {$xsltPath}");
        }

        // Load XML document and XSLT stylesheet
        $xml = new DOMDocument;
        $xml->load($inputXmlPath);
        $xsl = new DOMDocument;
        $xsl->load($xsltPath);

        // Create XSLT processor, configure it, and perform the transformation
        $proc = new XSLTProcessor;
        $proc->importStyleSheet($xsl);
        $newXml = $proc->transformToXML($xml);

        if ($newXml === false) {
            throw new Exception("Error during XSLT transformation.");
        }

        if ($download) {
            // Set headers for download and output the file
            header('Content-Type: application/xml');
            header('Content-Disposition: attachment; filename="' . basename($outputXmlPath) . '"');
            header('Content-Length: ' . strlen($newXml));
            echo $newXml;
            exit();
        } else {
            // Return the XML string
            return $newXml;
        }
    }

    /**
     * Exports a resource in the specified metadata scheme and initiates a file download.
     *
     * @param array $vars An associative array containing 'id' and 'scheme'.
     * @return void
     */
    public function exportResourceDownload($vars)
    {
        return $this->handleExport($vars, true);
    }

    /**
     * Exports a resource in the specified metadata scheme and outputs it directly.
     *
     * @param array $vars An associative array containing 'id' and 'scheme'.
     * @return void
     */
    public function exportResource($vars)
    {
        return $this->handleExport($vars, false);
    }

    /**
     * Handles the export of a resource, either by downloading it or outputting it directly.
     *
     * @param array $vars     An associative array containing 'id' and 'scheme'.
     * @param bool  $download If true, the resource will be downloaded; if false, it will be output directly.
     * @return void
     */
    private function handleExport($vars, $download)
    {
        $id = intval($vars['id']);
        $scheme = strtolower($vars['scheme']);

        // Check for valid schema formats
        $validSchemes = ['datacite', 'iso', 'dif'];
        if (!in_array($scheme, $validSchemes)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid metadata scheme. Supported schemes are: ' . implode(', ', $validSchemes)]);
            return;
        }

        try {
            $result = $this->transformAndSaveOrDownloadXml($id, $scheme, $download);

            if ($download) {
                // Ensure no output has been sent before headers
                if (ob_get_level())
                    ob_end_clean();

                $filename = "dataset_{$id}_{$scheme}.xml";

                // Binary Transfer
                header('Content-Type: application/octet-stream');
                header('Content-Disposition: attachment; filename="' . $filename . '"');
                header('Content-Length: ' . strlen($result));
                header('Content-Transfer-Encoding: binary');
                header('Connection: close');

                echo $result;
                flush();
                exit();
            } else {
                header('Content-Type: application/xml; charset=utf-8');
                echo $result;
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit();
    }

    /**
     * Exports all metadata schemes for a resource and initiates a file download.
     *
     * @param array $vars An associative array containing 'id'.
     * @return void
     */
    public function exportAllDownload($vars)
    {
        return $this->handleExportAll($vars, true, false);
    }

    /**
     * Exports all metadata schemes for a resource and outputs them directly.
     *
     * @param array $vars An associative array containing 'id'.
     * @return void
     */
    public function exportAll($vars)
    {
        return $this->handleExportAll($vars, false, false);
    }

    /**
     * Handles the export of all metadata schemes for a resource, either by downloading or outputting directly.
     *
     * @param array $vars     An associative array containing 'id'.
     * @param bool  $download If true, the combined XML will be downloaded; if false, it will be output directly.
     * @param bool  $returnAsString If true, the combined XML string is returned instead of being output.
     * @return string|void
     */
    private function handleExportAll($vars, $download, $returnAsString = false)
    {
        $id = intval($vars['id']);

        try {
            // Retrieve all three XML formats
            $dataciteXml = $this->transformAndSaveOrDownloadXml($id, 'datacite', false);
            $isoXml = $this->transformAndSaveOrDownloadXml($id, 'iso', false);
            $difXml = $this->transformAndSaveOrDownloadXml($id, 'dif', false);

            // Remove XML declarations from individual XMLs
            $dataciteXml = preg_replace('/<\?xml[^>]+\?>/', '', $dataciteXml);
            $isoXml = preg_replace('/<\?xml[^>]+\?>/', '', $isoXml);
            $difXml = preg_replace('/<\?xml[^>]+\?>/', '', $difXml);

            // Create the combined XML
            $combinedXml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<envelope>
    $dataciteXml

    $isoXml

    $difXml
</envelope>
XML;

            if ($returnAsString) {
                return $combinedXml;
            }

            if ($download) {
                // Ensure no output has been sent before headers
                if (ob_get_level()) {
                    ob_end_clean();
                }

                $filename = "dataset_{$id}_all.xml";

                // Binary Transfer
                header('Content-Type: application/octet-stream');
                header('Content-Disposition: attachment; filename="' . $filename . '"');
                header('Content-Length: ' . strlen($combinedXml));
                header('Content-Transfer-Encoding: binary');
                header('Connection: close');

                echo $combinedXml;
                flush();
            } else {
                header('Content-Type: application/xml; charset=utf-8');
                echo $combinedXml;
            }
        } catch (Exception $e) {
            if ($returnAsString) {
                throw $e;
            }
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage()]);
        }
        if (!$returnAsString) {
            exit();
        }
    }
    /**
     * this public function is used as an endpoint to get the XML in all formats. So called envelope.
     * Generates a transformed XML string for a given format without downloading it.
     *
     * @param mysqli $connection The database connection.
     * @param int $id The ID of the resource.
     */
    public function envelopeXmlAsString($connection, $id)
    {
        // Use the existing private function, returning the combined XML as a string.
        $vars = ['id' => $id];
        return $this->handleExportAll($vars, false, true);
    }
    /**
         * Exports the base XML for a resource as a file download.
         *
         * This method serves as a public endpoint to trigger the export of the base XML
         * (including GGM properties if present) for a given resource. It delegates the actual
         * export logic to handleExportBaseXml().
         *
         * @param array $vars An associative array containing at least the key 'id' (resource ID).
         * @return void
         */
    public function exportBaseXml($vars)
    {
        return $this->handleExportBaseXml($vars, false);
    }
    /**
     * Handles the export of the base XML for a resource and outputs it as a file download.
     *
     * This method generates the base XML for the specified resource (including GGM properties if present),
     * sets appropriate headers for file download, and outputs the XML content. If XML generation fails,
     * it returns a JSON error response with HTTP 500.
     *
     * @param array $vars An associative array containing at least the key 'id' (resource ID).
     * @return void
     */
    public function handleExportBaseXml(array $vars)
    {
        $id = intval($vars['id']);

        try {
            // Get the base XML, which includes GGM properties if they exist
            $xmlString = $this->getResourceAsXml($this->connection, $id);

            if ($xmlString === false || empty($xmlString)) {
                // getResourceAsXml might throw an exception, or return false/empty on error
                // This check is a fallback.
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['error' => "Failed to generate XML for resource ID: $id"]);
                exit();
            }

            // Ensure no output has been sent before headers
            if (ob_get_level()) {
                ob_end_clean();
            }

            $filename = "resource_{$id}.xml";
            header('Content-Type: application/xml; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . strlen($xmlString));
            // Optional: Caching prevention headers
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('Pragma: no-cache');
            header('Expires: 0');

            echo $xmlString;
            exit();

        } catch (Exception $e) {
            // Log the exception $e->getMessage()
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => "An error occurred: " . $e->getMessage()]);
            exit();
        }
    }
}