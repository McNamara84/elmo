<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestDox;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../includes/ggms_registration_mail.php';

/**
 * Prints the ELMO / ELMO GEM submit-mail decisions and composed bodies.
 *
 * Run alone to review the four branches without SMTP:
 *
 *   docker exec elmo-web-1 sh -c \
 *     'cd /var/www/html && vendor/bin/phpunit --no-coverage tests/GGMsEmailWorkflowScenarioTest.php'
 *
 * Branching mirrors endpoints/send_xml_file.php:
 *
 *   sendDataServices = !showGGMsProperties || doiEmpty
 *   sendIcgem        = showGGMsProperties
 */
final class GGMsEmailWorkflowScenarioTest extends TestCase
{
    private const XML_SUBMIT_ADDRESS = 'xmlsubmit@example.com';
    private const ICGEM_SUBMIT_ADDRESS = 'icgem@gfz.de';
    private const RESOURCE_ID = 42;
    private const TITLE = 'EIGEN-6C4';
    private const DATA_URL = 'https://example.com/primary-data';
    private const CONTACT_EMAIL = 'author@example.com';
    private const CONTACT_NAME = 'Josiah Carberry';

    /**
     * @return array<string, array{0: bool, 1: string}>
     */
    public static function workflowScenarios(): array
    {
        return [
            'generic, no DOI' => [false, ''],
            'generic, with DOI' => [false, '10.5880/icgem.2015.1'],
            'ELMO GEM, no DOI' => [true, ''],
            'ELMO GEM, with DOI' => [true, '10.5880/icgem.2015.1'],
        ];
    }

    #[DataProvider('workflowScenarios')]
    #[TestDox('Workflow: showGGMsProperties=$showGGMsProperties, doi="$doi"')]
    public function testWorkflowDecisionsAndMailBodies(bool $showGGMsProperties, string $doi): void
    {
        $doiEmpty = trim($doi) === '';
        $sendDataServicesMail = !$showGGMsProperties || $doiEmpty;
        $sendIcgemMail = $showGGMsProperties;
        $dataServicesEmailSent = $sendDataServicesMail;

        $variant = $showGGMsProperties ? 'ELMO GEM' : 'generic ELMO';
        $doiLabel = $doiEmpty ? '(empty)' : $doi;

        $this->logBanner("{$variant} | DOI {$doiLabel}");
        $this->logLine('Decision inputs');
        $this->logLine("  showGGMsProperties = " . ($showGGMsProperties ? 'true' : 'false'));
        $this->logLine("  doi field          = {$doiLabel}");
        $this->logLine('Decision outputs (same formulas as send_xml_file.php)');
        $this->logLine('  sendDataServicesMail = !showGGMsProperties || doiEmpty  => '
            . ($sendDataServicesMail ? 'YES' : 'NO'));
        $this->logLine('  sendIcgemMail        = showGGMsProperties              => '
            . ($sendIcgemMail ? 'YES' : 'NO'));
        if ($sendIcgemMail) {
            $this->logLine('  dataServicesEmailSent (flag inside ICGEM mail body)    => '
                . ($dataServicesEmailSent ? 'true' : 'false'));
        } else {
            $this->logLine('  dataServicesEmailSent                                   => n/a (no ICGEM mail)');
        }

        if ($showGGMsProperties) {
            $this->logLine('Payloads');
            $this->logLine('  ICGEM mail attachment      = IcgmController / icgem-xml (always for GEM)');
            $this->logLine('  Data Services attachment   = '
                . ($sendDataServicesMail
                    ? 'DatasetController / dataset-xml (generated because DOI is empty)'
                    : 'not generated (DOI already present)'));
            $this->logLine('  Researcher confirmation from = ICGEM grav:contact/grav:address');
        } else {
            $this->logLine('Payloads');
            $this->logLine('  Data Services attachment   = DatasetController / dataset-xml');
            $this->logLine('  ICGEM mail                 = not sent');
            $this->logLine('  Researcher confirmation from = ISO pointOfContact in dataset-xml');
        }

        if ($sendDataServicesMail) {
            $dataServices = $this->buildUsualDataServicesMail($showGGMsProperties);
            $this->logMail(
                'EMAIL 1 — GFZ Data Services (usual curator mail)',
                self::XML_SUBMIT_ADDRESS,
                $dataServices['subject'],
                $dataServices['text'],
                $showGGMsProperties ? 'dataset-xml (DatasetController)' : 'dataset-xml (DatasetController)'
            );
        } else {
            $this->logLine('');
            $this->logLine('EMAIL 1 — GFZ Data Services: SKIPPED');
        }

        if ($sendIcgemMail) {
            $icgem = buildGGMsIcgemMessage(
                [
                    'resourceId' => self::RESOURCE_ID,
                    'title' => self::TITLE,
                    'doi' => $doi,
                    'priorityText' => 'normal',
                    'dataUrl' => self::DATA_URL,
                    'contactEmails' => [self::CONTACT_EMAIL],
                    'submittedAt' => '30.07.2026 12:00:00',
                    'dataServicesEmailSent' => $dataServicesEmailSent,
                    'icgemAddress' => self::ICGEM_SUBMIT_ADDRESS,
                    'senderAddress' => 'elmo@example.com',
                ],
                [['filename' => 'metadata' . self::RESOURCE_ID . '.xml', 'content' => '<grav:envelope/>']]
            );

            $this->logMail(
                'EMAIL 2 — ICGEM (GEM registration mail)',
                (string) $icgem['to'],
                (string) $icgem['subject'],
                (string) $icgem['text'],
                'icgem-xml (IcgmController)'
            );
        } else {
            $this->logLine('');
            $this->logLine('EMAIL 2 — ICGEM: SKIPPED (generic ELMO)');
        }

        $confirmation = $this->buildResearcherConfirmationMail();
        $this->logMail(
            'EMAIL 3 — Researcher confirmation (always attempted when contacts exist)',
            self::CONTACT_EMAIL . ' (' . self::CONTACT_NAME . ')',
            $confirmation['subject'],
            $confirmation['text'],
            $showGGMsProperties
                ? 'contacts from ICGEM grav:contact (not from DatasetController)'
                : 'contacts from ISO pointOfContact in dataset-xml'
        );

        // Hard contracts for the four branches.
        if (!$showGGMsProperties) {
            $this->assertTrue($sendDataServicesMail, 'Generic ELMO always notifies Data Services.');
            $this->assertFalse($sendIcgemMail, 'Generic ELMO never sends the ICGEM mail.');
        } elseif ($doiEmpty) {
            $this->assertTrue($sendDataServicesMail, 'GEM without DOI notifies Data Services.');
            $this->assertTrue($sendIcgemMail, 'GEM without DOI notifies ICGEM.');
            $this->assertTrue($dataServicesEmailSent);
        } else {
            $this->assertFalse($sendDataServicesMail, 'GEM with DOI skips Data Services.');
            $this->assertTrue($sendIcgemMail, 'GEM with DOI still notifies ICGEM.');
            $this->assertFalse($dataServicesEmailSent);
        }
    }

