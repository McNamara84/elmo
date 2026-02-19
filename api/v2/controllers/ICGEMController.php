<?php

class ICGEMController
{
    private const ICGEM_NAMESPACE_PREFIX = 'icgv';
    private const ICGEM_NAMESPACE_URI = 'http://icgem.gfz.de/schema';

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
                r.year as publication_year,
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
     * Retrieves descriptions for a given resource.
     *
     * @param mysqli $connection The database connection.
     * @param int $resource_id The ID of the resource.
     * @return array<mixed> An array of descriptions with section information.
     */
    function getDescriptions(mysqli $connection, int $resource_id): array
    {
        $descriptions = [];
        $stmt = $connection->prepare("
        SELECT 
            d.type as section,
            d.description as description
        FROM Description d
        WHERE d.resource_id = ?
        ORDER BY d.type ASC
        ");
        if (!$stmt) {
            $this->logger && $this->logger->error("Prepare failed for Resource Descriptions: " . $connection->error);
            return [];
        }
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $result = $stmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $descriptions[] = $row;
        }
        return $descriptions;
    }
    /**
     * Inserts descriptions into the XML at root level.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param array<int, array<string, mixed>> $descriptions The descriptions to insert.
     */
    protected function insertDescriptions(SimpleXMLElement $xml, array $descriptions): void
    {
        if ($descriptions) {
            foreach ($descriptions as $desc) {
                if (!empty($desc['description'])) {
                    $descElement = $xml->addChild(self::ICGEM_NAMESPACE_PREFIX . ':description', htmlspecialchars($desc['description']), self::ICGEM_NAMESPACE_URI);
                    $section = !empty($desc['section']) ? htmlspecialchars($desc['section']) : 'General model description';
                    $descElement->addAttribute('section', $section);
                }
            }
        }
    }

