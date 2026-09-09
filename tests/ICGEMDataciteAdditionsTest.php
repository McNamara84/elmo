<?php
// This covers applyElmoGemAdditionsToDataciteXml

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/save_to_db_helper.php';

$GLOBALS['testXmlNoNamespace'] = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<envelope>
    
<resource xmlns="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI"/>
  <creators/>
  <titles/>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear/>
  <resourceType resourceTypeGeneral=""/>
  <subjects/>
  <contributors/>
  <dates>
    
  </dates>
  <language>en</language>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" schemeURI="https://spdx.org/licenses/" xml:lang="en">Creative Commons Attribution 4.0 International</rights>
  </rightsList>
  <descriptions/>
  <geoLocations/>
</resource>


    
<MD_Metadata xmlns="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco" xmlns:gsr="http://www.isotc211.org/2005/gsr" xmlns:gss="http://www.isotc211.org/2005/gss" xmlns:gts="http://www.isotc211.org/2005/gts" xmlns:gml="http://www.opengis.net/gml" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.isotc211.org/2005/gmd file:///C:/xampp/htdocs/msl-mde/schemas/ISO/gmd.xsd">
  <fileIdentifier>
    <gco:CharacterString>doi:N/A</gco:CharacterString>
  </fileIdentifier>
  <language>
    <LanguageCode codeList="http://www.loc.gov/standards/iso639-1/" codeListValue="en">en</LanguageCode>
  </language>
  <characterSet>
    <MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_CharacterSetCode" codeListValue="utf8"/>
  </characterSet>
  <hierarchyLevel>
    <MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset">dataset</MD_ScopeCode>
  </hierarchyLevel>
  <contact>
    <CI_ResponsibleParty>
      <organisationName>
        <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
      </organisationName>
      <contactInfo>
        <CI_Contact>
          <address>
            <CI_Address>
              <electronicMailAddress>
                <gco:CharacterString>lis-it@gfz.de</gco:CharacterString>
              </electronicMailAddress>
            </CI_Address>
          </address>
          <onlineResource>
            <CI_OnlineResource>
              <linkage>
                <URL>https://www.gfz.de/</URL>
              </linkage>
              <name>
                <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
              </name>
              <description>
                <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
              </description>
              <function>
                <CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</CI_OnLineFunctionCode>
              </function>
            </CI_OnlineResource>
          </onlineResource>
        </CI_Contact>
      </contactInfo>
      <role>
        <CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</CI_RoleCode>
      </role>
    </CI_ResponsibleParty>
  </contact>
  <dateStamp>
    <gco:Date>2026-09-09</gco:Date>
  </dateStamp>
  <referenceSystemInfo>
    <MD_ReferenceSystem>
      <referenceSystemIdentifier>
        <RS_Identifier>
          <code>
            <gco:CharacterString>urn:ogc:def:crs:EPSG:4326</gco:CharacterString>
          </code>
        </RS_Identifier>
      </referenceSystemIdentifier>
    </MD_ReferenceSystem>
  </referenceSystemInfo>
  <identificationInfo>
    <MD_DataIdentification>
      <citation>
        <CI_Citation>
          <title/>
          
        </CI_Citation>
      </citation>
      <abstract/>
      <descriptiveKeywords/>
      <descriptiveKeywords/>
      <resourceConstraints xlink:href="https://creativecommons.org/licenses/by/4.0/legalcode">
        <MD_Constraints>
          <useLimitation>
            <gco:CharacterString>Creative Commons Attribution 4.0 International</gco:CharacterString>
          </useLimitation>
        </MD_Constraints>
      </resourceConstraints>
      <resourceConstraints>
        <MD_LegalConstraints>
          <accessConstraints>
            <MD_RestrictionCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_RestrictionCode" codeListValue="otherRestrictions"/>
          </accessConstraints>
          <otherConstraints>
            <gco:CharacterString>Creative Commons Attribution 4.0 International</gco:CharacterString>
          </otherConstraints>
        </MD_LegalConstraints>
      </resourceConstraints>
      <resourceConstraints>
        <MD_SecurityConstraints>
          <classification>
            <MD_ClassificationCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_ClassificationCode" codeListValue="unclassified"/>
          </classification>
        </MD_SecurityConstraints>
      </resourceConstraints>
      <language>
        <gco:CharacterString>en</gco:CharacterString>
      </language>
      <characterSet>
        <MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_CharacterSetCode" codeListValue="utf8"/>
      </characterSet>
      <topicCategory>
        <MD_TopicCategoryCode>geoscientificInformation</MD_TopicCategoryCode>
      </topicCategory>
    </MD_DataIdentification>
  </identificationInfo>
  <distributionInfo>
    <MD_Distribution>
      <transferOptions>
        <MD_DigitalTransferOptions>
          <onLine>
            <CI_OnlineResource>
              <linkage>
                <URL>http://doi.org/N/A</URL>
              </linkage>
              <protocol>
                <gco:CharacterString>WWW:LINK-1.0-http--link</gco:CharacterString>
              </protocol>
              <name>
                <gco:CharacterString>Download</gco:CharacterString>
              </name>
              <description>
                <gco:CharacterString>Download</gco:CharacterString>
              </description>
              <function>
                <CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</CI_OnLineFunctionCode>
              </function>
            </CI_OnlineResource>
          </onLine>
        </MD_DigitalTransferOptions>
      </transferOptions>
    </MD_Distribution>
  </distributionInfo>
  <dataQualityInfo>
    <DQ_DataQuality>
      <scope>
        <DQ_Scope>
          <level>
            <MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset"/>
          </level>
        </DQ_Scope>
      </scope>
    </DQ_DataQuality>
  </dataQualityInfo>
</MD_Metadata>


</envelope>
XML;

$GLOBALS['expectedXmlNoNamespace'] = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<envelope>
    
