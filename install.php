<?php
/**
 *
 * This script handles the database installation process via AJAX requests.
 * It provides two installation options:
 * 1. Basic installation with required lookup data
 * 2. Complete installation including test data
 *
 */

// Include database connection
if (!defined('INCLUDED_FROM_TEST')) {
    // Include database connection nur wenn nicht von Tests aufgerufen
    if (!file_exists("settings.php")) {
        die(json_encode([
            'status' => 'error',
            'message' => 'Error: settings.php not found.'
        ]));
    }
    require_once("settings.php");
}

// Check database connection
if (!isset($connection) || !$connection) {
    die(json_encode([
        'status' => 'error',
        'message' => 'Error: Database connection could not be established. Please check settings.php and database availability.'
    ]));
}

/**
 * Drops all existing tables in the database.
 *
 * @param mysqli $connection The database connection object
 * @return void
 */
function dropTables($connection)
{
    $tables = [
        'Resource',
        'Resource_has_Author',
        'Author',
        'Resource_Type',
        'Rights',
        'Language',
        'Role',
        'Title_Type',
        'Title',
        'Author_has_Affiliation',
        'Contact_Person',
        'Contact_Person_has_Affiliation',
        'Resource_has_Contact_Person',
        'Originating_Laboratory',
        'Originating_Laboratory_has_Affiliation',
        'Resource_has_Originating_Laboratory',
        'Contributor_Person',
        'Contributor_Person_has_Role',
        'Contributor_Person_has_Affiliation',
        'Resource_has_Contributor_Person',
        'Contributor_Institution',
        'Contributor_Institution_has_Role',
        'Contributor_Institution_has_Affiliation',
        'Resource_has_Contributor_Institution',
        'Affiliation',
        'Description',
        'Thesaurus_Keywords',
        'Free_Keywords',
        'Resource_has_Free_Keywords',
        'Resource_has_Thesaurus_Keywords',
        'Spatial_Temporal_Coverage',
        'Resource_has_Spatial_Temporal_Coverage',
        'Relation',
        'Identifier_Type',
        'Related_Work',
        'Resource_has_Related_Work',
        'Funding_Reference',
        'Resource_has_Funding_Reference'
    ];

    // Disable foreign key checks to allow dropping tables with dependencies
    mysqli_query($connection, "SET FOREIGN_KEY_CHECKS = 0;");

    foreach ($tables as $table) {
        $sql = "DROP TABLE IF EXISTS $table;";
        mysqli_query($connection, $sql);
    }

    // Re-enable foreign key checks
    mysqli_query($connection, "SET FOREIGN_KEY_CHECKS = 1;");
}

/**
 * Creates the database structure by executing SQL CREATE TABLE statements.
 *
 * @param mysqli $connection The database connection object
 * @return array Status information about the operation
 */
