<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

require_once __DIR__ . '/../save/validation.php';

/**
 * Unit tests for the ORCID checksum validation function (ISO 7064 Mod 11-2).
 */
final class OrcidValidationTest extends TestCase
{
    #[DataProvider('validOrcidProvider')]
    public function testValidOrcidsPassChecksumValidation(string $orcid): void
    {
        $this->assertTrue(isValidOrcidChecksum($orcid));
    }

    public static function validOrcidProvider(): array
    {
        return [
            'standard ORCID' => ['0000-0002-1825-0097'],
            'ends with zero' => ['0000-0001-5109-3700'],
            'ends with X' => ['0000-0002-1694-233X'],
            'sequential digits' => ['0000-0001-2345-6789'],
            'real ORCID 1' => ['0009-0007-2910-0469'],
            'real ORCID 2' => ['0009-0000-1235-6950'],
            'real ORCID 3' => ['0009-0006-3313-7304'],
        ];
    }

    #[DataProvider('invalidOrcidProvider')]
    public function testInvalidOrcidsFailChecksumValidation(string $orcid): void
    {
        $this->assertFalse(isValidOrcidChecksum($orcid));
    }

    public static function invalidOrcidProvider(): array
    {
        return [
            'common test value' => ['1234-1234-1234-1234'],
            'last digit off by one' => ['0000-0002-1825-0098'],
            'should end with X' => ['0000-0002-1694-2330'],
            'wrong check digit' => ['0000-0002-3456-7890'],
            'wrong check digit 2' => ['0000-0003-4567-8901'],
        ];
    }

    public function testEmptyStringIsInvalid(): void
    {
        $this->assertFalse(isValidOrcidChecksum(''));
    }

    public function testTooShortInputIsInvalid(): void
    {
        $this->assertFalse(isValidOrcidChecksum('0000-0002-1825'));
    }

    public function testTooLongInputIsInvalid(): void
    {
        $this->assertFalse(isValidOrcidChecksum('0000-0002-1825-00970'));
    }

    public function testLettersInMainBodyAreInvalid(): void
    {
        $this->assertFalse(isValidOrcidChecksum('000A-0002-1825-0097'));
    }

    public function testWithoutHyphensIsValid(): void
    {
        $this->assertTrue(isValidOrcidChecksum('0000000218250097'));
    }
}