<resource xmlns="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI"/>
  <creators/>
  <titles/>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear/>
  <resourceType resourceTypeGeneral=""/>
  <subjects>
    <subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/6bbbf7b0-434b-4dbc-9fe8-e5e31fe99614">GEOID CHARACTERISTICS</subject>
    <subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/221386f6-ef9b-4990-82b3-f990b0fe39fa">GRAVITY/GRAVITATIONAL FIELD</subject>
  </subjects>
  <contributors>
    <contributor contributorType="DataCurator">
        <contributorName nameType="Personal">Ince, E. Sinem</contributorName>
        <givenName>E. Sinem</givenName>
        <familyName>Ince</familyName>
        <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-3393-1392</nameIdentifier>
        <affiliation>GFZ Helmholtz Centre for Geosciences, Potsdam, Germany</affiliation>
    </contributor>
    <contributor contributorType="DataManager">
        <contributorName nameType="Personal">Reißland, Sven</contributorName>
        <givenName>Sven</givenName>
        <familyName>Reißland</familyName>
        <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0001-6293-5336</nameIdentifier>
        <affiliation>GFZ Helmholtz Centre for Geosciences, Potsdam, Germany</affiliation>
    </contributor>
  </contributors>
  <dates>
    
  </dates>
  <language>en</language>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" schemeURI="https://spdx.org/licenses/" xml:lang="en">Creative Commons Attribution 4.0 International</rights>
  </rightsList>
  <descriptions/>
  <geoLocations/>
  <formats>
    <format>ICGEM-format</format>
  </formats>
</resource>


    
<MD_Metadata xmlns="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco" xmlns:gsr="http://www.isotc211.org/2005/gsr" xmlns:gss="http://www.isotc211.org/2005/gss" xmlns:gts="http://www.isotc211.org/2005/gts" xmlns:gml="http://www.opengis.net/gml" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.isotc211.org/2005/gmd file:///C:/xampp/htdocs/msl-mde/schemas/ISO/gmd.xsd">
  <fileIdentifier>
    <gco:CharacterString>doi:N/A</gco:CharacterString>
  </fileIdentifier>
  <language>
    <LanguageCode codeList="http://www.loc.gov/standards/iso639-1/" codeListValue="en">en</LanguageCode>
  </language>
  <characterSet>
    <MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_CharacterSetCode" codeListValue="utf8"/>
  </characterSet>
  <hierarchyLevel>
    <MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset">dataset</MD_ScopeCode>
  </hierarchyLevel>
  <contact>
    <CI_ResponsibleParty>
      <organisationName>
        <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
      </organisationName>
      <contactInfo>
        <CI_Contact>
          <address>
            <CI_Address>
              <electronicMailAddress>
                <gco:CharacterString>lis-it@gfz.de</gco:CharacterString>
              </electronicMailAddress>
            </CI_Address>
          </address>
          <onlineResource>
            <CI_OnlineResource>
              <linkage>
                <URL>https://www.gfz.de/</URL>
              </linkage>
              <name>
                <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
              </name>
              <description>
                <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
              </description>
              <function>
                <CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</CI_OnLineFunctionCode>
              </function>
            </CI_OnlineResource>
          </onlineResource>
        </CI_Contact>
      </contactInfo>
      <role>
        <CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</CI_RoleCode>
      </role>
    </CI_ResponsibleParty>
  </contact>
  <dateStamp>
    <gco:Date>2026-09-09</gco:Date>
  </dateStamp>
  <referenceSystemInfo>
    <MD_ReferenceSystem>
      <referenceSystemIdentifier>
        <RS_Identifier>
          <code>
            <gco:CharacterString>urn:ogc:def:crs:EPSG:4326</gco:CharacterString>
          </code>
        </RS_Identifier>
      </referenceSystemIdentifier>
    </MD_ReferenceSystem>
  </referenceSystemInfo>
  <identificationInfo>
    <MD_DataIdentification>
      <citation>
        <CI_Citation>
          <title/>
          
        </CI_Citation>
      </citation>
      <abstract/>
      <descriptiveKeywords/>
      <descriptiveKeywords/>
      <resourceConstraints xlink:href="https://creativecommons.org/licenses/by/4.0/legalcode">
        <MD_Constraints>
          <useLimitation>
            <gco:CharacterString>Creative Commons Attribution 4.0 International</gco:CharacterString>
          </useLimitation>
        </MD_Constraints>
      </resourceConstraints>
      <resourceConstraints>
        <MD_LegalConstraints>
          <accessConstraints>
            <MD_RestrictionCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_RestrictionCode" codeListValue="otherRestrictions"/>
          </accessConstraints>
          <otherConstraints>
            <gco:CharacterString>Creative Commons Attribution 4.0 International</gco:CharacterString>
          </otherConstraints>
        </MD_LegalConstraints>
      </resourceConstraints>
      <resourceConstraints>
        <MD_SecurityConstraints>
          <classification>
            <MD_ClassificationCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_ClassificationCode" codeListValue="unclassified"/>
          </classification>
        </MD_SecurityConstraints>
      </resourceConstraints>
      <language>
        <gco:CharacterString>en</gco:CharacterString>
      </language>
      <characterSet>
        <MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_CharacterSetCode" codeListValue="utf8"/>
      </characterSet>
      <topicCategory>
        <MD_TopicCategoryCode>geoscientificInformation</MD_TopicCategoryCode>
      </topicCategory>
    </MD_DataIdentification>
  </identificationInfo>
  <distributionInfo>
    <MD_Distribution>
      <transferOptions>
        <MD_DigitalTransferOptions>
          <onLine>
            <CI_OnlineResource>
              <linkage>
                <URL>http://doi.org/N/A</URL>
              </linkage>
              <protocol>
                <gco:CharacterString>WWW:LINK-1.0-http--link</gco:CharacterString>
              </protocol>
              <name>
                <gco:CharacterString>Download</gco:CharacterString>
              </name>
              <description>
                <gco:CharacterString>Download</gco:CharacterString>
              </description>
              <function>
                <CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</CI_OnLineFunctionCode>
              </function>
            </CI_OnlineResource>
          </onLine>
        </MD_DigitalTransferOptions>
      </transferOptions>
    </MD_Distribution>
  </distributionInfo>
  <dataQualityInfo>
    <DQ_DataQuality>
      <scope>
        <DQ_Scope>
          <level>
            <MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset"/>
          </level>
        </DQ_Scope>
      </scope>
    </DQ_DataQuality>
  </dataQualityInfo>