    /**
     * @return array{subject: string, text: string}
     */
    private function buildUsualDataServicesMail(bool $showGGMsProperties): array
    {
        $urgencyText = '4 weeks';
        $priorityText = 'normal';
        $submittedAt = '30.07.2026 12:00:00';

        $text = "Neue Metadaten-Einreichung von ELMO\n\n"
            . "Hallo! Ich bin ELMO und eine neue Metadaten-Einreichung wurde mit folgenden Details übermittelt:\n\n"
            . 'Ressource ID in ELMO Datenbank: ' . self::RESOURCE_ID . "\n"
            . "Priorität: {$urgencyText} ({$priorityText})\n"
            . 'URL zu den Daten: ' . self::DATA_URL . "\n"
            . 'Contact email addresses provided by the author(s): ' . self::CONTACT_EMAIL . "\n"
            . "Eingereicht am: {$submittedAt}\n\n"
            . "Ich habe die Metadaten an diese E-Mail angehängt.\n\n"
            . "Und jetzt an die Arbeit! Die Dringlichkeit dieses Datensatzes ist {$priorityText}! "
            . "Aber ich habe bereits den größten Teil der Arbeit für Sie erledigt ;-)\n\n"
            . 'Diese E-Mail wurde automatisch von ELMO generiert.';

        if ($showGGMsProperties) {
            $text .= buildGGMsDataServicesNote(self::ICGEM_SUBMIT_ADDRESS)['text'];
        }

        return [
            'subject' => "Neue ELMO Metadaten-Einreichung (ID: " . self::RESOURCE_ID . ", Priorität: {$priorityText})",
            'text' => $text,
        ];
    }

    /**
     * @return array{subject: string, text: string}
     */
    private function buildResearcherConfirmationMail(): array
    {
        $fullName = self::CONTACT_NAME;
        $title = self::TITLE;

        return [
            'subject' => 'Confirmation of your data submission to ELMO',
            'text' => "Dear {$fullName},\n\n"
                . "Thank you for your data submission to ELMO.\n"
                . "Your data entry titled \"{$title}\" has been received successfully.\n"
                . "The data curators will now review your submission.\n\n"
                . "Best regards\nELMO",
        ];
    }

    private function logBanner(string $title): void
    {
        $line = str_repeat('=', 72);
        $this->logLine('');
        $this->logLine($line);
        $this->logLine($title);
        $this->logLine($line);
    }

    private function logMail(string $title, string $to, string $subject, string $text, string $attachmentNote): void
    {
        $this->logLine('');
        $this->logLine("--- {$title} ---");
        $this->logLine("To:          {$to}");
        $this->logLine("Subject:     {$subject}");
        $this->logLine("Attachment:  {$attachmentNote}");
        $this->logLine('Body (plain text):');
        $this->logLine($text);
    }

    private function logLine(string $line): void
    {
        fwrite(STDERR, $line . PHP_EOL);
    }
}
