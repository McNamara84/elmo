<?php
declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Test suite for send_xml_file.php
 * 
 * Comprehensive tests for the XML submission script that saves metadata
 * and sends it via email with attachments.
 */
class SendXmlFileTest extends TestCase
{
    private string $scriptPath;
    private string $scriptContent;

    /**
     * Set up test environment before each test
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->scriptPath = __DIR__ . '/../send_xml_file.php';
        $this->scriptContent = file_get_contents($this->scriptPath);
    }

    /**
     * Test that the script file exists and is readable
     */
    public function testScriptFileExists(): void
    {
        $this->assertFileExists($this->scriptPath, 'send_xml_file.php should exist');
        $this->assertFileIsReadable($this->scriptPath, 'send_xml_file.php should be readable');
    }

    /**
     * Test script contains required includes
     */
    public function testScriptContainsRequiredIncludes(): void
    {
        $this->assertStringContainsString('settings.php', $this->scriptContent);
        $this->assertStringContainsString('PHPMailer', $this->scriptContent);
        $this->assertStringContainsString('DatasetController', $this->scriptContent);
    }

    /**
     * Test script includes save formgroup files
     */
    public function testScriptIncludesSaveFormgroups(): void
    {
        $this->assertStringContainsString('save_resourceinformation_and_rights.php', $this->scriptContent);
        $this->assertStringContainsString('save_authors.php', $this->scriptContent);
        $this->assertStringContainsString('save_contactperson.php', $this->scriptContent);
        $this->assertStringContainsString('save_freekeywords.php', $this->scriptContent);
        $this->assertStringContainsString('save_descriptions.php', $this->scriptContent);
    }

    /**
     * Test script uses error reporting
     */
    public function testScriptUsesErrorReporting(): void
    {
        $this->assertStringContainsString('error_reporting', $this->scriptContent);
        $this->assertStringContainsString('display_errors', $this->scriptContent);
    }

    /**
     * Test script uses output buffering
     */
    public function testScriptUsesOutputBuffering(): void
    {
        $this->assertStringContainsString('ob_start()', $this->scriptContent);
        $this->assertStringContainsString('ob_clean()', $this->scriptContent);
        $this->assertStringContainsString('ob_end_flush()', $this->scriptContent);
    }

    /**
     * Test script has testGfzSmtpConnectivity function
     */
    public function testScriptHasTestGfzSmtpConnectivityFunction(): void
    {
        $this->assertStringContainsString('function testGfzSmtpConnectivity()', $this->scriptContent);
        $this->assertStringContainsString('gethostbyname', $this->scriptContent);
        $this->assertStringContainsString('fsockopen', $this->scriptContent);
    }

    /**
     * Test script has getPriorityText function
     */
    public function testScriptHasGetPriorityTextFunction(): void
    {
        $this->assertStringContainsString('function getPriorityText', $this->scriptContent);
        $this->assertStringContainsString('switch', $this->scriptContent);
        $this->assertStringContainsString('high', $this->scriptContent);
        $this->assertStringContainsString('normal', $this->scriptContent);
        $this->assertStringContainsString('low', $this->scriptContent);
    }

    /**
     * Test getPriorityText function logic
     */
    public function testGetPriorityTextFunctionLogic(): void
    {
        // Test that function handles different week values
        $this->assertStringContainsString('case 2:', $this->scriptContent);
        $this->assertStringContainsString('return "high"', $this->scriptContent);
        $this->assertStringContainsString('case 4:', $this->scriptContent);
        $this->assertStringContainsString('return "normal"', $this->scriptContent);
        $this->assertStringContainsString('case 6:', $this->scriptContent);
        $this->assertStringContainsString('return "low"', $this->scriptContent);
        $this->assertStringContainsString('default:', $this->scriptContent);
        $this->assertStringContainsString('return "undefined"', $this->scriptContent);
    }

    /**
     * Test script initializes resource_id
     */
    public function testScriptInitializesResourceId(): void
    {
        $this->assertStringContainsString('$resource_id = false', $this->scriptContent);
    }

    /**
     * Test script uses try-catch for error handling
     */
    public function testScriptUsesTryCatchForErrorHandling(): void
    {
        $this->assertStringContainsString('try {', $this->scriptContent);
        $this->assertStringContainsString('} catch (Exception $e) {', $this->scriptContent);
    }