</MD_Metadata>


</envelope>
XML;


$GLOBALS['testXmlWithNamespace'] = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<grav:envelope xmlns:grav="http://icgem.gfz.de/schema" xmlns:dace="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://icgem.gfz.de/schema http://icgem.gfz.de/schema/icgemSchemaBase.xsd">
  <dace:resource>
    <dace:identifier identifierType="DOI"/>
    <dace:creators/>
    <dace:titles/>
    <dace:publisher xml:lang="en">GFZ Data Services</dace:publisher>
    <dace:publicationYear/>
    <dace:resourceType resourceTypeGeneral="Dataset">Dataset</dace:resourceType>
    <dace:subjects/>
    <dace:contributors/>
    <dace:dates>
    
  </dace:dates>
    <dace:language>en</dace:language>
    <dace:rightsList>
      <dace:rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" schemeURI="https://spdx.org/licenses/" xml:lang="en">Creative Commons Attribution 4.0 International</dace:rights>
    </dace:rightsList>
    <dace:descriptions/>
    <dace:geoLocations/>
  </dace:resource>
  <grav:globalGravityProduct>
    <grav:contact/>
    <grav:harmonicCoefficientsModel>
      <grav:celestialBody>Earth</grav:celestialBody>
    </grav:harmonicCoefficientsModel>
    <grav:inputDataSource type="Satellite">
      <grav:description/>
    </grav:inputDataSource>
  </grav:globalGravityProduct>
</grav:envelope>
XML;

$GLOBALS['testXmlWithDataWithNamespace'] = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<grav:envelope xmlns:grav="http://icgem.gfz.de/schema" xmlns:dace="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://icgem.gfz.de/schema http://icgem.gfz.de/schema/icgemSchemaBase.xsd">
  <dace:resource>
    <dace:identifier identifierType="DOI"/>
    <dace:creators/>
    <dace:titles/>
    <dace:publisher xml:lang="en">GFZ Data Services</dace:publisher>
    <dace:publicationYear/>
    <dace:resourceType resourceTypeGeneral="Dataset">Dataset</dace:resourceType>
    <dace:subjects>
      <dace:subject subjectScheme="NASA/GCMD Earth Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/ad09b215-e837-4d9f-acbc-2b45e5b81825" xml:lang="en">MARINE GRAVITY FIELD</dace:subject>
      <dace:subject subjectScheme="NASA/GCMD Earth Platforms Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/610cd524-ed33-44c2-811c-66bd27b9b3ea" xml:lang="en">Platforms &gt; Air-based Platforms &gt; Rotorcraft/Helicopter</dace:subject>
      <dace:subject subjectScheme="NASA/GCMD Instruments" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/11a96ea3-6231-48d7-8ebd-9212e1e0fa2f" xml:lang="en">Instruments &gt; In Situ/Laboratory Instruments &gt; Magnetic/Motion Sensors &gt; Gravimeters &gt; SUPERCONDUCTING GRAVIMETER</dace:subject>
      <dace:subject>icgem</dace:subject>
      <dace:subject>example</dace:subject>
    </dace:subjects>
    <dace:contributors>
      <dace:contributor contributorType="Producer">
        <dace:contributorName nameType="Personal">Ince, E. Sinem</dace:contributorName>
        <dace:givenName>E. Sinem</dace:givenName>
        <dace:familyName>Ince</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-3393-1392</dace:nameIdentifier>
      </dace:contributor>
      <dace:contributor contributorType="Other">
        <dace:contributorName nameType="Personal">Carberry, Josiah</dace:contributorName>
        <dace:givenName>Josiah</dace:givenName>
        <dace:familyName>Carberry</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-1825-0097</dace:nameIdentifier>
        <dace:affiliation affiliationIdentifierScheme="ROR" schemeURI="https://ror.org" affiliationIdentifier="https://ror.org/04n800n16">South Pointe Hospital</dace:affiliation>
      </dace:contributor>
      <dace:contributor contributorType="Other">
        <dace:contributorName nameType="Personal">Bob, Alice</dace:contributorName>
        <dace:givenName>Alice</dace:givenName>
        <dace:familyName>Bob</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0009-0009-8527-0993</dace:nameIdentifier>
      </dace:contributor>
    </dace:contributors>
    <dace:dates>
    
  </dace:dates>
    <dace:language>en</dace:language>
    <dace:rightsList>
      <dace:rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" schemeURI="https://spdx.org/licenses/" xml:lang="en">Creative Commons Attribution 4.0 International</dace:rights>
    </dace:rightsList>
    <dace:descriptions/>
    <dace:geoLocations/>
  </dace:resource>
  <grav:globalGravityProduct>
    <grav:contact/>
    <grav:harmonicCoefficientsModel>
      <grav:celestialBody>Earth</grav:celestialBody>
    </grav:harmonicCoefficientsModel>
    <grav:inputDataSource type="Satellite">
      <grav:description/>
    </grav:inputDataSource>
  </grav:globalGravityProduct>
</grav:envelope>
XML;

$GLOBALS['testXmlWithDataNoNamespace'] = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<envelope>
    
