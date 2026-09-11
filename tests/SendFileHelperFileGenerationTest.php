<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/send_file_helper.php';

// Mock DatasetController to avoid database dependency
if (!class_exists('DatasetController')) {
    class DatasetController
    {
        public function markDataCiteEnvelopeAsSubmitted(string $xmlContent, string $date): string
        {
            return str_replace('</dataset>', '<submitted>' . $date . '</submitted></dataset>', $xmlContent);
        }
    }
}

/**
 * Unit tests for generateFile and generateICGEMFile routing logic and file generation behavior.
 *
 * Tests the three core scenarios:
 * 1. Non-GEM: normal file generation, no ELMO-GEM additions, no ICGEM generation
 * 2. GEM + DOI: ICGEM file only, no Data Services mail or file
 * 3. GEM + no DOI: both Data Services file (with ELMO-GEM additions) and ICGEM file
 */
#[CoversFunction('generateFile')]
#[CoversFunction('generateICGEMFile')]
#[CoversFunction('resolveFileGenerationSettings')]
final class SendFileHelperFileGenerationTest extends TestCase
{
    /**
     * Mock payload data returned by generateDatasetPayloadByResourceId.
     */
    private const MOCK_DATASET_PAYLOAD = [
        'payload' => '<?xml version="1.0"?><envelope><resource xmlns="http://datacite.org/schema/kernel-4"><titles><title>Test Dataset</title></titles><subjects/><contributors/></resource></envelope>',
        'contentType' => 'application/xml',
        'extension' => 'xml',
        'generator' => 'xml',
    ];

    private const MOCK_ICGEM_PAYLOAD = [
        'payload' => '<?xml version="1.0"?><grav:envelope xmlns:grav="http://icgem.gfz.de/schema" xmlns:dace="http://datacite.org/schema/kernel-4"><dace:resource><dace:titles><dace:title>Test Model</dace:title></dace:titles><dace:subjects/><dace:contributors><dace:contributor contributorType="ContactPerson"><dace:contributorName>Jane Smith</dace:contributorName></dace:contributor></dace:contributors></dace:resource><grav:contact><grav:address>jane@example.com</grav:address></grav:contact></grav:envelope>',
        'contentType' => 'application/xml',
        'extension' => 'xml',
        'generator' => 'xml',
    ];

    private const MOCK_RESEARCHER_CONFIRMATION = [
        'title' => 'Test Dataset',
        'contacts' => [
            ['fullName' => 'John Doe', 'email' => 'john@example.com'],
        ],
        'invalidContacts' => [],
    ];

    private const MOCK_GEM_RESEARCHER_CONFIRMATION = [
        'title' => 'Test Model',
        'contacts' => [
            ['fullName' => 'Jane Smith', 'email' => 'jane@example.com'],
        ],
        'invalidContacts' => [],
    ];

    protected function setUp(): void
    {
        // Mock generateDatasetPayloadByResourceId to return test payloads
        if (!function_exists('generateDatasetPayloadByResourceId')) {
            $this->mockGenerateDatasetPayloadByResourceId();
        }

        // Mock collectResearcherConfirmationDataFromXml
        if (!function_exists('collectResearcherConfirmationDataFromXml')) {
            $this->mockCollectResearcherConfirmationDataFromXml();
        }

        // Mock collectGGMsResearcherConfirmationDataFromXml
        if (!function_exists('collectGGMsResearcherConfirmationDataFromXml')) {
            $this->mockCollectGGMsResearcherConfirmationDataFromXml();
        }
    }