    /**
     * Test script calls all save functions
     */
    public function testScriptCallsAllSaveFunctions(): void
    {
        $this->assertStringContainsString('saveResourceInformationAndRights', $this->scriptContent);
        $this->assertStringContainsString('saveAuthors', $this->scriptContent);
        $this->assertStringContainsString('saveContactPerson', $this->scriptContent);
        $this->assertStringContainsString('saveContributorInstitutions', $this->scriptContent);
        $this->assertStringContainsString('saveContributorPersons', $this->scriptContent);
        $this->assertStringContainsString('saveDescriptions', $this->scriptContent);
        $this->assertStringContainsString('saveKeywords', $this->scriptContent);
        $this->assertStringContainsString('saveFreeKeywords', $this->scriptContent);
        $this->assertStringContainsString('saveSpatialTemporalCoverage', $this->scriptContent);
        $this->assertStringContainsString('saveRelatedWork', $this->scriptContent);
        $this->assertStringContainsString('saveFundingReferences', $this->scriptContent);
    }

    /**
     * Test script retrieves POST data
     */
    public function testScriptRetrievesPostData(): void
    {
        $this->assertStringContainsString('$_POST', $this->scriptContent);
        $this->assertStringContainsString('urgency', $this->scriptContent);
        $this->assertStringContainsString('dataUrl', $this->scriptContent);
    }

    /**
     * Test script validates and formats URL
     */
    public function testScriptValidatesAndFormatsUrl(): void
    {
        $this->assertStringContainsString('filter_var', $this->scriptContent);
        $this->assertStringContainsString('FILTER_SANITIZE_URL', $this->scriptContent);
        $this->assertStringContainsString('FILTER_VALIDATE_URL', $this->scriptContent);
        $this->assertStringContainsString('trim', $this->scriptContent);
    }

    /**
     * Test script adds https protocol if missing
     */
    public function testScriptAddsHttpsProtocolIfMissing(): void
    {
        $this->assertStringContainsString('preg_match', $this->scriptContent);
        $this->assertStringContainsString('https://', $this->scriptContent);
    }

    /**
     * Test script includes DatasetController
     */
    public function testScriptIncludesDatasetController(): void
    {
        $this->assertStringContainsString('DatasetController.php', $this->scriptContent);
        $this->assertStringContainsString('new DatasetController()', $this->scriptContent);
    }

    /**
     * Test script generates XML content
     */
    public function testScriptGeneratesXmlContent(): void
    {
        $this->assertStringContainsString('$xml_content', $this->scriptContent);
        $this->assertStringContainsString('file_get_contents', $this->scriptContent);
        $this->assertStringContainsString('/api/v2/dataset/export/', $this->scriptContent);
    }

    /**
     * Test script has fallback for XML generation
     */
    public function testScriptHasFallbackForXmlGeneration(): void
    {
        $this->assertStringContainsString('envelopeXmlAsString', $this->scriptContent);
        $this->assertStringContainsString('fallback logic', $this->scriptContent);
    }

    /**
     * Test script tests SMTP connectivity
     */
    public function testScriptTestsSmtpConnectivity(): void
    {
        $this->assertStringContainsString('testGfzSmtpConnectivity()', $this->scriptContent);
        $this->assertStringContainsString('SMTP Server nicht erreichbar', $this->scriptContent);
    }

    /**
     * Test script creates PHPMailer instance
     */
    public function testScriptCreatesPhpMailerInstance(): void
    {
        $this->assertStringContainsString('new PHPMailer(true)', $this->scriptContent);
        $this->assertStringContainsString('$mail', $this->scriptContent);
    }

    /**
     * Test script configures SMTP debugging
     */
    public function testScriptConfiguresSmtpDebugging(): void
    {
        $this->assertStringContainsString('SMTPDebug', $this->scriptContent);
        $this->assertStringContainsString('Debugoutput', $this->scriptContent);
        $this->assertStringContainsString('$debugging_output', $this->scriptContent);
    }

    /**
     * Test script configures SMTP settings
     */
    public function testScriptConfiguresSmtpSettings(): void
    {
        $this->assertStringContainsString('isSMTP()', $this->scriptContent);
        $this->assertStringContainsString('$mail->Host', $this->scriptContent);
        $this->assertStringContainsString('$mail->Port', $this->scriptContent);
        $this->assertStringContainsString('$mail->SMTPAuth', $this->scriptContent);
    }

    /**
     * Test script handles SMTP authentication
     */
    public function testScriptHandlesSmtpAuthentication(): void
    {
        $this->assertStringContainsString('$mail->Username', $this->scriptContent);
        $this->assertStringContainsString('$mail->Password', $this->scriptContent);
        $this->assertStringContainsString('if ($mail->SMTPAuth)', $this->scriptContent);
    }