<resource xmlns="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
  <identifier identifierType="DOI"/>
  <creators/>
  <titles/>
  <publisher xml:lang="en">GFZ Data Services</publisher>
  <publicationYear/>
  <resourceType resourceTypeGeneral=""/>
  <subjects>
    <subject subjectScheme="NASA/GCMD Earth Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/c88a747b-2302-49c9-b747-f2faa21e2b6b" xml:lang="en">Science Keywords &gt; EARTH SCIENCE &gt; HUMAN DIMENSIONS &gt; SOCIOECONOMICS &gt; HOUSEHOLD INCOME</subject>
    <subject subjectScheme="NASA/GCMD Earth Platforms Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/6438d343-2e1f-4a89-97a9-b032e651163f" xml:lang="en">Platforms &gt; Living Organism-based Platforms &gt; Living Organism</subject>
    <subject subjectScheme="NASA/GCMD Instruments" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/5a9aea9c-9193-4074-a444-9073e348d5ad" xml:lang="en">Instruments &gt; In Situ/Laboratory Instruments &gt; Chemical Meters/Analyzers &gt; Thermo Scientific Ozone Analyzer</subject>
    <subject subjectScheme="International Chronostratigraphic Chart" schemeURI="http://resource.geosciml.org/vocabulary/timescale/gts2020" valueURI="http://resource.geosciml.org/classifier/ics/ischart/Present" xml:lang="en">The Present</subject>
    <subject>free keyword</subject>
    <subject>test1234</subject>
  </subjects>
  <contributors/>
  <dates>
    
  </dates>
  <language>en</language>
  <rightsList>
    <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" schemeURI="https://spdx.org/licenses/" xml:lang="en">Creative Commons Attribution 4.0 International</rights>
  </rightsList>
  <descriptions/>
  <geoLocations/>
</resource>


    
<MD_Metadata xmlns="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco" xmlns:gsr="http://www.isotc211.org/2005/gsr" xmlns:gss="http://www.isotc211.org/2005/gss" xmlns:gts="http://www.isotc211.org/2005/gts" xmlns:gml="http://www.opengis.net/gml" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.isotc211.org/2005/gmd file:///C:/xampp/htdocs/msl-mde/schemas/ISO/gmd.xsd">
  <fileIdentifier>
    <gco:CharacterString>doi:N/A</gco:CharacterString>
  </fileIdentifier>
  <language>
    <LanguageCode codeList="http://www.loc.gov/standards/iso639-1/" codeListValue="en">en</LanguageCode>
  </language>
  <characterSet>
    <MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_CharacterSetCode" codeListValue="utf8"/>
  </characterSet>
  <hierarchyLevel>
    <MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset">dataset</MD_ScopeCode>
  </hierarchyLevel>
  <contact>
    <CI_ResponsibleParty>
      <organisationName>
        <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
      </organisationName>
      <contactInfo>
        <CI_Contact>
          <address>
            <CI_Address>
              <electronicMailAddress>
                <gco:CharacterString>lis-it@gfz.de</gco:CharacterString>
              </electronicMailAddress>
            </CI_Address>
          </address>
          <onlineResource>
            <CI_OnlineResource>
              <linkage>
                <URL>https://www.gfz.de/</URL>
              </linkage>
              <name>
                <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
              </name>
              <description>
                <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
              </description>
              <function>
                <CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</CI_OnLineFunctionCode>
              </function>
            </CI_OnlineResource>
          </onlineResource>
        </CI_Contact>
      </contactInfo>
      <role>
        <CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</CI_RoleCode>
      </role>
    </CI_ResponsibleParty>
  </contact>
  <dateStamp>
    <gco:Date>2026-09-09</gco:Date>
  </dateStamp>
  <referenceSystemInfo>
    <MD_ReferenceSystem>
      <referenceSystemIdentifier>
        <RS_Identifier>
          <code>
            <gco:CharacterString>urn:ogc:def:crs:EPSG:4326</gco:CharacterString>
          </code>
        </RS_Identifier>
      </referenceSystemIdentifier>
    </MD_ReferenceSystem>
  </referenceSystemInfo>
  <identificationInfo>
    <MD_DataIdentification>
      <citation>
        <CI_Citation>
          <title/>
          
        </CI_Citation>
      </citation>
      <abstract/>
      <descriptiveKeywords/>
      <descriptiveKeywords>
        <MD_Keywords>
          <keyword>
            <gco:CharacterString>Science Keywords &gt; EARTH SCIENCE &gt; HUMAN DIMENSIONS &gt; SOCIOECONOMICS &gt; HOUSEHOLD INCOME</gco:CharacterString>
          </keyword>
          <thesaurusName>
            <CI_Citation>
              <title>
                <gco:CharacterString>NASA/GCMD Earth Science Keywords</gco:CharacterString>
              </title>
              <date>
                <CI_Date>
                  <date>
                    <gco:Date>2026-09-09</gco:Date>
                  </date>
                  <dateType>
                    <CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="lastUpdate">lastUpdate</CI_DateTypeCode>
                  </dateType>
                </CI_Date>
              </date>
            </CI_Citation>
          </thesaurusName>
        </MD_Keywords>
        <MD_Keywords>
          <keyword>
            <gco:CharacterString>Platforms &gt; Living Organism-based Platforms &gt; Living Organism</gco:CharacterString>
          </keyword>
          <thesaurusName>
            <CI_Citation>
              <title>
                <gco:CharacterString>NASA/GCMD Earth Platforms Keywords</gco:CharacterString>
              </title>
              <date>
                <CI_Date>
                  <date>
                    <gco:Date>2026-09-09</gco:Date>
                  </date>
                  <dateType>
                    <CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="lastUpdate">lastUpdate</CI_DateTypeCode>
                  </dateType>
                </CI_Date>
              </date>
            </CI_Citation>
          </thesaurusName>
        </MD_Keywords>
        <MD_Keywords>
          <keyword>
            <gco:CharacterString>Instruments &gt; In Situ/Laboratory Instruments &gt; Chemical Meters/Analyzers &gt; Thermo Scientific Ozone Analyzer</gco:CharacterString>
          </keyword>
          <thesaurusName>
            <CI_Citation>
              <title>
                <gco:CharacterString>NASA/GCMD Instruments</gco:CharacterString>
              </title>
              <date>
                <CI_Date>
                  <date>
                    <gco:Date>2026-09-09</gco:Date>
                  </date>
                  <dateType>
                    <CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="lastUpdate">lastUpdate</CI_DateTypeCode>
                  </dateType>
                </CI_Date>
              </date>
            </CI_Citation>
          </thesaurusName>
        </MD_Keywords>
      </descriptiveKeywords>
      <descriptiveKeywords>
        <MD_Keywords>
          <keyword>
            <gco:CharacterString>free keyword</gco:CharacterString>
          </keyword>
          <keyword>
            <gco:CharacterString>test1234</gco:CharacterString>
          </keyword>
        </MD_Keywords>
      </descriptiveKeywords>
      <resourceConstraints xlink:href="https://creativecommons.org/licenses/by/4.0/legalcode">
        <MD_Constraints>
          <useLimitation>
            <gco:CharacterString>Creative Commons Attribution 4.0 International</gco:CharacterString>
          </useLimitation>
        </MD_Constraints>
      </resourceConstraints>
      <resourceConstraints>
        <MD_LegalConstraints>
          <accessConstraints>
            <MD_RestrictionCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_RestrictionCode" codeListValue="otherRestrictions"/>
          </accessConstraints>
          <otherConstraints>
            <gco:CharacterString>Creative Commons Attribution 4.0 International</gco:CharacterString>
          </otherConstraints>
        </MD_LegalConstraints>
      </resourceConstraints>
      <resourceConstraints>
        <MD_SecurityConstraints>
          <classification>
            <MD_ClassificationCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_ClassificationCode" codeListValue="unclassified"/>
          </classification>
        </MD_SecurityConstraints>
      </resourceConstraints>
      <language>
        <gco:CharacterString>en</gco:CharacterString>
      </language>
      <characterSet>
        <MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_CharacterSetCode" codeListValue="utf8"/>
      </characterSet>
      <topicCategory>
        <MD_TopicCategoryCode>geoscientificInformation</MD_TopicCategoryCode>
      </topicCategory>
    </MD_DataIdentification>
  </identificationInfo>
  <distributionInfo>
    <MD_Distribution>
      <transferOptions>
        <MD_DigitalTransferOptions>
          <onLine>
            <CI_OnlineResource>
              <linkage>
                <URL>http://doi.org/N/A</URL>
              </linkage>
              <protocol>
                <gco:CharacterString>WWW:LINK-1.0-http--link</gco:CharacterString>
              </protocol>
              <name>
                <gco:CharacterString>Download</gco:CharacterString>
              </name>
              <description>
                <gco:CharacterString>Download</gco:CharacterString>
              </description>
              <function>
                <CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</CI_OnLineFunctionCode>
              </function>
            </CI_OnlineResource>
          </onLine>
        </MD_DigitalTransferOptions>
      </transferOptions>
    </MD_Distribution>
  </distributionInfo>
  <dataQualityInfo>
    <DQ_DataQuality>
      <scope>
        <DQ_Scope>
          <level>
            <MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset"/>
          </level>
        </DQ_Scope>
      </scope>
    </DQ_DataQuality>
  </dataQualityInfo>