    private function mockGenerateDatasetPayloadByResourceId(): void
    {
        if (function_exists('generateDatasetPayloadByResourceId')) {
            return;
        }

        eval('
            function generateDatasetPayloadByResourceId(int $resourceId, array $options = []): array {
                $variant = $options["variant"] ?? null;
                if ($variant === "icgem") {
                    return ' . var_export(self::MOCK_ICGEM_PAYLOAD, true) . ';
                }
                return ' . var_export(self::MOCK_DATASET_PAYLOAD, true) . ';
            }
        ');
    }

    private function mockCollectResearcherConfirmationDataFromXml(): void
    {
        if (function_exists('collectResearcherConfirmationDataFromXml')) {
            return;
        }

        eval('
            function collectResearcherConfirmationDataFromXml(string $xmlContent): array {
                return ' . var_export(self::MOCK_RESEARCHER_CONFIRMATION, true) . ';
            }
        ');
    }

    private function mockCollectGGMsResearcherConfirmationDataFromXml(): void
    {
        if (function_exists('collectGGMsResearcherConfirmationDataFromXml')) {
            return;
        }

        eval('
            function collectGGMsResearcherConfirmationDataFromXml(string $xmlContent): array {
                return ' . var_export(self::MOCK_GEM_RESEARCHER_CONFIRMATION, true) . ';
            }
        ');
    }

    /**
     * Scenario 1: Non-GEM mode
     * - No ELMO-GEM additions applied
     * - ICGEM file not generated
     * - Data Services file generated and should be sent
     */
    #[TestDox('Scenario 1: Non-GEM mode generates Data Services file without ELMO-GEM additions')]
    public function testNonGemModeGeneratesDataServicesFileOnly(): void
    {
        $result = generateFile(123, ['title' => ['Test']], [
            'showGGMsProperties' => false,
        ]);

        $this->assertTrue($result['shouldSendDataServicesMail']);
        $this->assertNotNull($result['dataServicesPayload']);
        $this->assertStringContainsString('Test Dataset', $result['dataServicesPayload']);
        $this->assertStringNotContainsString('ICGEM-format', $result['dataServicesPayload']);
        $this->assertEqualsCanonicalizing(
            self::MOCK_RESEARCHER_CONFIRMATION['contacts'],
            $result['researcherConfirmationData']['contacts']
        );
    }

    /**
     * Scenario 2: GEM + DOI provided
     * - Data Services file NOT generated (early return)
     * - Data Services mail NOT sent
     * - ICGEM file generation should be called separately
     */
    #[TestDox('Scenario 2: GEM with DOI skips Data Services file generation')]
    public function testGemWithDoiSkipsDataServicesFile(): void
    {
        $result = generateFile(456, [
            'title' => ['Model'],
            'doi' => '10.5880/icgem.2024.001',
        ], [
            'showGGMsProperties' => true,
        ]);

        $this->assertFalse($result['shouldSendDataServicesMail']);
        $this->assertNull($result['dataServicesPayload']);
        $this->assertEmpty($result['researcherConfirmationData']['contacts']);
    }

    /**
     * Scenario 3: GEM + no DOI
     * - Data Services file generated with ELMO-GEM additions
     * - Data Services mail should be sent
     * - ICGEM file generation happens separately
     */
    #[TestDox('Scenario 3: GEM without DOI generates Data Services file with ELMO-GEM additions')]
    public function testGemWithoutDoiGeneratesDataServicesFileWithAdditions(): void
    {
        $result = generateFile(789, [
            'title' => ['Model'],
            'doi' => '',
        ], [
            'showGGMsProperties' => true,
        ]);

        $this->assertTrue($result['shouldSendDataServicesMail']);
        $this->assertNotNull($result['dataServicesPayload']);
        $this->assertStringContainsString('ICGEM-format', $result['dataServicesPayload']);
        $this->assertEqualsCanonicalizing(
            self::MOCK_RESEARCHER_CONFIRMATION['contacts'],
            $result['researcherConfirmationData']['contacts']
        );
    }

    /**
     * Test generateICGEMFile respects showGGMsProperties flag.
     *
     * When GEM is enabled:
     * - shouldSendIcgemMail is true
     * - ICGEM payload is populated
     * - GEM researcher confirmation data extracted
     */
    #[TestDox('generateICGEMFile with GEM enabled produces ICGEM payload')]
    public function testGenerateIcgemFileWithGemEnabled(): void
    {
        $result = generateICGEMFile(123, ['title' => ['Model']], [
            'showGGMsProperties' => true,
        ]);

        $this->assertTrue($result['shouldSendIcgemMail']);
        $this->assertNotNull($result['icgemPayload']);
        $this->assertStringContainsString('Test Model', $result['icgemPayload']);
        $this->assertEqualsCanonicalizing(
            self::MOCK_GEM_RESEARCHER_CONFIRMATION['contacts'],
            $result['researcherConfirmationData']['contacts']
        );
    }

    /**
     * Test generateICGEMFile respects GEM disabled flag.
     *
     * When GEM is not enabled:
     * - shouldSendIcgemMail is false
     * - ICGEM payload is not generated
     */
    #[TestDox('generateICGEMFile with GEM disabled skips ICGEM payload')]
    public function testGenerateIcgemFileWithGemDisabled(): void
    {
        $result = generateICGEMFile(123, ['title' => ['Dataset']], [
            'showGGMsProperties' => false,
        ]);

        $this->assertFalse($result['shouldSendIcgemMail']);
        $this->assertNull($result['icgemPayload']);
        $this->assertEmpty($result['researcherConfirmationData']['contacts']);
    }

    /**
     * Test resolveFileGenerationSettings applies the DOI check correctly.
     */
    #[DataProvider('doiSettingsProvider')]
    #[TestDox('resolveFileGenerationSettings: showGGMsProperties=$showGGMsProperties, doi=$doi')]
    public function testResolveFileGenerationSettings(
        bool $showGGMsProperties,
        string $doi,
        bool $expectedDataServicesMail
    ): void {
        $settings = resolveFileGenerationSettings(
            ['doi' => $doi],
            ['showGGMsProperties' => $showGGMsProperties]
        );

        $this->assertSame($showGGMsProperties, $settings['showGGMsProperties']);
        $this->assertSame($expectedDataServicesMail, $settings['elmogemSendsDataServicesMail']);
    }

    /**
     * Provider for DOI settings test.
     *
     * @return array<string, array{showGGMsProperties: bool, doi: string, expectedDataServicesMail: bool}>
     */
    public static function doiSettingsProvider(): array
    {
        return [
            'non-GEM, no DOI' => [false, '', true],
            'non-GEM, with DOI' => [false, '10.5880/icgem.2024.001', true],
            'GEM, no DOI' => [true, '', true],
            'GEM, with DOI' => [true, '10.5880/icgem.2024.001', false],
        ];
    }

    /**
     * Integration test: Verify the complete routing matrix.
     *
     * @return array<string, array{
     *   showGGMsProperties: bool,
     *   doi: string,
     *   expectDataServicesFile: bool,
     *   expectIcgemGeneration: bool,
     *   expectDataServicesPayload: bool
     * }>
     */
    public static function routingMatrixProvider(): array
    {
        return [
            'Scenario 1: Non-GEM' => [
                'showGGMsProperties' => false,
                'doi' => '',
                'expectDataServicesFile' => true,
                'expectIcgemGeneration' => false,
                'expectDataServicesPayload' => true,
            ],
            'Scenario 2: GEM + DOI' => [
                'showGGMsProperties' => true,
                'doi' => '10.5880/icgem.2024.001',
                'expectDataServicesFile' => false,
                'expectIcgemGeneration' => true,
                'expectDataServicesPayload' => false,
            ],
            'Scenario 3: GEM + no DOI' => [
                'showGGMsProperties' => true,
                'doi' => '',
                'expectDataServicesFile' => true,
                'expectIcgemGeneration' => true,
                'expectDataServicesPayload' => true,
            ],
        ];
    }

    #[DataProvider('routingMatrixProvider')]
    #[TestDox('Routing matrix: showGGMsProperties=$showGGMsProperties, doi=$doi')]
    public function testCompletedRoutingMatrix(
        bool $showGGMsProperties,
        string $doi,
        bool $expectDataServicesFile,
        bool $expectIcgemGeneration,
        bool $expectDataServicesPayload
    ): void {
        $generatedFile = generateFile(123, [
            'title' => ['Test'],
            'doi' => $doi,
        ], [
            'showGGMsProperties' => $showGGMsProperties,
        ]);

        $generatedIcgem = generateICGEMFile(123, [
            'title' => ['Test'],
            'doi' => $doi,
        ], [
            'showGGMsProperties' => $showGGMsProperties,
        ]);

        $this->assertSame($expectDataServicesFile, $generatedFile['shouldSendDataServicesMail']);
        $this->assertSame($expectIcgemGeneration, $generatedIcgem['shouldSendIcgemMail']);

        if ($expectDataServicesPayload) {
            $this->assertNotNull($generatedFile['dataServicesPayload']);
        } else {
            $this->assertNull($generatedFile['dataServicesPayload']);
        }
    }
}