    /**
     * Test script configures TLS encryption
     */
    public function testScriptConfiguresTlsEncryption(): void
    {
        $this->assertStringContainsString('STARTTLS', $this->scriptContent);
        $this->assertStringContainsString('SMTPSecure', $this->scriptContent);
        $this->assertStringContainsString('SMTPAutoTLS', $this->scriptContent);
    }

    /**
     * Test script sets email recipients
     */
    public function testScriptSetsEmailRecipients(): void
    {
        $this->assertStringContainsString('setFrom', $this->scriptContent);
        $this->assertStringContainsString('addAddress', $this->scriptContent);
        $this->assertStringContainsString('addReplyTo', $this->scriptContent);
        $this->assertStringContainsString('$xmlSubmitAddress', $this->scriptContent);
    }

    /**
     * Test script handles file upload
     */
    public function testScriptHandlesFileUpload(): void
    {
        $this->assertStringContainsString('$_FILES', $this->scriptContent);
        $this->assertStringContainsString('dataDescription', $this->scriptContent);
        $this->assertStringContainsString('UPLOAD_ERR_OK', $this->scriptContent);
    }

    /**
     * Test script validates file type
     */
    public function testScriptValidatesFileType(): void
    {
        $this->assertStringContainsString('mime_content_type', $this->scriptContent);
        $this->assertStringContainsString('application/pdf', $this->scriptContent);
        $this->assertStringContainsString('application/msword', $this->scriptContent);
        $this->assertStringContainsString('wordprocessingml.document', $this->scriptContent);
    }

    /**
     * Test script validates file size
     */
    public function testScriptValidatesFileSize(): void
    {
        $this->assertStringContainsString('10 * 1024 * 1024', $this->scriptContent);
        $this->assertStringContainsString('File size exceeds maximum', $this->scriptContent);
    }

    /**
     * Test script adds file attachment
     */
    public function testScriptAddsFileAttachment(): void
    {
        $this->assertStringContainsString('addAttachment', $this->scriptContent);
        $this->assertStringContainsString('data_description_', $this->scriptContent);
    }

    /**
     * Test script adds XML attachment
     */
    public function testScriptAddsXmlAttachment(): void
    {
        $this->assertStringContainsString('addStringAttachment', $this->scriptContent);
        $this->assertStringContainsString('metadata_', $this->scriptContent);
        $this->assertStringContainsString('.xml', $this->scriptContent);
    }

    /**
     * Test script prepares email content
     */
    public function testScriptPreparesEmailContent(): void
    {
        $this->assertStringContainsString('$htmlBody', $this->scriptContent);
        $this->assertStringContainsString('$plainBody', $this->scriptContent);
        $this->assertStringContainsString('Neue Metadaten-Einreichung', $this->scriptContent);
    }

    /**
     * Test email includes resource ID
     */
    public function testEmailIncludesResourceId(): void
    {
        $this->assertStringContainsString('Ressource ID in ELMO Datenbank', $this->scriptContent);
        $this->assertStringContainsString('{$resource_id}', $this->scriptContent);
    }

    /**
     * Test email includes priority information
     */
    public function testEmailIncludesPriorityInformation(): void
    {
        $this->assertStringContainsString('Priorität', $this->scriptContent);
        $this->assertStringContainsString('{$priorityText}', $this->scriptContent);
        $this->assertStringContainsString('Dringlichkeit', $this->scriptContent);
    }

    /**
     * Test email includes data URL
     */
    public function testEmailIncludesDataUrl(): void
    {
        $this->assertStringContainsString('URL zu den Daten', $this->scriptContent);
        $this->assertStringContainsString('{$dataUrl}', $this->scriptContent);
    }

    /**
     * Test email includes timestamp
     */
    public function testEmailIncludesTimestamp(): void
    {
        $this->assertStringContainsString('Eingereicht am', $this->scriptContent);
        $this->assertStringContainsString("date('d.m.Y H:i:s')", $this->scriptContent);
    }

    /**
     * Test script sets email subject
     */
    public function testScriptSetsEmailSubject(): void
    {
        $this->assertStringContainsString('$mail->Subject', $this->scriptContent);
        $this->assertStringContainsString('Neue ELMO Metadaten-Einreichung', $this->scriptContent);
    }

    /**
     * Test script sets HTML body
     */
    public function testScriptSetsHtmlBody(): void
    {
        $this->assertStringContainsString('$mail->isHTML(true)', $this->scriptContent);
        $this->assertStringContainsString('$mail->Body = $htmlBody', $this->scriptContent);
    }

    /**
     * Test script sets alternative plain text body
     */
    public function testScriptSetsAlternativePlainTextBody(): void
    {
        $this->assertStringContainsString('$mail->AltBody', $this->scriptContent);
        $this->assertStringContainsString('$plainBody', $this->scriptContent);
    }

