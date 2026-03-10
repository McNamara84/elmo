<?php

class ICGEMController
{
    protected mysqli $connection;
    protected mixed $logger;

    public function __construct()
    {
        global $connection;
        $this->connection = $connection;
        $this->logger = null; // Optional logger
    }
    /**
     * Retrieves GGM essential variables for a given resource id
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource in question.
     * @return array<mixed>|null An array of GGM data or null if not found.
     */
    protected function getGGMData(mysqli $connection, int $resource_id): ?array
    {
        $ggmData = [];

        // Get all GGM data in one query
        $stmt = $connection->prepare("
            SELECT 
                mt.name as model_type_name, 
                mr.name as mathematical_representation_name, 
                ff.name as file_format_name,
                def.Model_Name as model_name, 
                def.Celestial_Body as celestial_body,
                def.Product_Type as product_type,
                ggm.Errors as errors,
                ggm.Error_Handling_Approach as error_handling_approach,
                ggm.Tide_System as tide_system,
                ggm.degree as degree,
                ggm.radius as radius,
                ggm.earth_gravity_constant as earth_gravity_constant
            
                FROM Resource r
            Left JOIN Resource_has_GGM_Definition rhgd ON r.resource_id = rhgd.Resource_resource_id
            LEFT JOIN GGM_Definition def ON rhgd.GGM_Definition_GGM_Definition_id = def.GGM_Definition_id

            Left JOIN Resource_has_GGM_Properties rhgp ON r.resource_id = rhgp.Resource_resource_id
            LEFT JOIN GGM_Properties ggm ON rhgp.GGM_Properties_GGM_Properties_id = ggm.GGM_Properties_id

            LEFT JOIN Model_Type mt ON def.Model_type_id = mt.Model_type_id
            LEFT JOIN Mathematical_Representation mr ON def.Mathematical_Representation_id = mr.Mathematical_representation_id
            LEFT JOIN File_Format ff ON def.File_format_id = ff.File_format_id

            WHERE r.resource_id = ?
        ");
        
        if (!$stmt) {
            $this->logger && $this->logger->error("Prepare failed for GGM data: " . $connection->error);
            return null;
        }
        
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        /**
         * Filters out null values from the result array and populates the ggmData array.
         * Iterates through each key-value pair in the result array and only adds non-null values
         * to the ggmData array, effectively removing any null entries.
         */
        if ($result) {
            foreach ($result as $key => $value) {
                if ($value !== null) {
                    $ggmData[$key] = $value;
                }
            }
        }
        
        return !empty($ggmData) ? $ggmData : null;
    }

    /**
     * Retrieves data sources for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array<mixed> An array of data sources with their details.
     */
    function getDataSources(mysqli $connection, int $resource_id): array
    {
        $dataSources = [];
        $stmt = $connection->prepare("
        SELECT 
            ds.data_source_id as data_source_id,
            ds.type as type,
            ds.description as description,
            ds.details as details,
            ds.S_value_name as S_value_name,
            ds.S_value_uri as S_value_uri,
            ds.S_scheme_name as S_scheme_name,  
            ds.S_scheme_uri as S_scheme_uri,
            ds.T_Isostasy_compensation_depth as T_Isostasy_compensation_depth,
            ds.M_identifier as M_identifier,
            ds.M_identifier_type as M_identifier_type,
            ds.M_name as M_name
        FROM Data_Sources ds
        JOIN Resource_has_Data_Sources rhds ON ds.data_source_id = rhds.data_source_id
        WHERE rhds.resource_id = ?
        ");
        if (!$stmt) {
            $this->logger && $this->logger->error("Prepare failed for GGM Data Sources: " . $connection->error);
            return [];
        }
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        // Puts each individual data source into an array one by one. 
        while ($row = $result->fetch_assoc()) {
            $dataSources[] = $row;
        }
        return $dataSources;
    }

    /**
     * Retrieves topographic model properties for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array<mixed> An array of topographic model properties.
     */
    function getTopographicModelProperties(mysqli $connection, int $resource_id): array
    {
        $stmt = $connection->prepare("
        SELECT 
            tmp.layer_approach,
            tmp.forward_modelling_domain,
            tmp.density_information,
            tmp.density_information_details,
            tmp.mantle_density_information,
            tmp.mantle_density_information_details,
            tmp.crust_density_information,
            tmp.crust_density_information_details,
            tmp.approximation
        FROM Topographic_Models_Properties tmp
        JOIN Resource_has_Topographic_Model_Properties rhtmp ON tmp.topographic_model_property_id = rhtmp.topographic_model_property_id
        WHERE rhtmp.resource_id = ?
        ");
        if (!$stmt) {
            $this->logger && $this->logger->error("Prepare failed for Topographic Model Properties: " . $connection->error);
            return [];
        }
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    /**
     * Retrieves temporal model properties for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array<mixed> An array of temporal model properties.
     */
    function getTemporalModelProperties(mysqli $connection, int $resource_id): array
    {
        $stmt = $connection->prepare("
        SELECT 
        tmp.generating_institution,
        tmp.temporal_resolution_days,
        tmp.start_date,
        tmp.end_date,
        tmp.release
        FROM Temporal_Model_Properties tmp
        JOIN Resource_has_Temporal_Model_Properties rhtmp ON tmp.temporal_model_property_id = rhtmp.temporal_model_property_id
        WHERE rhtmp.resource_id = ?
        ");
        if (!$stmt) {
            $this->logger && $this->logger->error("Prepare failed for Temporal Model Properties: " . $connection->error);
            return [];
        }
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    /**
     * Retrieves static model properties for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array<mixed> An array of static model properties.
     */
    function getStaticModelProperties(mysqli $connection, int $resource_id): array
    {
        $stmt = $connection->prepare("
        SELECT 
        static.info_time_variable_coefficients
        FROM Static_Model_Properties static
        JOIN Resource_has_Static_Model_Properties rhsmp ON static.static_model_property_id = rhsmp.static_model_property_id
        WHERE rhsmp.resource_id = ?
        ");
        if (!$stmt) {
            $this->logger && $this->logger->error("Prepare failed for Static Model Properties: " . $connection->error);
            return [];
        }
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }
    /**
     * Retrieves ellipsoidal parameters for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array<mixed> An array of ellipsoidal parameters.
     */
    function getEllipsoidalParameters(mysqli $connection, int $resource_id): array
    {
        $stmt = $connection->prepare("
        SELECT 
            ep.semimajor_axis_a,
            ep.semiminor_axis_b,
            ep.flattening,
            ep.reciprocal_flattening,
            ep.description,
            ep.excentricity
        FROM Ellipsoidal_Parameters ep
        JOIN Resource_has_Ellipsoidal_Parameters rhep ON ep.ellipsoidal_parameter_id = rhep.ellipsoidal_parameter_id
        WHERE rhep.resource_id = ?
        ");
        if (!$stmt) {
            $this->logger && $this->logger->error("Prepare failed for Ellipsoidal Parameters: " . $connection->error);
            return [];
        }
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        return $result->fetch_all(MYSQLI_ASSOC);
    }
    /**
     * Inserts GGM properties into the XML.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param array<string, mixed> $ggmData The GGM data to insert.
     */
    protected function insertGgmProperties(SimpleXMLElement $xml, ?array $ggmData): void
    {
        if ($ggmData) {
            $ggmPropertiesXml = $xml->addChild('ggm_properties');
            if (!empty($ggmData['model_name'])) {
                $ggmPropertiesXml->addChild('modelName', htmlspecialchars($ggmData['model_name']));
            }
            if (!empty($ggmData['celestial_body'])) {
                $ggmPropertiesXml->addChild('celestialBody', htmlspecialchars($ggmData['celestial_body']));
            }
            if (!empty($ggmData['product_type'])) {
                $ggmPropertiesXml->addChild('productType', htmlspecialchars($ggmData['product_type']));
            }
            if (!empty($ggmData['errors'])) {
                $ggmPropertiesXml->addChild('errors', htmlspecialchars($ggmData['errors']));
            }
            if (!empty($ggmData['error_handling_approach'])) {
                $ggmPropertiesXml->addChild('errorHandlingApproach', htmlspecialchars($ggmData['error_handling_approach']));
            }
            if (!empty($ggmData['error_description'])) {
                $ggmPropertiesXml->addChild('errorDescription', htmlspecialchars($ggmData['error_description']));
            }
            if (!empty($ggmData['tide_system'])) {
                $ggmPropertiesXml->addChild('tideSystem', htmlspecialchars($ggmData['tide_system']));
            }
            if (!empty($ggmData['degree'])) {
                $ggmPropertiesXml->addChild('degree', htmlspecialchars($ggmData['degree']));
            }
            if (!empty($ggmData['radius'])) {
                $ggmPropertiesXml->addChild('radius', htmlspecialchars($ggmData['radius']));
            }
            if (!empty($ggmData['earth_gravity_constant'])) {
                $ggmPropertiesXml->addChild('earthGravityConstant', htmlspecialchars($ggmData['earth_gravity_constant']));
            }
            if (!empty($ggmData['model_type_name'])) {
                $ggmPropertiesXml->addChild('modelType', htmlspecialchars($ggmData['model_type_name']));
            }
            if (!empty($ggmData['mathematical_representation_name'])) {
                $ggmPropertiesXml->addChild('mathematicalRepresentation', htmlspecialchars($ggmData['mathematical_representation_name']));
            }
            if (!empty($ggmData['file_format_name'])) {
                $ggmPropertiesXml->addChild('fileFormat', htmlspecialchars($ggmData['file_format_name']));
            }
        }
    }
    /**
     * Inserts data source elements into the XML.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param array<int, array<string, mixed>> $dataSources The data sources to insert.
     */
    protected function insertDataSources(SimpleXMLElement $xml, array $dataSources): void
    {
        if ($dataSources) {
            $dataSourcesXml = $xml->addChild('DataSources');
            foreach ($dataSources as $dataSource) {
                $dataSourceXml = $dataSourcesXml->addChild('DataSource');
                
                // Core identification
                $dataSourceXml->addChild('sourceId', htmlspecialchars($dataSource['data_source_id']));
                $dataSourceXml->addChild('sourceType', htmlspecialchars($dataSource['type']));
                if (!empty($dataSource['description'])) {
                    $dataSourceXml->addChild('description', htmlspecialchars($dataSource['description']));
                }
                
                if (!empty($dataSource['S_value_name'])) {
                    $dataSourceXml->addChild('SatelliteValueName', htmlspecialchars($dataSource['S_value_name']));
                }
                if (!empty($dataSource['S_value_uri'])) {
                    $dataSourceXml->addChild('SatelliteValueUri', htmlspecialchars($dataSource['S_value_uri']));
                }
                if (!empty($dataSource['S_scheme_name'])) {
                    $dataSourceXml->addChild('SatelliteSchemeName', htmlspecialchars($dataSource['S_scheme_name']));
                }
                if (!empty($dataSource['S_scheme_uri'])) {
                    $dataSourceXml->addChild('SatelliteSchemeUri', htmlspecialchars($dataSource['S_scheme_uri']));
                }
                
                if (!empty($dataSource['details'])) {
                    $dataSourceXml->addChild('Details', htmlspecialchars($dataSource['details']));
                }
                if (!empty($dataSource['T_Isostasy_compensation_depth'])) {
                    $dataSourceXml->addChild('IsostasyCompensationDepth', htmlspecialchars($dataSource['T_Isostasy_compensation_depth']));
                }
                if (!empty($dataSource['M_identifier'])) {
                    $dataSourceXml->addChild('M_Identifier', htmlspecialchars($dataSource['M_identifier']));
                }
                if (!empty($dataSource['M_identifier_type'])) {
                    $dataSourceXml->addChild('M_Identifier_Type', htmlspecialchars($dataSource['M_identifier_type']));
                }
                if (!empty($dataSource['M_name'])) {
                    $dataSourceXml->addChild('M_Name', htmlspecialchars($dataSource['M_name']));
                }
            }
        }
    }
    /**
     * Inserts topographic model properties into the XML.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param array<string, mixed> $topographicProperties The topographic model properties to insert.
     */
    protected function insertTopographicModelProperties(SimpleXMLElement $xml, array $topographicProperties): void
    {
        if ($topographicProperties) {
            $topographicPropertiesXml = $xml->addChild('TopographicModelProperties');
            foreach ($topographicProperties as $property) {
                $propertyXml = $topographicPropertiesXml->addChild('TopographicProperty');
                
                if (!empty($property['layer_approach'])) {
                    $propertyXml->addChild('layerApproach', htmlspecialchars($property['layer_approach']));
                }
                if (!empty($property['forward_modelling_domain'])) {
                    $propertyXml->addChild('forwardModellingDomain', htmlspecialchars($property['forward_modelling_domain']));
                }
                    if (!empty($property['approximation'])) {
                    $propertyXml->addChild('approximation', htmlspecialchars($property['approximation']));
                }
                if (!empty($property['density_information'])) {
                    $propertyXml->addChild('densityInformation', htmlspecialchars($property['density_information']));
                }
                if (!empty($property['density_information_details'])) {
                    $propertyXml->addChild('densityInformationDetails', htmlspecialchars($property['density_information_details']));
                }
                if (!empty($property['mantle_density_information'])) {
                    $propertyXml->addChild('mantleDensityInformation', htmlspecialchars($property['mantle_density_information']));
                }
                if (!empty($property['mantle_density_information_details'])) {
                    $propertyXml->addChild('mantleDensityInformationDetails', htmlspecialchars($property['mantle_density_information_details']));
                }
                if (!empty($property['crust_density_information'])) {
                    $propertyXml->addChild('crustDensityInformation', htmlspecialchars($property['crust_density_information']));
                }
                if (!empty($property['crust_density_information_details'])) {
                    $propertyXml->addChild('crustDensityInformationDetails', htmlspecialchars($property['crust_density_information_details']));
                }

            }
        }
    }
    /**
     * Inserts temporal model properties into the XML.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param array<string, mixed> $temporalProperties The temporal model properties to insert.
     */
    protected function insertTemporalModelProperties(SimpleXMLElement $xml, array $temporalProperties): void
    {
        if ($temporalProperties) {
            $temporalPropertiesXml = $xml->addChild('TemporalModelProperties');
            foreach ($temporalProperties as $property) {
                $propertyXml = $temporalPropertiesXml->addChild('TemporalProperty');
                
                if (!empty($property['generating_institution'])) {
                    $propertyXml->addChild('generatingInstitution', htmlspecialchars($property['generating_institution']));
                }
                if (!empty($property['temporal_resolution_days'])) {
                    $propertyXml->addChild('temporalResolutionDays', htmlspecialchars($property['temporal_resolution_days']));
                }
                if (!empty($property['start_date'])) {
                    $propertyXml->addChild('startDate', htmlspecialchars($property['start_date']));
                }
                if (!empty($property['end_date'])) {
                    $propertyXml->addChild('endDate', htmlspecialchars($property['end_date']));
                }
                if (!empty($property['release'])) {
                    $propertyXml->addChild('release', htmlspecialchars($property['release']));
                }
            }
        }
    }
    /**
     * Inserts static model properties into the XML.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param array<string, mixed> $staticProperties The static model properties to insert.
     */
    protected function insertStaticModelProperties(SimpleXMLElement $xml, array $staticProperties): void
    {
        if ($staticProperties) {
            $staticPropertiesXml = $xml->addChild('StaticModelProperties');
            foreach ($staticProperties as $property) {
                $propertyXml = $staticPropertiesXml->addChild('StaticProperty');
                
                if (!empty($property['info_time_variable_coefficients'])) {
                    $propertyXml->addChild('infoTimeVariableCoefficients', htmlspecialchars($property['info_time_variable_coefficients']));
                }
            }
        }
    }

    /**
     * Inserts ellipsoidal parameters into the XML.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param array<string, mixed> $ellipsoidalParameters The ellipsoidal parameters to insert.
     */
    protected function insertEllipsoidalParameters(SimpleXMLElement $xml, array $ellipsoidalParameters): void
    {
        if ($ellipsoidalParameters) {
            $ellipsoidalParametersXml = $xml->addChild('EllipsoidalParameters');
            foreach ($ellipsoidalParameters as $parameter) {
                $parameterXml = $ellipsoidalParametersXml->addChild('EllipsoidalParameter');
                
                if (!empty($parameter['semimajor_axis_a'])) {
                    $parameterXml->addChild('semimajorAxisA', htmlspecialchars($parameter['semimajor_axis_a']));
                }
                if (!empty($parameter['semiminor_axis_b'])) {
                    $parameterXml->addChild('semiminorAxisB', htmlspecialchars($parameter['semiminor_axis_b']));
                }
                if (!empty($parameter['flattening'])) {
                    $parameterXml->addChild('flattening', htmlspecialchars($parameter['flattening']));
                }
                if (!empty($parameter['reciprocal_flattening'])) {
                    $parameterXml->addChild('reciprocalFlattening', htmlspecialchars($parameter['reciprocal_flattening']));
                }
                if (!empty($parameter['description'])) {
                    $parameterXml->addChild('description', htmlspecialchars($parameter['description']));
                }
                if (!empty($parameter['excentricity'])) {
                    $parameterXml->addChild('excentricity', htmlspecialchars($parameter['excentricity']));
                }
            }
        }
    }

    /**
     * ICGEM-compliant description types enumeration.
     * Only these types are valid for ICGEM XML output.
     * 
     * @var array<string>
     */
    private const ICGEM_DESCRIPTION_TYPES = [
        'Abstract',
        'General model description',
        'Input data',
        'Processing procedures',
        'Specific features of resulting gravity field',
        'Other'
    ];

    /**
     * ELMOGEM-specific description types whose text is appended to Abstract during save.
     * These texts should be removed from Abstract in ICGEM output to avoid duplication.
     * 
     * @var array<string>
     */
    private const ELMOGEM_SPECIFIC_DESCRIPTION_TYPES = [
        'General model description',
        'Input data',
        'Processing procedures',
        'Specific features of resulting gravity field'
    ];

    /**
     * Normalizes a description type to sentence case (first letter uppercase, rest lowercase).
     * This ensures consistent comparison regardless of how the value is stored in the database.
     *
     * @param string $type The description type to normalize.
     * @return string The normalized type in sentence case.
     */
    private function normalizeDescriptionType(string $type): string
    {
        return ucfirst(strtolower($type));
    }

    /**
     * Removes ELMOGEM-specific text blocks from Abstract to avoid duplication.
     * 
     * Removes each ELMOGEM-specific description text from the Abstract,
     * cleaning up leading/trailing whitespace and extra line breaks.
     *
     * @param string $abstract The Abstract text to clean.
     * @param array<string> $elmogem_texts Array of ELMOGEM-specific description texts.
     * @return string The cleaned Abstract with ELMOGEM texts removed.
     */
    private function removeElmogEmTextFromAbstract(string $abstract, array $elmogem_texts): string
    {
        foreach ($elmogem_texts as $text) {
            // Remove exact text occurrences
            $abstract = str_replace($text, '', $abstract);
        }
        
        // Clean up extra whitespace/line breaks left behind
        $abstract = preg_replace('/\n\s*\n\s*\n+/', "\n\n", $abstract);
        $abstract = trim($abstract);
        
        return $abstract;
    }

    /**
     * Retrieves and inserts all descriptions into ICGEM metadata.
     * 
     * Validates that description types match ICGEM schema enumeration using
     * case-insensitive comparison. Both the database value and the enumerated
     * constants are normalized to sentence case before comparison, ensuring
     * robustness against variations in storage casing.
     * 
     * For Abstract descriptions, removes any text that appears in ELMOGEM-specific
     * description types to avoid duplication in ICGEM output (since ELMOGEM-specific
     * texts were appended to Abstract during save for DataCite indexing).
     * 
     * Types not in the ICGEM enumeration (e.g., 'Methods', 'TechnicalInfo') 
     * are filtered out and logged.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param int $id The resource ID.
     */
    protected function insertDescriptions(SimpleXMLElement $xml, int $id): void
    {
        // find all descriptions for the resource
        $query = "SELECT type, description FROM Description WHERE resource_id = ? ORDER BY description_id";
        $stmt = $this->connection->prepare($query);
        if (!$stmt) {
            error_log("ICGEMController.insertDescriptions: Failed to prepare statement: " . $this->connection->error);
            return; // Exit gracefully if query fails
        }
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        // Collect descriptions into an array
        $descriptions = [];
        while ($row = $result->fetch_assoc()) {
            $descriptions[] = $row;
        }
        $stmt->close();

        if (!empty($descriptions)) {
            $descriptionsXml = $xml->addChild('descriptions');
            
            // Normalize all valid types for robust comparison
            $normalizedValidTypes = array_map(
                fn($type) => $this->normalizeDescriptionType($type),
                self::ICGEM_DESCRIPTION_TYPES
            );
            
            // Collect ELMOGEM-specific texts for deduplication from Abstract
            $elmogem_texts = [];
            foreach ($descriptions as $description) {
                if (in_array($description['type'], self::ELMOGEM_SPECIFIC_DESCRIPTION_TYPES, true)) {
                    $elmogem_texts[] = $description['description'];
                }
            }
            
            foreach ($descriptions as $description) {
                $dbType = $description['type'];
                $descriptionText = $description['description'];
                
                // Normalize the database value using the same function
                $normalizedDbType = $this->normalizeDescriptionType($dbType);
                
                // Validate against ICGEM enumeration (case-insensitive comparison)
                if (!in_array($normalizedDbType, $normalizedValidTypes, true)) {
                    error_log("Description type '$dbType' (normalized: '$normalizedDbType') not in ICGEM schema for resource $id, skipping");
                    continue;
                }
                
                // For Abstract, remove text that appears in ELMOGEM-specific descriptions
                if ($normalizedDbType === 'Abstract' && !empty($elmogem_texts)) {
                    $descriptionText = $this->removeElmogEmTextFromAbstract($descriptionText, $elmogem_texts);
                }
                
                // Add to XML with validated, normalized type
                $descriptionXml = $descriptionsXml->addChild('description', htmlspecialchars($descriptionText));
                $descriptionXml->addAttribute('type', $normalizedDbType);
            }
        }
    }
        /**
     * Creates an ICGEM-specific XML by extending the DataCite XML with additional properties.
     *
     * @param int $id The ID of the resource.
     * @return string The combined XML as a string.
     * @throws Exception If XML transformation or data fetching fails.
     */
    public function createICGEMxml(int $id): string
    {
        // 1. Check if the resource has actual GGM data.
        $ggmData = $this->getGGMData($this->connection, $id);
        if (empty($ggmData) || empty($ggmData['model_name'])) {
            throw new Exception("Resource with ID $id does not contain GGM data required for ICGEM XML.");
        }

        // 2. Get the base DataCite XML as a string.
        $datasetController = new DatasetController();
        $dataciteXmlString = $datasetController->transformAndSaveOrDownloadXml($id, 'datacite', false);

        // 3. Create the envelope root element
        $envelope = new SimpleXMLElement('<envelope/>');

        // 4. Import DataCite XML as <resource> with namespace
        $resourceXml = $envelope->addChild(
            'resource',
            null,
            'http://datacite.org/schema/kernel-4'
        );
        $resourceXml->addAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $resourceXml->addAttribute(
            'xsi:schemaLocation',
            'http://datacite.org/schema/kernel-4 '
        );

        $dataciteXml = new SimpleXMLElement($dataciteXmlString);
        foreach ($dataciteXml->children() as $child) {
            $this->simplexmlAppend($resourceXml, $child);
        }

        // 5. Add icgem_metadata element
        $icgemSpecificXml = $envelope->addChild('icgem_metadata');

        // 6. Fetch all the ICGEM-specific data
        $dataSources = $this->getDataSources($this->connection, $id);
        $topographicProperties = $this->getTopographicModelProperties($this->connection, $id);
        $temporalProperties = $this->getTemporalModelProperties($this->connection, $id);
        $staticProperties = $this->getStaticModelProperties($this->connection, $id);
        $ellipsoidalParameters = $this->getEllipsoidalParameters($this->connection, $id);

        // 7. Insert the fetched data into <icgem_metadata>
        $this->insertGgmProperties($icgemSpecificXml, $ggmData);
        $this->insertDescriptions($icgemSpecificXml, $id);
        $this->insertDataSources($icgemSpecificXml, $dataSources);
        $this->insertTopographicModelProperties($icgemSpecificXml, $topographicProperties);
        $this->insertTemporalModelProperties($icgemSpecificXml, $temporalProperties);
        $this->insertStaticModelProperties($icgemSpecificXml, $staticProperties);
        $this->insertEllipsoidalParameters($icgemSpecificXml, $ellipsoidalParameters);

        // 8. Format and return the final XML as a string.
        $dom = dom_import_simplexml($envelope)->ownerDocument;
        $dom->formatOutput = true;
        return $dom->saveXML();
    }

    /**
     * Helper to append one SimpleXMLElement to another.
     */
    protected function simplexmlAppend(SimpleXMLElement $to, SimpleXMLElement $from): void
    {
        $toDom = dom_import_simplexml($to);
        $fromDom = dom_import_simplexml($from);
        $toDom->appendChild($toDom->ownerDocument->importNode($fromDom, true));
    }
        /**
     * Exports an ICGEM-specific XML for a resource and outputs it directly.
     *
     * @param array<mixed> $vars An associative array containing 'id'.
     * @return void
     */
    public function exportICGEMxml(array $vars): void
    {
        $id = intval($vars['id']);

        try {
            $xmlString = $this->createICGEMxml($id);
            header('Content-Type: application/xml; charset=utf-8');
            echo $xmlString;
        } catch (Exception $e) {
            http_response_code(404); // Or 500 depending on the error
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit();
    }
}