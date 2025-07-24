<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../save/validation.php';

/**
 * Test suite for validation helper functions.
 *
 * These tests ensure that the validation logic for required fields,
 * dependencies and data structures behaves as expected.
 */
class ValidationFunctionsTest extends TestCase
{
    /**
     * Validates that all required fields being present returns true.
     *
     * @return void
     */
    public function testValidateRequiredFieldsSuccess(): void
    {
        $data = ['a' => 'x', 'b' => 'y'];
        $this->assertTrue(validateRequiredFields($data, ['a', 'b']));
    }

    /**
     * Ensures validation fails when a required field is missing.
     *
     * @return void
     */
    public function testValidateRequiredFieldsMissing(): void
    {
        $data = ['a' => 'x'];
        $this->assertFalse(validateRequiredFields($data, ['a', 'b']));
    }

    /**
     * Tests validation of required array fields with populated values.
     *
     * @return void
     */
    public function testValidateRequiredFieldsArraySuccess(): void
    {
        $data = ['list' => [1, 2]];
        $this->assertTrue(validateRequiredFields($data, [], ['list']));
    }

    /**
     * Tests validation failure when a required array field is empty.
     *
     * @return void
     */
    public function testValidateRequiredFieldsArrayMissing(): void
    {
        $data = ['list' => []];
        $this->assertFalse(validateRequiredFields($data, [], ['list']));
    }

    /**
     * Checks array dependency validation with matching indices.
     *
     * @return void
     */
    public function testValidateArrayDependenciesSuccess(): void
    {
        $data = ['a' => ['x', 'y'], 'b' => ['1', '2']];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertTrue(validateArrayDependencies($data, $deps));
    }

    /**
     * Verifies that missing dependent values cause validation to fail.
     *
     * @return void
     */
    public function testValidateArrayDependenciesMissing(): void
    {
        $data = ['a' => ['x'], 'b' => []];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertFalse(validateArrayDependencies($data, $deps));
    }

    /**
     * Tests array dependency validation when the primary value is JSON encoded.
     *
     * @return void
     */
    public function testValidateArrayDependenciesJsonPrimary(): void
    {
        $primary = json_encode([["value" => "foo"]]);
        $data = ['a' => [$primary], 'b' => ['bar']];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertTrue(validateArrayDependencies($data, $deps));
    }

    /**
     * Ensures empty contributor person data passes validation.
     *
     * @return void
     */
    public function testValidateContributorPersonDependenciesEmpty(): void
    {
        $this->assertTrue(validateContributorPersonDependencies([]));
    }

    /**
     * Tests validation of a complete contributor person entry.
     *
     * @return void
     */
    public function testValidateContributorPersonDependenciesValid(): void
    {
        $entry = [
            'firstname' => 'A',
            'lastname' => 'B',
            'roles' => ['Editor']
        ];
        $this->assertTrue(validateContributorPersonDependencies($entry));
    }

    /**
     * Ensures contributor person validation fails when required fields are missing.
     *
     * @return void
     */
    public function testValidateContributorPersonDependenciesInvalid(): void
    {
        $entry = ['firstname' => 'A', 'roles' => ['Editor']];
        $this->assertFalse(validateContributorPersonDependencies($entry));
    }

    /**
     * Tests contributor person validation with roles provided as JSON.
     *
     * @return void
     */
    public function testValidateContributorPersonDependenciesRolesJson(): void
    {
        $entry = [
            'firstname' => 'A',
            'lastname' => 'B',
            'roles' => json_encode(['Editor'])
        ];
        $this->assertTrue(validateContributorPersonDependencies($entry));
    }

    /**
     * Ensures empty contributor institution data is considered valid.
     *
     * @return void
     */
    public function testValidateContributorInstitutionDependenciesEmpty(): void
    {
        $this->assertTrue(validateContributorInstitutionDependencies([]));
    }

    /**
     * Tests validation of a contributor institution with required fields.
     *
     * @return void
     */
    public function testValidateContributorInstitutionDependenciesValid(): void
    {
        $entry = ['name' => 'Inst', 'roles' => ['Editor']];
        $this->assertTrue(validateContributorInstitutionDependencies($entry));
    }

    /**
     * Verifies contributor institution validation fails if roles are missing.
     *
     * @return void
     */
    public function testValidateContributorInstitutionDependenciesInvalid(): void
    {
        $entry = ['name' => 'Inst'];
        $this->assertFalse(validateContributorInstitutionDependencies($entry));
    }

    /**
     * Checks keyword entry validation with all required fields present.
     *
     * @return void
     */
    public function testValidateKeywordEntriesValid(): void
    {
        $entry = [['value' => 'A', 'id' => '1', 'scheme' => 's', 'schemeURI' => 'u', 'language' => 'en']];
        $this->assertTrue(validateKeywordEntries($entry));
    }

    /**
     * Ensures keyword validation fails when required fields are absent.
     *
     * @return void
     */
    public function testValidateKeywordEntriesMissingField(): void
    {
        $entry = [['value' => 'A', 'id' => '1']];
        $this->assertFalse(validateKeywordEntries($entry));
    }

    /**
     * Tests validation failure when keyword data is not an array.
     *
     * @return void
     */
    public function testValidateKeywordEntriesNotArray(): void
    {
        $this->assertFalse(validateKeywordEntries('not-array'));
    }

