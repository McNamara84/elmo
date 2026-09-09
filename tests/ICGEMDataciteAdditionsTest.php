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


$referenceXmlNamespace = <<<XML
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
  <dace:subjects>
    <dace:subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/6bbbf7b0-434b-4dbc-9fe8-e5e31fe99614">GEOID CHARACTERISTICS</dace:subject>
    <dace:subject xml:lang="en" subjectScheme="Science Keywords" schemeURI="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords" valueURI="https://gcmd.earthdata.nasa.gov/kms/concept/221386f6-ef9b-4990-82b3-f990b0fe39fa">GRAVITY/GRAVITATIONAL FIELD</dace:subject>
  </dace:subjects>
  <dace:contributors>
    <dace:contributor contributorType="DataCurator">
        <dace:contributorName nameType="Personal">Ince, E. Sinem</contributorName>
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

$referenceXmlNamespace = <<<XML
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

final class ICGEMDataciteAdditionsTest extends TestCase
{
    public function testNoNamespace(): void
    {
        $result = applyElmoGemAdditionsToDataciteXml($GLOBALS['testXmlNoNamespace']);
        $this->assertXmlStringEqualsXmlString($GLOBALS['expectedXmlNoNamespace'], $result);
    }
}
