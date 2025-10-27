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
                ggm.Model_Name as model_name, 
                ggm.Celestial_Body as celestial_body,
                ggm.Product_Type as product_type,
                ggm.Errors as errors,
                ggm.Error_Handling_Approach as error_handling_approach,
                ggm.Error_Description as error_description,
                ggm.Tide_System as tide_system,
                ggm.degree as degree,
                ggm.radius as radius,
                ggm.earth_gravity_constant as earth_gravity_constant,
                ggm.info_time_variable_coefficients as info_time_variable_coefficients
            FROM Resource r
            LEFT JOIN Model_Type mt ON r.Model_type_id = mt.Model_type_id
            LEFT JOIN Mathematical_Representation mr ON r.Mathematical_Representation_id = mr.Mathematical_representation_id
            LEFT JOIN File_Format ff ON r.File_format_id = ff.File_format_id
            LEFT JOIN Resource_has_GGM_Properties rhg ON r.resource_id = rhg.Resource_resource_id
            LEFT JOIN GGM_Properties ggm ON rhg.GGM_Properties_GGM_Properties_id = ggm.GGM_Properties_id
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
            ds.S_value_name as s_value_name,
            ds.S_value_uri as s_value_uri,
            ds.S_scheme_name as s_scheme_name,  
            ds.S_scheme_uri as s_scheme_uri,
            ds.G_details as g_details,
            ds.A_details as a_details,
            ds.T_details as t_details,
            ds.T_Isostasy_compensation_depth as t_isostasy_compensation_depth,
            ds.M_details as m_details,
            ds.M_identifier as m_identifier,
            ds.M_identifier_type as m_identifier_type
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
            tmp.mantle_density_value,
            tmp.mantle_density_description,
            tmp.crust_density_value,
            tmp.crust_density_description,
            tmp.approximation,
            tmp.description
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
        tmp.end_date
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
                $ggmPropertiesXml->addChild('model_name', htmlspecialchars($ggmData['model_name']));
            }
            if (!empty($ggmData['celestial_body'])) {
                $ggmPropertiesXml->addChild('celestial_body', htmlspecialchars($ggmData['celestial_body']));
            }
            if (!empty($ggmData['product_type'])) {
                $ggmPropertiesXml->addChild('product_type', htmlspecialchars($ggmData['product_type']));
            }
            if (!empty($ggmData['errors'])) {
                $ggmPropertiesXml->addChild('errors', htmlspecialchars($ggmData['errors']));
            }
            if (!empty($ggmData['error_handling_approach'])) {
                $ggmPropertiesXml->addChild('error_handling_approach', htmlspecialchars($ggmData['error_handling_approach']));
            }
            if (!empty($ggmData['error_description'])) {
                $ggmPropertiesXml->addChild('error_description', htmlspecialchars($ggmData['error_description']));
            }
            if (!empty($ggmData['tide_system'])) {
                $ggmPropertiesXml->addChild('tide_system', htmlspecialchars($ggmData['tide_system']));
            }
            if (!empty($ggmData['degree'])) {
                $ggmPropertiesXml->addChild('degree', htmlspecialchars($ggmData['degree']));
            }
            if (!empty($ggmData['radius'])) {
                $ggmPropertiesXml->addChild('radius', htmlspecialchars($ggmData['radius']));
            }
            if (!empty($ggmData['earth_gravity_constant'])) {
                $ggmPropertiesXml->addChild('earth_gravity_constant', htmlspecialchars($ggmData['earth_gravity_constant']));
            }
            if (!empty($ggmData['model_type_name'])) {
                $ggmPropertiesXml->addChild('model_type', htmlspecialchars($ggmData['model_type_name']));
            }
            if (!empty($ggmData['mathematical_representation_name'])) {
                $ggmPropertiesXml->addChild('mathematical_representation', htmlspecialchars($ggmData['mathematical_representation_name']));
            }
            if (!empty($ggmData['file_format_name'])) {
                $ggmPropertiesXml->addChild('file_format', htmlspecialchars($ggmData['file_format_name']));
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
                
                // Standardized properties (S_ prefix = Standard)
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
                
                // Domain-specific details
                if (!empty($dataSource['G_details'])) {
                    $dataSourceXml->addChild('G_Details', htmlspecialchars($dataSource['G_details']));
                }
                if (!empty($dataSource['A_details'])) {
                    $dataSourceXml->addChild('A_Details', htmlspecialchars($dataSource['A_details']));
                }
                if (!empty($dataSource['T_details'])) {
                    $dataSourceXml->addChild('Topography_Details', htmlspecialchars($dataSource['T_details']));
                }
                if (!empty($dataSource['T_Isostasy_compensation_depth'])) {
                    $dataSourceXml->addChild('IsostasyCompensationDepth', htmlspecialchars($dataSource['T_Isostasy_compensation_depth']));
                }
                if (!empty($dataSource['M_details'])) {
                    $dataSourceXml->addChild('M_Details', htmlspecialchars($dataSource['M_details']));
                }
                if (!empty($dataSource['M_identifier'])) {
                    $dataSourceXml->addChild('M_Identifier', htmlspecialchars($dataSource['M_identifier']));
                }
                if (!empty($dataSource['M_identifier_type'])) {
                    $dataSourceXml->addChild('M_Identifier_Type', htmlspecialchars($dataSource['M_identifier_type']));
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
                if (!empty($property['density_information'])) {
                    $propertyXml->addChild('densityInformation', htmlspecialchars($property['density_information']));
                }
                if (!empty($property['density_information_details'])) {
                    $propertyXml->addChild('densityInformationDetails', htmlspecialchars($property['density_information_details']));
                }
                if (!empty($property['mantle_density_value'])) {
                    $propertyXml->addChild('mantleDensityValue', htmlspecialchars($property['mantle_density_value']));
                }
                if (!empty($property['mantle_density_description'])) {
                    $propertyXml->addChild('mantleDensityDescription', htmlspecialchars($property['mantle_density_description']));
                }
                if (!empty($property['crust_density_value'])) {
                    $propertyXml->addChild('crustDensityValue', htmlspecialchars($property['crust_density_value']));
                }
                if (!empty($property['crust_density_description'])) {
                    $propertyXml->addChild('crustDensityDescription', htmlspecialchars($property['crust_density_description']));
                }
                if (!empty($property['approximation'])) {
                    $propertyXml->addChild('approximation', htmlspecialchars($property['approximation']));
                }
                if (!empty($property['description'])) {
                    $propertyXml->addChild('description', htmlspecialchars($property['description']));
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
                
                if (isset($property['generating_institution'])) {
                    $propertyXml->addChild('generatingInstitution', htmlspecialchars($property['generating_institution'] ? 'true' : 'false'));
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
            // Throw an exception to be caught by the calling export function.
            // This is a clean way to signal that the operation cannot proceed.
            throw new Exception("Resource with ID $id does not contain GGM data required for ICGEM XML.");
        }

        // 2. Get the base DataCite XML as a string.
        // Create an instance of DatasetController to access its methods
        $datasetController = new DatasetController();
        $dataciteXmlString = $datasetController->transformAndSaveOrDownloadXml($id, 'datacite', false);

        // 3. Load the DataCite XML into a SimpleXMLElement object.
        $xml = new SimpleXMLElement($dataciteXmlString);

        // 4. Add the new parent element for ICGEM-specific data.
        $icgemSpecificXml = $xml->addChild('icgem_metadata');

        // 5. Fetch all the ICGEM-specific data using existing methods.
        // We already have ggmData, so we don't need to fetch it again.
        $dataSources = $this->getDataSources($this->connection, $id);
        $topographicProperties = $this->getTopographicModelProperties($this->connection, $id);
        $temporalProperties = $this->getTemporalModelProperties($this->connection, $id);
        $ellipsoidalParameters = $this->getEllipsoidalParameters($this->connection, $id);

        // 6. Insert the fetched data into the new <icgem_metadata> element.
        $this->insertGgmProperties($icgemSpecificXml, $ggmData);
        $this->insertDataSources($icgemSpecificXml, $dataSources);
        $this->insertTopographicModelProperties($icgemSpecificXml, $topographicProperties);
        $this->insertTemporalModelProperties($icgemSpecificXml, $temporalProperties);
        $this->insertEllipsoidalParameters($icgemSpecificXml, $ellipsoidalParameters);

        // 7. Format and return the final XML as a string.
        $dom = dom_import_simplexml($xml)->ownerDocument;
        $dom->formatOutput = true;
        return $dom->saveXML();
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
