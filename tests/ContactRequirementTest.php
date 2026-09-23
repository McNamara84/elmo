<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/contact_requirement.php';

final class ContactRequirementTest extends TestCase
{
    public function testContributorPersonCanSatisfyContactRequirement(): void
    {
        $post = ['authorsPayload' => '[]', 'contributorsPayload' => json_encode([[
            'type' => 'person', 'familyname' => 'Doe', 'email' => 'doe@example.org',
            'roles' => ['DataCollector', 'Contact Person'],
        ]])];
        self::assertTrue(validateSubmittedContact($post, false));
    }

    public function testInstitutionRequiresFeatureFlag(): void
    {
        $post = ['authorsPayload' => '[]', 'contributorsPayload' => json_encode([[
            'type' => 'institution', 'institutionname' => 'Institute', 'email' => 'info@example.org',
            'roles' => ['Contact Person'],
        ]])];
        self::assertFalse(validateSubmittedContact($post, false));
        self::assertTrue(validateSubmittedContact($post, true));
    }

    public function testInvalidEmailAndMalformedPayloadFail(): void
    {
        $entry = ['type' => 'person', 'familyname' => 'Doe', 'email' => 'bad', 'roles' => ['Contact Person']];
        self::assertFalse(validateSubmittedContact(['authorsPayload' => '[]', 'contributorsPayload' => json_encode([$entry])], false));
        self::assertFalse(validateSubmittedContact(['authorsPayload' => '[]', 'contributorsPayload' => '{'], false));
    }
}
