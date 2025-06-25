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
}