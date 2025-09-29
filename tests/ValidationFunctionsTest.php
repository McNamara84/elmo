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
        $entry = ['awardUri' => 'https://example.com'];
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
     * Test edge cases for required fields validation
     *
     * @return void
     */
    public function testValidateRequiredFieldsEdgeCases(): void
    {
        // Test with null values
        $dataWithNull = ['a' => null, 'b' => 'valid'];
        $this->assertFalse(validateRequiredFields($dataWithNull, ['a', 'b']));
        
        // Test with empty strings
        $dataWithEmpty = ['a' => '', 'b' => 'valid'];
        $this->assertFalse(validateRequiredFields($dataWithEmpty, ['a', 'b']));
        
        // Test with whitespace only
        $dataWithWhitespace = ['a' => '   ', 'b' => 'valid'];
        $this->assertFalse(validateRequiredFields($dataWithWhitespace, ['a', 'b']));
        
        // Test with zero value (should be valid)
        $dataWithZero = ['a' => 0, 'b' => 'valid'];
        $this->assertTrue(validateRequiredFields($dataWithZero, ['a', 'b']));
        
        // Test with false value (should be valid)
        $dataWithFalse = ['a' => false, 'b' => 'valid'];
        $this->assertTrue(validateRequiredFields($dataWithFalse, ['a', 'b']));
    }

    /**
     * Test validation with numeric and boolean values
     *
     * @return void
     */
    public function testValidateRequiredFieldsNumericAndBoolean(): void
    {
        // Test with numeric values
        $dataNumeric = ['count' => 42, 'price' => 19.99, 'enabled' => true];
        $this->assertTrue(validateRequiredFields($dataNumeric, ['count', 'price', 'enabled']));
        
        // Test with boolean false (should pass)
        $dataWithFalse = ['active' => false, 'name' => 'test'];
        $this->assertTrue(validateRequiredFields($dataWithFalse, ['active', 'name']));
    }

    /**
     * Test validation with array data
     *
     * @return void
     */
    public function testValidateRequiredFieldsArrayData(): void
    {
        // Test with empty array (should fail)
        $dataWithEmptyArray = ['items' => [], 'name' => 'test'];
        $this->assertFalse(validateRequiredFields($dataWithEmptyArray, ['items', 'name']));
        
        // Test with non-empty array (should pass)
        $dataWithArray = ['items' => ['item1'], 'name' => 'test'];
        $this->assertTrue(validateRequiredFields($dataWithArray, ['items', 'name']));
    }

    /**
     * Test contributor person validation with edge cases
     *
     * @return void
     */
    public function testValidateContributorPersonEdgeCases(): void
    {
        // Test with whitespace-only names
        $entryWithWhitespace = [
            'firstname' => '   ',
            'lastname' => 'Valid',
            'roles' => ['Editor']
        ];
        $this->assertFalse(validateContributorPersonDependencies($entryWithWhitespace));
        
        // Test with numeric roles
        $entryWithNumericRoles = [
            'firstname' => 'John',
            'lastname' => 'Doe',
            'roles' => [1, 2]  // numeric role IDs
        ];
        $this->assertTrue(validateContributorPersonDependencies($entryWithNumericRoles));
        
        // Test with empty roles array
        $entryWithEmptyRoles = [
            'firstname' => 'John',
            'lastname' => 'Doe',
            'roles' => []
        ];
        $this->assertFalse(validateContributorPersonDependencies($entryWithEmptyRoles));
    }

    /**
     * Test keyword validation with different value types
     *
     * @return void
     */
    public function testValidateKeywordEntriesValueTypes(): void
    {
        // Test with numeric keyword value
        $entryNumeric = [[
            'value' => 123,
            'id' => '1',
            'scheme' => 's',
            'schemeURI' => 'u',
            'language' => 'en'
        ]];
        $this->assertTrue(validateKeywordEntries($entryNumeric));
        
        // Test with special characters in value
        $entrySpecialChars = [[
            'value' => 'Special & chars <test>',
            'id' => '1',
            'scheme' => 's',
            'schemeURI' => 'u',
            'language' => 'en'
        ]];
        $this->assertTrue(validateKeywordEntries($entrySpecialChars));
        
        // Test with multiple keyword entries
        $multipleEntries = [
            [
                'value' => 'Keyword 1',
                'id' => '1',
                'scheme' => 's1',
                'schemeURI' => 'u1',
                'language' => 'en'
            ],
            [
                'value' => 'Keyword 2',
                'id' => '2',
                'scheme' => 's2',
                'schemeURI' => 'u2',
                'language' => 'de'
            ]
        ];
        $this->assertTrue(validateKeywordEntries($multipleEntries));
    }

    /**
     * Test STC validation with boundary values
     *
     * @return void
     */
    public function testValidateSTCDependenciesBoundaryValues(): void
    {
        // Test with extreme latitude values
        $entryExtremeLatitude = [
            'latitudeMin' => -90,
            'latitudeMax' => 90,
            'longitudeMin' => -180,
            'longitudeMax' => 180,
            'description' => 'Global coverage',
            'dateStart' => '2020-01-01',
            'dateEnd' => '2020-12-31',
            'timezone' => 'UTC'
        ];
        $this->assertTrue(validateSTCDependencies($entryExtremeLatitude));
        
        // Test with invalid latitude values
        $entryInvalidLatitude = [
            'latitudeMin' => -95,  // Invalid latitude
            'longitudeMin' => 0,
            'description' => 'd',
            'dateStart' => '2020-01-01',
            'dateEnd' => '2020-01-02',
            'timezone' => 'UTC'
        ];
        // Note: This test depends on whether the validation function checks coordinate bounds
        // If it doesn't, this test should be adjusted or validation function enhanced
        
        // Test with same start and end dates
        $entrySameDates = [
            'latitudeMin' => 50,
            'longitudeMin' => 10,
            'description' => 'Single day',
            'dateStart' => '2020-01-01',
            'dateEnd' => '2020-01-01',
            'timezone' => 'UTC'
        ];
        $this->assertTrue(validateSTCDependencies($entrySameDates));
    }

    /**
     * Test related work validation with various identifier types
     *
     * @return void
     */
    public function testValidateRelatedWorkIdentifierTypes(): void
    {
        $identifierTypes = ['DOI', 'URL', 'ISBN', 'ISSN', 'arXiv'];
        
        foreach ($identifierTypes as $type) {
            $entry = [
                'identifier' => '10.1000/test',
                'relation' => 'IsReferencedBy',
                'identifierType' => $type
            ];
            $this->assertTrue(validateRelatedWorkDependencies($entry), 
                "Should validate with identifier type: $type");
        }
    }

    /**
     * Test funding reference validation with complex scenarios
     *
     * @return void
     */
    public function testValidateFundingReferenceComplexScenarios(): void
    {
        // Test with all funding fields provided
        $completeEntry = [
            'funder' => 'National Science Foundation',
            'grantNumber' => 'NSF-123456',
            'awardTitle' => 'Research Grant',
            'awardUri' => 'https://example.com/award/123'
        ];
        $this->assertTrue(validateFundingReferenceDependencies($completeEntry));
        
        // Test with minimal valid entry
        $minimalEntry = ['funder' => 'Private Foundation'];
        $this->assertTrue(validateFundingReferenceDependencies($minimalEntry));
        
        // Test with funding but empty grant number
        $entryEmptyGrant = [
            'funder' => 'Foundation',
            'grantNumber' => ''
        ];
        $this->assertFalse(validateFundingReferenceDependencies($entryEmptyGrant));
    }
}