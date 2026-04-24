<?php
require_once __DIR__ . '/DatasetController.php';

class ICGEMController extends DatasetController
{
    private const ICGEM_NAMESPACE_PREFIX = 'grav';
    private const ICGEM_NAMESPACE_URI = 'http://icgem.gfz.de/schema';

    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Override of getResourceAsXml to ensure ICGEM XML always has a DOI (placeholder if not provided).
     * 
     * @param mysqli $connection The database connection.
     * @param int $id The resource ID.
     * @return string The generated XML as a string.
     */
    function getResourceAsXml($connection, $id): string
    {
        // Call parent implementation which returns XML string and saves it
        $xmlString = parent::getResourceAsXml($connection, $id);
        
        // Parse the returned XML string
        try {
            $resourceXml = new SimpleXMLElement($xmlString);
        } catch (Exception $e) {
            // If parsing fails, return the original
            return $xmlString;
        }
        
        // Check if DOI element exists and is empty
        $doiElement = $resourceXml->doi;
        if ($doiElement === null || trim((string)$doiElement) === '') {
            // Add placeholder DOI
            if ($doiElement !== null) {
                unset($resourceXml->doi);
            }
            $resourceXml->addChild('doi', htmlspecialchars('10.5072/placeholder'));
        }
        
        // Return the modified XML as string
        return $resourceXml->asXML();
    }

//----------------------------------DATA RETRIEVAL FUNCTIONS FOR ICGEM XML CREATION---------------------------------    
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
// ---------------------------------INSERTION FUNCTIONS FOR ICGEM XML CREATION--------------------------------- 
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
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':modelName', $this->prepare($ggmData['model_name'], 'modelName'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['publication_year'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':publicationYear', $this->prepare($ggmData['publication_year'], 'publicationYear'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['model_type_name'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':modelType', $this->prepare($ggmData['model_type_name'], 'modelType'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['mathematical_representation_name'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':mathematicalRepresentation', $this->prepare($ggmData['mathematical_representation_name'], 'mathematicalRepresentation'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['product_type'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':productType', $this->prepare($ggmData['product_type'], 'productType'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['celestial_body'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':celestialBody', $this->prepare($ggmData['celestial_body'], 'celestialBody'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['file_format_name'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':fileFormat', $this->prepare($ggmData['file_format_name'], 'fileFormat'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['tide_system'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':tideSystem', $this->prepare($ggmData['tide_system'], 'tideSystem'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['degree'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':degreeOrderMax', $this->prepare($ggmData['degree'], 'degreeOrderMax'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['radius'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':radius', $this->prepare($ggmData['radius'], 'radius'), self::ICGEM_NAMESPACE_URI);
            }
            if (!empty($ggmData['earth_gravity_constant'])) {
                $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':earthGravityConstant', $this->prepare($ggmData['earth_gravity_constant'], 'earthGravityConstant'), self::ICGEM_NAMESPACE_URI);
            }
        }
    }

    /**
     * Inserts errors and errorHandling as direct siblings on the harmonicCoefficientsModel element.
     *
     * @param SimpleXMLElement $shm The sphericalHarmonicModel XML element.
     * @param array<string, mixed> $ggmData The GGM data.
     */
    protected function insertErrors(SimpleXMLElement $shm, array $ggmData): void
    {
        if (!empty($ggmData['errors'])) {
            $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':errors', $this->prepare($ggmData['errors'], 'errorType'), self::ICGEM_NAMESPACE_URI);
        }
        if (!empty($ggmData['error_handling_approach'])) {
            $shm->addChild(self::ICGEM_NAMESPACE_PREFIX . ':errorHandling', $this->prepare($ggmData['error_handling_approach'], 'errorHandling'), self::ICGEM_NAMESPACE_URI);
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
            'T' => 'Elevation/Terrain',
            'M' => 'Model'
        ];

        if ($dataSources) {
            foreach ($dataSources as $dataSource) {
                $dsElement = $xml->addChild(self::ICGEM_NAMESPACE_PREFIX . ':inputDataSource', null, self::ICGEM_NAMESPACE_URI);
                
                // Map type code to human-readable name and set as attribute
                $sourceType = $typeMap[$dataSource['type']] ?? $dataSource['type'];
                $dsElement->addAttribute('type', $sourceType);
                
                if (!empty($dataSource['description'])) {
                    $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':description', $this->prepare($dataSource['description'], 'description'), self::ICGEM_NAMESPACE_URI);
                }
                
                // Handle different source types
                switch ($dataSource['type']) {
                    case 'S': // Satellite
                        if (!empty($dataSource['S_value_name'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':satelliteValueName', $this->prepare($dataSource['S_value_name'], 'satelliteValueName'), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['S_value_uri'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':satelliteValueUri', $this->prepare($dataSource['S_value_uri'], 'satelliteValueUri'), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['S_scheme_name'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':satelliteSchemeName', $this->prepare($dataSource['S_scheme_name'], 'satelliteSchemeName'), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['S_scheme_uri'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':satelliteSchemeUri', $this->prepare($dataSource['S_scheme_uri'], 'satelliteSchemeUri'), self::ICGEM_NAMESPACE_URI);
                        }
                        break;
                    
                    case 'G': // Ground data
                        if (!empty($dataSource['details'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':groundDetail', $this->prepare($dataSource['details'], 'description'), self::ICGEM_NAMESPACE_URI);
                        }
                        break;
                    
                    case 'A': // Altimetry
                        if (!empty($dataSource['details'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':altimetryDetail', $this->prepare($dataSource['details'], 'description'), self::ICGEM_NAMESPACE_URI);
                        }
                        break;
                    
                    case 'T': // Topographic/Elevation Terrain
                        if (!empty($dataSource['details'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':elevationTerrainDetail', $this->prepare($dataSource['details'], 'description'), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['T_Isostasy_compensation_depth'])) {
                            $uom = 'm';
                            if (in_array($uom, self::ALLOWED_UOM_VALUES, true)) {
                                $compDepthElement = $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':compensationDepth', $this->prepare($dataSource['T_Isostasy_compensation_depth'], 'compensationDepth'), self::ICGEM_NAMESPACE_URI);
                                $compDepthElement->addAttribute('uom', $uom);
                            }
                        }
                        break;
                    
                    case 'M': // Model
                        if (!empty($dataSource['details'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':modelDetail', $this->prepare($dataSource['details'], 'description'), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['M_identifier'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':identifier', $this->prepare($dataSource['M_identifier'], 'identifier'), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['M_identifier_type'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':identifierType', $this->prepare($dataSource['M_identifier_type'], 'identifierType'), self::ICGEM_NAMESPACE_URI);
                        }
                        if (!empty($dataSource['M_name'])) {
                            $dsElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':name', $this->prepare($dataSource['M_name'], 'name'), self::ICGEM_NAMESPACE_URI);
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
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':layerApproach', $this->prepare($property['layer_approach'], 'layerApproach'), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['forward_modelling_domain'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':forwardModellingDomain', $this->prepare($property['forward_modelling_domain'], 'forwardModellingDomain'), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['approximation'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':approximation', $this->prepare($property['approximation'], 'approximation'), self::ICGEM_NAMESPACE_URI);
                }
                
                // Insert nested densityInformation elements for each domain (Whole, Mantle, Crust)
                // Domain: Whole
                if (!empty($property['density_information'])) {
                    $this->insertDensityInformationElement(
                        $tmpElement,
                        'Whole',
                        $property['density_information'],
                        $property['density_information_details'] ?? null
                    );
                }
                
                // Domain: Mantle
                if (!empty($property['mantle_density_information'])) {
                    $this->insertDensityInformationElement(
                        $tmpElement,
                        'Mantle',
                        $property['mantle_density_information'],
                        $property['mantle_density_information_details'] ?? null
                    );
                }
                
                // Domain: Crust
                if (!empty($property['crust_density_information'])) {
                    $this->insertDensityInformationElement(
                        $tmpElement,
                        'Crust',
                        $property['crust_density_information'],
                        $property['crust_density_information_details'] ?? null
                    );
                }
            }
        }
    }

    /**
     * Inserts a single densityInformation element with required child elements.
     *
     * @param SimpleXMLElement $parentElement The parent element to insert into.
     * @param string $domain The density information domain (Whole, Mantle, or Crust).
     * @param string $informationType The type of density information (enumeration value).
     * @param string|null $description Optional description of the density information.
     */
    private function insertDensityInformationElement(
        SimpleXMLElement $parentElement,
        string $domain,
        string $informationType,
        ?string $description
    ): void
    {
        $densityElement = $parentElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':densityInformation', null, self::ICGEM_NAMESPACE_URI);
        
        // Add required domain element
        $densityElement->addChild(
            self::ICGEM_NAMESPACE_PREFIX . ':densityInformationDomain',
            $this->prepare($domain, 'densityInformationDomain'),
            self::ICGEM_NAMESPACE_URI
        );
        
        // Add required type element
        $densityElement->addChild(
            self::ICGEM_NAMESPACE_PREFIX . ':densityInformationType',
            $this->prepare($informationType, 'densityInformationType'),
            self::ICGEM_NAMESPACE_URI
        );
        
        // Add optional description element
        if (!empty($description)) {
            $densityElement->addChild(
                self::ICGEM_NAMESPACE_PREFIX . ':densityInformationDescription',
                $this->prepare($description, 'densityInformationDescription'),
                self::ICGEM_NAMESPACE_URI
            );
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
                
                $hasStart = !empty($property['start_date']);
                $hasEnd = !empty($property['end_date']);
                if ($hasStart || $hasEnd) {
                    $startPart = $hasStart ? $property['start_date'] : 'unknown';
                    $endPart = $hasEnd ? $property['end_date'] : 'open';
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':temporalCoverage', htmlspecialchars($startPart . '/' . $endPart), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['generating_institution'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':generatingInstitution', $this->prepare($property['generating_institution'], 'generatingInstitution'), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['release'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':release', $this->prepare($property['release'], 'release'), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($property['temporal_resolution_days'])) {
                    $tmpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':temporalResolution', $this->prepare($property['temporal_resolution_days'], 'temporalResolution'), self::ICGEM_NAMESPACE_URI);
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
                    $smpElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':infoTimeVariableCoefficients', $this->prepare($property['info_time_variable_coefficients'], 'infoTimeVariableCoefficients'), self::ICGEM_NAMESPACE_URI);
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
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':semimajorAxisA', $this->prepare($parameter['semimajor_axis_a'], 'semimajorAxisA'), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($parameter['semiminor_axis_b'])) {
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':semiminorAxisB', $this->prepare($parameter['semiminor_axis_b'], 'semiminorAxisB'), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($parameter['flattening'])) {
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':flattening', $this->prepare($parameter['flattening'], 'flattening'), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($parameter['reciprocal_flattening'])) {
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':reciprocalFlattening', $this->prepare($parameter['reciprocal_flattening'], 'reciprocalFlattening'), self::ICGEM_NAMESPACE_URI);
                }
                if (!empty($parameter['excentricity'])) {
                    $epElement->addChild(self::ICGEM_NAMESPACE_PREFIX . ':eccentricity', $this->prepare($parameter['excentricity'], 'eccentricity'), self::ICGEM_NAMESPACE_URI);
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
    /**
     * Fields that require enumeration-style normalization (first letter capital).
     * These correspond to ICGEM XSD enumeration types.
     * Non-enumeration fields (numeric values, URIs) are excluded.
     * This basically has to list all the variables with enum values in the schema 
     * @var array<string>
     */
    private const ALLOWED_UOM_VALUES = ['m', 'm/s', 'm/s²'];

    private const ENUMERATION_FIELDS = [
        'errorType', 
        'descriptionSection', 
        'modelType', 
        'groundDetails', 
        'inputDataSourceType', 
        'tideSystem', 
        'mathematicalRepresentation',
        'forwardModellingDomain',
        'approximation',
        'layerApproach',
        'modelDetails',
        'altimetryDetails',
        'elevationTerrainDetails',
        'densityInformationType',
        'densityInformationDomain'
    ];

    private const ICGEM_DESCRIPTION_TYPES = [
        'Abstract',
        'General model description',
        'Input data',
        'Processing procedures',
        'Specific features of resulting gravity field',
        'Other'
    ];

    /**
     * Prepares a value for XML output by escaping and optionally capitalizing.
     * 
     * Enumeration fields (defined in ENUMERATION_FIELDS) are capitalized
     * (first letter uppercase, rest as-is) to match XSD enumeration requirements.
     * All other fields are passed through as-is (but always HTML-escaped).
     *
     * @param string $value The value to prepare.
     * @param string $fieldName The XML field name to determine if normalization applies.
     * @return string The prepared value, HTML-escaped and possibly capitalized.
     */
    private function prepare(string $value, string $fieldName): string
    {
        $trimmed = trim($value);
        
        // Replace spaces with dashes in tide system
        if ($fieldName === 'tideSystem') {
            $trimmed = str_replace(' ', '-', $trimmed);
        }

        // replace underscores and dashes with spaces in density information type, then collapse multiple spaces to single
        if ($fieldName === 'densityInformationType') {
            // a special case for Density model 
            $trimmed = str_replace(['ensity-model'], 'ensity model', $trimmed);
            $trimmed = str_replace(['_'], ' ', $trimmed);
            $trimmed = preg_replace('/\s+/', ' ', $trimmed) ?? $trimmed;
        }
        
        // Capitalize if this is an enumeration field
        if (in_array($fieldName, self::ENUMERATION_FIELDS, true)) {
            $trimmed = ucfirst($trimmed);
        }
        
        return htmlspecialchars($trimmed);
    }

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
                $descriptionXml = $descriptionsXml->addChild('description', $this->prepare($descriptionText, 'description'));
                $descriptionXml->addAttribute('section', $normalizedDbType);
            }
        }
    }
        /**
     * Replaces hardcoded local file paths in DataCite XML with proper remote schema URLs.
     * The XSLT that generates DataCite XML includes hardcoded Windows file paths
     * which need to be replaced for production environments.
     *
     * @param string $dataciteXmlString The DataCite XML string with potentially hardcoded paths.
     * @return string The cleaned XML with proper schema URLs.
     */
    private function cleanDataCiteSchemaLocation(string $dataciteXmlString): string
    {
        // Replace hardcoded Windows file paths with the official DataCite schema URL
        $dataciteXmlString = preg_replace(
            '/file:.*?DataCiteSchema\d+\.xsd/',
            'https://schema.datacite.org/meta/kernel-4.7/metadata.xsd',
            $dataciteXmlString
        );
        
        return $dataciteXmlString;
    }

    /**
     * Creates an ICGEM-specific XML by combining DataCite and ICGEM metadata in an envelope.
     *
     * @param int $id The ID of the resource.
     * @return string The combined XML as a string with envelope containing DataCite and ICGEM children.
     * @throws Exception If GGM data is missing or data fetching fails.
     */
    public function createICGEMxml(int $id): string
    {
        // 1. Verify that the resource has GGM data
        $ggmData = $this->getGGMData($this->connection, $id);
        if (empty($ggmData) || empty($ggmData['model_name'])) {
            throw new Exception("Resource with ID $id does not contain GGM data required for ICGEM XML.");
        }
        
        // 2. Get DataCite XML as string and clean schema location
        $dataciteXmlString = $this->transformAndSaveOrDownloadXml($id, "datacite");
        $dataciteXmlString = $this->cleanDataCiteSchemaLocation($dataciteXmlString);
        
        // 3. Create envelope root with ICGEM as primary namespace and DataCite as secondary
        $envelope = new SimpleXMLElement(
            '<?xml version="1.0" encoding="UTF-8"?>' .
            '<icgv:envelope xmlns:icgv="' . self::ICGEM_NAMESPACE_URI . '" ' .
            'xmlns:dc="http://datacite.org/schema/kernel-4" ' .
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' .
            'xsi:schemaLocation="' . self::ICGEM_NAMESPACE_URI . ' http://icgem.gfz.de/schema/icgemSchemaBase.xsd"/>'
        );
        
        // 4. Parse DataCite XML and append it to envelope
        try {
            $dataciteXml = new SimpleXMLElement($dataciteXmlString);
            $this->simplexmlAppend($envelope, $dataciteXml);
        } catch (Exception $e) {
            throw new Exception("Failed to parse DataCite XML: " . $e->getMessage());
        }
        
        // 5. Fetch all the ICGEM-specific data
        $dataSources = $this->getDataSources($this->connection, $id);
        $topographicProperties = $this->getTopographicModelProperties($this->connection, $id);
        $temporalProperties = $this->getTemporalModelProperties($this->connection, $id);
        $staticProperties = $this->getStaticModelProperties($this->connection, $id);
        $ellipsoidalParameters = $this->getEllipsoidalParameters($this->connection, $id);
        
        // 6. Create ICGEM globalGravityProduct as child of envelope
        $icgempart = $envelope->addChild(self::ICGEM_NAMESPACE_PREFIX . ':globalGravityProduct', null, self::ICGEM_NAMESPACE_URI);
        
        // 7. Create harmonicCoefficientsModel container (FIRST per XSD sequence)
        $shm = $icgempart->addChild(self::ICGEM_NAMESPACE_PREFIX . ':harmonicCoefficientsModel', null, self::ICGEM_NAMESPACE_URI);
        
        // 8. Insert core GGM properties into harmonicCoefficientsModel
        $this->insertSphericalHarmonicModelProperties($shm, $ggmData);
        $this->insertErrors($shm, $ggmData);
        $this->insertTemporalModelPropertiesIcgem($shm, $temporalProperties);
        $this->insertTopographicModelPropertiesIcgem($shm, $topographicProperties);
        $this->insertStaticModelPropertiesIcgem($shm, $staticProperties);
        $this->insertEllipsoidalParametersIcgem($shm, $ellipsoidalParameters);
        
        // 9. Insert data sources (SECOND per XSD sequence)
        $this->insertInputDataSources($icgempart, $dataSources);
        
        // 10. Insert descriptions (THIRD per XSD sequence)
        $this->insertDescriptions($icgempart, $id);
        
        // 11. Format and return the combined envelope XML
        $dom = dom_import_simplexml($envelope)->ownerDocument;
        $dom->formatOutput = true;
        $xml = $dom->saveXML();
        
        // Ensure no leading whitespace that would break XML declaration
        return ltrim($xml);
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
            // Clear any output buffering to ensure clean XML output
            if (ob_get_level()) {
                ob_end_clean();
            }
            
            $xmlString = $this->createICGEMxml($id);
            
            // Extra safeguard: ensure no leading whitespace
            $xmlString = ltrim($xmlString);
            
            header('Content-Type: application/xml; charset=utf-8');
            echo $xmlString;
        } catch (Exception $e) {
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit();
    }
}