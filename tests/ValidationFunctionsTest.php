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
}