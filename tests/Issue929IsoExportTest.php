<?php

declare(strict_types=1);

namespace Tests;

require_once __DIR__ . '/../api/v2/controllers/DatasetController.php';

final class Issue929IsoExportTest extends DatabaseTestCase
{
    public function testIsoTransformOmitsEmptyCreationDateWhenDateCreatedIsMissing(): void
    {
        $controller = new \DatasetController();
        $isoXml = $controller->transformResourceXmlString($this->resourceXmlWithoutDateCreated(), 'iso');

        $dom = new \DOMDocument();
        $dom->loadXML($isoXml);
        $xpath = new \DOMXPath($dom);
        $xpath->registerNamespace('gmd', 'http://www.isotc211.org/2005/gmd');
        $xpath->registerNamespace('gco', 'http://www.isotc211.org/2005/gco');

        $emptyCreationDates = $xpath->query(
            '//gmd:date[gmd:CI_Date[gmd:date/gco:Date[normalize-space(.) = ""] and gmd:dateType/gmd:CI_DateTypeCode[@codeListValue="creation"]]]'
        );

        $this->assertSame(0, $emptyCreationDates->length);
    }

    private function resourceXmlWithoutDateCreated(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Resource>
    <doi>10.5880/GFZ.TEST.ISSUE.929.ISO</doi>
    <year>2026</year>
    <currentDate>2026-06-25</currentDate>
    <ResourceType><resource_type_general>Dataset</resource_type_general></ResourceType>
    <Language><code>en</code></Language>
    <Titles><Title><text>Issue 929 ISO Dataset</text><type>Main Title</type></Title></Titles>
    <Descriptions><Description><description>Regression test dataset</description><type>Abstract</type></Description></Descriptions>
    <Authors>
        <Author><familyname>Tester</familyname><givenname>Case</givenname></Author>
    </Authors>
    <ContactPersons/>
</Resource>
XML;
    }
}
