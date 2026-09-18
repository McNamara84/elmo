<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\TestCase;

if (!defined('PHPUNIT_RUNNING')) {
    define('PHPUNIT_RUNNING', true);
}
require_once __DIR__ . '/../endpoints/send_xml_file.php';

#[CoversFunction('collectResearcherConfirmationDataFromXml')]
#[CoversFunction('sendResearcherConfirmationEmails')]
final class ResearcherConfirmationTest extends TestCase
{
    /**
     * Tests that empty XML returns no title and no contacts.
     */
    public function testEmptyXmlReturnsEmptyResult(): void
    {
        $result = collectResearcherConfirmationDataFromXml('');

        $this->assertSame('', $result['title']);
        $this->assertSame([], $result['contacts']);
        $this->assertSame([], $result['invalidContacts']);
    }

    /**
     * Tests that the dataset title is extracted correctly.
     */
    public function testTitleIsExtracted(): void
    {
        $xml = '<root><title>My Dataset</title></root>';

        $result = collectResearcherConfirmationDataFromXml($xml);

        $this->assertSame('My Dataset', $result['title']);
    }

    /**
     * Tests that a contact is extracted and name is converted.
     */
    public function testContactIsExtracted(): void
    {
        $xml =
            '<root>' .
                '<pointOfContact>' .
                    '<individualName><CharacterString>Doe, John</CharacterString></individualName>' .
                    '<electronicMailAddress><CharacterString>john@example.com</CharacterString></electronicMailAddress>' .
                '</pointOfContact>' .
            '</root>';

        $result = collectResearcherConfirmationDataFromXml($xml);

        $this->assertCount(1, $result['contacts']);

        $this->assertSame('John Doe', $result['contacts'][0]['fullName']);
        $this->assertSame('john@example.com', $result['contacts'][0]['email']);
    }

    /**
     * Tests that invalid email addresses are skipped.
     */
    public function testInvalidEmailIsSkipped(): void
    {
        $xml =
            '<root>' .
                '<pointOfContact>' .
                    '<individualName><CharacterString>John Doe</CharacterString></individualName>' .
                    '<electronicMailAddress><CharacterString>invalid-email</CharacterString></electronicMailAddress>' .
                '</pointOfContact>' .
            '</root>';

        $result = collectResearcherConfirmationDataFromXml($xml);

        $this->assertSame([], $result['contacts']);
        $this->assertCount(1, $result['invalidContacts']);
        $this->assertSame('John Doe', $result['invalidContacts'][0]['fullName']);
        $this->assertSame('invalid-email', $result['invalidContacts'][0]['email']);
    }

    /**
     * Tests that duplicate contacts are removed.
     */
    public function testDuplicateContactsAreRemoved(): void
    {
        $xml =
            '<root>' .
                '<pointOfContact>' .
                    '<individualName><CharacterString>Doe, John</CharacterString></individualName>' .
                    '<electronicMailAddress><CharacterString>john@example.com</CharacterString></electronicMailAddress>' .
                '</pointOfContact>' .
                '<pointOfContact>' .
                    '<individualName><CharacterString>Doe, John</CharacterString></individualName>' .
                    '<electronicMailAddress><CharacterString>john@example.com</CharacterString></electronicMailAddress>' .
                '</pointOfContact>' .
            '</root>';

        $result = collectResearcherConfirmationDataFromXml($xml);

        $this->assertCount(1, $result['contacts']);
    }

    /**
     * Tests email generation in simulation mode.
     */
    public function testSendResearcherConfirmationEmailsInSimulationMode(): void
    {
        $data = [
            'title' => 'My Dataset',
            'contacts' => [
                [
                    'fullName' => 'John Doe',
                    'email' => 'john@example.com',
                ],
            ],
        ];

        $result = sendResearcherConfirmationEmails($data, true);

        $this->assertSame(1, $result['sent']);
        $this->assertSame([], $result['failed']);
    }

    /**
     * Tests that invalid email addresses are skipped during email generation.
     */
    public function testSendResearcherConfirmationEmailsSkipsInvalidEmail(): void
    {
        $data = [
            'title' => 'My Dataset',
            'contacts' => [
                [
                    'fullName' => 'John Doe',
                    'email' => 'invalid-email',
                ],
            ],
        ];

        $result = sendResearcherConfirmationEmails($data, true);

        $this->assertSame(0, $result['sent']);
        $this->assertCount(1, $result['failed']);
        $this->assertSame('invalid email address', $result['failed'][0]['error']);
    }
}