function createDatabaseStructure($connection)
{
    $tables = [
        "Resource" => "CREATE TABLE IF NOT EXISTS `Resource` (
    `resource_id` INT NOT NULL AUTO_INCREMENT,
    `doi` VARCHAR(100) NULL,
    `version` FLOAT NULL,
    `year` YEAR(4) NOT NULL,
    `dateCreated` DATE NOT NULL,
    `dateEmbargoUntil` DATE NULL,
    `Rights_rights_id` INT NOT NULL,
    `Resource_Type_resource_name_id` INT NOT NULL,
    `Language_language_id` INT NOT NULL,
    PRIMARY KEY (`resource_id`));",

        "Resource_Type" => "CREATE TABLE IF NOT EXISTS `Resource_Type` (
    `resource_name_id` INT NOT NULL AUTO_INCREMENT,
    `resource_type_general` VARCHAR(30) NULL,
    `description` TEXT(5000) NULL,
    PRIMARY KEY (`resource_name_id`));",

        "Rights" => "CREATE TABLE IF NOT EXISTS `Rights` (
    `rights_id` INT NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(100) NOT NULL,
    `rightsIdentifier` VARCHAR(20) NULL,
    `rightsURI` VARCHAR(256) NULL,
    `forSoftware` SMALLINT,
    PRIMARY KEY (`rights_id`));",

        "Language" => "CREATE TABLE IF NOT EXISTS `Language` (
    `language_id` INT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(10) NULL,
    `name` VARCHAR(20) NOT NULL,
    PRIMARY KEY (`language_id`));",

        "Author" => "CREATE TABLE IF NOT EXISTS `Author` (
    `author_id` INT NOT NULL AUTO_INCREMENT,
    `familyname` TEXT(666) NOT NULL,
    `givenname` TEXT(746) NOT NULL,
    `orcid` VARCHAR(19) NOT NULL,
    PRIMARY KEY (`author_id`));",

        "Role" => "CREATE TABLE IF NOT EXISTS `Role` (
    `role_id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(45) NOT NULL,
    `description` TEXT(1000) NULL,
    `forInstitutions` SMALLINT,
    PRIMARY KEY (`role_id`));",

        "Affiliation" => "CREATE TABLE IF NOT EXISTS `Affiliation` (
    `affiliation_id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(265) NOT NULL,
    `rorId` VARCHAR(25) NULL,
    PRIMARY KEY (`affiliation_id`));",

        "Title_Type" => "CREATE TABLE IF NOT EXISTS `Title_Type` (
    `title_type_id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(25) NOT NULL,
    PRIMARY KEY (`title_type_id`));",

        "Title" => "CREATE TABLE IF NOT EXISTS `Title` (
    `title_id` INT NOT NULL AUTO_INCREMENT,
    `text` VARCHAR(256) NOT NULL,
    `Title_Type_fk` INT NOT NULL,
    `Resource_resource_id` INT NOT NULL,
    PRIMARY KEY (`title_id`, `Title_Type_fk`, `Resource_resource_id`),
    FOREIGN KEY (`Title_Type_fk`)
    REFERENCES `Title_Type` (`title_type_id`),
    FOREIGN KEY (`Resource_resource_id`)
    REFERENCES `Resource` (`resource_id`));",

        "Contact_Person" => "CREATE TABLE IF NOT EXISTS `Contact_Person` (
   `contact_person_id` INT NOT NULL AUTO_INCREMENT,
   `familyname` TEXT(666)  NULL,
   `givenname` TEXT(746) NULL,
   `position` TEXT(45)  NULL,
   `email` VARCHAR(255)  NULL,
   `website` VARCHAR(255) NULL,
   PRIMARY KEY (`contact_person_id`));",

        "Originating_Laboratory" => "CREATE TABLE IF NOT EXISTS `Originating_Laboratory` (
   `originating_laboratory_id` INT NOT NULL AUTO_INCREMENT,
   `laboratoryname` TEXT(1000) NOT NULL,
   `labId` VARCHAR(32) NULL UNIQUE,
   PRIMARY KEY (`originating_laboratory_id`));",

        "Originating_Laboratory_has_Affiliation" => "CREATE TABLE IF NOT EXISTS `Originating_Laboratory_has_Affiliation` (
   `Originating_Laboratory_has_Affiliation_id` INT NOT NULL AUTO_INCREMENT,
   `Originating_Laboratory_originating_laboratory_id` INT NOT NULL,
   `Affiliation_affiliation_id` INT NOT NULL,
   PRIMARY KEY (`Originating_Laboratory_has_Affiliation_id`),
   FOREIGN KEY (`Originating_Laboratory_originating_laboratory_id`)
   REFERENCES `Originating_Laboratory` (`originating_laboratory_id`),
   FOREIGN KEY (`Affiliation_affiliation_id`)
   REFERENCES `Affiliation` (`affiliation_id`));",

        "Resource_has_Originating_Laboratory" => "CREATE TABLE IF NOT EXISTS `Resource_has_Originating_Laboratory` (
   `Resource_has_Originating_Laboratory_id` INT NOT NULL AUTO_INCREMENT,
   `Resource_resource_id` INT NOT NULL,
   `Originating_Laboratory_originating_laboratory_id` INT NOT NULL,
   PRIMARY KEY (`Resource_has_Originating_Laboratory_id`),
   FOREIGN KEY (`Resource_resource_id`)
   REFERENCES `Resource` (`resource_id`),
   FOREIGN KEY (`Originating_Laboratory_originating_laboratory_id`)
   REFERENCES `Originating_Laboratory` (`originating_laboratory_id`));",

        "Contributor_Person" => "CREATE TABLE IF NOT EXISTS `Contributor_Person` (
   `contributor_person_id` INT NOT NULL AUTO_INCREMENT,
   `familyname` TEXT(666) NULL,
   `givenname` TEXT(746) NULL,
   `orcid` VARCHAR(19) NULL,
    PRIMARY KEY (`contributor_person_id`));",

        "Contributor_Institution" => "CREATE TABLE IF NOT EXISTS `Contributor_Institution` (
   `contributor_institution_id` INT NOT NULL AUTO_INCREMENT,
   `name` VARCHAR(255) NULL,
    PRIMARY KEY (`contributor_institution_id`));",

        "Description" => "CREATE TABLE IF NOT EXISTS `Description` (
    `description_id` INT NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(22) NOT NULL,
    `description` TEXT NOT NULL,
    `resource_id` INT NOT NULL,
    PRIMARY KEY (`description_id`),
    FOREIGN KEY (`resource_id`)
    REFERENCES `Resource`(`resource_id`));",

        "Thesaurus_Keywords" => "CREATE TABLE IF NOT EXISTS `Thesaurus_Keywords` (
    `thesaurus_keywords_id` INT NOT NULL AUTO_INCREMENT,
    `keyword` TEXT(256) NOT NULL,
    `scheme` TEXT(256) NULL,
    `schemeURI` VARCHAR(256) NULL,
    `valueURI` VARCHAR(1000) NULL,
    `language` VARCHAR(20) NOT NULL,
    PRIMARY KEY (`thesaurus_keywords_id`));",

        "Resource_has_Thesaurus_Keywords" => "CREATE TABLE IF NOT EXISTS `Resource_has_Thesaurus_Keywords` (
    `Resource_has_Thesaurus_Keywords_id` INT NOT NULL AUTO_INCREMENT,
    `Resource_resource_id` INT NOT NULL,
    `Thesaurus_Keywords_thesaurus_keywords_id` INT NOT NULL,
    PRIMARY KEY (`Resource_has_Thesaurus_Keywords_id`),
    FOREIGN KEY (`Resource_resource_id`)
    REFERENCES `Resource` (`resource_id`),
    FOREIGN KEY (`Thesaurus_Keywords_thesaurus_keywords_id`)
    REFERENCES `Thesaurus_Keywords` (`thesaurus_keywords_id`));",

        "Free_Keywords" => "CREATE TABLE IF NOT EXISTS Free_Keywords (
    free_keywords_id INT NOT NULL AUTO_INCREMENT,
    free_keyword VARCHAR(100) NOT NULL,
    isCurated SMALLINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (free_keywords_id));",

        "Resource_has_Free_Keywords" => "CREATE TABLE IF NOT EXISTS Resource_has_Free_Keywords (
    Resource_resource_id INT NOT NULL,
    Free_Keywords_free_keywords_id INT NOT NULL,
    PRIMARY KEY (Resource_resource_id, Free_Keywords_free_keywords_id),
    FOREIGN KEY (Resource_resource_id) REFERENCES Resource (resource_id),
    FOREIGN KEY (Free_Keywords_free_keywords_id) REFERENCES Free_Keywords (free_keywords_id))",


        "Spatial_Temporal_Coverage" => "CREATE TABLE IF NOT EXISTS `Spatial_Temporal_Coverage` (
    `spatial_temporal_coverage_id` INT NOT NULL AUTO_INCREMENT,
    `latitudeMin` FLOAT NULL,
    `latitudeMax` FLOAT NULL,
    `longitudeMin` FLOAT NULL,
    `longitudeMax` FLOAT NULL,
    `description` TEXT(5000) NULL,
    `dateStart` DATE NULL,
    `dateEnd` DATE NULL,
    `timeStart` TIME NULL,
    `timeEnd` TIME NULL,
    `timezone` VARCHAR(10) NULL,
    PRIMARY KEY (`spatial_temporal_coverage_id`));",

        "Relation" => "CREATE TABLE IF NOT EXISTS `Relation` (
    `relation_id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(45) NOT NULL,
    `description` TEXT(1000) NULL,
    PRIMARY KEY (`relation_id`));",

        "Identifier_Type" => "CREATE TABLE IF NOT EXISTS `Identifier_Type` (
    `identifier_type_id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(45) NOT NULL,
    `description` TEXT(1000) NULL,
    `pattern` VARCHAR(256),
    PRIMARY KEY (`identifier_type_id`));",

        "Related_Work" => "CREATE TABLE IF NOT EXISTS `Related_Work` (
    `related_work_id` INT NOT NULL AUTO_INCREMENT,
    `Identifier` VARCHAR(245) NOT NULL,
    `relation_fk` INT NOT NULL,
    `identifier_type_fk`INT NOT NULL,
    PRIMARY KEY (`related_work_id`),
    FOREIGN KEY (`relation_fk`)
    REFERENCES `Relation` (`relation_id`),
    FOREIGN KEY (`identifier_type_fk`)
    REFERENCES `Identifier_Type` (`identifier_type_id`));",

        "Resource_has_Related_Work" => "CREATE TABLE IF NOT EXISTS `Resource_has_Related_Work` (
    `Resource_has_Related_Work_id` INT NOT NULL AUTO_INCREMENT,
    `Resource_resource_id` INT NOT NULL,
    `Related_Work_related_work_id` INT NOT NULL,
    PRIMARY KEY (`Resource_has_Related_Work_id`),
    FOREIGN KEY (`Resource_resource_id`)
    REFERENCES `Resource` (`resource_id`),
    FOREIGN KEY (`Related_Work_related_work_id`)
    REFERENCES `Related_Work` (`related_work_id`));",

        "Funding_Reference" => "CREATE TABLE IF NOT EXISTS `Funding_Reference` (
   `funding_reference_id` INT NOT NULL AUTO_INCREMENT,
   `funder` VARCHAR(265) NOT NULL,
   `funderid` VARCHAR(11) NULL,
   `funderidtyp` VARCHAR(25) NULL,
   `grantnumber` VARCHAR(45) NULL,
   `grantname` VARCHAR(75) NULL,
    PRIMARY KEY (`funding_reference_id`));",

        "Resource_has_Funding_Reference" => "CREATE TABLE IF NOT EXISTS `Resource_has_Funding_Reference` (
   `Resource_has_Funding_Reference_id` INT NOT NULL AUTO_INCREMENT,
   `Resource_resource_id` INT NOT NULL,
   `Funding_Reference_funding_reference_id` INT NOT NULL,
   PRIMARY KEY (`Resource_has_Funding_Reference_id`),
   CONSTRAINT `fk_resource_funding`
   FOREIGN KEY (`Resource_resource_id`)
   REFERENCES `Resource` (`resource_id`)
   ON DELETE CASCADE
   ON UPDATE CASCADE,
   CONSTRAINT `fk_funding_reference`
   FOREIGN KEY (`Funding_Reference_funding_reference_id`)
   REFERENCES `Funding_Reference` (`funding_reference_id`)
   ON DELETE CASCADE
   ON UPDATE CASCADE);",

        "Resource_has_Author" => "CREATE TABLE IF NOT EXISTS `Resource_has_Author` (
    `Resource_has_Author_id` INT NOT NULL AUTO_INCREMENT,
    `Resource_resource_id` INT NOT NULL,
    `Author_author_id` INT NOT NULL,
    PRIMARY KEY (`Resource_has_Author_id`),
    FOREIGN KEY (`Resource_resource_id`)
    REFERENCES `Resource` (`resource_id`),
    FOREIGN KEY (`Author_author_id`)
    REFERENCES `Author` (`author_id`));",


        "Author_has_Affiliation" => "CREATE TABLE IF NOT EXISTS `Author_has_Affiliation` (
    `Author_has_Affiliation_id` INT NOT NULL AUTO_INCREMENT,
    `Author_author_id` INT NOT NULL,
    `Affiliation_affiliation_id` INT NOT NULL,
    PRIMARY KEY (`Author_has_Affiliation_id`),
    FOREIGN KEY (`Author_author_id`)
    REFERENCES `Author` (`author_id`),
    FOREIGN KEY (`Affiliation_affiliation_id`)
    REFERENCES `Affiliation` (`affiliation_id`));",

        "Contact_Person_has_Affiliation" => "CREATE TABLE IF NOT EXISTS `Contact_Person_has_Affiliation` (
    `Contact_Person_has_Affiliation_id` INT NOT NULL AUTO_INCREMENT,
    `Contact_Person_contact_person_id` INT NOT NULL,
    `Affiliation_affiliation_id` INT NOT NULL,
    PRIMARY KEY (`Contact_Person_has_Affiliation_id`),
    FOREIGN KEY (`Contact_Person_contact_person_id`)
    REFERENCES `Contact_Person` (`contact_person_id`),
    FOREIGN KEY (`Affiliation_affiliation_id`)
    REFERENCES `Affiliation` (`affiliation_id`));",

        "Resource_has_Contact_Person" => "CREATE TABLE IF NOT EXISTS `Resource_has_Contact_Person` (
    `Resource_has_Contact_Person_id` INT NOT NULL AUTO_INCREMENT,
    `Resource_resource_id` INT NOT NULL,
    `Contact_Person_contact_person_id` INT NOT NULL,
    PRIMARY KEY (`Resource_has_Contact_Person_id`),
    FOREIGN KEY (`Resource_resource_id`)
    REFERENCES `Resource` (`resource_id`),
    FOREIGN KEY (`Contact_Person_contact_person_id`)
    REFERENCES `Contact_Person` (`Contact_Person_id`));",

        "Contributor_Person_has_Role" => "CREATE TABLE IF NOT EXISTS `Contributor_Person_has_Role` (
    `Contributor_Person_has_Role_id` INT NOT NULL AUTO_INCREMENT,
    `Contributor_Person_contributor_person_id` INT NOT NULL,
    `Role_role_id` INT NOT NULL,
    PRIMARY KEY (`Contributor_Person_has_Role_id`),
    FOREIGN KEY (`Contributor_Person_contributor_person_id`)
    REFERENCES `Contributor_Person` (`contributor_person_id`),
    FOREIGN KEY (`Role_role_id`)
    REFERENCES `Role` (`role_id`));",

        "Contributor_Person_has_Affiliation" => "CREATE TABLE IF NOT EXISTS `Contributor_Person_has_Affiliation` (
    `Contributor_Person_has_Affiliation_id` INT NOT NULL AUTO_INCREMENT,
    `Contributor_Person_contributor_person_id` INT NOT NULL,
    `Affiliation_affiliation_id` INT NOT NULL,
    PRIMARY KEY (`Contributor_Person_has_Affiliation_id`),
    FOREIGN KEY (`Contributor_Person_contributor_person_id`)
    REFERENCES `Contributor_Person` (`contributor_person_id`),
    FOREIGN KEY (`Affiliation_affiliation_id`)
    REFERENCES `Affiliation` (`affiliation_id`));",

        "Resource_has_Contributor_Person" => "CREATE TABLE IF NOT EXISTS `Resource_has_Contributor_Person` (
    `Resource_has_Contributor_Person_id` INT NOT NULL AUTO_INCREMENT,
    `Resource_resource_id` INT NOT NULL,
    `Contributor_Person_contributor_person_id` INT NOT NULL,
    PRIMARY KEY (`Resource_has_Contributor_Person_id`),
    FOREIGN KEY (`Resource_resource_id`)
    REFERENCES `Resource` (`resource_id`),
    FOREIGN KEY (`Contributor_Person_contributor_person_id`)
    REFERENCES `Contributor_Person` (`Contributor_Person_id`));",

        "Contributor_Institution_has_Role" => "CREATE TABLE IF NOT EXISTS `Contributor_Institution_has_Role` (
    `Contributor_Institution_has_Role_id` INT NOT NULL AUTO_INCREMENT,
    `Contributor_Institution_contributor_institution_id` INT NOT NULL,
    `Role_role_id` INT NOT NULL,
    PRIMARY KEY (`Contributor_Institution_has_Role_id`),
    FOREIGN KEY (`Contributor_Institution_contributor_institution_id`)
    REFERENCES `Contributor_Institution` (`contributor_institution_id`),
    FOREIGN KEY (`Role_role_id`)
    REFERENCES `Role` (`role_id`));",

        "Contributor_Institution_has_Affiliation" => "CREATE TABLE IF NOT EXISTS `Contributor_Institution_has_Affiliation` (
    `Contributor_Institution_has_Affiliation_id` INT NOT NULL AUTO_INCREMENT,
    `Contributor_Institution_contributor_institution_id` INT NOT NULL,
    `Affiliation_affiliation_id` INT NOT NULL,
    PRIMARY KEY (`Contributor_Institution_has_Affiliation_id`),
    FOREIGN KEY (`Contributor_Institution_contributor_institution_id`)
    REFERENCES `Contributor_Institution` (`contributor_institution_id`),
    FOREIGN KEY (`Affiliation_affiliation_id`)
    REFERENCES `Affiliation` (`affiliation_id`));",

        "Resource_has_Contributor_Institution" => "CREATE TABLE IF NOT EXISTS `Resource_has_Contributor_Institution` (
    `Resource_has_Contributor_Institution_id` INT NOT NULL AUTO_INCREMENT,
    `Resource_resource_id` INT NOT NULL,
    `Contributor_Institution_contributor_institution_id` INT NOT NULL,
    PRIMARY KEY (`Resource_has_Contributor_Institution_id`),
    FOREIGN KEY (`Resource_resource_id`)
    REFERENCES `Resource` (`resource_id`),
    FOREIGN KEY (`Contributor_Institution_contributor_institution_id`)
    REFERENCES `Contributor_Institution` (`Contributor_institution_id`));",

        "Resource_has_Spatial_Temporal_Coverage" => "CREATE TABLE IF NOT EXISTS `Resource_has_Spatial_Temporal_Coverage` (
    `Resource_has_Spatial_Temporal_Coverage_id` INT NOT NULL AUTO_INCREMENT,
    `Resource_resource_id` INT NOT NULL,
    `Spatial_Temporal_Coverage_spatial_temporal_coverage_id` INT NOT NULL,
    PRIMARY KEY (`Resource_has_Spatial_Temporal_Coverage_id`),
    FOREIGN KEY (`Resource_resource_id`)
    REFERENCES `Resource` (`resource_id`),
    FOREIGN KEY (`Spatial_Temporal_Coverage_spatial_temporal_coverage_id`)
    REFERENCES `Spatial_Temporal_Coverage` (`spatial_temporal_coverage_id`));"
    ];

    $created = 0;
    $total = count($tables);

    foreach ($tables as $tableName => $sqlCreate) {
        try {
            $stmt = $connection->prepare($sqlCreate);
            $stmt->execute();
            $created++;
        } catch (Exception $e) {
            return [
                'status' => 'error',
                'message' => "Error creating table $tableName: " . $e->getMessage(),
                'progress' => ($created / $total) * 100
            ];
        }
    }

    return [
        'status' => 'success',
        'message' => "Successfully created $created tables",
        'progress' => 100
    ];
}

/**
 * Inserts required lookup data for dropdowns and selections.
 *
 * @param mysqli $connection The database connection object
 * @return void
 */
function insertLookupData($connection)
{
    $lookupData = [
        "Resource_Type" => [
            ["resource_type_general" => "Audiovisual", "description" => "A series of visual representations imparting an impression of motion when shown in succession. May or may not include sound."],
            ["resource_type_general" => "Collection", "description" => "An aggregation of resources, which may encompass collections of one resourceType as well as those of mixed types. A collection is described as a group; its parts may also be separately described."],
            ["resource_type_general" => "ComputationalNotebook", "description" => "A virtual notebook environment used for literate programming."],
            ["resource_type_general" => "DataPaper", "description" => "A factual and objective publication with a focused intent to identify and describe specific data, sets of data, or data collections to facilitate discoverability."],
            ["resource_type_general" => "Dataset", "description" => "Data encoded in a defined structure."],
            ["resource_type_general" => "Event", "description" => "A non-persistent, time-based occurrence."],
            ["resource_type_general" => "Image", "description" => "A visual representation other than text."],
            ["resource_type_general" => "InteractiveResource", "description" => "A resource requiring interaction from the user to be understood, executed, or experienced."],
            ["resource_type_general" => "Model", "description" => "An abstract, conceptual, graphical, mathematical or visualization model that represents empirical objects, phenomena, or physical processes."],
            ["resource_type_general" => "OutputManagementPlan", "description" => "A formal document that outlines how research outputs are to be handled both during a research project and after the project is completed."],
            ["resource_type_general" => "Preprint", "description" => "A version of a scholarly or scientific paper that precedes formal peer review and publication in a peer-reviewed scholarly or scientific journal."],
            ["resource_type_general" => "Software", "description" => "A computer program other than a computational notebook, in either source code (text) or compiled form. Use this type for general software components supporting scholarly research. Use the \"ComputationalNotebook\" value for virtual notebooks."],
            ["resource_type_general" => "Sound", "description" => "A resource primarily intended to be heard."],
            ["resource_type_general" => "Standard", "description" => "Something established by authority, custom, or general consent as a model, example, or point of reference."],
            ["resource_type_general" => "StudyRegistration", "description" => "A detailed, time-stamped description of a research plan, often openly shared in a registry or published in a journal before the study is conducted to lend accountability and transparency in the hypothesis generating and testing process."],
            ["resource_type_general" => "Text", "description" => "A resource consisting primarily of words for reading that is not covered by any other textual resource type in this list."],
            ["resource_type_general" => "Workflow", "description" => "A structured series of steps which can be executed to produce a final outcome, allowing users a means to specify and enact their work in a more reproducible manner."],
            ["resource_type_general" => "Other", "description" => "If selected, supply a value for ResourceType."]
        ],
        "Rights" => [
            ["text" => "Creative Commons Attribution 4.0 International", "rightsIdentifier" => "CC-BY-4.0", "rightsURI" => "https://creativecommons.org/licenses/by/4.0/legalcode", "forSoftware" => "0"],
            ["text" => "Creative Commons Zero v1.0 Universal", "rightsIdentifier" => "CC0-1.0", "rightsURI" => "https://creativecommons.org/publicdomain/zero/1.0/legalcode", "forSoftware" => "0"],
            ["text" => "GNU General Public License v3.0 or later", "rightsIdentifier" => "GPL-3.0-or-later", "rightsURI" => "https://www.gnu.org/licenses/gpl-3.0-standalone.html", "forSoftware" => "1"],
            ["text" => "MIT License", "rightsIdentifier" => "MIT", "rightsURI" => "https://opensource.org/license/mit/", "forSoftware" => "1"],
            ["text" => "Apache License 2.0", "rightsIdentifier" => "Apache-2.0", "rightsURI" => "https://www.apache.org/licenses/LICENSE-2.0", "forSoftware" => "1"],
            ["text" => "European Union Public License 1.2", "rightsIdentifier" => "EUPL-1.2", "rightsURI" => "https://joinup.ec.europa.eu/sites/default/files/custom-page/attachment/2020-03/EUPL-1.2%20EN.txt", "forSoftware" => "0"],
            ["text" => "BSD 3-Clause License", "rightsIdentifier" => "BSD-3-Clause", "rightsURI" => "https://opensource.org/licenses/BSD-3-Clause", "forSoftware" => "1"],
            ["text" => "Creative Commons Attribution-NonCommercial 4.0 International", "rightsIdentifier" => "CC-BY-NC-4.0", "rightsURI" => "https://creativecommons.org/licenses/by-nc/4.0/legalcode.en", "forSoftware" => "0"]
        ],
        "Language" => [
            ["code" => "en", "name" => "English"],
            ["code" => "de", "name" => "German"],
            ["code" => "fr", "name" => "French"]
        ],
        "Role" => [
            ["name" => "Data Collector", "description" => "Data Collector: Person/institution responsible for finding, gathering/collecting data under the guidelines of the author(s) or Principal Investigator (PI); May also use when crediting survey conductors, interviewers, event or condition observers, person responsible for monitoring key instrument data.", "forInstitutions" => "2"],
            ["name" => "Data Curator", "description" => "Data Curator: Person tasked with reviewing, enhancing, cleaning, or standardizing metadata and the associated data submitted for storage, use, and maintenance within a data center or repository; While the \"DataManager\" is concerned with digital maintenance, the DataCurator's role encompasses quality assurance focused on content and metadata. This includes checking whether the submitted dataset is complete, with all files and components as described by submitter, whether the metadata is standardized to appropriate systems and schema, whether specialized metadata is needed to add value and ensure access across disciplines, and determining how the metadata might map to search engines, database products, and automated feeds.", "forInstitutions" => "0"],
            ["name" => "Data Manager", "description" => "Data Manager: Person (or organization with a staff of data managers, such as a data centre) responsible for maintaining the finished resource. The work done by this person or organization ensures that the resource is periodically \"refreshed\" in terms of software/hardware support, is kept available or is protected from unauthorized access, is stored in accordance with industry standards, and is handled in accordance with the records management requirements applicable to it.", "forInstitutions" => "2"],
            ["name" => "Distributor", "description" => "Distributor: Institution tasked with responsibility to generate/disseminate copies of the resource in either electronic or print form. Works stored in more than one archive/repository may credit each as a distributor.", "forInstitutions" => "1"],
            ["name" => "Editor", "description" => "Editor. A person who oversees the details related to the publication format of the resource. Note: if the Editor is to be credited in place of multiple authors, the Editor's name may be supplied as Author, with \"(Ed.)\" appended to the name.", "forInstitutions" => "0"],
            ["name" => "Hosting Institution", "description" => "Hosting Institution: Typically, the organization allowing the resource to be available on the internet through the provision of its hardware/software/operating support. May also be used for an organization that stores the data offline. Often a data centre (if that data centre is not the", "forInstitutions" => "1"],
            ["name" => "Producer", "description" => "Producer: Typically a person or organization responsible for the artistry and form of a media product. In the data industry, this may be a company", "forInstitutions" => "2"],
            ["name" => "Project Leader", "description" => "Project Leader. Person officially designated as head of project team or sub-project team instrumental in the work necessary to development of the resource. The Project Leader is not", "forInstitutions" => "0"],
            ["name" => "Project Manager", "description" => "Project Manager: Person officially designated as manager of a project. Project may on consist of one or many project teams and sub-teams. The manager of a project normally has more administrative responsibility than actual work involvement.", "forInstitutions" => "0"],
            ["name" => "Project Member", "description" => "Project Member: Person on the membership list of a designated project/project team. This vocabulary may or may not indicate the quality, quantity, or substance of the person's involvement", "forInstitutions" => "0"],
            ["name" => "Registration Agency", "description" => "Registration Agency: Institution/organization officially appointed by a Registration Authority to handle specific tasks within a defined area of responsibility. DataCite is a Registration Agency for the International DOI Foundation (IDF). One of Data Cite's tasks is to assign DOI prefixes to the allocating agents who then assign the full, specific character string to data clients, provide metadata back to the Data Cite registry, etc.", "forInstitutions" => "1"],
            ["name" => "Registration Authority", "description" => "Registration Authority: A standards-setting body from which Registration Agencies obtain official recognition and guidance. The IDF serves as the Registration Authority for the International Standards Organization (ISO) in the area/domain of Digital Object Identifiers.", "forInstitutions" => "1"],
            ["name" => "Related Person", "description" => "Related Person: A person without a specifically defined role in the development of the resource, but who is someone the author wishes to recognize. This person could be an author's intellectual mentor, a person providing intellectual leadership in the discipline or subject domain, etc.", "forInstitutions" => "0"],
            ["name" => "Researcher", "description" => "Researcher: A person involved in analyzing data or the results of an experiment or formal study. May indicate an intern or assistant to one of the authors who helped with research but who was not so", "forInstitutions" => "0"],
            ["name" => "Research Group", "description" => "Research Group: Typically refers to a group of individuals with a lab, department, or on division; the group has a particular, defined focus of activity. May operate at a narrower level of scope; may or may not hold less administrative responsibility than a project team.", "forInstitutions" => "1"],
            ["name" => "Rights Holder", "description" => "Rights Holder: Person or institution owning or managing property rights, including intellectual property rights over the resource.", "forInstitutions" => "2"],
            ["name" => "Sponsor", "description" => "Sponsor: Person or organization that issued a contract or under the auspices of which a work has been written, printed, published, developed, etc. Includes organizations that provide in-kind support, through donation, provision of people or a facility or instrumentation necessary for the development of the resource, etc.", "forInstitutions" => "2"],
            ["name" => "Supervisor", "description" => "Supervisor: Designated administrator over one or more groups/teams working to produce a resource or over one or more steps of a development process.", "forInstitutions" => "0"],
            ["name" => "WorkPackage Leader", "description" => "Workpackage Leader: A Work Package is a recognized data product, not all of which is included in publication. The package, instead, may include notes, discarded documents, etc. The Work Package Leader is responsible for ensuring the comprehensive contents, versioning, and availability of the Work Package during the development of the resource.", "forInstitutions" => "0"],
            ["name" => "Other", "description" => "Other: Any person or institution making a significant contribution to the development and/or maintenance of the resource, but whose contribution does not", "forInstitutions" => "2"]
        ],
        "Title_Type" => [
            ["name" => "Main Title"],
            ["name" => "Alternative Title"],
            ["name" => "Translated Title"]
        ],
        "Relation" => [
            ["name" => "IsCitedBy", "description" => "indicates that B includes A in a citation"],
            ["name" => "Cites", "description" => "indicates that A includes B in a citation"],
            ["name" => "IsSupplementTo", "description" => "indicates that A is a supplement to B"],
            ["name" => "IsSupplementedBy", "description" => "indicates that B is a supplement to A"],
            ["name" => "IsContinuedBy", "description" => "indicates A is continued by the work B"],
            ["name" => "Continues", "description" => "indicates A is a continuation of the work B"],
            ["name" => "IsDescribedBy", "description" => "indicates A is described by B"],
            ["name" => "Describes", "description" => "indicates A describes B"],
            ["name" => "HasMetadata", "description" => "indicates resource A has additional metadata B"],
            ["name" => "IsMetadataFor", "description" => "indicates additional metadata A for a resource B"],
            ["name" => "HasVersion", "description" => "indicates A has a version B"],
            ["name" => "IsVersionOf", "description" => "indicates A is a version of B"],
            ["name" => "IsNewVersionOf", "description" => "indicates A is a version of B"],
            ["name" => "IsPreviousVersionOf", "description" => "indicates A is a new edition of B, where the new edition has been modified or updated"],
            ["name" => "IsPartOf", "description" => "indicates A is a portion of B; may be used for elements of a series"],
            ["name" => "HasPart", "description" => "indicates A includes the part B"],
            ["name" => "IsPublishedIn", "description" => "indicates A is published inside B, but is independent of other things published inside of B"],
            ["name" => "IsReferencedBy", "description" => "indicates A is used as a source of information by B"],
            ["name" => "References", "description" => "indicates B is used as a source of information for A"],
            ["name" => "IsDocumentedBy", "description" => "indicates B is documentation about/explaining A"],
            ["name" => "Documents", "description" => "indicates A is documentation about/explaining B"],
            ["name" => "IsCompiledBy", "description" => "indicates B is used to compile or create A"],
            ["name" => "Compiles", "description" => "indicates B is the result of a compile or creation event using A"],
            ["name" => "IsVariantFormOf", "description" => "indicates A is a variant or different form of B"],
            ["name" => "IsOriginalFormOf", "description" => "indicates A is the original form of B"],
            ["name" => "IsIdenticalTo", "description" => "indicates that A is identical to B, for use when there is a need to register two separate instances of the same resource"],
            ["name" => "IsReviewedBy", "description" => "indicates that A is reviewed by B"],
            ["name" => "Reviews", "description" => "indicates that A is a review of B"],
            ["name" => "IsDerivedFrom", "description" => "indicates B is a source upon which A is based"],
            ["name" => "IsSourceOf", "description" => "indicates A is a source upon which B is based"],
            ["name" => "IsRequiredBy", "description" => "Indicates A is required by B"],
            ["name" => "Requires", "description" => "Indicates A requires B"],
            ["name" => "IsObsoletedBy", "description" => "Indicates A is replaced by B"],
            ["name" => "Obsoletes", "description" => "Indicates A replaces B"],
            ["name" => "IsCollectedBy", "description" => "Indicates A is collected by B"],
            ["name" => "Collects", "description" => "Indicates A collects B"],
        ],
        "Identifier_Type" => [
            ["name" => "ARK", "description" => "A URI designed to support long-term access to information objects. In general, ARK syntax is of the form (brackets, []. indicate optional elements)", "pattern" => "^ark:\/\d{5}\/\w+$/"],
            ["name" => "arXiv", "description" => "arXiv.org is a repository of preprints of scientific papers in the fields of mathematics, physics, astronomy, computer science, quantitative biology, statistics, and quantitative finance.", "pattern" => "^(\d{4}\.\d{4,5}|[a-z\-]+(\.[A-Z]{2})?\/\d{7})v\d+$/"],
            ["name" => "bibcode", "description" => "A standardized 19-character identifier according to the syntax yyyyjjjjjvvvvmppppa. See http://info-uri.info/registry/OAIHandler?verb=GetRecord&metadataPrefix=reg&identifier=info:bibcode/.", "pattern" => "^\d{4}\w{5}[A-Z][0-9A-Za-z\.&]{14}$/"],
            ["name" => "DOI", "description" => "A character string used to uniquely identify an object. A DOI name is divided into two parts, a prefix and a suffix, separated by a slash.", "pattern" => "^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i"],
            ["name" => "EAN13", "description" => "A 13-digit barcoding standard that is a superset of the original 12-digit Universal Product Code (UPC) system.", "pattern" => "^\d{13}$/"],
            ["name" => "EISSN", "description" => "ISSN used to identify periodicals in electronic form (eISSN or e-ISSN).", "pattern" => "^\d{4}-\d{3}[0-9X]$/"],
            ["name" => "Handle", "description" => "This refers specifically to an ID in the Handle system operated by the Corporation for National Research Initiatives (CNRI).", "pattern" => "^(hdl:)?\d+(\.\d+)*(\/[^\s]+)?$/"],
            ["name" => "IGSN", "description" => "A code that uniquely identifies samples from our natural environment and related features-of-interest.", "pattern" => "^[A-Z]{5}[0-9A-Z]{4}$"],
            ["name" => "ISBN", "description" => "A unique numeric book identifier. There are 2 formats: a 10-digit ISBN format and a 13-digit ISBN.", "pattern" => "^978\d{10}$"],
            ["name" => "ISSN", "description" => "A unique 8-digit number used to identify a print or electronic periodical publication.", "pattern" => "^[0-9]{4}-([0-9]{4}|[0-9]{3}X)$"],
            ["name" => "ISTC", "description" => "A unique “number” assigned to a textual work. An ISTC consists of 16 numbers and/or letters.", "pattern" => "^[0-9A-Z]{3}-[0-9]{4}-[0-9A-Z]{8}-[0-9A-Z]{1}$"],
            ["name" => "LISSN", "description" => "The linking ISSN or ISSN-L enables collocation or linking among different media versions of a continuing resource.", "pattern" => "^\d{4}‐\d{4}$"],
            ["name" => "LSID", "description" => "A unique identifier for data in the Life Science domain. Format: urn:lsid:authority:namespace:identifier:revision.", "pattern" => "^urn:lsid:[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+$"],
            ["name" => "PMID", "description" => "A unique number assigned to each PubMed record.", "pattern" => "^\d{8}$"],
            ["name" => "PURL", "description" => "A PURL has three parts: (1) a protocol, (2) a resolver address, and (3) a name.", "pattern" => "^http:\/\/purl\.(org|oclc\.org)\/[a-zA-Z0-9\/._-]+$"],
            ["name" => "UPC", "description" => "A barcode symbology used for tracking trade items in stores. Its most common form, the UPC-A, consists of 12 numerical digits.", "pattern" => "^\d{12}$"],
            ["name" => "URL", "description" => "Also known as web address, a URL is a specific character string that constitutes a reference to a resource. The syntax is: scheme://domain:port/path?query_string#fragment_id.", "pattern" => "(https:\/\/www\.|http:\/\/www\.|https:\/\/|http:\/\/)?[a-zA-Z0-9]{2,}(\.[a-zA-Z0-9]{2,})(\.[a-zA-Z0-9]{2,})?"],
            ["name" => "URN", "description" => "A unique and persistent identifier of an electronic document. The syntax is: urn:<NID>:<NSS>. The leading urn: sequence is case-insensitive, <NID> is the namespace identifier, <NSS> is the namespace-specific string.", "pattern" => "^urn:nbn:[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+:[a-zA-Z0-9.-]+$"],
            ["name" => "w3id", "description" => "Mostly used to publish vocabularies and ontologies. The letters ‘w3’ stand for “World Wide Web”.", "pattern" => "^https:\/\/w3id\.org\/[a-zA-Z0-9\/._-]+(?:#[a-zA-Z0-9._-]+)?$"],
        ]
    ];

    foreach ($lookupData as $tableName => $data) {
        $columns = implode(", ", array_keys($data[0]));
        $placeholders = implode(", ", array_fill(0, count($data[0]), "?"));
        $sqlInsert = "INSERT INTO $tableName ($columns) VALUES ($placeholders)";
        $stmt = $connection->prepare($sqlInsert);

        foreach ($data as $row) {
            $values = array_values($row);
            $stmt->bind_param(str_repeat("s", count($values)), ...$values);
            $stmt->execute();
        }
    }
}

/**
 * Inserts sample resource data and their related information.
 *
 * @param mysqli $connection The database connection object
 * @return void
 */
function insertTestResourceData($connection)
{
    $mainTableData = [
        "Resource" => [
            ["doi" => "10.1029/2023JB028411", "version" => null, "year" => 2024, "dateCreated" => "2024-06-05", "dateEmbargoUntil" => "2024-06-15", "Rights_rights_id" => 1, "Resource_Type_resource_name_id" => 3, "Language_language_id" => 1],
            ["doi" => "10.5880/GFZ.2.4.2024.001", "version" => 2.1, "year" => 2024, "dateCreated" => "1999-04-07", "dateEmbargoUntil" => "2000-12-31", "Rights_rights_id" => 1, "Resource_Type_resource_name_id" => 3, "Language_language_id" => 1],
            ["doi" => "10.21384/test-dataset", "version" => 1.23, "year" => 2024, "dateCreated" => "2023-07-02", "dateEmbargoUntil" => "2023-07-10", "Rights_rights_id" => 1, "Resource_Type_resource_name_id" => 3, "Language_language_id" => 1]
        ],
        "Author" => [
            ["familyName" => "Grzegorz", "givenname" => "Kwiatek", "orcid" => "0000-0003-1076-615X"],
            ["familyName" => "Goebel", "givenname" => "Thomas", "orcid" => "0000-0003-1552-0861"],
            ["familyName" => "Wille", "givenname" => "Christian", "orcid" => "0000-0003-0930-6527"]
        ],
        "Affiliation" => [
            ["name" => "GFZ German Research Centre for Geosciences", "rorId" => "04z8jg394"],
            ["name" => "Department of Earth Sciences, Memphis Center for Earthquake Research and Information, University of Memphis", "rorId" => "05dyx6314"],
            ["name" => "University of Applied Sciences Potsdam", "rorId" => "012m9bp23"]
        ],
        "Title" => [
            ["text" => "Acoustic Emission and Seismic moment tensor catalogs associated with triaxial stick-slip experiments performed on Westerly Granite samples", "Title_Type_fk" => 1, "Resource_resource_id" => 1],
            ["text" => "A decade of short-period earthquake rupture histories from multi-array back-projection", "Title_Type_fk" => 1, "Resource_resource_id" => 2],
            ["text" => "Long-term CO2 and CH4 flux measurements and associated environmental variables from a rewetted peatland", "Title_Type_fk" => 1, "Resource_resource_id" => 3]
        ],
        "Contact_Person" => [
            ["familyName" => "Grzegorz", "givenname" => "Kwiatek", "position" => "Arbeitsgruppenleiter", "email" => "Kwiatek.Grzegorz@gfz.de", "website" => "gfz.de"],
            ["familyName" => "Goebel", "givenname" => "Thomas", "position" => "Projektleiter", "email" => "Thomas.Goebel@tu-berlin.de", "website" => "www.tu.berlin"],
            ["familyName" => "Wille", "givenname" => "Christian", "position" => "Abteilungsleiter", "email" => "Christian.Wille@fh-potsdam.de", "website" => "fh-potsdam.de"]
        ],
        "Originating_Laboratory" => [
            ["laboratoryname" => "Lab 1", "labId" => "123456789c7caa2d763b647d476b2910"],
            ["laboratoryname" => "Lab 2", "labId" => "9cd562c216daa82792972a01234567"],
            ["laboratoryname" => "Lab 3", "labId" => "abc1234567890"]
        ],
        "Contributor_Person" => [
            ["familyName" => "Müller", "givenname" => "Anna", "orcid" => "4100-4503-1076-415X"],
            ["familyName" => "Schmidt", "givenname" => "Johann", "orcid" => "4500-8523-8552-0861"],
            ["familyName" => "Fischer", "givenname" => "Lena", "orcid" => "7854-3000-5930-6527"]
        ],
        "Contributor_Institution" => [
            ["name" => "GFZ German Research Centre for Geosciences"],
            ["name" => "Department of Earth Sciences, Memphis Center for Earthquake Research and Information, University of Memphis"],
            ["name" => "University of Applied Sciences Potsdam"]
        ],
        "Description" => [
            ["type" => "Abstract", "description" => "This dataset contains element concentrations of six different hydrological compartments sampled on a daily basis over the course of one year in two neighboured first order headwater catchments located in the Conventwald (Black Forest, Germany). Critical Zone water compartments include above-canopy precipitation (bulk precipitation including rainwater, snow and fog water), below-canopy precipitation (throughfall), subsurface flow from three distinct soil layers (organic layer, upper mineral soil, deep mineral soil), groundwater, creek water and spring water. Element concentrations include major elements (Ca, K, Mg, Na, Si, S), trace elements (Al, Ba, Cr, Cu, Fe, Li, Mn, P, Sr, Zn), anion (Cl), and dissolved organic elements (DOC, DON).\The data were used to explore concentration (C) - discharge (Q) relationships and to calculate short-term element-specific chemical weathering fluxes, which were compared with previously published long-term element-specific chemical weathering fluxes. The ratio of both weathering fluxes, described by the so-called “Dissolved Export Efficiency” (DEE) metric revealed deficits in the stream dissolved load. These deficits were attributed to colloid-bound export and either storage in re-growing forest biomass or export in biogenic particulate form.\Tables supplementary to the article, including data quality control, are provided in .pdf and .xlsx formats. In addition, data measured in the course of the study are also provided as machine readable ASCII files.", "resource_id" => 1],
            ["type" => "Methods", "description" => "The field campaign and subsequent findings are derived from UAV data collected between July 27th and August 5th, 2016. We used lightweight cameras mounted on a modified DJI Matrice 100 quadcopter drone, allowing flight durations of over 30 min and simultaneous use of optical and thermal cameras. Flight control was based on GPS, with live video feed to the operator and predefined flight paths. Overflights were conducted at different times to optimize image quality: daylight flights at 5:00 local time for optimal contrast for the optical camera, and cold night flights at 3:00 local time for the infrared camera. Altitudes were 120 meters above ground to ensure comprehensive image coverage. The optical camera, a DJI Zenmuse X5R, captured 16-megapixel images at 2 frames per second, with each image geotagged by GPS. The thermal camera, a FLIR Tau 2, had a fully radiometric resolution of 640 × 512 pixels and a spectral band of 7.5-13.5 μm, with GPS geotagging for each image.", "resource_id" => 1],
            ["type" => "Other", "description" => "Orbital products describe positions and velocities of satellites, be it the Global Navigation Satellite System (GNSS) satellites or Low Earth Orbiter (LEO) satellites. These orbital products can be divided into the fastest available ones, the Near Realtime Orbits (NRT), which are mostly available within 15 to 60 minutes delay, followed by Rapid Science Orbit (RSO) products with a latency of two days and finally the Precise Science Orbit (PSO) which, with a latency of up to a few weeks, are the most delayed. The absolute positional accuracy increases with the time delay.", "resource_id" => 1],
            ["type" => "Abstract", "description" => "The model named EHFM_Earth_7200 was derived by layer-based forward modeling technique in ellipsoidal harmonics, the maximum degree of this model reaches 7200. The relief information was provided by Earth2014 relief model. EHFM_Earth_7200 provides very detailed (~3 km) information for the Earth’s short-scale gravity field, and it is expected to be able to augment or refine existing global gravity models. To meet the existing standard, here we provide spherical harmonic coefficients, which are transformed from original ellipsoidal harmonic coefficients. The maximum degree of the spherical harmonic coefficients is 7300.", "resource_id" => 2],
            [
                "type" => "Methods",
                "description" => "- Compute global equiangular reduced latitude grids from degree 10800 Earth2014 SHCs and expanded these grids into EHCs. The grids are band-limited in spherical harmonics instead of in ellipsoidal harmonics so extra degrees beyond the truncation degree are also calculated. We obtained surface EHCs up to degree and order (d/o) 11000 but truncated them to d/o 7200.
                - Calculate potential models of three layers (crust, water and ice) separately from Earth2014 reliefs by new developed ellipsoidal harmonic forward modeling formulas. The densities of the three layers are 2670, 1030, and 917 kg/m^3.
                - Sum up results from the three layers and obtain EHFM_Earth_7200 ellipsoidal harmonic coefficients.
                - Convert ellipsoidal harmonic coefficients to spherical harmonic coefficients. The maximum degree of the spherical harmonic coefficients is 7300.",
                "resource_id" => 2
            ],
            ["type" => "Abstract", "description" => "Global database of  >20, 000 geochemical analyses of Neogene-Quaternary intraplate volcanic rocks. The database collates major, trace element and Sr-Nd-Pb isotopic data for whole-rock samples <20 Ma old that were published between 1990 and 2020. Database as published in Ball et al. (2021).", "resource_id" => 3],
            ["type" => "Other", "description" => "The DIGIS geochemical data repository is a research data repository in the Earth Sciences domain with a specific focus on geochemical data. It is hosted at GFZ Data Services through a collaboration between the Digital Geochemical Data Infrastructure (DIGIS) for GEOROC 2.0 (https://digis.geo.uni-goettingen.de) and the GFZ German Research Centre for Geosciences. The repository archives, publishes and makes accessible user-contributed, peer-reviewed research data that fall within the scope of the GEOROC database. Compilations of previously published data are also made available on the GEOROC website (https://georoc.eu) as Expert Datasets.", "resource_id" => 3]
        ],
        "Thesaurus_Keywords" => [
            ["keyword" => "Science Keywords > EARTH SCIENCE > OCEANS > SEA ICE > SEA ICE VOLUME", "scheme" => "NASA/GCMD Earth Science Keywords", "schemeUri" => "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords", "valueURI" => "https://gcmd.earthdata.nasa.gov/kms/concept/32929f40-ee7f-411d-8d2d-1d2cd9b78b09", "language" => "en"],
            ["keyword" => "Instruments > Solar/Space Observing Instruments > Particle Detectors > HYDRA", "scheme" => "NASA/GCMD Instruments", "schemeUri" => "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments", "valueURI" => "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments", "language" => "en"],
            ["keyword" => "Platforms > Land-based Platforms > Field Sites > Ice Shelf", "scheme" => "NASA/GCMD Earth Platforms Keywords", "schemeUri" => "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms", "valueURI" => "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms", "language" => "en"],
            ["keyword" => "Phanerozoic > Cenozoic > Neogene > Pliocene > Zanclean", "scheme" => "Chronostratigraphic Chart", "schemeUri" => "https://stratigraphy.org", "valueUri" => "http://resource.geosciml.org/classifier/ics/ischart/Zanclean", "language" => "en"],
            ["keyword" => "compound material > breccia", "scheme" => "CGI Simple Lithology", "schemeUri" => "https://geosciml.org/resource/vocabulary/cgi/2016/simplelithology", "valueUri" => "http://resource.geosciml.org/classifier/cgi/lithology/breccia", "language" => "en"],
            ["keyword" => "GEMET Concepts > hydrosphere > water (geographic) > surface water > freshwater > ice", "scheme" => "GEMET - Concepts, version 4.2.3", "schemeUri" => "http://www.eionet.europa.eu/gemet/gemetThesaurus", "valueUri" => "http://www.eionet.europa.eu/gemet/concept/4131", "language" => "en"]
        ],
        "Free_Keywords" => [
            ["free_keyword" => "Acoustic Emission", "isCurated" => "1"],
            ["free_keyword" => "CO2 flux measurements", "isCurated" => "1"],
            ["free_keyword" => "CH4 flux measurements", "isCurated" => "1"],
            ["free_keyword" => "Eruption", "isCurated" => "1"],
            ["free_keyword" => "Seismic tremor", "isCurated" => "1"],
            ["free_keyword" => "ATP", "isCurated" => "1"],
            ["free_keyword" => "Adenosine triphosphate", "isCurated" => "1"],
            ["free_keyword" => "ADP", "isCurated" => "1"],
            ["free_keyword" => "Adenosine diphosphate", "isCurated" => "1"],
            ["free_keyword" => "AMP", "isCurated" => "1"],
            ["free_keyword" => "Adenosine monophosphate", "isCurated" => "1"],
            ["free_keyword" => "In-situ Raman spectroscopy", "isCurated" => "1"],
            ["free_keyword" => "Autoclave, Hydrothermal diamond anvil cell", "isCurated" => "1"],
            ["free_keyword" => "HDAC", "isCurated" => "1"],
            ["free_keyword" => "Hydrolysis", "isCurated" => "1"],
            ["free_keyword" => "ASHEE model", "isCurated" => "1"],
            ["free_keyword" => "Conduit dynamic", "isCurated" => "1"],
            ["free_keyword" => "Eperimental volcanology", "isCurated" => "1"],
            ["free_keyword" => "EPOS", "isCurated" => "1"],
            ["free_keyword" => "Multi-scale laboratories", "isCurated" => "1"],
            ["free_keyword" => "Rock and melt physical properties", "isCurated" => "1"],
            ["free_keyword" => "CH5 flux measurements", "isCurated" => "0"],
        ],
        "Spatial_Temporal_Coverage" => [
            ["latitudeMin" => "53.773072687072634", "latitudeMax" => "56.19295930435612", "longitudeMin" => "49.417527009637524", "longitudeMax" => "57.503464509637524", "description" => "Ein großes Sedimentbecken in Westaustralien, das reich an fossilen Brennstoffen und bedeutenden Erdöl- und Erdgasvorkommen ist.", "dateStart" => "2024-06-03", "dateEnd" => "2024-06-03", "timeStart" => "", "timeEnd" => "", "timezone" => "+00:00"],
            ["latitudeMin" => "7.357546774322249", "latitudeMax" => "8.836749074314008", "longitudeMin" => "-70.8163484389335", "longitudeMax" => "-69.4979890639335", "description" => "Eine geologisch aktive Region in den Alpen, geprägt durch die Kollision der eurasischen und afrikanischen Kontinentalplatten, die zur Bildung hoher Gebirgsketten führt.", "dateStart" => "2000-07-23", "dateEnd" => "2024-06-03", "timeStart" => "12:13", "timeEnd" => "12:22:55", "timezone" => "+05:00"],
            ["latitudeMin" => "26.40875141688829", "latitudeMax" => "56.19295930435612", "longitudeMin" => "14.852995116766325", "longitudeMax" => "18.566374023016326", "description" => " Ein aktives vulkanisches Gebiet in Island, bekannt für seine regelmäßigen Ausbrüche, Lavafelder und geothermischen Aktivitäten.", "dateStart" => "2024-06-10", "dateEnd" => "2024-06-03", "timeStart" => "", "timeEnd" => "", "timezone" => "+02:00"]
        ],
        "Related_Work" => [
            ["Identifier" => "10.1016/j.epsl.2011.11.037", "relation_fk" => 6, "identifier_type_fk" => 1],
            ["Identifier" => "IECUR0097", "relation_fk" => 3, "identifier_type_fk" => 5],
            ["Identifier" => "978-3-905673-82-1", "relation_fk" => 4, "identifier_type_fk" => 2]
        ],
        "Funding_Reference" => [
            ["funder" => "Gordon and Betty Moore Foundation", "funderid" => "100000936", "funderidtyp" => "Crossref Funder ID", "grantnumber" => "GBMF3859.01", "grantname" => "Socioenvironmental Monitoring of the Amazon Basin and Xingu"],
            ["funder" => "Ford Foundation", "funderid" => "100000016", "funderidtyp" => "Crossref Funder ID", "grantnumber" => "GBMF3859.11", "grantname" => "Grants database"],
            ["funder" => "U.S. Department of Defense", "funderid" => "100000005", "funderidtyp" => "Crossref Funder ID", "grantnumber" => "GBMF3859.22", "grantname" => "Grantmaking at a glance"]
        ],
    ];

    foreach ($mainTableData as $tableName => $data) {
        $columns = implode(", ", array_keys($data[0]));
        $placeholders = implode(", ", array_fill(0, count($data[0]), "?"));
        $sqlInsert = "INSERT INTO $tableName ($columns) VALUES ($placeholders)";
        $stmt = $connection->prepare($sqlInsert);

        foreach ($data as $row) {
            $values = array_values($row);
            $stmt->bind_param(str_repeat("s", count($values)), ...$values);
            $stmt->execute();
        }
    }

    $helpTableData = [
        "Resource_has_Author" => [
            ["Resource_resource_id" => 3, "Author_author_id" => 1],
            ["Resource_resource_id" => 2, "Author_author_id" => 3],
            ["Resource_resource_id" => 1, "Author_author_id" => 2]
        ],
        "Author_has_Affiliation" => [
            ["Author_author_id" => 1, "Affiliation_affiliation_id" => 2],
            ["Author_author_id" => 2, "Affiliation_affiliation_id" => 1],
            ["Author_author_id" => 3, "Affiliation_affiliation_id" => 3]
        ],
        "Contact_Person_has_Affiliation" => [
            ["Contact_Person_contact_person_id" => 1, "Affiliation_affiliation_id" => 2],
            ["Contact_Person_contact_person_id" => 2, "Affiliation_affiliation_id" => 1],
            ["Contact_Person_contact_person_id" => 3, "Affiliation_affiliation_id" => 3]
        ],
        "Resource_has_Contact_Person" => [
            ["Resource_resource_id" => 3, "Contact_Person_contact_person_id" => 1],
            ["Resource_resource_id" => 2, "Contact_Person_contact_person_id" => 3],
            ["Resource_resource_id" => 1, "Contact_Person_contact_person_id" => 2]
        ],
        "Contributor_Person_has_Role" => [
            ["Role_role_id" => 3, "Contributor_Person_contributor_person_id" => 1],
            ["Role_role_id" => 2, "Contributor_Person_contributor_person_id" => 3],
            ["Role_role_id" => 1, "Contributor_Person_contributor_person_id" => 2]
        ],
        "Contributor_Person_has_Affiliation" => [
            ["Affiliation_affiliation_id" => 3, "Contributor_Person_contributor_person_id" => 1],
            ["Affiliation_affiliation_id" => 2, "Contributor_Person_contributor_person_id" => 3],
            ["Affiliation_affiliation_id" => 1, "Contributor_Person_contributor_person_id" => 2]
        ],
        "Resource_has_Contributor_Person" => [
            ["Resource_resource_id" => 3, "Contributor_Person_contributor_person_id" => 1],
            ["Resource_resource_id" => 2, "Contributor_Person_contributor_person_id" => 3],
            ["Resource_resource_id" => 1, "Contributor_Person_contributor_person_id" => 2]
        ],
        "Contributor_Institution_has_Role" => [
            ["Role_role_id" => 3, "Contributor_Institution_contributor_institution_id" => 1],
            ["Role_role_id" => 2, "Contributor_Institution_contributor_institution_id" => 3],
            ["Role_role_id" => 1, "Contributor_Institution_contributor_institution_id" => 2]
        ],
        "Contributor_Institution_has_Affiliation" => [
            ["Affiliation_affiliation_id" => 3, "Contributor_Institution_contributor_institution_id" => 1],
            ["Affiliation_affiliation_id" => 2, "Contributor_Institution_contributor_institution_id" => 3],
            ["Affiliation_affiliation_id" => 1, "Contributor_Institution_contributor_institution_id" => 2]
        ],
        "Resource_has_Contributor_Institution" => [
            ["Resource_resource_id" => 3, "Contributor_Institution_contributor_institution_id" => 1],
            ["Resource_resource_id" => 2, "Contributor_Institution_contributor_institution_id" => 3],
            ["Resource_resource_id" => 1, "Contributor_Institution_contributor_institution_id" => 2]
        ],
        "Resource_has_Spatial_Temporal_Coverage" => [
            ["Resource_resource_id" => 3, "Spatial_Temporal_Coverage_spatial_temporal_coverage_id" => 1],
            ["Resource_resource_id" => 2, "Spatial_Temporal_Coverage_spatial_temporal_coverage_id" => 3],
            ["Resource_resource_id" => 1, "Spatial_Temporal_Coverage_spatial_temporal_coverage_id" => 2]
        ],
        "Resource_has_Related_Work" => [
            ["Resource_resource_id" => 3, "Related_Work_related_work_id" => 1],
            ["Resource_resource_id" => 2, "Related_Work_related_work_id" => 3],
            ["Resource_resource_id" => 1, "Related_Work_related_work_id" => 2]
        ],
        "Resource_has_Funding_Reference" => [
            ["Resource_resource_id" => 3, "Funding_Reference_funding_reference_id" => 1],
            ["Resource_resource_id" => 2, "Funding_Reference_funding_reference_id" => 3],
            ["Resource_resource_id" => 1, "Funding_Reference_funding_reference_id" => 2]
        ],
        "Resource_has_Thesaurus_Keywords" => [
            ["Resource_resource_id" => 3, "Thesaurus_Keywords_thesaurus_keywords_id" => 1],
            ["Resource_resource_id" => 2, "Thesaurus_Keywords_thesaurus_keywords_id" => 2],
            ["Resource_resource_id" => 1, "Thesaurus_Keywords_thesaurus_keywords_id" => 3],
            ["Resource_resource_id" => 1, "Thesaurus_Keywords_thesaurus_keywords_id" => 4],
            ["Resource_resource_id" => 1, "Thesaurus_Keywords_thesaurus_keywords_id" => 5],
            ["Resource_resource_id" => 1, "Thesaurus_Keywords_thesaurus_keywords_id" => 6]
        ],
        "Resource_has_Free_Keywords" => [
            ["Resource_resource_id" => 3, "Free_Keywords_free_keywords_id" => 1],
            ["Resource_resource_id" => 2, "Free_Keywords_free_keywords_id" => 2],
            ["Resource_resource_id" => 1, "Free_Keywords_free_keywords_id" => 3]
        ],
        "Originating_Laboratory_has_Affiliation" => [
            ["Affiliation_affiliation_id" => 2, "Originating_Laboratory_originating_laboratory_id" => 1],
            ["Affiliation_affiliation_id" => 2, "Originating_Laboratory_originating_laboratory_id" => 1],
            ["Affiliation_affiliation_id" => 3, "Originating_Laboratory_originating_laboratory_id" => 2]
        ],
        "Resource_has_Originating_Laboratory" => [
            ["Resource_resource_id" => 3, "originating_laboratory_originating_laboratory_id" => 1],
            ["Resource_resource_id" => 2, "originating_laboratory_originating_laboratory_id" => 3],
            ["Resource_resource_id" => 1, "originating_laboratory_originating_laboratory_id" => 2]
        ],
    ];

    foreach ($helpTableData as $tableName => $data) {
        $columns = implode(", ", array_keys($data[0]));
        $placeholders = implode(", ", array_fill(0, count($data[0]), "?"));
        $sqlInsert = "INSERT INTO $tableName ($columns) VALUES ($placeholders)";
        $stmt = $connection->prepare($sqlInsert);

        foreach ($data as $row) {
            $values = array_values($row);
            $stmt->bind_param(str_repeat("i", count($values)), ...$values);
            $stmt->execute();
        }
    }
}

/**
 * Processes the installation step by step and sends progress updates
 *
 * @param mysqli $connection The database connection object
 * @param string $action The installation type (basic/complete)
 * @return array Installation status and progress information
 */
function processInstallation($connection, $action)
{
    try {
        // Step 1: Drop existing tables
        dropTables($connection);

        // Step 2: Create structure
        $structureResult = createDatabaseStructure($connection);
        if ($structureResult['status'] === 'error') {
            return $structureResult;
        }

        // Step 3: Insert lookup data
        insertLookupData($connection);

        // Step 4: Insert test data if requested
        if ($action === 'complete') {
            insertTestResourceData($connection);
            return [
                'status' => 'success',
                'message' => 'Database installed successfully with all test data. Please do not forget to delete the files install.php and install.html now!',
                'progress' => 100
            ];
        }

        return [
            'status' => 'success',
            'message' => 'Database installed successfully with required data. Please do not forget to delete the files install.php and install.html now!',
            'progress' => 100
        ];

    } catch (Exception $e) {
        return [
            'status' => 'error',
            'message' => 'Installation failed: ' . $e->getMessage(),
            'progress' => 0
        ];
    }
}

// Handle AJAX requests
if (isset($_POST['action'])) {
    header('Content-Type: application/json');
    $result = processInstallation($connection, $_POST['action']);
    echo json_encode($result);
    exit;
}