    /**
     * Validates that a complete Spatial Temporal Coverage entry is accepted.
     *
     * @return void
     */
    public function testValidateSTCDependenciesValid(): void
    {
        $entry = [
            'latitudeMin' => 1,
            'longitudeMin' => 1,
            'description' => 'd',
            'dateStart' => '2020-01-01',
            'dateEnd' => '2020-01-02',
            'timezone' => 'UTC'
        ];
        $this->assertTrue(validateSTCDependencies($entry));
    }

    /**
     * Ensures STC validation fails when base fields are missing.
     *
     * @return void
     */
    public function testValidateSTCDependenciesMissingBase(): void
    {
        $entry = [];
        $this->assertFalse(validateSTCDependencies($entry));
    }

    /**
     * Verifies that providing a start time without an end time fails validation.
     *
     * @return void
     */
    public function testValidateSTCDependenciesMissingTimeEnd(): void
    {
        $entry = [
            'latitudeMin' => 1,
            'longitudeMin' => 1,
            'description' => 'd',
            'dateStart' => '2020-01-01',
            'dateEnd' => '2020-01-02',
            'timezone' => 'UTC',
            'timeStart' => '10:00'
        ];
        $this->assertFalse(validateSTCDependencies($entry));
    }

    /**
     * Tests STC validation failure when longitude max is set without latitude max.
     *
     * @return void
     */
    public function testValidateSTCDependenciesMissingLatitudeMax(): void
    {
        $entry = [
            'latitudeMin' => 1,
            'longitudeMin' => 1,
            'description' => 'd',
            'dateStart' => '2020-01-01',
            'dateEnd' => '2020-01-02',
            'timezone' => 'UTC',
            'longitudeMax' => 2
        ];
        $this->assertFalse(validateSTCDependencies($entry));
    }

    /**
     * Ensures an empty related work entry is considered valid.
     *
     * @return void
     */
    public function testValidateRelatedWorkDependenciesEmpty(): void
    {
        $this->assertTrue(validateRelatedWorkDependencies([]));
    }

    /**
     * Tests a fully populated related work entry for successful validation.
     *
     * @return void
     */
    public function testValidateRelatedWorkDependenciesValid(): void
    {
        $entry = [
            'identifier' => 'id',
            'relation' => 'rel',
            'identifierType' => 'type'
        ];
        $this->assertTrue(validateRelatedWorkDependencies($entry));
    }

    /**
     * Verifies validation failure when related work fields are incomplete.
     *
     * @return void
     */
    public function testValidateRelatedWorkDependenciesInvalid(): void
    {
        $entry = ['identifier' => 'id'];
        $this->assertFalse(validateRelatedWorkDependencies($entry));
    }

    /**
     * Ensures empty funding reference data passes validation.
     *
     * @return void
     */
    public function testValidateFundingReferenceDependenciesEmpty(): void
    {
        $this->assertTrue(validateFundingReferenceDependencies([]));
    }

    /**
     * Tests funding reference validation when only the funder is provided.
     *
     * @return void
     */
    public function testValidateFundingReferenceDependenciesOnlyFunder(): void
    {
        $entry = ['funder' => 'name'];
        $this->assertTrue(validateFundingReferenceDependencies($entry));
    }

    /**
     * Verifies failure if dependent funding fields are set without a funder.
     *
     * @return void
     */
    public function testValidateFundingReferenceDependenciesMissingFunder(): void
    {
        $entry = ['grantName' => 'grant'];
        $this->assertFalse(validateFundingReferenceDependencies($entry));
    }

    /**
     * Tests funding reference validation when a funder and additional data are supplied.
     *
     * @return void
     */
    public function testValidateFundingReferenceDependenciesWithFunder(): void
    {
        $entry = ['grantNumber' => '123', 'funder' => 'name'];
        $this->assertTrue(validateFundingReferenceDependencies($entry));
    }

    /**
     * Validates array dependencies when the primary field is missing.
     *
     * @return void
     */
    public function testValidateArrayDependenciesMissingPrimary(): void
    {
        $data = ['b' => ['1']];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertFalse(validateArrayDependencies($data, $deps));
    }

    /**
     * Validates array dependencies when the primary value is empty and should be skipped.
     *
     * @return void
     */
    public function testValidateArrayDependenciesSkipEmpty(): void
    {
        $data = ['a' => [''], 'b' => []];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertTrue(validateArrayDependencies($data, $deps));
    }

    /**
     * Ensures invalid JSON in the primary array causes a failure when dependent is missing.
     *
     * @return void
     */
    public function testValidateArrayDependenciesInvalidJson(): void
    {
        $data = ['a' => ['{invalid json}'], 'b' => []];
        $deps = [['primary' => 'a', 'dependent' => 'b']];
        $this->assertFalse(validateArrayDependencies($data, $deps));
    }

    /**
     * Checks contributor person validation when only the firstname is provided.
     *
     * @return void
     */
    public function testValidateContributorPersonOnlyFirstname(): void
    {
        $entry = ['firstname' => 'A', 'roles' => []];
        $this->assertFalse(validateContributorPersonDependencies($entry));
    }

    /**
     * Ensures roles provided as a non-JSON string are rejected.
     *
     * @return void
     */
    public function testValidateContributorPersonRolesInvalidString(): void
    {
        $entry = ['firstname' => 'A', 'lastname' => 'B', 'roles' => 'Editor'];
        $this->assertFalse(validateContributorPersonDependencies($entry));
    }

    /**
     * Tests contributor institution validation when only roles are supplied.
     *
     * @return void
     */
    public function testValidateContributorInstitutionOnlyRoles(): void
    {
        $entry = ['roles' => ['Editor'], 'name' => null];
        $this->assertFalse(validateContributorInstitutionDependencies($entry));
    }
}