</MD_Metadata>


</envelope>
XML;

$GLOBALS['expectedXmlWithNamespace'] = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<grav:envelope xmlns:grav="http://icgem.gfz.de/schema" xmlns:dace="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://icgem.gfz.de/schema http://icgem.gfz.de/schema/icgemSchemaBase.xsd">
  <dace:resource>
    <dace:identifier identifierType="DOI"/>
    <dace:creators/>
    <dace:titles/>
    <dace:publisher xml:lang="en">GFZ Data Services</dace:publisher>
    <dace:publicationYear/>
    <dace:resourceType resourceTypeGeneral="Dataset">Dataset</dace:resourceType>
    <dace:subjects>
      <dace:subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/6bbbf7b0-434b-4dbc-9fe8-e5e31fe99614">GEOID CHARACTERISTICS</dace:subject>
      <dace:subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/221386f6-ef9b-4990-82b3-f990b0fe39fa">GRAVITY/GRAVITATIONAL FIELD</dace:subject>
    </dace:subjects>
    <dace:contributors>
      <dace:contributor contributorType="DataCurator">
        <dace:contributorName nameType="Personal">Ince, E. Sinem</dace:contributorName>
        <dace:givenName>E. Sinem</dace:givenName>
        <dace:familyName>Ince</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-3393-1392</dace:nameIdentifier>
        <dace:affiliation>GFZ Helmholtz Centre for Geosciences, Potsdam, Germany</dace:affiliation>
      </dace:contributor>
      <dace:contributor contributorType="DataManager">
        <dace:contributorName nameType="Personal">Reißland, Sven</dace:contributorName>
        <dace:givenName>Sven</dace:givenName>
        <dace:familyName>Reißland</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0001-6293-5336</dace:nameIdentifier>
        <dace:affiliation>GFZ Helmholtz Centre for Geosciences, Potsdam, Germany</dace:affiliation>
      </dace:contributor>
    </dace:contributors>
    <dace:dates>
    
  </dace:dates>
    <dace:language>en</dace:language>
    <dace:rightsList>
      <dace:rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" schemeURI="https://spdx.org/licenses/" xml:lang="en">Creative Commons Attribution 4.0 International</dace:rights>
    </dace:rightsList>
    <dace:descriptions/>
    <dace:geoLocations/>
    <dace:formats>
      <dace:format>ICGEM-format</dace:format>
    </dace:formats>
  </dace:resource>
  <grav:globalGravityProduct>
    <grav:contact/>
    <grav:harmonicCoefficientsModel>
      <grav:celestialBody>Earth</grav:celestialBody>
    </grav:harmonicCoefficientsModel>
    <grav:inputDataSource type="Satellite">
      <grav:description/>
    </grav:inputDataSource>
  </grav:globalGravityProduct>