    /**
     * Test script sends email
     */
    public function testScriptSendsEmail(): void
    {
        $this->assertStringContainsString('$mail->send()', $this->scriptContent);
        $this->assertStringContainsString('E-Mail erfolgreich', $this->scriptContent);
    }

    /**
     * Test script returns success response as JSON
     */
    public function testScriptReturnsSuccessResponseAsJson(): void
    {
        $this->assertStringContainsString("header('Content-Type: application/json')", $this->scriptContent);
        $this->assertStringContainsString('json_encode', $this->scriptContent);
        $this->assertStringContainsString("'success' => true", $this->scriptContent);
    }

    /**
     * Test success response includes message
     */
    public function testSuccessResponseIncludesMessage(): void
    {
        $this->assertStringContainsString("'message'", $this->scriptContent);
        $this->assertStringContainsString('Metadaten gespeichert', $this->scriptContent);
    }

    /**
     * Test success response includes resource ID
     */
    public function testSuccessResponseIncludesResourceId(): void
    {
        $this->assertStringContainsString("'resource_id' => \$resource_id", $this->scriptContent);
    }

    /**
     * Test script logs errors
     */
    public function testScriptLogsErrors(): void
    {
        $this->assertStringContainsString('error_log', $this->scriptContent);
        $this->assertStringContainsString('XML Submit Error', $this->scriptContent);
    }

    /**
     * Test script has backup mechanism for failed emails
     */
    public function testScriptHasBackupMechanismForFailedEmails(): void
    {
        $this->assertStringContainsString('BACKUP XML SUBMISSION', $this->scriptContent);
        $this->assertStringContainsString('xml_submit_backup.txt', $this->scriptContent);
        $this->assertStringContainsString('file_put_contents', $this->scriptContent);
    }

    /**
     * Test backup saves resource ID
     */
    public function testBackupSavesResourceId(): void
    {
        $this->assertStringContainsString('Resource ID:', $this->scriptContent);
        $this->assertStringContainsString('$resource_id', $this->scriptContent);
    }

    /**
     * Test backup saves error message
     */
    public function testBackupSavesErrorMessage(): void
    {
        $this->assertStringContainsString('Error:', $this->scriptContent);
        $this->assertStringContainsString('$e->getMessage()', $this->scriptContent);
    }

    /**
     * Test script returns error response on exception
     */
    public function testScriptReturnsErrorResponseOnException(): void
    {
        $this->assertStringContainsString('http_response_code(500)', $this->scriptContent);
        $this->assertStringContainsString("'success' => false", $this->scriptContent);
        $this->assertStringContainsString('Fehler:', $this->scriptContent);
    }

    /**
     * Test error response includes debug information
     */
    public function testErrorResponseIncludesDebugInformation(): void
    {
        $this->assertStringContainsString("'debug' => \$debugging_output", $this->scriptContent);
    }

    /**
     * Test script uses global variables from settings
     */
    public function testScriptUsesGlobalVariablesFromSettings(): void
    {
        $this->assertStringContainsString('global $connection', $this->scriptContent);
        // The globals are declared on multiple lines, check for at least one of them
        $this->assertStringContainsString('global $smtpHost', $this->scriptContent);
        $this->assertStringContainsString('global $xmlSubmitAddress', $this->scriptContent);
    }

    /**
     * Test script handles conditional GGMs properties
     */
    public function testScriptHandlesConditionalGgmsProperties(): void
    {
        $this->assertStringContainsString('if ($showGGMsProperties)', $this->scriptContent);
        $this->assertStringContainsString('save_ggmsproperties.php', $this->scriptContent);
    }

    /**
     * Test script sets UTF-8 charset for email
     */
    public function testScriptSetsUtf8CharsetForEmail(): void
    {
        $this->assertStringContainsString("CharSet = 'UTF-8'", $this->scriptContent);
    }

    /**
     * Test script constructs API URL correctly
     */
    public function testScriptConstructsApiUrlCorrectly(): void
    {
        $this->assertStringContainsString('$protocol', $this->scriptContent);
        $this->assertStringContainsString('$_SERVER[\'HTTPS\']', $this->scriptContent);
        $this->assertStringContainsString('$_SERVER[\'HTTP_HOST\']', $this->scriptContent);
        $this->assertStringContainsString('$base_url', $this->scriptContent);
    }

    /**
     * Test script handles empty XML content
     */
    public function testScriptHandlesEmptyXmlContent(): void
    {
        $this->assertStringContainsString('empty($xml_content)', $this->scriptContent);
        $this->assertStringContainsString('Failed to retrieve XML content', $this->scriptContent);
    }

