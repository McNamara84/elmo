<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" encoding="UTF-8" omit-xml-declaration="yes" indent="yes"/>
  <xsl:strip-space elements="*"/>

  <xsl:template match="/">
    <ResourceInformation>
      <xsl:variable name="resource" select="(//*[local-name()='resource' and (namespace-uri() = 'http://datacite.org/schema/kernel-4' or namespace-uri() = '')])[1]"/>
      <Doi><xsl:value-of select="$resource/*[local-name()='identifier'][1]"/></Doi>
      <Year><xsl:value-of select="$resource/*[local-name()='publicationYear'][1]"/></Year>
      <ResourceType><xsl:value-of select="($resource/*[local-name()='resourceType'] | $resource/*[local-name()='types']/*[local-name()='resourceType'])[1]/@resourceTypeGeneral"/></ResourceType>
      <Version><xsl:value-of select="$resource/*[local-name()='version'][1]"/></Version>
      <Language><xsl:value-of select="$resource/*[local-name()='language'][1]"/></Language>
      <Titles>
        <xsl:for-each select="$resource/*[local-name()='titles']/*[local-name()='title']">
          <Title>
            <xsl:attribute name="type"><xsl:value-of select="@titleType"/></xsl:attribute>
            <xsl:attribute name="position"><xsl:value-of select="position() - 1"/></xsl:attribute>
            <xsl:value-of select="."/>
          </Title>
        </xsl:for-each>
      </Titles>
    </ResourceInformation>
  </xsl:template>
</xsl:stylesheet>