</grav:envelope>
XML;

$GLOBALS['expectedXmlWithDataWithNamespace'] = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<grav:envelope xmlns:grav="http://icgem.gfz.de/schema" xmlns:dace="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://icgem.gfz.de/schema http://icgem.gfz.de/schema/icgemSchemaBase.xsd">
  <dace:resource>
    <dace:identifier identifierType="DOI"/>
    <dace:creators/>
    <dace:titles/>
    <dace:publisher xml:lang="en">GFZ Data Services</dace:publisher>
    <dace:publicationYear/>
    <dace:resourceType resourceTypeGeneral="Dataset">Dataset</dace:resourceType>
    <dace:subjects>
      <dace:subject subjectScheme="NASA/GCMD Earth Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/ad09b215-e837-4d9f-acbc-2b45e5b81825" xml:lang="en">MARINE GRAVITY FIELD</dace:subject>
      <dace:subject subjectScheme="NASA/GCMD Earth Platforms Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/610cd524-ed33-44c2-811c-66bd27b9b3ea" xml:lang="en">Platforms &gt; Air-based Platforms &gt; Rotorcraft/Helicopter</dace:subject>
      <dace:subject subjectScheme="NASA/GCMD Instruments" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/11a96ea3-6231-48d7-8ebd-9212e1e0fa2f" xml:lang="en">Instruments &gt; In Situ/Laboratory Instruments &gt; Magnetic/Motion Sensors &gt; Gravimeters &gt; SUPERCONDUCTING GRAVIMETER</dace:subject>
      <dace:subject>icgem</dace:subject>
      <dace:subject>example</dace:subject>
      <dace:subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/6bbbf7b0-434b-4dbc-9fe8-e5e31fe99614">GEOID CHARACTERISTICS</dace:subject>
      <dace:subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/221386f6-ef9b-4990-82b3-f990b0fe39fa">GRAVITY/GRAVITATIONAL FIELD</dace:subject>
    </dace:subjects>
    <dace:contributors>
      <dace:contributor contributorType="Producer">
        <dace:contributorName nameType="Personal">Ince, E. Sinem</dace:contributorName>
        <dace:givenName>E. Sinem</dace:givenName>
        <dace:familyName>Ince</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-3393-1392</dace:nameIdentifier>
      </dace:contributor>
      <dace:contributor contributorType="Other">
        <dace:contributorName nameType="Personal">Carberry, Josiah</dace:contributorName>
        <dace:givenName>Josiah</dace:givenName>
        <dace:familyName>Carberry</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-1825-0097</dace:nameIdentifier>
        <dace:affiliation affiliationIdentifierScheme="ROR" schemeURI="https://ror.org" affiliationIdentifier="https://ror.org/04n800n16">South Pointe Hospital</dace:affiliation>
      </dace:contributor>
      <dace:contributor contributorType="Other">
        <dace:contributorName nameType="Personal">Bob, Alice</dace:contributorName>
        <dace:givenName>Alice</dace:givenName>
        <dace:familyName>Bob</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0009-0009-8527-0993</dace:nameIdentifier>
      </dace:contributor>
      <dace:contributor contributorType="DataCurator">
        <dace:contributorName nameType="Personal">Ince, E. Sinem</dace:contributorName>
        <dace:givenName>E. Sinem</dace:givenName>
        <dace:familyName>Ince</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-3393-1392</dace:nameIdentifier>
        <dace:affiliation>GFZ Helmholtz Centre for Geosciences, Potsdam, Germany</dace:affiliation>
      </dace:contributor>
      <dace:contributor contributorType="DataManager">
        <dace:contributorName nameType="Personal">Reißland, Sven</dace:contributorName>
        <dace:givenName>Sven</dace:givenName>
        <dace:familyName>Reißland</dace:familyName>
        <dace:nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0001-6293-5336</dace:nameIdentifier>
        <dace:affiliation>GFZ Helmholtz Centre for Geosciences, Potsdam, Germany</dace:affiliation>
      </dace:contributor>
    </dace:contributors>
    <dace:dates>
    
  </dace:dates>
    <dace:language>en</dace:language>
    <dace:rightsList>
      <dace:rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" schemeURI="https://spdx.org/licenses/" xml:lang="en">Creative Commons Attribution 4.0 International</dace:rights>
    </dace:rightsList>
    <dace:descriptions/>
    <dace:geoLocations/>
    <dace:formats>
      <dace:format>ICGEM-format</dace:format>
    </dace:formats>
  </dace:resource>
  <grav:globalGravityProduct>
    <grav:contact/>
    <grav:harmonicCoefficientsModel>
      <grav:celestialBody>Earth</grav:celestialBody>
    </grav:harmonicCoefficientsModel>
    <grav:inputDataSource type="Satellite">
      <grav:description/>
    </grav:inputDataSource>
  </grav:globalGravityProduct>
</grav:envelope>
XML;

