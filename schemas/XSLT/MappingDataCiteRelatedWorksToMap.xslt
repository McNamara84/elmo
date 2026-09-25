<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <xsl:output method="xml" encoding="UTF-8" omit-xml-declaration="yes" indent="yes"/>
  <xsl:strip-space elements="*"/>

  <!--
    Used Instruments owns IsCollectedBy when that optional form group is active.
    Browser callers pass the string "true" to exclude those identifiers here.
  -->
  <xsl:param name="excludeIsCollectedBy" select="'false'"/>

  <xsl:template match="/">
    <RelatedWorks>
      <xsl:for-each select="
        //*[local-name()='relatedIdentifiers'
          and (namespace-uri() = 'http://datacite.org/schema/kernel-4' or namespace-uri() = '')]
        /*[local-name()='relatedIdentifier'
          and (namespace-uri() = 'http://datacite.org/schema/kernel-4' or namespace-uri() = '')
          and not($excludeIsCollectedBy = 'true' and @relationType = 'IsCollectedBy')]
      ">
        <RelatedWork>
          <Identifier><xsl:value-of select="."/></Identifier>
          <Relation>
            <name><xsl:value-of select="@relationType"/></name>
          </Relation>
          <IdentifierType>
            <name><xsl:value-of select="@relatedIdentifierType"/></name>
          </IdentifierType>
        </RelatedWork>
      </xsl:for-each>
    </RelatedWorks>
  </xsl:template>

</xsl:stylesheet>
