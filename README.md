![PHP 8.4](https://img.shields.io/badge/php-8.4-blue?logo=php)
![MySQL 8.4](https://img.shields.io/badge/mysql-8.4-orange?logo=mysql&logoColor=white)
![jQuery 3.7](https://img.shields.io/badge/jquery-3.7-0769ad?logo=jquery)
![Bootstrap 5.3](https://img.shields.io/badge/bootstrap-5.3-563d7c?logo=bootstrap)
![OpenAPI 3.1](https://img.shields.io/badge/openapi-3.1-6BA539?logo=openapiinitiative)
![Coverage](https://github.com/McNamara84/ELMO-Enhanced-Laboratory-Metadata-Optimizer/blob/image-data/coverage.svg?raw=true)
![JS Coverage](https://github.com/McNamara84/ELMO-Enhanced-Laboratory-Metadata-Optimizer/blob/image-data-js/js-coverage.svg?raw=true)

# ELMO - Enhanced Laboratory Metadata Organizer

The Enhanced Laboratory Metadata Organizer (ELMO) is based on a student cooperation project between the [University of Applied Sciences Potsdam](https://fh-potsdam.de) and the [GeoForschungsZentrum Potsdam](https://gfz.de). The editor saves metadata for research datasets in valid XML files according to the DataCite, ISO and DIF schema.

## Table of contents
  - [Main Features](#main-features)
  - [Installation](#installation)
    - [Requirements](#requirements)
    - [Quick installation guide](#quick-installation-guide)
    - [Detailed example installation on Windows 10/11](#detailed-example-installation-on-windows-1011)
  - [Dependencies](#dependencies)
  - [Settings](#settings)
  - [API-Dokumentation](#api-dokumentation)
    - [Allgemeine Informationen](#allgemeine-informationen)
    - [API-Endpunkte](#api-endpunkte)
  - [Formularfelder](#formularfelder)
  - [Data validation](#data-validation)
  - [Data Mapping and Occurences](#data-mapping-and-occurences)
  - [Database structure](#database-structure)
  - [Contributing](#contributing)
  - [Testing](#testing)

## Main Features
- Simple mapping of entered data using XSLT.
- Modular, customizable front end.
- Multilingualism through the use of language files. Add your own language file and ELMO will detect it automatically.
- Always up-to-date controlled vocabularies through regular automatic updates.
- Easy input of authors and contributors using ORCID preload.
- Submitting of metadata directly to data curators.
- Authors can be sorted by drag & drop and marked as contact person with a toggle switch button.
- Submission of data descriptions files and link to data is possible.
- Optional input fields with form groups that can be hidden.

## Installation

### Requirements

The installation of ELMO is possible on operating systems such as recent Windows versions (e.g. Windows 10/11) and the most common Linux distributions (e.g. Ubuntu, Debian).
Following conditions are required for installation:
- PHP ≥ 8.2 and ≤ 8.4
	- incl. a webserver able to perform PHP operations (such as Apache or Nginx)
	- extensions needed: XSL, ZIP
- MySQL (for further requirements, see: [MySQL Documentation](https://dev.mysql.com/doc/refman/8.0/en/installing-and-configuration.html)) or MariaDB

### Quick installation guide

1. Ensure a development environment with PHP >8.2 and a MySQL or MariaDB server.
2. The XSL and ZIP extensions for PHP must be installed and enabled.
3. Don't forget to start Apache and MySQL.
4. Create a new empty sql database in (e.g. using phpMyAdmin) and copy the name of the database.
5. Copy the content of the file `sample_helper_functions.php` into a new file `helper_functions.php` and adjust the settings for the database connection.
6. For the automatically generated time zone selection, create a free API key at [timezonedb.com](https://timezonedb.com/) and enter it into the newly created `helper_functions.php`.
7. Create a Google Maps JS API key and paste it into the `helper_functions.php` file as well.
8. Copy all files from this repository into the `htdocs` or `www` folder of your web server.
9. In this folder run `npm install` via bash.
10. There you run `composer install`. 
11. Access `install.html` via the browser and choose to install with or without test datasets. The database tables will be created in your database, as well as 3 test datasets, if you chose that first option.
12. Delete `install.php` and `install.html` after successfully creating the database.
13. The metadata editor is now accessible in the browser via `localhost/directoryname`.
14. Adjust settings in `helper_functions.php` (see [Settings Section](#einstellungen)).

### Installation via Docker
1. Install [Docker](https://docs.docker.com/engine/install/).
2. Clone the repository.
3. Run `docker compose build` in the cloned project folder via bash.
4. Run `docker compose up -d` to start the container.
5. This directory contains .env_sample that you will need to rename to .env. Please feel free to change the credentials in it.
	Please mind that: 
	- Environment variables for database setup only apply on first container startup. If volumes persist, old configs stay alive.
	- Use `docker-compose down -v` to reset the database when updating credentials.
6. Docker Environment Setup 🐳

This section outlines the automatic processes handled by the Docker environment for ELMO. While not strictly necessary for basic usage, understanding these steps is crucial for modifying behavior or troubleshooting.

**1. `docker-compose.yaml`**
- Configures and orchestrates two primary services:
  - `db`: Built from a MariaDB image.
  - `web`: Built from the `Dockerfile`.

**2. `Dockerfile`** 
- **Base Image:** Installs `php 8.4-apache` and essential dependencies, including the database client.
- **Project Copy:** Copies the entire project directory into the container's root (`/var/www/html`), setting appropriate ownership for the standard Apache user (`www-data`). I fyou don't want something to be copied into container, include it into .dockerignore (performance might be affected)
- **Entrypoint:** Executes the `docker-entrypoint.sh` script.

**3. `docker-entrypoint.sh`** 
- **Database Setup:** Responsible for initializing the database structure by running `install.php`.
- **Idempotency:** Utilizes a `FLAG_FILE` to ensure the database setup runs only once. If this file exists, the installation process is skipped.
- **Installation Options for `install.php`:**
  - `basic` (default): Creates only the database structure and inserts lookup data.
  - `complete`: Creates the database structure, inserts lookup data, *and* populates the database with exemplar (test) data. This is controlled by the `INSTALL_ACTION` environment variable (e.g., `INSTALL_ACTION=complete`).

---

**Important Notes for Developers:**

* **Full Reset for Dockerfile/Entrypoint Changes:**
    To apply changes made to `Dockerfile` or `docker-entrypoint.sh`, a full reset of the Docker containers is required:
    ```bash
    docker-compose down -v
    docker-compose build --no-cache
    ```
* **Applying Other Changes:**
    For changes to project files (which are copied, not mounted as volumes), you need to rebuild the service:
    ```bash
    docker-compose up --build
    ```
    This rebuilds the `web` service (and any other services specified in `docker-compose.yaml` that depend on the build context), ensuring your updated project files are included in the new container image.


If you encounter problems with the installation, feel free to leave an entry in the feedback form or in [our issue board on GitHub](https://github.com/McNamara84/gfz-metadata-editor-msl-v2/issues)!

<details> 
  <summary> 

  ## Installation
  </summary>

  ### Requirements

  The installation of ELMO is possible on operating systems such as recent Windows versions (e.g. Windows 10/11) and the most common Linux distributions (e.g. Ubuntu, Debian).
  Following conditions are required for installation:
  - PHP ≥ 8.2 and ≤ 8.4
    - incl. a webserver able to perform PHP operations (such as Apache or Nginx)
    - extensions needed: XSL, ZIP
  - MySQL (for further requirements, see: [MySQL Documentation](https://dev.mysql.com/doc/refman/8.0/en/installing-and-configuration.html)) or MariaDB

  ### Quick installation guide

  1. Ensure a development environment with PHP >8.2 and a MySQL or MariaDB server.
  2. The XSL and ZIP extensions for PHP must be installed and enabled.
  3. Don't forget to start Apache and MySQL.
  4. Create a new empty sql database in (e.g. using phpMyAdmin) and copy the name of the database.
  5. Copy the content of the file `sample_helper_functions.php` into a new file `helper_functions.php` and adjust the settings for the database connection.
  6. For the automatically generated time zone selection, create a free API key at [timezonedb.com](https://timezonedb.com/) and enter it into the newly created `helper_functions.php`.
  7. Create a Google Maps JS API key and paste it into the `helper_functions.php` file as well.
  8. Copy all files from this repository into the `htdocs` or `www` folder of your web server.
  9. Access `install.php` via the browser. The database tables will be created automatically in your database.
  10. The metadata editor is now accessible in the browser via `localhost/directoryname`.
  11. Adjust settings in `helper_functions.php` (see [Settings Section](#einstellungen)).

  If you encounter problems with the installation, feel free to leave an entry in the feedback form or in [our issue board on GitHub](https://github.com/McNamara84/gfz-metadata-editor-msl-v2/issues)!
  
  <details>
  <summary>

  ### Detailed example installation on Windows 10/11
  </summary>

  This section will further explain the installation of the metadata editor with the help of a more detailed step-by-step guide on how to install the metadata editor on Windows 10/11 using PHP and MySQL. For a local development environment, localhost-based access to the server is usually sufficient.
  #### 1. Setting up the development environment
  - Download and run the installer from the official [PHP website](https://www.php.net/downloads.php) (PHP > 8.2).
  - Install [MySQL](https://dev.mysql.com/downloads/installer/) or MariaDB.
  - Install and enable the XSL and ZIP extensions for PHP. In order to do that, open the `php.ini` file and uncomment the line for the required extensions.
  #### 2. Starting Apache and MySQL
  - If you're using an all-in-one solutions such as XAMPP or WampServer, you can start Apache directly from the XAMPP or WampServer control panel.
  - Alternatively, you can manually start Apache by navigating to the `bin` directory of Apache (e.g., `C:\xampp\apache\bin`) and running `httpd.exe`.
  #### 3. Creating an empty SQL database
  - Using phpMyAdmin: If you're using XAMPP or WampServer, phpMyAdmin is already installed. You can access it by going to `http://localhost/phpmyadmin` in your browser.
  - Create a new database and remember the name of it, as you'll need it later in the next step.
  - Alternatively, using the Windows PowerShell: 
    - Start MySQL in the Shell while being in your SQL directory: `mysql -u root -p`
    - Create a database: `CREATE DATABASE your_database;`
    - Create a new MySQL-user for the installation: `CREATE USER 'username'@'localhost' IDENTIFIED BY 'password';`
    - Granting rights to this user: `GRANT CREATE ON your_database.* TO 'username'@'localhost';` and save with `FLUSH PRIVILEGES;`
    - Optional: confirm the creation of the database while being logged in as the new user: `SHOW DATABASES;`
  #### 4. Setting up the `helper_functions.php` file
  - Download all files from this repository into the `htdocs`or`www`folder of your webserver.
  - Create `helper_functions.php`:
     - Copy the entire contents of `sample_helper_functions.php` which is located in the first level of the ELMO repository and save it as `helper_functions.php` in the same directory.
  - Adjust the database connection:
    - Open the `helper_functions.php` file with a text editor and modify the database connection settings according to your database name, user, password and host. The default MySQL user ist 'root'. Change this to the MySQL-user you just created in step 3. The host value typically remains as 'localhost'.
  #### 5. Setting up the application
  - Access the installation script in your browser as follows: `http://localhost/your_directory/install.html`. This script will automatically create the required tables in the database you specified in step 3. In addition, three test datasets are installed through `install.html` if you chose this option.
  #### 6. Delete installation files
  - Please delete `install.php` and `install.html` after successfully creating the database.
  #### 7. (Optional) Creating an API key for the automatically generated time zone selection
  - Sign up for a free API key at [timezonedb.com](https://timezonedb.com/). After registration, you should receive an email with your account data including your API key.
  - Insert your API key in `helper_functions.php`in the according line.
  #### 8. Creating a Google Maps JS API key
  - Get a Google Maps JS API key via the [Google Cloud Console](https://console.cloud.google.com). To do this, create a project, enable the Google Maps JavaScript API and get your API key.
  - Insert your Google Maps API key in the corresponding line in the `helper_functions.php`file. 
  #### 9. Accessing the metadata editor
  - After the installation is complete, you should be able to access the metadata editor in your browser at `http://localhost/your_directory`.
  - Settings may be modified in `helper_functions.php`.
  </details>
</details> 

<details>
  <summary>

  ## Dependencies
  </summary>
Dependencies can be installed using the following terminal commands:
	1. `composer install`
	2. `npm install`
Prequisite for that is composer. If you don't have it consider brew install composer or other options

The following third-party dependencies are included in header.php and footer.html:

- [Bootstrap 5](https://github.com/twbs/bootstrap/releases)<br>
  For the design, responsiveness and dark mode.
- [Bootstrap Icons 1](https://github.com/twbs/icons/releases)<br>
  For the icons used.
- [jQuery 3](https://github.com/jquery/jquery/releases)<br>
  For the event handlers in JavaScript and to simplify the JavaScript code.
- [jQuery UI 1](https://github.com/jquery/jquery-ui/releases)<br>
  Extends jQuery with the autocomplete function that we currently use for the affiliation fields.
- [Tagify 4](https://github.com/yairEO/tagify/releases)<br>
  Is used for the Thesaurus Keywords field, the entry of multiple affiliations and free keywords.
- [jsTree 3](https://github.com/vakata/jstree/releases)<br>
  Is used to display the thesauri as a hierarchical tree structure.
- [Swagger UI 5](https://github.com/swagger-api/swagger-ui/releases)<br>
  For displaying the dynamic and interactive API documentation in accordance with OpenAPI standard 3.1.

To install them: npm install
</details>

<details>
  <summary>

  ## Settings
  </summary>

  In addition to the access data for the database, other settings can also be adjusted in the `helper_functions.php` file:

  - `$host`: Database host.
  - `$username`: Username of the user with access to the given database.
  - `$password`: Password of database user.
  - `$database`: Name of the database created.
  - `$maxTitles`: Defines the maximum number of titles that users can enter in the editor.
  - `$apiKeyElmo`: A self-defined security key to connect cron jobs with api calls to `/update/` for refreshing the vocabularies.
  - `$mslLabsUrl`: URL to the JSON file with the current list of laboratories.
  - `$showFeedbackLink`: true-> feedback function switched on, false-> feedback function switched off
  - `$smtpHost`: URL to the SMTP mail server
  - `$smtpPort`: Port of the mail server
  - `$smtpUser`: User name of the mailbox for sending the mails
  - `$smtpPassword`: Password of the mailbox
  - `$smtpSender`: Name of the sender in the feedback mails
  - `$feedbackAddress`: Email Address to which the feedback is sent
  - `$xmlSubmitAddress`: Email Address to which the finished XML file is sent. When deploying the three frontend variants via `docker-compose.prod.yml`, configure this via the environment variables `XML_SUBMIT_ADDRESS`, `XML_SUBMIT_ADDRESS_MSL`, and `XML_SUBMIT_ADDRESS_GEM` for the standard, MSL, and GEM variants respectively.
  - `$showContributorPersons`: Specifies whether the form group Contributor Persons should be displayed (true/false).
  - `$showContributorInstitutions`: Specifies whether the form group Contributor Institutions should be displayed (true/false).
  - `$showMslLabs`: Specifies whether the form group Originating Laboratory should be displayed (true/false).
  - `$showMslVocabs`: Specifies whether the form group EPOS Multi-Scale Laboratories Keywords should be displayed (true/false).
  - `$showGcmdThesauri`: Specifies whether the form group GCMD Thesauri should be displayed (true/false).
  - `$showFreeKeywords`: Specifies whether the form group Free Keywords should be displayed (true/false).
  - `$showSpatialTemporalCoverage`: Specifies whether the form group Spatial and Temporal Coverages should be displayed (true/false).
  - `$showRelatedWork`: Specifies whether the form group Related Work should be displayed (true/false).
  - `$showFundingReference`: Specifies whether the form group Funding Reference should be displayed (true/false).
  - `$showGGMsProperties`: specific for implementation for the ICGEM platform. Specifies whether ICGEM form groups (GGMs Properties and Characteristics of the model) should be displayed (true/false).

</details>

## [API documentation](https://elmo.cats4future.de/api/v2/docs/index.html)


<details>
  <summary>

  ## Formularfelder
  </summary>

### Resource Information

- DOI <a href="https://www.doi.org/" target="_blank" rel="noopener"><img src="logos/doi.logo.svg" alt="DOI Logo" style="height:15px; vertical-align:9px; margin-left:-1px;"></a>

  This field contains the DOI (Digital Object Identifier) that identifies the resource.
  - Data type: String
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: `doi` in the table `Resource`
  - Restrictions: Must be in “prefix/suffix” format
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/identifier/)
  - Example values: `10.5880/GFZ.3.1.2024.002`, `10.5880/pik.2024.001`
  - Mapping: is mapped to `<identifier>` in the DataCite scheme and to `<gmd:fileIdentifier>` as well as `<gmd:identifier> <gmd:MD_Identifier> <gmd:code>` and `<gmd:distributionInfo> <gmd:MD_Distribution> <gmd:transferOptions> <gmd:MD_DigitalTransferOptions> <gmd:onLine> <gmd:CI_OnlineResource>` in the ISO scheme

- Publication Year

    This field contains the publication year of the resource.
    - Data type: Year
    - Occurrence: 1
    - The corresponding field in the database where the value is saved is called: `year` in the table `year`
    - Restrictions: A year in four-digit format. Values allowed in four-digit format: 1901 to 2155 (due to data type YEAR)
    - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/publicationyear/#publicationyear)
    - Example values: `1998`, `2018`
    - Mapping: is mapped to `<publicationYear>` in the DataCite scheme


- Resource Type

  This field contains the type of resource.
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database where the value is saved is called: `resource_type_general` in the table `Resource_Type`
  - Restrictions: must be selected from [controlled list](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/resourceTypeGeneral/#resourcetypegeneral) 
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/resourcetype/#a-resourcetypegeneral)
  - Example values: `Dataset`, `Audiovisual`, `Book`
  - Mapping: mapped to `<resourceType resourceTypeGeneral="XX">` in the DataCite scheme

- Version

  This field contains the version number of the resource.
  - Data type: Float
  - Occurrence: 0-1
  - The corresponding field in the database where the value is saved is called: `version` in the table `Resource`
  - Restrictions: None 
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/version/)
  - Example values: `1.0` `2.1` `3.5`
  - Mapping: mapped to `<version>` in DataCite scheme

- Language of Dataset

  This field contains the language of the dataset
  - Data type: String
  - Occurence: 1
  - The corresponding field in the database where the value is saved is called: `name` in the table `Language`
  - Restrictions: must be selected from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/language/)
  - Beispielwerte: `Englisch`, `German`, `French`
  - Mapping: mapped to `<language>` element in DataCite scheme and to `<gmd:language>` in ISO scheme 

- Title

  This field contains the title of the resource.
  - Data type: String
  - Occurrence: 1-n, with n=$maxTitles specified in the helper_functions.php
  - The corresponding field in the database where the value is stored is called: `text` in the table `title`
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/title/)
  - Example values: `Drone based photogrammetry data at the Geysir`
  - Mapping: mapped to `<titles> <title>` in DataCite scheme and `<identificationInfo> <MD_DataIdentification> <citation> <CI_Citation> <title>` or `...<alternateTitle` depending on the title type

- Title Type

  This field contains the type of title (other than the main title).
  - Data type: String
  - Occurrence: 1, if the corresponding title is not the main title
  - The corresponding field in the database where the value is stored is called: `name` in the table `Title_Type`
  - Restrictions: must be selected from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/title/#a-titletype)
  - Example values: `Translated Title`
  - Mapping: mapped to `<title titleType="TranslatedTitle">` in the datacite scheme

### Licenses & Rights

- Rights Title

  The content of this field is mapped to `<rights>` in the DataCite scheme and to `<resourceConstraints> <gmd:MD_Constraints> <gmd:useLimitation>` as well as `<gmd:resourceConstraints> <gmd:MD_LegalConstraints>` in the ISO scheme.

  This field contains the title of the license with its abbreviation.
  - Data type: String
  - Occurrence: 1
  - The corresponding fields in the database where the value is stored is called: `text`and `rightsIdentifier` in the table `Rights`
  - Restrictions: Mandatory field. Must be selected from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/rights/)
  - Example value: `Creative Commons Attribution 4.0 International (CC-BY-4.0)`

- *Saved in backend (not visible to user):* rightsURI

  This field contains the URI of the License.
  - Data Type: String
  - Occurence: 1
  - The corresponding fields in the database where the value is stored is called: `rightsURI` in the table `Rights`
  - Restrictions: Mandatory field. Must be selected from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/rights/#a-rightsuri)
  - Example values: `https://creativecommons.org/licenses/by/4.0/legalcode`

- *Saved in backend (not visible to user):* forSoftware

  This field specifies if the license is used for software (forSoftware=1) or not (forSoftware=0). The controlled list changes for users based on this parameter when resource type Software is chosen.

### Author(s)
#### Author Persons
Author information mapped to `<creator>` element in the datacite scheme and to `<citedResponsibleParty>` in the ISO scheme.
Occurrence is: 1-n

- Last Name 

  This field contains the author's surname.
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database where the value is stored is called: `familyname` in the table `author`
  - Restrictions: mandatory field, only letters allowed
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/creator/#familyname)
  - Example values: `Jemison`, `Smith`

- First Name

  This field contains the author's first name.
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database where the value is stored is called: `givenname` in the table `author`
  - Restrictions: mandatory field, only letters allowed
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/creator/#givenname)
  - Example values: `Lisa`, `Elisa`

- Author ORCID <a href="https://orcid.org/" target="_blank" rel="noopener"><img src="logos/orcid.logo.png" alt="ORCID Logo" style="height:15px; vertical-align:9px; margin-left:-1px;"></a>

  This field contains the author's ORCID (Open Researcher and Contributor ID).
  - Data type: String
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: `orcid` in the table `author`
  - Restrictions: Must be in the format “xxxx-xxxx-xxxx-xxxx-xxxx”.
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/creator/#nameidentifier)
  - Example values: `0000-0001-5727-2427`, `0000-0003-4816-5915`

- Affiliation <a href="https://ror.org/" target="_blank" rel="noopener"><img src="logos/ror-logo.svg" alt="ROR Logo" style="height:10px; vertical-align:7px; margin-left:-1px;"></a>
 
  This field contains the author's affiliation.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database where the value is stored is called: `name` in the table `affiliation`
  - Restrictions: None, can be chosen from the dropdown menu or given as free text
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/creator/#affiliation)
  - Example values: `Technische Universität Berlin`, `Helmholtz Centre Potsdam - GFZ German Research Centre for Geosciences`

- *Saved in backend (not visible to user):* rorId

  If an affiliation is chosen from the dropdown menu, which contains the entry from the Research Organization Registry (ROR), the assiciated ROR-ID is saved.
  - Occurrence: 0-n
  - The corresponding field in the database where the value is stored is called: `rorId` in the table `affiliation`
  - Restrictions: is automatically saved when an affiliation is chosen
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/creator/#a-affiliationidentifier)
  - Example values: `03v4gjf40`, `04z8jg394`



#### Author Institutions
Author Institution has the same role as Author as a person. Here, the institution is entered as the author of the data set, for example: Helmholtz Centre Potsdam - GFZ German Research Centre for Geosciences
Occurrence is: 0-n

- Institution Name

  This field contains the Name of the Institution(author).
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database where the value is stored is called: `institutionname` in the table `Author\_institution`
  - Restrictions: Optional field, but may become mandatory in certain cases.
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/creator/#creatorname)
  - Example values: `California Digital Library`, `Helmholtz Centre Potsdam - GFZ German Research Centre for Geosciences`

- Affiliation <a href="https://ror.org/" target="\_blank" rel="noopener"><img src="logos/ror-logo.svg" alt="ROR Logo" style="height:10px; vertical-align:7px; margin-left:-1px;"></a>

  This field contains the author's affiliation.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database where the value is stored is called: `name` in the table `affiliation`
  - Restrictions: None, can be chosen from the dropdown menu or given as free text
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/creator/#affiliation)
  - Example values: `Technische Universität Berlin`, `Helmholtz Centre Potsdam - GFZ German Research Centre for Geosciences`


- *Saved in backend (not visible to user):* rorId

  If an affiliation is chosen from the dropdown menu, which contains the entry from the Research Organization Registry (ROR), the assiciated ROR-ID is saved.
  - Occurrence: 0-n
  - The corresponding field in the database where the value is stored is called: `rorId` in the table `affiliation`
  - Restrictions: is automatically saved when an affiliation is chosen
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/creator/#a-affiliationidentifier)
  - Example values: `03v4gjf40`, `04z8jg394`


#### Contact Person(s)
A Contact Person is saved as a "Contributor" with the role "Contact Person" in the DataCite scheme (version 4.5) and as a "Point of Contact" in the ISO scheme (Version 2012-07-13). Authors can be labelled as a contact person with the help of a toggle switch button which adds the additional fields required for contact (Email address, Website).

- Last Name

  This field contains the surname of the person.
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database where the value is stored is called: familyname in the Contact_Person table
  - Restrictions: Mandatory
  - Example values: `Jemison`, `Smith`

- First Name

  This field contains the first name of the person.
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database where the value is stored is called: givenname in the table Contact_Person
  - Restrictions: Mandatory
  - Example values: `John`, `Jane`

- Email address

  This field contains the email address of the person or organisation.
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database where the value is stored is called: email in the Contact_Person table
  - Restrictions: Mandatory
  - Example values: `ali.mohammed@gfz.de`, `holger.ehrmann@gfz.de`

- Website

  This field contains the organisation's website.
  - Data type: String
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: website in the Contact_Person table
  - Restrictions: Optional
  - Example values: `gfz.de`, `fh-potsdam.de`

- Affiliation
    
  This field contains the affiliation of the person.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database where the value is saved is called: name in the Affiliation table.
  - Restrictions: Optional
  - Example values: `Technische Universität Berlin`, `GFZ, Helmholtz-Zentrum Potsdam - Deutsches GeoForschungsZentrum GFZ`
  - Note: As in all affiliation fields the ROR ID is saved, when an affiliation is chosen from the list

### Originating Laboratory
The controlled list is provided and maintained by Utrecht University ([MSL Laboratories](https://github.com/UtrechtUniversity/msl_vocabularies/blob/main/vocabularies/labs/laboratories.json)) and can be updated via API call (see [API documentation](https://env.rz-vm182.gfz.de/elmo/api/v2/docs/index.html)).

- Laboratory Name
  This field contains the laboratory, where the research data came from. Its content is mapped to `<contributor contributorType="HostingInstitution"><contributorName>` in the DataCite scheme. 
  - Data Type: String
  - Occurence: 0-n
  - The corresponding field in the database is called: `laboratoryname` in the table `originating_laboratory`
  - Restrictions: Controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#a-contributortype)
  - Example values: `Fragmentation Lab (Ludwig-Maximilians-University Munich, Germany)`, `TecMOD - GRmodel (CNRS-Rennes 1 University, France)`

- *Saved in backend (not visible to user):* LabId, laboratoryAffiliation, laboratoryRorId
    The purpose of these fields is to clearly identify the originating laboratory. The contents are mapped to `<nameIdentifier nameIdentifierScheme="labid">` and `<affiliation>` in the DataCite scheme.
    - Data type: String
    - Occurence: 1
    - The corresponding field in the database where the values are saved are called: `labId` in the table `originating_laboratory` and `name` and `rorId` in the table `affiliation`
    - Restrictions: Fields are filled automatically with data provided by the vocabulary provider and maintainer
    - Example values: 
      LabID `9cd562c216daa82792972a074a222c52`, 
      laboratoryAffiliation `Ludwig-Maximilians-University Munich, Munich, Germany`
      laboratoryRorId `https://ror.org/02e2c7k09`


### Contributors

#### _Person_
Contributor fields are optional. Only when one of the fields is filled the fields "Last Name", "First Name" and "Role" become mandatory . The contents of the fields are mapped to `<contributor contributorType="ROLE">` with `<contributorName nameType="Personal">` in the DataCite scheme.

- ORCID <a href="https://orcid.org/" target="_blank" rel="noopener"><img src="logos/orcid.logo.png" alt="ORCID Logo" style="height:15px; vertical-align:9px; margin-left:-1px;"></a>

  This field contains the ORCID of the contributor (Open Researcher and Contributor ID).
  - Data type: String
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: `orcid` in the `Contributor_Person` table
  - Restrictions: Must be in the format “xxxx-xxxx-xxxx-xxxx-xxxx”
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#a-nameidentifierscheme)
  - Example values: `1452-9875-4521-7893`, `0082-4781-1312-884x`

- Last Name 

  This field contains the contributpr's surname.
  - Data type: String
  - Occurrence: 1, if a contributor person is specified
  - The corresponding field in the database where the value is stored is called: `familyname` in the table `Contributor_Person`
  - Restrictions: Only letters are allowed.
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#familyname)
  - Example values: `Jemison`, `Smith`

- First Name

  This field contains the contributpr's surname.
  - Data type: String
  - Occurrence: 1, if a contributor person is specified
  - The corresponding field in the database where the value is stored is called: `givenname` in the table `Contributor_Person`
  - Restrictions: Only letters are allowed
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#givenname)
  - Example values: `John`, `Jane`

- Role

  This field contains the role(s) of the contributor(s).
  - Data type: String
  - Occurrence: 1-10, if a contributor person is specified
  - The corresponding field in the database where the value is stored is called: `name` in the `Role` table
  - Restrictions: must be selcted from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#a-contributortype)
  - Example values: `Data Manager`, `Project Manager`

- Affiliation <a href="https://ror.org/" target="_blank" rel="noopener"><img src="logos/ror-logo.svg" alt="ROR Logo" style="height:10px; vertical-align:7px; margin-left:-1px;"></a>

  This field contains the affiliation of the contributor(s).
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database where the value is stored is called: `name` in the table `Affiliation`
  - Restrictions: None, can be selected from list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#affiliation)
  - Example values: `Technische Universität Berlin`, `GFZ, Helmholtz-Zentrum Potsdam - Deutsches GeoForschungsZentrum GFZ`
    - Note: As in all affiliation fields the ROR ID is saved, when an affiliation is chosen from the list

#### _Organisation_
Contributor fields are optional. Only when one of the fields is filled the fields "Organisation Name" and "Role" become mandatory. The contents of the fields are mapped to `<contributor contributorType="ROLE">` in the DataCite scheme with `<contributorName nameType="Organizational">`

- Organisation Name

  This field contains the name of the institution.
  - Data type: String
  - Occurrence: 1, if contributing organisation is specified
  - The corresponding field in the database where the value is saved is called: `name` in the table `contributor_institution`
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#contributorname)
  - Example values: `University of Applied Sciences Potsdam`, `Helmholtz Centre Potsdam - GFZ German Research Centre for Geosciences`

- Role

  This field contains the role/roles of the institution.
  - Data type: String
  - Occurrence: 1-10
  - The corresponding field in the database where the value is stored is called: `name` in the table `Role`
  - Restrictions: must be selected from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#a-contributortype)
  - Example values: `Data Collector`, `Data Curator`.
  
- Affiliation <a href="https://ror.org/" target="_blank" rel="noopener"><img src="logos/ror-logo.svg" alt="ROR Logo" style="height:10px; vertical-align:7px; margin-left:-1px;"></a>

  This field contains the affiliation of the contributing institution.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database where the value is stored is called: `name` in the `Affiliation` table
  - Restrictions: None, can be selected from list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/contributor/#affiliation)
  - Example values: `Education and Science Workers' Union`, `Institute of Science and Ethics`
  - Note: As in all affiliation fields the ROR ID is saved, when an affiliation is chosen from the list
 
### Descriptions
- Abstract
  This field contains the abstract of the dataset. It is mapped to `<descriptions><description descriptionType="Abstract">` in the DataCite scheme and to `<identificationInfo><MD_DataIdentification><abstract>` in the ISO scheme
  - Data type: String
  - Occurence: 1
  - The corresponding field in the database where the value is saved is called: `description` in the table `description` with `type=Abstract`
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/descriptionType/#abstract)
  - Example value: `The dataset contains a subset of an airborne hyperspectral HyMap image over the Cabo de Gata-Nίjar Natural Park in Spain from 15.06.2005, and soil wet chemistry data based on in-situ soil sampling. The Cabo de Gata-Nίjar Natural Park is a semi-arid mediterranean area in Southern Spain, sparsely populated and with a range of landscape patterns.`

- Methods
  This field contains the The methodology employed for the study or research. It is mapped to `<descriptions><description descriptionType="Methods">` in the DataCite scheme.
  - Data type: String
  - Occurence: 0-1
  - The corresponding field in the database where the value is saved is called: `description` in the table `description` with `type = Methods`
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/descriptionType/#methods)
  - Example value: `Graphical representation of the steps used to reconstruct sequence alignments of the Nudix superfamily, as described in the Materials and Methods section. (A) The pipeline to build the 78-PDB structure guided sequence alignment. (B) The pipeline to build the 324-core sequence alignment guided by the 78-PDB sequence alignment. (C) The pipeline to build the alignment of the complete Nudix clan (38,950 sequences). (D) Illustration of how to combine two alignment into one guided by a scaffold alignment.`

- TechnicalInfo
  This field contains detailed information that may be associated with design, implementation, operation, use, and/or maintenance of a process, system, or instrument. It is mapped to `<descriptions><description descriptionType="TechnicalInfo">` in the DataCite scheme.
  - Data type: String
  - Occurence: 0-1
  - The corresponding field in the database where the value is saved is called: `description` in the table `description` with `type = Technical Information`
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/descriptionType/#technicalinfo)
  - Example value: `Scripts written and run using Wolfram Mathematica (confirmed with versions 10.2 to 11.1). Assumes raw data matches format produced by a LTQ Orbitrap Velos mass spectrometer and exported by the proprietary software (Xcalibur) to a comma-separated values (.csv) file. The .csv files are the expected input into the Mathematica scripts. `

- Other
  Other description information that does not fit into an existing category. Content of the field is mapped to `<descriptions><description descriptionType="Other">` in the DataCite scheme.
  - Data type: String
  - Occurence: 0-1
  - The corresponding field in the database where the value is saved is called: `description` in the table `description` with `type = Other`
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/descriptionType/#other)
  - Example value:  `This is the description of a data set that does not fit into the categories of abstract, methods or technical information, but is nevertheless extremely necessary.`

### Keywords
Contents from the keyword fields "EPOS Multi-Scale Laboratories Keywords", "GCMD Science Keywords" and "Free Keywords" are mapped to `<subject>` in the DataCite 4.5 scheme and to `<descriptiveKeywords> <MD_Keywords> <keyword>` in the ISO scheme. 

#### EPOS Multi-Scale Laboratories Keywords

Keywords from the [EPOS Multi-Scale Laboratories vocabularies](https://epos-msl.uu.nl/vocabularies) are provided by Utrecht University on [GitHub](https://github.com/UtrechtUniversity/msl_vocabularies). Vocabulary can be updated from the repository via API (see [API Documentation](https://env.rz-vm182.gfz.de/elmo/api/v2/docs/index.html)).

- EPOS Multi-Scale Laboratories Keyword

  This field contains keywords to describe the content of the resource.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database is called: `keyword` in the table `thesaurus_keywords`
  - Restrictions: Controlled vocabulary
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/)
  - Example values: `Material > minerals > chemical elements > selenium`, `Geochemistry > measured property > selenium`

- *Saved in backend (not visible to user):* scheme, schemeURI, valueURI und language

  The purpose of these fields is to clearly identify the keyword.
  - Data type: String
  - Occurence: 1 for controlled (thesaurus) keywords
  - The corresponding field in the database where the value is saved is called: `scheme`, `schemeURI`, `valueURI` and `language` in the table `thesaurus_keywords`
  - Restrictions: fields are filled automatically with data provided by the vocabulary provider and maintainer
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/#a-scheme)
  - Example values: 
    scheme `https://epos-msl.uu.nl/voc/materials/1.3/`, 
    schemeURI `https://epos-msl.uu.nl/voc/materials/1.3/`, 
    valueURI `https://epos-msl.uu.nl/voc/materials/1.3/minerals-chemical_elements-selenium`, 
    language `en`

#### Thesaurus Keywords

Keywords from the GCMD vocabulary. GCMD Science Keywords, GCMD Platforms, and GCMD Instruments are available for selection. Can be updated from [NASA's GCMD](https://www.earthdata.nasa.gov/data/tools/idn/gcmd-keyword-viewer) repository via API (see [API documentation](https://env.rz-vm182.gfz.de/elmo/api/v2/docs/index.html))

- **GCMD Science Keyword**

  This field contains keywords to describe the content of the resource.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database is called: `keyword` in the table `thesaurus_keywords`
  - Restrictions: Terms can be selected from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/)
  - Example Values: `Science Keywords > EARTH SCIENCE > OCEANS > SEA ICE > SEA ICE VOLUME`,`Science Keywords > EARTH SCIENCE > TERRESTRIAL HYDROSPHERE > WATER QUALITY/WATER CHEMISTRY > CONTAMINANTS > SELENIUM`

- *Saved in backend (not visible to user):* scheme, schemeURI, valueURI, language

  The purpose of these fields is to clearly identify the keyword.
  - Data type: String
  - Occurence: 1 for controlled (thesaurus) keywords
  - The corresponding field in the database where the value is saved is called: `scheme`, `schemeURI`, `valueURI` and `language` in the table `thesaurus_keywords`
  - Restrictions: fields are filled automatically with data provided by the vocabulary provider and maintainer
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/#a-scheme)
  - Example values: 
    scheme `NASA/GCMD Earth Science Keywords`, 
    schemeURI `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords"`, 
    valueURI `https://gcmd.earthdata.nasa.gov/kms/concept/b2318fb3-788c-4f36-a1d1-36670d2da747"`, 
    language `en`


- **GCMD Platforms**

  This field contains keywords to describe the content of the resource.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database is called: `keyword` in the table `thesaurus_keywords`
  - Restrictions: Terms can be selected from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/)
  - Example Values: `Platforms > Air-based Platforms > Dropwindsondes > DROPWINDSONDES`

- *Saved in backend (not visible to user):* scheme, schemeURI, valueURI, language

  The purpose of these fields is to clearly identify the keyword.
  - Data type: String
  - Occurence: 1 for controlled (thesaurus) keywords
  - The corresponding field in the database where the value is saved is called: `scheme`, `schemeURI`, `valueURI` and `language` in the table `thesaurus_keywords`
  - Restrictions: fields are filled automatically with data provided by the vocabulary provider and maintainer
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/#a-scheme)
  - Example values: 
    scheme `NASA/GCMD Platforms Keywords`, 
    schemeURI `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms`, 
    valueURI `https://gcmd.earthdata.nasa.gov/kms/concept/fa514134-ff56-47d1-bc02-6b8568ad21e7`, 
    language `en`


- **GCMD Instruments**

  This field contains keywords to describe the content of the resource.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database is called: `keyword` in the table `thesaurus_keywords`
  - Restrictions: Terms can be selected from controlled list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/)
  - Example Values: `Instruments > Solar/Space Observing Instruments > Photon/Optical Detectors > Charged Coupled Devices > K-LINE CCD/SOLAR OSCILLATIONS`

- *Saved in backend (not visible to user):* scheme, schemeURI, valueURI, language

  The purpose of these fields is to clearly identify the keyword.
  - Data type: String
  - Occurence: 1 for controlled (thesaurus) keywords
  - The corresponding field in the database where the value is saved is called: `scheme`, `schemeURI`, `valueURI` and `language` in the table `thesaurus_keywords`
  - Restrictions: fields are filled automatically with data provided by the vocabulary provider and maintainer
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/#a-scheme)
  - Example values: 
    scheme `NASA/GCMD Instruments`, 
    schemeURI `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments`, 
    valueURI `https://gcmd.earthdata.nasa.gov/kms/concept/657ac23c-4ee8-400c-bd41-165dfd3845f5`, 
    language `en`

#### Free Keywords

- Free Keyword

This field contains free keywords that are not part of a thesaurus.
  - Data type: String
  - Occurrence: 0-n
  - The corresponding field in the database where the value is saved is called: `free_keyword` in the table `free_keywords`
  - Restrictions: Dublicates are not allowed
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/subject/#a-scheme)
  - Example values: `Seismic tremor`, `Acoustic Emission`

### Dates
In the DataCite scheme: All field data are mapped to `<dates>`, with `dateType dateType="Available">` for the Embargo and `dateType="Created"` for the Date created.
In the ISO scheme: The data from Date created are mapped to `<date>`, while Embargo until are mapped to `<gml:endPosition>`.

- Date created
  
  This field contains the date the resource itself was put together; this could refer to a timeframe in ancient history, a date range, or a single date for a final component, e.g., the finalized file with all the data.
  - Data type: Date
  - Occurrence: 1
  - The corresponding field in the database where the value is stored is called: `dateCreated` in the `resource` table
  - Restrictions: This field must be a valid calendar date
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/dateType/#created)
  - Example values: `2024-06-05` `1999-04-07`

- Embargo until

  This field contains the date the resource is made publicly available, marking the end of an embargo period.
  - Data typ: Date
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: `dateEmbargoUntil` in the `resource` table
  - Restrictions: This field must be a valid calendar date
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/dateType/#available)
  - Example values: `2024-06-15` `2000-12-31`

### Spatial and temporal coverage

Spatial and temporal coverage specifies the geographic region and time frame that the dataset encompasses, providing essential context for its relevance and applicability.
In the DataCite scheme: The data from Latitude, Longitude and Description are mapped to `<geoLocations>`, while Start Date/Time and End Date/Time are mapped to `<date dateType="Collected">`.
In the ISO scheme: All field data are mapped to `<EX_Extent>`. Occurency of spatial and temporal coverage is 0-n.

- Latitude Min
  
  This field contains the geographic latitude of a single coordinate or the smaller geographic latitude of a rectangle.
  - Data type: Floating-point number
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: latitudeMin in the spatial_temporal_coverage table
  - Restrictions: Only positive and negative numbers in the value range from -90 to +90
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/geolocation/#southboundlatitude)
  - Example values: `52.0317983498743` `-3.234`

- Latitude Max
  
  This field contains the larger geographic latitude of a rectangle.
  - Data type: Floating-point number
  - Occurrence: 0-1, becomes mandatory if Longitude Max is filled
  - The corresponding field in the database where the value is stored is called: latitudeMax in the spatial_temporal_coverage table
  - Restrictions: Only positive and negative numbers in the value range from -90 to +90
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/geolocation/#northboundlatitude)
  - Example values: `49.72437624376` `-32.82438824398`
  
- Longitude Min
  
  This field contains the geographic longitude of a single coordinate or the smaller geographic longitude of a rectangle.
  - Data type: Floating-point number
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: longitudeMin in the spatial_temporal_coverage table
  - Restrictions: Only positive and negative numbers in the value range from -180 to +180
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/geolocation/#westboundlongitude)
  - Example values: `108.0317983498743` `-3.04`
  
- Longitude Max
  
  This field contains the larger geographic longitude of a rectangle.
  - Data type: Floating-point number
  - Occurrence: 0-1, becomes mandatory if Latitude Max is filled
  - The corresponding field in the database where the value is stored is called: longitudeMax in the spatial_temporal_coverage table
  - Restrictions: Only positive and negative numbers in the value range from -180 to +180
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/geolocation/#eastboundlongitude)
  - Example values: `99.037543735498743` `-6.4`
  
- Description

  This field contains a free-text explanation of the geographic and temporal context.
  - Data type: Free text
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: description in the spatial_temporal_coverage table
  - Restrictions: none
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/geolocation/#geolocationplace)
  - Example values: `Several boreholes at regular intervals distributed over the entire surface.`
  
- Start Date
  
  This field contains the starting date of the temporal classification of the dataset.
  - Data type: DATE
  - Occurrence: 0-1 
  - The corresponding field in the database where the value is stored is called: dateStart in the spatial_temporal_coverage table
  - Restrictions: YYYY-MM-DD
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/dateType/#collected)
  - Example values: `2024-01-02` `1999-08-07`
  
- Start Time
  
  This field contains the starting time.
  - Data type: TIME  
  - Occurrence: 0-1, becomes mandatory, if any time in Spatial and Temporal Coverage is specified, to achieve data consistency
  - The corresponding field in the database where the value is stored is called: timeStart in the spatial_temporal_coverage table
  - Restrictions: hh:mm:ss
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/dateType/#collected)
  - Example values: `10:43:50` `04:00:00`
  
- End Date
  
  This field contains the ending date of the temporal classification of the dataset.
  - Data type: DATE
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: dateEnd in the spatial_temporal_coverage table
  - Restrictions: YYYY-MM-DD
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/dateType/#collected)
  - Example values: `1998-01-02` `2001-07-08`
  
- End Time
  
  This field contains the ending time.
  - Data type: TIME 
  - Occurrence: 0-1, becomes mandatory, if any time in Spatial and Temporal Coverage is specified, to achieve data consistency
  - The corresponding field in the database where the value is stored is called: timeEnd in the spatial_temporal_coverage table
  - Restrictions: hh:mm:ss
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/dateType/#collected)
  - Example values: `11:34:56` `09:00:00`
  
- Timezone
  
  This field contains the timezone of the start and end times specified. All possible timezones are regularly updated via the API using the getTimezones method if a CronJob is configured on the server. Important: The API key for timezonedb.com must be specified in the settings to enable automatic updates!
  - Data type: String
  - Occurrence: 0-1, mandatory, when Start Date, Start Time, End Date or End Time is filled
  - The corresponding field in the database where the value is stored is called: timezone in the spatial_temporal_coverage table
  - Restrictions: Only values from the list are permitted
  - ISO documentation
  - Example values: `+02:00` `-08:00`

### Related Work
This is mapped to `<relatedIdentifier>` in the DataCite scheme and to `<gmd:aggregationInfo>` in the ISO scheme (not yet implemented). The element is optional in both schemes.

- Relation

  This field contains the type of relation.
  - Data type: String
  - Occurrence: 1, if relatedIdentifier is <0
  - The corresponding field in the database where the value is saved is called: `relation_fk` in the `Related_Work` table
  - Restrictions: A relation type must be selected, if related work is specified
  - Relations can be chosen from a controlled List: [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/relatedidentifier/#b-relationtype)
  - Example values: `IsCitedBy` `IsSupplementTo` `IsContinuedBy`

- Identifier

  - This field contains the identifier
  - Data type: String
  - Occurrence: 1, if relatedIdentifier is <0
  - The corresponding field in the database where the value is stored is called: `Identifier` in the `Related_Work` table
  - Restrictions: Must be specified, if related work specified
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/relatedidentifier/)
  - Example values: `13030/tqb3kh97gh8w`, `0706.0001`, `10.26022/IEDA/112263`

- Identifier Type

  - This field contains the type of the relatedIdentifier.
  - Data type: String
  - Occurrence: 0-1
  - The corresponding field in the database where the value is stored is called: `identifier_type_fk` in the `Related_Work` table
  - if possible, the Identifier Type is automatically selected based on the structure of Identifier (see `function updateIdentifierType`) 
  - Restrictions: Must be selected, if related work is specified
  - must be chosen from a controlled List: [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/relatedidentifier/#a-relatedidentifiertype)
  - Example values: `ARK` `arXiv` `EAN13`

### Funding Reference
This element is optional in the DataCite scheme. However, it is a best practice to supply funding information when financial support has been received.

- Funder
  
  Name of the funding provider.
  - Data type: String
  - Occurence: 0-1, if Funding Reference is specified, then funderName is mandatory. 
  - The corresponding field in the database where the value is stored is called: `funder` in the `Funding_Reference` table
  - Restrictions: Selection from CrossRef funders list is possible, as well as free text
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/fundingreference/)
  - Example values: `Gordon and Betty Moore Foundation`, `Ford Foundation`

- *Saved in backend (not visible to user):* funderId

  Uniquely identifies a funding entity, using Crossrefs' [Funder Registry](https://www.crossref.org/services/funder-registry/)
  - Data type: String
  - Occurence: 0-1
  - The corresponding field in the database where the value is stored is called: `funderid` in the `Funding_Reference` table
  - Restrictions: is automatically saved, if a funder is selected from the dropdown list
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/fundingreference/#funderidentifier)
  - Example values: `http://dx.doi.org/10.13039/100001214`

- *Saved in backend (not visible to user):* funderidtyp

  The type of the funderIdentifier. Is either NULL or "Crossref Funder ID"
  - Data type: String
  - Occurence: 0-1
  - The corresponding field in the database where the value is stored is called: `funderidtyp` in the `Funding_Reference` table
  - Restrictions: can only be "Crossref Funder ID" (if a funder is selected from the dropdown list) or null
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/fundingreference/#a-funderidentifiertype)
  - Value: `Crossref Funder ID`

- Grant Number

  The code assigned by the funder to a sponsored award (grant).
  - Data type: String
  - Occurence: 0-1
  - The corresponding field in the database where the value is stored is called: `grantnumber` in the `Funding_Reference` table
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/fundingreference/#awardnumber)
  - Example values: `GBMF3859.01` `GBMF3859.22`

- Grant Name

  The human readable title or name of the award (grant).
  - Data type: String
  - Occurence: 0-1
  - The corresponding field in the database where the value is stored is called: `grantname` in the `Funding_Reference` table
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/fundingreference/#awardtitle)
  - Example values: `Socioenvironmental Monitoring of the Amazon Basin and Xingu`, `Grantmaking at a glance`

- Award URI

  A resolvable link to information about the award or grant.
  - Data type: String
  - Occurence: 0-1
  - The corresponding field in the database where the value is stored is called: `awarduri` in the `Funding_Reference` table
  - Restrictions: None
  - [DataCite documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/fundingreference/#a-awarduri)
  - Example values: `https://www.moore.org/grants/list/GBMF3859.01`, `[Grantmaking at a glance](https://doi.org/10.35802/221400)`

### GGMs Properties (Essential)

Viable for the implementation for the ICGEM platform. This form group collects the essential characteristics of a Global Geopotential Model (GGM). 
Essential are understood as one formgroup containing the most general information about a model being published. This formgroup is the first of multiple groups. These formgroups are developed as an adaptation of ELMO for publications of the Global Gravitational Models. Hence, if any field in this group is filled, all the fields become required.

- **Model Type**

  The type of gravity field model being described.
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database is described in the dedicated `Model_Type` table with id, name and description
  - Restrictions: Must be selected from a controlled list
  - Example values: `Static`, `Temporal`
  - Mapping: mapped to `<modelType>` in the XML export

- **Mathematical Representation**

  The set of functions used to express the gravitational potential, which are solutions of Laplace’s equation in a given coordinate system. The coordi-nate system determines the type of harmonics — spherical or ellipsoidal — and thus defines the mathematical form of the model. 
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database is described in the dedicated `Mathematical_Representation` table with id, name and description
  - Restrictions: Must be selected from a controlled list 
  - Example values: `Spherical harmonics`, `Ellipsoidal harmonics`
  - Mapping: mapped to `<mathematicalRepresentation>` in the XML export

- **Celestial Body**

  The planetary body for which the gravity field model is computed.
  - Data type: String
  - Occurrence: 0-1
  - The corresponding field in the database is called: `Celestial_Body` in the `GGM_Properties` table
  - Restrictions: Must be selected from a controlled list
  - Example values: `Earth`, `Moon of the Earth`, `Mars`, `Ceres`, `Venus`, `Other`
  - Mapping: mapped to `<celestialBody>` in the XML export

- **File Format**

  The file format following ICGEM standards, that is used for the model data.
  - Data type: String
  - Occurrence: 0-1
  - The corresponding field in the database is described in the dedicated `File_Format` table with id, name and description
  - Restrictions: Must be selected from a controlled list (populated from the ICGEM format database)
  - Example values: `icgem1.0`, `icgem2.0`
  - Mapping: mapped to `<fileFormat>` in the XML export

- **Model Name**

  The unique identifier for the gravity field model.
  - Data type: String
  - Occurrence: 1
  - The corresponding field in the database is called: `Model_Name` in the `GGM_Properties` table
  - Restrictions: No spaces allowed; must be unique
  - Example values: `EIGEN-6C4`, `GOCO06s`, `GGM05G`
  - Mapping: mapped to `<modelName>` in the XML export

- **Product Type**

  Specifies the type of gravity field product.
  - Data type: String
  - Occurrence: 0-1
  - The corresponding field in the database is called: `Product_Type` in the `GGM_Properties` table
  - Restrictions: Must be selected from a controlled list
  - Example values: `Gravity Field`, `Topographic Gravity Field`
  - Mapping: mapped to `<productType>` in the XML export

</details>

<details>
  <summary>


  ## Data Mapping and Occurences
  </summary>
The following table gives a quick overview on the occurences of the form fields in comparison to the occurences of the corresponding DataCite metadata as described in the [DataCite 4.5 documentation](https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/). Input fields visable to the user are marked **bold** in the table whereas hidden fields are in *italics*.

| Form group                 | **Input Field**                           |            Occurence in ELMO            | Occurence in DataCite metadata scheme | Mapped to in DataCite                                                                                                                                                       |
| -------------------------- | ----------------------------------------- | :-------------------------------------: | :-----------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource Information       |                                           |                                         |                                       |                                                                                                                                                                             |
|                            | **DOI**                                   |                   0-1                   |                   1                   | `<identifier>` with `<identifier identifierType="DOI">`                                                                                                                     |
|                            | **Publication Year**                      |                    1                    |                   1                   | `<publicationYear>`                                                                                                                                                         |
|                            | **Resource Type**                         |                    1                    |                   1                   | `<resourceType>` as well as `<resourceTypeGeneral>`                                                                                                                         |
|                            | **Version**                               |                   0-1                   |                  0-1                  | `<version>`                                                                                                                                                                 |
|                            | **Language of Dataset**                   |                    1                    |                  0-1                  | `<language>`                                                                                                                                                                |
|                            | **Title**                                 |   1-n (n=$maxTitles in helper_functions.php)    |                  1-n                  | `<title>`                                                                                                                                                                   |
|                            | **Title Type**                            | 1 (if corresponding title ≠ main title) |                  0-1                  | `<titleType>`                                                                                                                                                               |
| Licenses & Rights          |                                           |                                         |                                       |                                                                                                                                                                             |
|                            | **Rights Title**                          |                    1                    |                  0-n                  | `<rights>`                                                                                                                                                                  |
|                            | *rightsURI*                               |                    1                    |                  0-1                  | `<rights rightsURI="...">`                                                                                                                                                  |
| Author(s)                  |                                           |                   1-n                   |                  1-n                  | `<creators>`                                                                                                                                                                |
|                            | **Last Name**                             |                    1                    |                   1                   | `<creator><creatorName><familyName>`                                                                                                                                        |
|                            | **First Name**                            |                    1                    |                   1                   | `<creator><creatorName><givenName>`                                                                                                                                         |
|                            | **Author ORCID**                          |                   0-1                   |                  0-n                  | `<nameIdentifier schemeURI="https://orcid.org/" nameIdentifierScheme="ORCID">`                                                                                              |
|                            | **Affiliation**                           |                   0-n                   |                  0-n                  | `<creator><creatorName><affiliation>`                                                                                                                                       |
|                            | *rorID*                                   |                   0-1                   |                  0-1                  | `<creator><creatorName><affiliation>` long: `<affiliation affiliationIdentifier="https://ror.org/XXXXXXXXX" affiliationIdentifierScheme="ROR" schemeURI="https://ror.org">` |
| Contact Person(s)          |                                           |                   0-n                   |                  0-n                  | `<contributor contributorType="Contact Person">`                                                                                                                            |
|                            | **Last Name**                             |                    1                    |                  0-1                  | `<contributorName><familyName>`                                                                                                                                             |
|                            | **First Name**                            |                    1                    |                  0-1                  | `<contributorName><givenName>`                                                                                                                                              |
|                            | **Position**                              |                   0-1                   |                  --                   | --                                                                                                                                                                          |
|                            | **Email adress**                          |                    1                    |                  --                   | --                                                                                                                                                                          |
|                            | **Website**                               |                   0-1                   |                  --                   | --                                                                                                                                                                          |
|                            | **Affiliation**                           |                   0-n                   |                  0-n                  | `<contributor><affiliation>`                                                                                                                                                |
|                            | *rorID*                                   |                   0-1                   |                  0-1                  | `<contributor><contributorName><affiliation>`                                                                                                                               |
| Originating Laboratory     |                                           |                   0-n                   |                  0-n                  | `<contributor contributorType="HostingInstitution"><contributorName>`                                                                                                       |
|                            | *LabID*                                   |                    1                    |                   1                   | `<nameIdentifier nameIdentifierScheme="labid">`                                                                                                                             |
|                            | *laboratoryAffiliation*                   |                    1                    |                  0-n                  | `<affiliation>`                                                                                                                                                             |
| Contributors (Person)      |                                           |                   0-n                   |                  0-n                  | `<contributor nameType="Personal">`                                                                                                                                         |
|                            | **ORCID**                                 |                   0-1                   |                   1                   | `<nameIdentifier>`                                                                                                                                                          |
|                            | **Last Name**                             |                    1                    |                  0-1                  | `<familyName>`                                                                                                                                                              |
|                            | **First Name**                            |                    1                    |                  0-1                  | `<givenName>`                                                                                                                                                               |
|                            | **Role**                                  |                  1-10                   |                   1                   | `<contributorType>`                                                                                                                                                         |
|                            | **Affiliation**                           |                   0-n                   |                  0-n                  | `<affiliation>`                                                                                                                                                             |
|                            | *rorID*                                   |                   0-1                   |                  0-1                  | `<affiliation affiliationIdentifierScheme="ROR" schemeURI="https://ror.org" affiliationIdentifier="https://ror.org/*rorID*">`                                               |
| Contributors (Institution) |                                           |                   0-n                   |                  0-n                  | `<contributor nameType="Organizational">`                                                                                                                                   |
|                            | **Organisation Name**                     |                    1                    |                   1                   | `<contributorName>`                                                                                                                                                         |
|                            | **Role**                                  |                  1-10                   |                   1                   | `<contributorType>`                                                                                                                                                         |
|                            | **Affiliation**                           |                   0-n                   |                  0-n                  | `<affiliation>`                                                                                                                                                             |
|                            | *rorID*                                   |                   0-1                   |                  0-1                  | `<contributor><contributorName><affiliation>`                                                                                                                               |
| Descriptions               |                                           |                                         |                                       | `<descriptions>`                                                                                                                                                            |
|                            | **Abstract**                              |                    1                    |                  0-n                  | `<description descriptionType="Abstract">`                                                                                                                                  |
|                            | **Methods**                               |                   0-1                   |                  0-n                  | `<description descriptionType="Methods">`                                                                                                                                   |
|                            | **TechnicalInfo**                         |                   0-1                   |                  0-n                  | `<description descriptionType="TechnicalInfo">`                                                                                                                             |
|                            | **Other**                                 |                   0-1                   |                  0-n                  | `<description descriptionType="Other">`                                                                                                                                     |
| Keywords                   |                                           |                                         |                                       | `<subjects>`                                                                                                                                                                |
|                            | **EPOS Multi-Scale Laboratories Keyword** |                   0-n                   |                  0-n                  | `<subject>`                                                                                                                                                                 |
|                            | *scheme*                                  |                    1                    |                  0-1                  | `<subject subjectScheme="https://epos-msl.uu.nl/voc/paleomagnetism/1.3/">`                                                                                                  |
|                            | *schemeURI*                               |                    1                    |                  0-1                  | `<subject schemeURI="https://epos-msl.uu.nl/voc/paleomagnetism/1.3/">`                                                                                                      |
|                            | *valueURI*                                |                    1                    |                  0-1                  | `<subject valueURI="...">`                                                                                                                                                  |
|                            | *language*                                |                    1                    |                  --                   | `<subject xml:lang="en">`                                                                                                                                                   |
|                            | **GCMD Science Keywords**                 |                   0-n                   |                  0-n                  | `<subject>`                                                                                                                                                                 |
|                            | *scheme*                                  |                    1                    |                  0-1                  | `<subjectScheme="NASA/GCMD Earth Science Keywords">`                                                                                                                        |
|                            | *schemeURI*                               |                    1                    |                  0-1                  | `<subject schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords">`                                                                         |
|                            | *valueURI*                                |                    1                    |                  0-1                  | `<subject valueURI="...">`                                                                                                                                                  |
|                            | *language*                                |                    1                    |                  --                   | `<subject xml:lang>`                                                                                                                                                        |
|                            | **Free Keyword**                          |                   0-n                   |                  0-n                  | `<subject>`                                                                                                                                                                 |
| Dates                      |                                           |                                         |                                       | `<date>`                                                                                                                                                                    |
|                            | **Date created**                          |                    1                    |                  0-n                  | `<date dateType="Created">`                                                                                                                                                 |
|                            | **Embargo until**                         |                   0-1                   |                  0-n                  | `<date dateType="Available">`                                                                                                                                               |
| Spatial Coverage           |                                           |                   0-n                   |                  0-n                  | `<geoLocation><geoLocationPoint>` or `<geoLocation><geoLocationBox>`                                                                                                        |
|                            | **Latitude Min**                          |                    1                    |                   1                   | `<pointLatitude>`                                                                                                                                                           |
|                            | **Longitude Min**                         |                    1                    |                   1                   | `<pointLongitude>`                                                                                                                                                          |
|                            | **Latitude Min**                          |                    1                    |                   1                   | `<southBoundLatitude>`                                                                                                                                                      |
|                            | **Latitude Max**                          |                    1                    |                   1                   | `<northBoundLatitude>`                                                                                                                                                      |
|                            | **Longitude Min**                         |                    1                    |                   1                   | `<westBoundLongitude>`                                                                                                                                                      |
|                            | **Longitude Max**                         |                    1                    |                   1                   | `<eastBoundLongitudens>`                                                                                                                                                    |
|                            | **Description**                           |                    1                    |                   1                   | `<geoLocationPlace>`                                                                                                                                                        |
| Temporal Coverage          |                                           |                   0-n                   |                  0-n                  | `<date>`                                                                                                                                                                    |
|                            | **Start Date**                            |                    1                    |                   1                   | `<date dateType="Collected">`                                                                                                                                               |
|                            | **Start Time**                            |                   0-1                   |                   1                   | `<date dateType "Collected">`                                                                                                                                               |
|                            | **End Date**                              |                    1                    |                   1                   | `<date dateType="Collected">`                                                                                                                                               |
|                            | **End Time**                              |                   0-1                   |                   1                   | `<date dateType="Collected">`                                                                                                                                               |
|                            | **Timezone**                              |                   0-1                   |                   1                   | `<date dateType="Collected">`                                                                                                                                               |
| Related Work               |                                           |                   0-n                   |                  0-n                  |                                                                                                                                                                             |
|                            | **Relation**                              |                    1                    |                   1                   | `<relationType>`                                                                                                                                                            |
|                            | **Identifier**                            |                    1                    |                  0-n                  | `<relatedIdentifier>`                                                                                                                                                       |
|                            | **Identifier Type**                       |                    1                    |                   1                   | `<relatedIdentifier relatedIdentifiertype>`                                                                                                                                 |
| Funding Reference          |                                           |                   0-n                   |                  0-n                  | `<fundingReferences>`                                                                                                                                                       |
|                            | **Funder**                                |                    1                    |                  0-n                  | `<funderName>`                                                                                                                                                              |
|                            | *funderId*                                |                   0-1                   |                  0-1                  | `<funderIdentifier>`                                                                                                                                                        |
|                            | *funderidtyp*                             |                   0-1                   |                   1                   | `<funderIdentifier funderIdentifierType>`                                                                                                                                   |
|                            | *schemeURI*                               |                   0-1                   |                  0-1                  | `<funderIdentifier schemeURI>`                                                                                                                                              |
|                            | **Grant Number**                          |                   0-1                   |                  0-1                  | `<awardNumber>`                                                                                                                                                             |
|                            | **Grant Name**                            |                   0-1                   |                  0-1                  | `<awardTitle>`                                                                                                                                                              |
|                            | **Award URI**                             |             0-1                   |                  0-1                  | `<awardNumber awardURI="...">` |
| GGMs Properties (Essential)|                                           |        1                                |                  0                    |           not mapped                                                                                                                                                        |
|                            | **Model Type**                            |        1                                |                  0                    |           not mapped                                                                                                                                                        |
|                            | **Mathematical Representation**           |        1                                |                  0                    |           not mapped                                                                                                                                                        |
|                            | **Celestial Body**                        |       0-1                               |                  0                    |           not mapped                                                                                                                                                        |
|                            | **File Format**                           |       0-1                               |                  0                    |           not mapped                                                                                                                                                        |
|                            | **Model Name**                            |        1                                |                  0                    |           not mapped                                                                                                                                                        |
|                            | **Product Type**                          |       0-1                               |                  0                    |           not mapped                                                                                                                                                        |


</details>

<details>
  <summary>

  ## Data validation
  </summary>

The metadata editor has some mandatory fields which are necessary for the submission of data. These include the following fields:
- **Publication Year**, **Resource Type**, **Language of dataset**, **Title**, **Title Type**(_not for the first (main) title!_), **Author Lastname**, **Author Firstname**,**Contact Person Lastname**, **Contact Person Firstname**, **Contact Person Email address**, **Descriptions Abstract**, **Date created**, **Min Latitude**, **Min Longitude**, **STC Description**, **STC Date Start**, **STC Date End** und **STC Timezone**.❗


The other fields are optional and are used to further enrich the data set with metadata. The following fields are optional:
- **DOI**, **Version**, **Rights**, **Author ORCID**, **Author Affiliation**, **Contact Person Website**, **Contact Person Affiliation**, **Contributor ORCID**, **Contributor Role**, **Contributor Lastname**, **Contributor Firstname**, **Contributor Affiliation**, **Contributor Organisation Name**, **Contributor Organisation Role**, **Contributor Organisation Affiliation**, **Description Methods**, **Description TechnicalInfo**, **Description Other**, **Thesaurus Keywords**, **MSL Keywords**, **Free Keywords**, **STC Max Latitude**, **STC Max Longitude**, **STC Time Start**, **STC Time End**, **Related work all fields** and **Funding Reference all fields**.✅


In certain cases, some subfields within a formgroup become mandatory. This affects the following fields:

Formgroup Contributors:
  - **Contributor Role**, **Contributor Lastname** and **Contributor Firstname** become mandatory, if one of the Contributor Person fields is filled in
  - **Contributor Organisation Name** and **Contributor Organisation Role** become mandatory, if one of the Contributor Organisation fields is filled in (this includes **Contributor Organisation Affiliation**)

Formgroup Spatial and Temporal Coverages: 
  - Per default, no specification of any fields is required here when leaving all fields empty. Filling in any of the optional fields results in a change of mandatory fields.
  - **Min Latitude**, **Min Longitude**, **Description**, **Date Start**, **Date End** and **Timezone** will become mandatory, if only one field of the formgroup gets filled in 
  - **Max Latitude** becomes mandatory, if **Max Longitude** is filled in and vice versa
  - **Time Start** becomes mandatory, if **Time End** is filled in and vice versa

Formgroup Related works:
  - **Related work all Fields** becomes mandatory fields, if one of the fields is filled in
  Formgroup Funding Reference:
  - **Funder** becomes mandatory, if **Grant Number** or **Grant Name** are specified

As for the ICGEM implementation, more required variables are added to ensure a full description of a Global Gravitational Model:
- **Model Type**, **Mathematical Representation**, **Model Name**

Meanwhile these variables from required list are not required to publish a GGM:
- **Resource Type** *(can be mapped to Model)*, **Spatio-temporal Coverage** *(can be mapped to global coverage)* 


</details>

<details>
  <summary>

  ## Database structure
  </summary>

  #### ER diagram

  The following ER diagram shows the relationships and structures of the tables in the database.

  ![ER-Diagramm](doc/ER-Diagram.jpg)
  
</details>

## Contributing

We appreciate every contribution to this project! You can use the feedback back form on the test server [link], create an issue on github or contribute directly: If you have an idea, improvement, or bug fix, please create a new branch and open a pull request (PR). We have prepared a pull request template (only available in german right now!), so we kindly ask you to use it when submitting your changes. This helps ensure we have all the necessary information to review and merge your contribution smoothly.

## Testing

> [!NOTE]
> In order to run the tests, the dependencies must first be loaded via `composer install` and `npm install`.

- `composer run test` runs the tests in `tests/`
- `npm test` runs the JavaScript tests in `tests/js/`
