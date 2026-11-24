<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\TestCase;

#[CoversFunction('resolveFeatureToggle')]
#[CoversFunction('JSVariables')]
final class FeatureToggleDefaultsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        require_once dirname(__DIR__) . '/includes/feature_toggles.php';
    }

    public function testNullValuesFallBackToDefault(): void
    {
        $this->assertTrue(resolveFeatureToggle(null, true));
        $this->assertFalse(resolveFeatureToggle(null, false));
    }

    public function testExplicitBooleanValuesAreRespected(): void
    {
        $this->assertTrue(resolveFeatureToggle(true, false));
        $this->assertFalse(resolveFeatureToggle(false, true));
    }

    public function testClientFeatureFlagsExposeOnlyBrowserValues(): void
    {
        $flags = JSVariables([
            'showThesauri' => 'false',
            'showMslMode' => true,
            'showContactInstitution' => false,
            'showGGMsProperties' => false,
            'showUsedInstruments' => true,
            'hiddenThesauri' => ['gemet', 'gemet', ''],
            'funderPidMode' => 'ROR',
            'dataUploadUrl' => 'https://upload.example/a',
            'xmlSubmitAddress' => 'curator@example.org',
            'contactAddressRepository' => 'repo@example.org',
            'SIMULATE_EMAIL' => true,
            'smtpPassword' => 'hunter2',
            'showFreeKeywords' => false,
            'showAuthorInstitution' => false,
            'showSpatialTemporalCoverage' => false,
            'showRelatedWork' => false,
            'showFundingReference' => false,
        ]);

        $this->assertSame([
            'showThesauri' => false,
            'showMslMode' => true,
            'showContactInstitution' => false,
            'showGGMsProperties' => false,
            'showUsedInstruments' => true,
            'hiddenThesauri' => ['gemet'],
            'funderPidMode' => 'ROR',
            'dataUploadUrl' => 'https://upload.example/a',
            'xmlSubmitAddress' => 'curator@example.org',
        ], $flags);
    }

    public function testClientFeatureFlagsUseDefaultsWhenValuesAreMissing(): void
    {
        $this->assertSame([
            'showThesauri' => true,
            'showMslMode' => false,
            'showContactInstitution' => false,
            'showGGMsProperties' => false,
            'showUsedInstruments' => true,
            'hiddenThesauri' => [],
            'funderPidMode' => 'CFID',
            'dataUploadUrl' => '',
            'xmlSubmitAddress' => 'datapub@gfz.de',
        ], JSVariables([]));
    }
}