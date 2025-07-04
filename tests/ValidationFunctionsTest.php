<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/validation.php';

class ValidationFunctionsTest extends TestCase
{
    public function testValidateRequiredFieldsSuccess(): void
    {
        $data = ['a' => 'x', 'b' => 'y'];
        $this->assertTrue(validateRequiredFields($data, ['a', 'b']));
    }

    public function testValidateRequiredFieldsMissing(): void
    {
        $data = ['a' => 'x'];
        $this->assertFalse(validateRequiredFields($data, ['a', 'b']));
    }

    public function testValidateRequiredFieldsArraySuccess(): void
    {
        $data = ['list' => [1, 2]];
        $this->assertTrue(validateRequiredFields($data, [], ['list']));
    }

    public function testValidateRequiredFieldsArrayMissing(): void
    {
        $data = ['list' => []];
        $this->assertFalse(validateRequiredFields($data, [], ['list']));
    }

    public function testValidateArrayDependenciesSuccess(): void
    {
        $data = ['a' => ['x', 'y'], 'b' => ['1', '2']];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertTrue(validateArrayDependencies($data, $deps));
    }

    public function testValidateArrayDependenciesMissing(): void
    {
        $data = ['a' => ['x'], 'b' => []];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertFalse(validateArrayDependencies($data, $deps));
    }

    public function testValidateArrayDependenciesJsonPrimary(): void
    {
        $primary = json_encode([["value" => "foo"]]);
        $data = ['a' => [$primary], 'b' => ['bar']];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertTrue(validateArrayDependencies($data, $deps));
    }

    public function testValidateContributorPersonDependenciesEmpty(): void
    {
        $this->assertTrue(validateContributorPersonDependencies([]));
    }

    public function testValidateContributorPersonDependenciesValid(): void
    {
        $entry = [
            'firstname' => 'A',
            'lastname' => 'B',
            'roles' => ['Editor']
        ];
        $this->assertTrue(validateContributorPersonDependencies($entry));
    }

    public function testValidateContributorPersonDependenciesInvalid(): void
    {
        $entry = ['firstname' => 'A', 'roles' => ['Editor']];
        $this->assertFalse(validateContributorPersonDependencies($entry));
    }

    public function testValidateContributorPersonDependenciesRolesJson(): void
    {
        $entry = [
            'firstname' => 'A',
            'lastname' => 'B',
            'roles' => json_encode(['Editor'])
        ];
        $this->assertTrue(validateContributorPersonDependencies($entry));
    }

    public function testValidateContributorInstitutionDependenciesEmpty(): void
    {
        $this->assertTrue(validateContributorInstitutionDependencies([]));
    }

    public function testValidateContributorInstitutionDependenciesValid(): void
    {
        $entry = ['name' => 'Inst', 'roles' => ['Editor']];
        $this->assertTrue(validateContributorInstitutionDependencies($entry));
    }

    public function testValidateContributorInstitutionDependenciesInvalid(): void
    {
        $entry = ['name' => 'Inst'];
        $this->assertFalse(validateContributorInstitutionDependencies($entry));
    }
}