    /**
     * Inserts spherical harmonic model core properties into the sphericalHarmonicModel element.
     *
     * @param SimpleXMLElement $shm The sphericalHarmonicModel XML element.
     * @param array<string, mixed> $ggmData The GGM data to insert.
     */
    protected function insertSphericalHarmonicModelProperties(SimpleXMLElement $shm, ?array $ggmData): void
    {
        if ($ggmData) {
            if (!empty($ggmData['model_name'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':modelName', htmlspecialchars($ggmData['model_name']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['publication_year'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':publicationYear', htmlspecialchars($ggmData['publication_year']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['model_type_name'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':modelType', htmlspecialchars($ggmData['model_type_name']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['mathematical_representation_name'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':mathematicalRepresentation', htmlspecialchars($ggmData['mathematical_representation_name']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['product_type'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':productType', htmlspecialchars($ggmData['product_type']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['file_format_name'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':fileFormat', htmlspecialchars($ggmData['file_format_name']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['tide_system'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':tideSystem', htmlspecialchars($ggmData['tide_system']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['degree'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':degreeOrderMax', htmlspecialchars($ggmData['degree']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['earth_gravity_constant'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':earthGravityConstant', htmlspecialchars($ggmData['earth_gravity_constant']), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['radius'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':radius', htmlspecialchars($ggmData['radius']), self::ICGEM_NAMESPACE_URI);
            }
        }
    }

    /**
     * Inserts errors element into the spherical harmonic model.
     *
     * @param SimpleXMLElement $shm The sphericalHarmonicModel XML element.
     * @param array<string, mixed> $ggmData The GGM data.
     */
    protected function insertErrors(SimpleXMLElement $shm, array $ggmData): void
    {
        if (!empty($ggmData['errors'])) {
            $errorsElement = $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':errors', null, self::ICGEM_NAMESPACE_URI);
            $errorsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':errorsType', htmlspecialchars($ggmData['errors']), self::ICGEM_NAMESPACE_URI);
        }
    }

    /**
     * Inserts error handling element into the spherical harmonic model.
     *
     * @param SimpleXMLElement $shm The sphericalHarmonicModel XML element.
     * @param array<string, mixed> $ggmData The GGM data.
     */
    protected function insertErrorHandling(SimpleXMLElement $shm, array $ggmData): void
    {
        if (!empty($ggmData['error_handling_approach'])) {
            $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':errorHandling', htmlspecialchars($ggmData['error_handling_approach']), self::ICGEM_NAMESPACE_URI);
        }
    }
    /**
     * Inserts input data source elements into the XML at root level.
     *
     * @param SimpleXMLElement $xml The XML element to insert into.
     * @param array<int, array<string, mixed>> $dataSources The data sources to insert.
     */
    protected function insertInputDataSources(SimpleXMLElement $xml, array $dataSources): void
    {
        $typeMap = [
            'S' => 'Satellite',
            'G' => 'Ground data',
            'A' => 'Altimetry',
            'T' => 'Topographic',
            'M' => 'Model'
        ];

        if ($dataSources) {
            foreach ($dataSources as $dataSource) {
                $dsElement = $xml->addChild(self::ICGEM_NAMESPACE_PREFIX . ':inputDataSources', null, self::ICGEM_NAMESPACE_URI);
                
                // Map type code to human-readable name
                $sourceType = $typeMap[$dataSource['type']] ?? $dataSource['type'];
                $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':inputDataSourceType', htmlspecialchars($sourceType), self::ICGEM_NAMESPACE_URI);
                
                if (!empty($dataSource['description'])) {
                    $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':description', htmlspecialchars($dataSource['description']), self::ICGEM_NAMESPACE_URI);
                }
                
                // Handle different source types
                switch ($dataSource['type']) {
                    case 'S': // Satellite
                        if (!empty($dataSource['S_value_name'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':satelliteValueName', htmlspecialchars($dataSource['S_value_name']), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['S_value_uri'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':satelliteValueUri', htmlspecialchars($dataSource['S_value_uri']), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['S_scheme_name'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':satelliteSchemeName', htmlspecialchars($dataSource['S_scheme_name']), self::ICGEM_NAMESPACE_URI);
                        }
                        break;
                    
                    case 'G': // Ground data
                        if (!empty($dataSource['details'])) {
                            $groundDetailElement = $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':groundDetail', null, self::ICGEM_NAMESPACE_URI);
                            $groundDetailElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':description', htmlspecialchars($dataSource['details']), self::ICGEM_NAMESPACE_URI);
                        }
                        break;
                    
                    case 'A': // Altimetry
                        if (!empty($dataSource['details'])) {
                            $altimetryDetailElement = $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':altimetryDetail', null, self::ICGEM_NAMESPACE_URI);
                            $altimetryDetailElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':description', htmlspecialchars($dataSource['details']), self::ICGEM_NAMESPACE_URI);
                        }
                        break;
                    
                    case 'T': // Topographic/Elevation Terrain
                        if (!empty($dataSource['T_Isostasy_compensation_depth'])) {
                            $elevTerrainElement = $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':elevationTerrainDetail', null, self::ICGEM_NAMESPACE_URI);
                            $compDepthElement = $elevTerrainElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':compensationDepth', htmlspecialchars($dataSource['T_Isostasy_compensation_depth']), self::ICGEM_NAMESPACE_URI);
                            $compDepthElement->addAttribute('uom', 'm');
                        }
                        break;
                    
                    case 'M': // Model
                        $modelDetailElement = $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':modelDetail', null, self::ICGEM_NAMESPACE_URI);
                        if (!empty($dataSource['M_identifier'])) {
                            $modelDetailElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':identifier', htmlspecialchars($dataSource['M_identifier']), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['M_identifier_type'])) {
                            $modelDetailElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':identifierType', htmlspecialchars($dataSource['M_identifier_type']), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['M_name'])) {
                            $modelDetailElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':name', htmlspecialchars($dataSource['M_name']), self::ICGEM_NAMESPACE_URI);
                        }
                        break;
                }
            }
        }
    }
    /**
     * Inserts topographic model properties into spherical harmonic model.
     *
     * @param SimpleXMLElement $shm The sphericalHarmonicModel XML element.
     * @param array<int, array<string, mixed>> $topographicProperties The topographic model properties to insert.
     */
    protected function insertTopographicModelPropertiesIcgem(SimpleXMLElement $shm, array $topographicProperties): void
    {
        if ($topographicProperties) {
            foreach ($topographicProperties as $property) {
                $tmpElement = $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':topographicModelProperties', null, self::ICGEM_NAMESPACE_URI);
                
                if (!empty($property['layer_approach'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':layerApproach', htmlspecialchars($property['layer_approach']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['forward_modelling_domain'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':forwardModellingDomain', htmlspecialchars($property['forward_modelling_domain']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['approximation'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':approximation', htmlspecialchars($property['approximation']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['density_information'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':densityInformation', htmlspecialchars($property['density_information']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['density_information_details'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':densityInformationDetails', htmlspecialchars($property['density_information_details']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['mantle_density_information'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':mantleDensityInformation', htmlspecialchars($property['mantle_density_information']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['mantle_density_information_details'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':mantleDensityInformationDetails', htmlspecialchars($property['mantle_density_information_details']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['crust_density_information'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':crustDensityInformation', htmlspecialchars($property['crust_density_information']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['crust_density_information_details'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':crustDensityInformationDetails', htmlspecialchars($property['crust_density_information_details']), self::ICGEM_NAMESPACE_URI);
                }
            }
        }
    }
    /**
     * Inserts temporal model properties into spherical harmonic model.
     *
     * @param SimpleXMLElement $shm The sphericalHarmonicModel XML element.
     * @param array<int, array<string, mixed>> $temporalProperties The temporal model properties to insert.
     */
    protected function insertTemporalModelPropertiesIcgem(SimpleXMLElement $shm, array $temporalProperties): void
    {
        if ($temporalProperties) {
            foreach ($temporalProperties as $property) {
                $tmpElement = $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':temporalModelProperties', null, self::ICGEM_NAMESPACE_URI);
                
                if (!empty($property['start_date'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':startDate', htmlspecialchars($property['start_date']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['end_date'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':stopDate', htmlspecialchars($property['end_date']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['generating_institution'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':generatingInstitution', htmlspecialchars($property['generating_institution']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['release'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':release', htmlspecialchars($property['release']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['temporal_resolution_days'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':temporalResolutionDays', htmlspecialchars($property['temporal_resolution_days']), self::ICGEM_NAMESPACE_URI);
                }
            }
        }
    }
    /**
     * Inserts static model properties into spherical harmonic model.
     *
     * @param SimpleXMLElement $shm The sphericalHarmonicModel XML element.
     * @param array<int, array<string, mixed>> $staticProperties The static model properties to insert.
     */
    protected function insertStaticModelPropertiesIcgem(SimpleXMLElement $shm, array $staticProperties): void
    {
        if ($staticProperties) {
            foreach ($staticProperties as $property) {
                $smpElement = $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':staticModelProperties', null, self::ICGEM_NAMESPACE_URI);
                
                if (!empty($property['info_time_variable_coefficients'])) {
                    $smpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':infoTimeVariableCoefficients', htmlspecialchars($property['info_time_variable_coefficients']), self::ICGEM_NAMESPACE_URI);
                }
            }
        }
    }

    /**
     * Inserts ellipsoidal parameters into spherical harmonic model.
     *
     * @param SimpleXMLElement $shm The sphericalHarmonicModel XML element.
     * @param array<int, array<string, mixed>> $ellipsoidalParameters The ellipsoidal parameters to insert.
     */
    protected function insertEllipsoidalParametersIcgem(SimpleXMLElement $shm, array $ellipsoidalParameters): void
    {
        if ($ellipsoidalParameters) {
            $epElement = $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':ellipsoidalParameters', null, self::ICGEM_NAMESPACE_URI);
            foreach ($ellipsoidalParameters as $parameter) {
                if (!empty($parameter['semimajor_axis_a'])) {
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':semimajorAxisA', htmlspecialchars($parameter['semimajor_axis_a']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($parameter['semiminor_axis_b'])) {
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':semiminorAxisB', htmlspecialchars($parameter['semiminor_axis_b']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($parameter['flattening'])) {
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':flattening', htmlspecialchars($parameter['flattening']), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($parameter['reciprocal_flattening'])) {
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':reciprocalFlattening', htmlspecialchars($parameter['reciprocal_flattening']), self::ICGEM_NAMESPACE_URI);
                }
            }
        }
    }
    /**
     * Creates an ICGEM-specific XML file according to the ICGEM schema.
     *
     * @param int $id The ID of the resource.
     * @return string The ICGEM XML as a string.
     * @throws Exception If GGM data is missing or data fetching fails.
     */
    public function createICGEMxml(int $id): string
    {
        // 1. Verify that the resource has GGM data
        $ggmData = $this->getGGMData($this->connection, $id);
        if (empty($ggmData) || empty($ggmData['model_name'])) {
            throw new Exception("Resource with ID $id does not contain GGM data required for ICGEM XML.");
        }

        // 2. Create the root globalGravityProduct element with proper namespaces
        $xml = new SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<' . self::ICGEM_NAMESPACE_PREFIX . ':globalGravityProduct xmlns:' . self::ICGEM_NAMESPACE_PREFIX . '="' . self::ICGEM_NAMESPACE_URI . '" ' .
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' .
            'xsi:schemaLocation="' . self::ICGEM_NAMESPACE_URI . ' globalGravityProduct.xsd"/>'
        );

        // 3. Fetch all the ICGEM-specific data
        $descriptions = $this->getDescriptions($this->connection, $id);
        $dataSources = $this->getDataSources($this->connection, $id);
        $topographicProperties = $this->getTopographicModelProperties($this->connection, $id);
        $temporalProperties = $this->getTemporalModelProperties($this->connection, $id);
        $staticProperties = $this->getStaticModelProperties($this->connection, $id);
        $ellipsoidalParameters = $this->getEllipsoidalParameters($this->connection, $id);

        // 4. Insert descriptions at root level
        $this->insertDescriptions($xml, $descriptions);

        // 5. Create sphericalHarmonicModel container
        $shm = $xml->addChild(self::ICGEM_NAMESPACE_PREFIX . ':sphericalHarmonicModel', null, self::ICGEM_NAMESPACE_URI);

        // 6. Insert core GGM properties into sphericalHarmonicModel
        $this->insertSphericalHarmonicModelProperties($shm, $ggmData);
        $this->insertErrors($shm, $ggmData);
        $this->insertErrorHandling($shm, $ggmData);
        $this->insertTemporalModelPropertiesIcgem($shm, $temporalProperties);
        $this->insertTopographicModelPropertiesIcgem($shm, $topographicProperties);
        $this->insertStaticModelPropertiesIcgem($shm, $staticProperties);
        $this->insertEllipsoidalParametersIcgem($shm, $ellipsoidalParameters);

        // 7. Insert data sources at root level
        $this->insertInputDataSources($xml, $dataSources);

        // 8. Format and return the final XML as a string
        $dom = dom_import_simplexml($xml)->ownerDocument;
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