$GLOBALS['expectedXmlWithDataNoNamespace'] = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<envelope>
  <resource xmlns="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://datacite.org/schema/kernel-4 https://schema.datacite.org/meta/kernel-4.7/metadata.xsd">
    <identifier identifierType="DOI"/>
    <creators/>
    <titles/>
    <publisher xml:lang="en">GFZ Data Services</publisher>
    <publicationYear/>
    <resourceType resourceTypeGeneral=""/>
    <subjects>
      <subject subjectScheme="NASA/GCMD Earth Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/c88a747b-2302-49c9-b747-f2faa21e2b6b" xml:lang="en">Science Keywords &gt; EARTH SCIENCE &gt; HUMAN DIMENSIONS &gt; SOCIOECONOMICS &gt; HOUSEHOLD INCOME</subject>
      <subject subjectScheme="NASA/GCMD Earth Platforms Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/platforms" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/6438d343-2e1f-4a89-97a9-b032e651163f" xml:lang="en">Platforms &gt; Living Organism-based Platforms &gt; Living Organism</subject>
      <subject subjectScheme="NASA/GCMD Instruments" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/instruments" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/5a9aea9c-9193-4074-a444-9073e348d5ad" xml:lang="en">Instruments &gt; In Situ/Laboratory Instruments &gt; Chemical Meters/Analyzers &gt; Thermo Scientific Ozone Analyzer</subject>
      <subject subjectScheme="International Chronostratigraphic Chart" schemeURI="http://resource.geosciml.org/vocabulary/timescale/gts2020" valueURI="http://resource.geosciml.org/classifier/ics/ischart/Present" xml:lang="en">The Present</subject>
      <subject>free keyword</subject>
      <subject>test1234</subject>
      <subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/6bbbf7b0-434b-4dbc-9fe8-e5e31fe99614">GEOID CHARACTERISTICS</subject>
      <subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/221386f6-ef9b-4990-82b3-f990b0fe39fa">GRAVITY/GRAVITATIONAL FIELD</subject>
    </subjects>
    <contributors>
      <contributor contributorType="DataCurator">
        <contributorName nameType="Personal">Ince, E. Sinem</contributorName>
        <givenName>E. Sinem</givenName>
        <familyName>Ince</familyName>
        <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0002-3393-1392</nameIdentifier>
        <affiliation>GFZ Helmholtz Centre for Geosciences, Potsdam, Germany</affiliation>
      </contributor>
      <contributor contributorType="DataManager">
        <contributorName nameType="Personal">Reißland, Sven</contributorName>
        <givenName>Sven</givenName>
        <familyName>Reißland</familyName>
        <nameIdentifier nameIdentifierScheme="ORCID" schemeURI="https://orcid.org/">0000-0001-6293-5336</nameIdentifier>
        <affiliation>GFZ Helmholtz Centre for Geosciences, Potsdam, Germany</affiliation>
      </contributor>
    </contributors>
    <dates>
    
  </dates>
    <language>en</language>
    <rightsList>
      <rights rightsURI="https://creativecommons.org/licenses/by/4.0/legalcode" rightsIdentifier="CC-BY-4.0" rightsIdentifierScheme="SPDX" schemeURI="https://spdx.org/licenses/" xml:lang="en">Creative Commons Attribution 4.0 International</rights>
    </rightsList>
    <descriptions/>
    <geoLocations/>
    <formats>
      <format>ICGEM-format</format>
    </formats>
  </resource>
  <MD_Metadata xmlns="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco" xmlns:gsr="http://www.isotc211.org/2005/gsr" xmlns:gss="http://www.isotc211.org/2005/gss" xmlns:gts="http://www.isotc211.org/2005/gts" xmlns:gml="http://www.opengis.net/gml" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.isotc211.org/2005/gmd file:///C:/xampp/htdocs/msl-mde/schemas/ISO/gmd.xsd">
    <fileIdentifier>
      <gco:CharacterString>doi:N/A</gco:CharacterString>
    </fileIdentifier>
    <language>
      <LanguageCode codeList="http://www.loc.gov/standards/iso639-1/" codeListValue="en">en</LanguageCode>
    </language>
    <characterSet>
      <MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_CharacterSetCode" codeListValue="utf8"/>
    </characterSet>
    <hierarchyLevel>
      <MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset">dataset</MD_ScopeCode>
    </hierarchyLevel>
    <contact>
      <CI_ResponsibleParty>
        <organisationName>
          <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
        </organisationName>
        <contactInfo>
          <CI_Contact>
            <address>
              <CI_Address>
                <electronicMailAddress>
                  <gco:CharacterString>lis-it@gfz.de</gco:CharacterString>
                </electronicMailAddress>
              </CI_Address>
            </address>
            <onlineResource>
              <CI_OnlineResource>
                <linkage>
                  <URL>https://www.gfz.de/</URL>
                </linkage>
                <name>
                  <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
                </name>
                <description>
                  <gco:CharacterString>GFZ Helmholtz Centre for Geosciences</gco:CharacterString>
                </description>
                <function>
                  <CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</CI_OnLineFunctionCode>
                </function>
              </CI_OnlineResource>
            </onlineResource>
          </CI_Contact>
        </contactInfo>
        <role>
          <CI_RoleCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</CI_RoleCode>
        </role>
      </CI_ResponsibleParty>
    </contact>
    <dateStamp>
      <gco:Date>2026-09-09</gco:Date>
    </dateStamp>
    <referenceSystemInfo>
      <MD_ReferenceSystem>
        <referenceSystemIdentifier>
          <RS_Identifier>
            <code>
              <gco:CharacterString>urn:ogc:def:crs:EPSG:4326</gco:CharacterString>
            </code>
          </RS_Identifier>
        </referenceSystemIdentifier>
      </MD_ReferenceSystem>
    </referenceSystemInfo>
    <identificationInfo>
      <MD_DataIdentification>
        <citation>
          <CI_Citation>
            <title/>
          </CI_Citation>
        </citation>
        <abstract/>
        <descriptiveKeywords/>
        <descriptiveKeywords>
          <MD_Keywords>
            <keyword>
              <gco:CharacterString>Science Keywords &gt; EARTH SCIENCE &gt; HUMAN DIMENSIONS &gt; SOCIOECONOMICS &gt; HOUSEHOLD INCOME</gco:CharacterString>
            </keyword>
            <thesaurusName>
              <CI_Citation>
                <title>
                  <gco:CharacterString>NASA/GCMD Earth Science Keywords</gco:CharacterString>
                </title>
                <date>
                  <CI_Date>
                    <date>
                      <gco:Date>2026-09-09</gco:Date>
                    </date>
                    <dateType>
                      <CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="lastUpdate">lastUpdate</CI_DateTypeCode>
                    </dateType>
                  </CI_Date>
                </date>
              </CI_Citation>
            </thesaurusName>
          </MD_Keywords>
          <MD_Keywords>
            <keyword>
              <gco:CharacterString>Platforms &gt; Living Organism-based Platforms &gt; Living Organism</gco:CharacterString>
            </keyword>
            <thesaurusName>
              <CI_Citation>
                <title>
                  <gco:CharacterString>NASA/GCMD Earth Platforms Keywords</gco:CharacterString>
                </title>
                <date>
                  <CI_Date>
                    <date>
                      <gco:Date>2026-09-09</gco:Date>
                    </date>
                    <dateType>
                      <CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="lastUpdate">lastUpdate</CI_DateTypeCode>
                    </dateType>
                  </CI_Date>
                </date>
              </CI_Citation>
            </thesaurusName>
          </MD_Keywords>
          <MD_Keywords>
            <keyword>
              <gco:CharacterString>Instruments &gt; In Situ/Laboratory Instruments &gt; Chemical Meters/Analyzers &gt; Thermo Scientific Ozone Analyzer</gco:CharacterString>
            </keyword>
            <thesaurusName>
              <CI_Citation>
                <title>
                  <gco:CharacterString>NASA/GCMD Instruments</gco:CharacterString>
                </title>
                <date>
                  <CI_Date>
                    <date>
                      <gco:Date>2026-09-09</gco:Date>
                    </date>
                    <dateType>
                      <CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="lastUpdate">lastUpdate</CI_DateTypeCode>
                    </dateType>
                  </CI_Date>
                </date>
              </CI_Citation>
            </thesaurusName>
          </MD_Keywords>
        </descriptiveKeywords>
        <descriptiveKeywords>
          <MD_Keywords>
            <keyword>
              <gco:CharacterString>free keyword</gco:CharacterString>
            </keyword>
            <keyword>
              <gco:CharacterString>test1234</gco:CharacterString>
            </keyword>
          </MD_Keywords>
        </descriptiveKeywords>
        <resourceConstraints xlink:href="https://creativecommons.org/licenses/by/4.0/legalcode">
          <MD_Constraints>
            <useLimitation>
              <gco:CharacterString>Creative Commons Attribution 4.0 International</gco:CharacterString>
            </useLimitation>
          </MD_Constraints>
        </resourceConstraints>
        <resourceConstraints>
          <MD_LegalConstraints>
            <accessConstraints>
              <MD_RestrictionCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_RestrictionCode" codeListValue="otherRestrictions"/>
            </accessConstraints>
            <otherConstraints>
              <gco:CharacterString>Creative Commons Attribution 4.0 International</gco:CharacterString>
            </otherConstraints>
          </MD_LegalConstraints>
        </resourceConstraints>
        <resourceConstraints>
          <MD_SecurityConstraints>
            <classification>
              <MD_ClassificationCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_ClassificationCode" codeListValue="unclassified"/>
            </classification>
          </MD_SecurityConstraints>
        </resourceConstraints>
        <language>
          <gco:CharacterString>en</gco:CharacterString>
        </language>
        <characterSet>
          <MD_CharacterSetCode codeList="http://www.isotc211.org/2005/resources/codeList.xml#MD_CharacterSetCode" codeListValue="utf8"/>
        </characterSet>
        <topicCategory>
          <MD_TopicCategoryCode>geoscientificInformation</MD_TopicCategoryCode>
        </topicCategory>
      </MD_DataIdentification>
    </identificationInfo>
    <distributionInfo>
      <MD_Distribution>
        <transferOptions>
          <MD_DigitalTransferOptions>
            <onLine>
              <CI_OnlineResource>
                <linkage>
                  <URL>http://doi.org/N/A</URL>
                </linkage>
                <protocol>
                  <gco:CharacterString>WWW:LINK-1.0-http--link</gco:CharacterString>
                </protocol>
                <name>
                  <gco:CharacterString>Download</gco:CharacterString>
                </name>
                <description>
                  <gco:CharacterString>Download</gco:CharacterString>
                </description>
                <function>
                  <CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</CI_OnLineFunctionCode>
                </function>
              </CI_OnlineResource>
            </onLine>
          </MD_DigitalTransferOptions>
        </transferOptions>
      </MD_Distribution>
    </distributionInfo>
    <dataQualityInfo>
      <DQ_DataQuality>
        <scope>
          <DQ_Scope>
            <level>
              <MD_ScopeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_ScopeCode" codeListValue="dataset"/>
            </level>
          </DQ_Scope>
        </scope>
      </DQ_DataQuality>
    </dataQualityInfo>
  </MD_Metadata>
