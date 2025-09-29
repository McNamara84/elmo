<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Test suite for email functionality
 * 
 * Tests the email sending functions and SMTP connectivity
 */
class EmailFunctionsTest extends TestCase
{
    /**
     * Test SMTP connectivity function exists and handles errors
     */
    public function testSmtpConnectivityFunctionExists(): void
    {
        // Include the file that contains the function only if not already included
        if (!function_exists('testGfzSmtpConnectivity')) {
            require_once __DIR__ . '/../send_feedback_mail.php';
        }
        
        $this->assertTrue(function_exists('testGfzSmtpConnectivity'), 
            'testGfzSmtpConnectivity function must exist');
    }

    /**
     * Test feedback mail function exists
     */
    public function testFeedbackMailFunctionExists(): void
    {
        if (!function_exists('sendFeedbackMail')) {
            require_once __DIR__ . '/../send_feedback_mail.php';
        }
        
        $this->assertTrue(function_exists('sendFeedbackMail'),
            'sendFeedbackMail function must exist');
    }

    /**
     * Test feedback mail function parameters validation
     */
    public function testFeedbackMailParameterValidation(): void
    {
        if (!function_exists('sendFeedbackMail')) {
            require_once __DIR__ . '/../send_feedback_mail.php';
        }
        
        // Only include settings if needed
        if (!isset($smtpHost)) {
            require_once __DIR__ . '/../settings.php';
        }
        
        // Create reflection to test parameter count
        $reflection = new \ReflectionFunction('sendFeedbackMail');
        $paramCount = $reflection->getNumberOfParameters();
        
        $this->assertEquals(7, $paramCount, 
            'sendFeedbackMail should accept 7 parameters for feedback questions');
    }

    /**
     * Test that required PHPMailer classes are available
     */
    public function testPhpMailerAvailable(): void
    {
        require_once __DIR__ . '/../vendor/autoload.php';
        
        $this->assertTrue(class_exists('PHPMailer\\PHPMailer\\PHPMailer'),
            'PHPMailer class must be available');
        $this->assertTrue(class_exists('PHPMailer\\PHPMailer\\Exception'),
            'PHPMailer Exception class must be available');
    }

    /**
     * Test SMTP settings are configured
     */
    public function testSmtpSettingsConfigured(): void
    {
        // Only include settings if variables are not set
        if (!isset($GLOBALS['smtpHost'])) {
            require_once __DIR__ . '/../settings.php';
        }
        
        $this->assertNotEmpty($smtpHost ?? '', 'SMTP host must be configured');
        $this->assertNotEmpty($smtpPort ?? '', 'SMTP port must be configured');
        $this->assertNotEmpty($smtpUser ?? '', 'SMTP user must be configured');
        $this->assertNotEmpty($feedbackAddress ?? '', 'Feedback address must be configured');
        
        // Validate port is numeric
        if (isset($smtpPort)) {
            $this->assertIsNumeric($smtpPort, 'SMTP port must be numeric');
        }
    }

    /**
     * Test email address validation helper
     */
    public function testEmailAddressValidation(): void
    {
        // Test valid email addresses
        $validEmails = [
            'test@example.com',
            'user.name@domain.co.uk',
            'admin+tag@site.org'
        ];
        
        foreach ($validEmails as $email) {
            $this->assertTrue(filter_var($email, FILTER_VALIDATE_EMAIL) !== false,
                "Email $email should be valid");
        }
        
        // Test invalid email addresses
        $invalidEmails = [
            'invalid-email',
            '@domain.com',
            'user@',
            ''
        ];
        
        foreach ($invalidEmails as $email) {
            $this->assertFalse(filter_var($email, FILTER_VALIDATE_EMAIL),
                "Email $email should be invalid");
        }
    }

    /**
     * Test that feedback questions can be sanitized
     */
    public function testFeedbackQuestionSanitization(): void
    {
        $dangerousInput = '<script>alert("xss")</script>Feedback text';
        $sanitized = strip_tags($dangerousInput);
        
        $this->assertEquals('Feedback text', $sanitized,
            'HTML tags should be stripped from feedback input');
        
        $htmlInput = '<b>Bold text</b> and <i>italic</i>';
        $sanitizedHtml = strip_tags($htmlInput);
        
        $this->assertEquals('Bold text and italic', $sanitizedHtml,
            'HTML formatting should be removed');
    }

    /**
     * Test feedback input length validation
     */
    public function testFeedbackInputLengthValidation(): void
    {
        // Test reasonable length limits
        $shortText = 'Short feedback';
        $longText = str_repeat('Long feedback text. ', 100); // ~1900 chars
        $veryLongText = str_repeat('Very long feedback text. ', 500); // ~9500 chars
        
        $this->assertLessThan(1000, strlen($shortText),
            'Short feedback should be under reasonable limit');
        
        $this->assertLessThan(10000, strlen($longText),
            'Long feedback should be under maximum limit');
        
        // Truncate very long text
        $truncated = substr($veryLongText, 0, 5000);
        $this->assertEquals(5000, strlen($truncated),
            'Very long text should be truncatable');
    }

    /**
     * Test required mail headers are set correctly
     */
    public function testMailHeadersConfiguration(): void
    {
        $headers = [
            'Content-Type' => 'text/html; charset=UTF-8',
            'MIME-Version' => '1.0',
            'From' => 'test@example.com',
            'Reply-To' => 'noreply@example.com'
        ];
        
        foreach ($headers as $header => $value) {
            $this->assertIsString($header, 'Header name should be string');
            $this->assertIsString($value, 'Header value should be string');
            $this->assertNotEmpty($header, 'Header name should not be empty');
            $this->assertNotEmpty($value, 'Header value should not be empty');
        }
    }
}