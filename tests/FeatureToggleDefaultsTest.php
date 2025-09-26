<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

class FeatureToggleDefaultsTest extends TestCase
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
}