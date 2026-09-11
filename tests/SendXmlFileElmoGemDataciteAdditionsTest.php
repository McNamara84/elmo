<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/send_file_helper.php';

/**
 * Guards applyElmoGemAdditionsToDataciteXml call-site behaviour from send_xml_file.php.
 */
#[CoversFunction('applyElmoGemAdditionsToDataciteXml')]
final class SendXmlFileElmoGemDataciteAdditionsTest extends TestCase
{
    private const DATA_SERVICES_XML = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<envelope>
  <resource xmlns="http://datacite.org/schema/kernel-4">
    <subjects/>
    <contributors/>
  </resource>
</envelope>
XML;

    private const ICGEM_XML = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<grav:envelope xmlns:grav="http://icgem.gfz.de/schema" xmlns:dace="http://datacite.org/schema/kernel-4">
  <dace:resource>
    <dace:subjects/>
    <dace:contributors/>
  </dace:resource>
</grav:envelope>
XML;

    /**
     * @return array<string, array{0: bool, 1: string, 2: bool, 3: bool}>
     */
    public static function submitWorkflowScenarios(): array
    {
        return [
            'generic, no DOI' => [false, '', false, false],
            'generic, with DOI' => [false, '10.5880/icgem.2015.1', false, false],
            'ELMO GEM, no DOI' => [true, '', true, true],
            'ELMO GEM, with DOI' => [true, '10.5880/icgem.2015.1', false, true],
        ];
    }

    #[DataProvider('submitWorkflowScenarios')]
    #[TestDox('submit guards: showGGMsProperties=$showGGMsProperties, doi="$doi"')]
    public function testApplyElmoGemAdditionsGuardsMatchSubmitWorkflow(
        bool $showGGMsProperties,
        string $doi,
        bool $expectDataServicesAddition,
        bool $expectIcgemAddition,
    ): void {
        $elmogemSendsDataServicesMail = !$showGGMsProperties || trim($doi) === '';

        $dataServicesResult = applyElmoGemAdditionsToDataciteXml(
            self::DATA_SERVICES_XML,
            $showGGMsProperties,
            $elmogemSendsDataServicesMail
        );
        $icgemResult = applyElmoGemAdditionsToDataciteXml(
            self::ICGEM_XML,
            $showGGMsProperties,
            $elmogemSendsDataServicesMail
        );

        if ($expectDataServicesAddition) {
            $this->assertStringContainsString('ICGEM-format', $dataServicesResult);
        } else {
            $this->assertSame(self::DATA_SERVICES_XML, $dataServicesResult);
        }

        if ($expectIcgemAddition) {
            $this->assertStringContainsString('ICGEM-format', $icgemResult);
        } else {
            $this->assertSame(self::ICGEM_XML, $icgemResult);
        }
    }
}
