<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/ggms_registration_mail.php';

/**
 * Contract tests for the ELMO GEM ICGEM registration mail and contact extraction.
 *
 * The DOI field decides whether GFZ Data Services was notified. The ICGEM mail
 * must report that truthfully, and confirmation contacts must come from
 * grav:contact because the ICGEM envelope has no ISO pointOfContact block.
 */
#[CoversFunction('buildGGMsIcgemMessage')]
#[CoversFunction('buildGGMsDataServicesNote')]
#[CoversFunction('collectGGMsResearcherConfirmationDataFromXml')]
final class GGMsRegistrationMailTest extends TestCase
{
    /**
     * @return array<string, mixed>
     */
    private function context(bool $dataServicesEmailSent, string $doi = ''): array
    {
        return [
            'resourceId' => 42,
            'title' => 'EIGEN-6C4',
            'doi' => $doi,
            'priorityText' => 'normal',
            'dataUrl' => 'https://example.com/data',
            'contactEmails' => ['author@example.com'],
            'submittedAt' => '30.07.2026 12:00:00',
            'dataServicesEmailSent' => $dataServicesEmailSent,
            'icgemAddress' => 'icgem@gfz.de',
        ];
    }

    /**
     * Builds an ICGEM envelope with the given contact addresses.
     *
     * @param array<int, string> $addresses
     */
    private function icgemEnvelope(array $addresses): string
    {
        $addressXml = '';
        foreach ($addresses as $address) {
            $addressXml .= "<grav:address>{$address}</grav:address>";
        }

        return '<?xml version="1.0" encoding="UTF-8"?>
            <grav:envelope xmlns:grav="http://icgem.gfz.de/schema" xmlns:dace="http://datacite.org/schema/kernel-4">
                <dace:resource>
                    <dace:titles><dace:title xml:lang="en">EIGEN-6C4</dace:title></dace:titles>
                    <dace:contributors>
                        <dace:contributor contributorType="ContactPerson">
                            <dace:contributorName>Carberry, Josiah</dace:contributorName>
                        </dace:contributor>
                    </dace:contributors>
                </dace:resource>
                <grav:globalGravityProduct>
                    <grav:contact>' . $addressXml . '</grav:contact>
                </grav:globalGravityProduct>
            </grav:envelope>';
    }

    public function testDataServicesNoteNamesIcgemAddress(): void
    {
        $note = buildGGMsDataServicesNote('icgem@gfz.de');

        $this->assertStringContainsString('ElmoGen', $note['html']);
        $this->assertStringContainsString('icgem@gfz.de', $note['html']);
        $this->assertStringContainsString('icgem@gfz.de', $note['text']);
    }

    public function testIcgemMessageReportsSentDataServicesMail(): void
    {
        $message = buildGGMsIcgemMessage(
            $this->context(true),
            [['filename' => 'metadata42.xml', 'content' => '<grav:envelope/>']]
        );

        $this->assertSame('icgem@gfz.de', $message['to']);
        $this->assertStringContainsString('GFZ Data Services email sent:</strong> true', $message['html']);
        $this->assertStringContainsString('model ID will be', $message['html']);
        $this->assertStringNotContainsString('No new DOI', $message['html']);
        $this->assertSame('metadata42.xml', $message['attachments'][0]['filename']);
    }

    public function testIcgemMessageReportsExistingDoiPath(): void
    {
        $message = buildGGMsIcgemMessage(
            $this->context(false, '10.5880/icgem.2015.1'),
            [['filename' => 'metadata42.xml', 'content' => '<grav:envelope/>']]
        );

        $this->assertStringContainsString('GFZ Data Services email sent:</strong> false', $message['html']);
        $this->assertStringContainsString('10.5880/icgem.2015.1', $message['html']);
        $this->assertStringContainsString('No new DOI and no new model ID are generated', $message['html']);
        $this->assertStringNotContainsString('model ID will be', $message['html']);
    }

    public function testPlainTextBodyMirrorsDoiStatement(): void
    {
        $sentMessage = buildGGMsIcgemMessage($this->context(true), []);
        $notSentMessage = buildGGMsIcgemMessage($this->context(false, '10.5880/icgem.2015.1'), []);

        $this->assertStringContainsString('GFZ Data Services email sent: true', $sentMessage['text']);
        $this->assertStringContainsString('GFZ Data Services email sent: false', $notSentMessage['text']);
        $this->assertStringContainsString('10.5880/icgem.2015.1', $notSentMessage['text']);
    }

    public function testContactsAreReadFromIcgemContactElement(): void
    {
        $data = collectGGMsResearcherConfirmationDataFromXml(
            $this->icgemEnvelope(['author@example.com'])
        );

        $this->assertSame('EIGEN-6C4', $data['title']);
        $this->assertSame([['fullName' => 'Josiah Carberry', 'email' => 'author@example.com']], $data['contacts']);
        $this->assertSame([], $data['invalidContacts']);
    }

    public function testInvalidContactAddressIsReported(): void
    {
        $data = collectGGMsResearcherConfirmationDataFromXml(
            $this->icgemEnvelope(['not-an-email'])
        );

        $this->assertSame([], $data['contacts']);
        $this->assertSame([['fullName' => 'Josiah Carberry', 'email' => 'not-an-email']], $data['invalidContacts']);
    }
}