</envelope>
XML;

final class ICGEMDataciteAdditionsTest extends TestCase
{
    public function testNoNamespace(): void
    {
        $result = applyElmoGemAdditionsToDataciteXml($GLOBALS['testXmlNoNamespace'], true, true);
        $this->assertXmlStringEqualsXmlString($GLOBALS['expectedXmlNoNamespace'], $result);
    }

    public function testWithNamespace(): void
    {
        $result = applyElmoGemAdditionsToDataciteXml($GLOBALS['testXmlWithNamespace'], true, true);
        $this->assertXmlStringEqualsXmlString($GLOBALS['expectedXmlWithNamespace'], $result);
    }

    public function testWithDataWithNamespace(): void
    {
        $result = applyElmoGemAdditionsToDataciteXml($GLOBALS['testXmlWithDataWithNamespace'], true, true);
        $this->assertXmlStringEqualsXmlString($GLOBALS['expectedXmlWithDataWithNamespace'], $result);
    }

    public function testWithDataNoNamespace(): void
    {
        $result = applyElmoGemAdditionsToDataciteXml($GLOBALS['testXmlWithDataNoNamespace'], true, true);
        $this->assertXmlStringEqualsXmlString($GLOBALS['expectedXmlWithDataNoNamespace'], $result);
    }
}