    /**
     * Test script validates uploaded file before adding
     */
    public function testScriptValidatesUploadedFileBeforeAdding(): void
    {
        $this->assertStringContainsString('in_array($fileType, $allowedTypes)', $this->scriptContent);
        $this->assertStringContainsString('Invalid file type', $this->scriptContent);
    }

    /**
     * Test script gets file extension from uploaded file
     */
    public function testScriptGetsFileExtensionFromUploadedFile(): void
    {
        $this->assertStringContainsString('pathinfo', $this->scriptContent);
        $this->assertStringContainsString('PATHINFO_EXTENSION', $this->scriptContent);
    }

    /**
     * Test SMTP connectivity function checks DNS
     */
    public function testSmtpConnectivityFunctionChecksDns(): void
    {
        $this->assertStringContainsString('DNS Resolution', $this->scriptContent);
        $this->assertStringContainsString('gethostbyname($smtpHost)', $this->scriptContent);
    }

    /**
     * Test SMTP connectivity function checks port
     */
    public function testSmtpConnectivityFunctionChecksPort(): void
    {
        $this->assertStringContainsString('Port', $this->scriptContent);
        $this->assertStringContainsString('OPEN', $this->scriptContent);
        $this->assertStringContainsString('CLOSED', $this->scriptContent);
    }

    /**
     * Test script clears output buffer before response
     */
    public function testScriptClearsOutputBufferBeforeResponse(): void
    {
        $this->assertStringContainsString('ob_clean()', $this->scriptContent);
    }

    /**
     * Test PHPMailer classes are imported
     */
    public function testPhpMailerClassesAreImported(): void
    {
        // Use escaped backslashes for namespace separators in string search
        $this->assertStringContainsString('use PHPMailer\\PHPMailer\\PHPMailer', $this->scriptContent);
        $this->assertStringContainsString('use PHPMailer\\PHPMailer\\Exception', $this->scriptContent);
        // Note: SMTP is only required, not imported with use statement
    }

    /**
     * Test PHPMailer vendor files are required
     */
    public function testPhpMailerVendorFilesAreRequired(): void
    {
        $this->assertStringContainsString('phpmailer/phpmailer/src/Exception.php', $this->scriptContent);
        $this->assertStringContainsString('phpmailer/phpmailer/src/PHPMailer.php', $this->scriptContent);
        $this->assertStringContainsString('phpmailer/phpmailer/src/SMTP.php', $this->scriptContent);
    }

    /**
     * Test script validates resource ID before backup
     */
    public function testScriptValidatesResourceIdBeforeBackup(): void
    {
        $this->assertStringContainsString('if ($resource_id !== false)', $this->scriptContent);
    }

    /**
     * Test backup uses file locking
     */
    public function testBackupUsesFileLocking(): void
    {
        $this->assertStringContainsString('FILE_APPEND | LOCK_EX', $this->scriptContent);
    }

    /**
     * Test script configures SMTP timeout
     */
    public function testScriptConfiguresSmtpTimeout(): void
    {
        $this->assertStringContainsString('Timeout', $this->scriptContent);
        $this->assertStringContainsString('30', $this->scriptContent);
    }

    /**
     * Test script disables SMTP keep-alive
     */
    public function testScriptDisablesSmtpKeepAlive(): void
    {
        $this->assertStringContainsString('SMTPKeepAlive', $this->scriptContent);
        $this->assertStringContainsString('false', $this->scriptContent);
    }

    /**
     * Test email body mentions ELMO system
     */
    public function testEmailBodyMentionsElmoSystem(): void
    {
        $this->assertStringContainsString('Ich bin ELMO', $this->scriptContent);
        $this->assertStringContainsString('ELMO System', $this->scriptContent);
    }

    /**
     * Test email has friendly tone
     */
    public function testEmailHasFriendlyTone(): void
    {
        $this->assertStringContainsString('Hallo!', $this->scriptContent);
        $this->assertStringContainsString('Und jetzt an die Arbeit!', $this->scriptContent);
        $this->assertStringContainsString(';-)', $this->scriptContent);
    }

    /**
     * Test script handles integer conversion for urgency
     */
    public function testScriptHandlesIntegerConversionForUrgency(): void
    {
        $this->assertStringContainsString('intval($_POST[\'urgency\'])', $this->scriptContent);
    }

    /**
     * Test script sanitizes data URL
     */
    public function testScriptSanitizesDataUrl(): void
    {
        $this->assertStringContainsString('filter_var($_POST[\'dataUrl\'], FILTER_SANITIZE_URL)', $this->scriptContent);
    }
}
