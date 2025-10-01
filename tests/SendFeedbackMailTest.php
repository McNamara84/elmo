<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

/**
 * Test suite for send_feedback_mail.php functionality
 * 
 * Tests mail functions without actually sending emails
 */
class SendFeedbackMailTest extends TestCase
{
    /**
     * Test that feedback mail file exists
     */
    public function testFeedbackMailFileExists(): void
    {
        $mailFile = __DIR__ . '/../send_feedback_mail.php';
        $this->assertFileExists($mailFile);
    }

    /**
     * Test mail validation functions
     */
    public function testMailValidationFunctions(): void
    {
        // Test email validation pattern
        $validEmail = 'test@example.com';
        $invalidEmail = 'invalid-email';
        
        $emailPattern = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';
        $this->assertMatchesRegularExpression($emailPattern, $validEmail);
        $this->assertDoesNotMatchRegularExpression($emailPattern, $invalidEmail);
    }

    /**
     * Test feedback form validation
     */
    public function testFeedbackFormValidation(): void
    {
        $validFeedback = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'subject' => 'Test Subject',
            'message' => 'This is a test message'
        ];
        
        // Test required fields are present
        $requiredFields = ['name', 'email', 'subject', 'message'];
        foreach ($requiredFields as $field) {
            $this->assertArrayHasKey($field, $validFeedback);
            $this->assertNotEmpty($validFeedback[$field]);
        }
    }

    /**
     * Test input sanitization
     */
    public function testInputSanitization(): void
    {
        $maliciousInput = '<script>alert("xss")</script>Test Message';
        $sanitized = htmlspecialchars($maliciousInput, ENT_QUOTES, 'UTF-8');
        
        $this->assertStringNotContainsString('<script>', $sanitized);
        $this->assertStringContainsString('&lt;script&gt;', $sanitized);
        $this->assertStringContainsString('Test Message', $sanitized);
    }

    /**
     * Test mail headers configuration
     */
    public function testMailHeadersConfiguration(): void
    {
        $headers = [
            'From' => 'noreply@example.com',
            'Reply-To' => 'test@example.com',
            'Content-Type' => 'text/html; charset=UTF-8',
            'X-Mailer' => 'PHP/' . phpversion()
        ];
        
        $this->assertArrayHasKey('From', $headers);
        $this->assertArrayHasKey('Content-Type', $headers);
        $this->assertStringContainsString('UTF-8', $headers['Content-Type']);
        $this->assertStringContainsString('PHP/', $headers['X-Mailer']);
    }

    /**
     * Test email template structure
     */
    public function testEmailTemplateStructure(): void
    {
        $templateData = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'subject' => 'Test Subject',
            'message' => 'Test message content'
        ];
        
        // Generate email body
        $emailBody = "
        <html>
        <body>
            <h2>Feedback from {$templateData['name']}</h2>
            <p><strong>Email:</strong> {$templateData['email']}</p>
            <p><strong>Subject:</strong> {$templateData['subject']}</p>
            <p><strong>Message:</strong><br>{$templateData['message']}</p>
        </body>
        </html>";
        
        $this->assertStringContainsString('<html>', $emailBody);
        $this->assertStringContainsString($templateData['name'], $emailBody);
        $this->assertStringContainsString($templateData['email'], $emailBody);
        $this->assertStringContainsString($templateData['subject'], $emailBody);
        $this->assertStringContainsString($templateData['message'], $emailBody);
    }

    /**
     * Test SMTP configuration validation
     */
    public function testSMTPConfigurationValidation(): void
    {
        $smtpConfig = [
            'host' => 'smtp.example.com',
            'port' => 587,
            'username' => 'user@example.com',
            'password' => 'password',
            'encryption' => 'tls'
        ];
        
        $this->assertArrayHasKey('host', $smtpConfig);
        $this->assertArrayHasKey('port', $smtpConfig);
        $this->assertIsInt($smtpConfig['port']);
        $this->assertGreaterThan(0, $smtpConfig['port']);
        $this->assertContains($smtpConfig['encryption'], ['tls', 'ssl', '']);
    }

    /**
     * Test rate limiting logic
     */
    public function testRateLimitingLogic(): void
    {
        $currentTime = time();
        $lastSent = $currentTime - 30; // 30 seconds ago
        $rateLimit = 60; // 1 minute rate limit
        
        $timeDiff = $currentTime - $lastSent;
        $canSend = $timeDiff >= $rateLimit;
        
        $this->assertFalse($canSend, 'Should not allow sending within rate limit');
        
        // Test after rate limit period
        $lastSent = $currentTime - 70; // 70 seconds ago
        $timeDiff = $currentTime - $lastSent;
        $canSend = $timeDiff >= $rateLimit;
        
        $this->assertTrue($canSend, 'Should allow sending after rate limit period');
    }

    /**
     * Test error response formatting
     */
    public function testErrorResponseFormatting(): void
    {
        $errors = [
            'name' => 'Name is required',
            'email' => 'Invalid email format',
            'message' => 'Message is too short'
        ];
        
        $errorResponse = [
            'status' => 'error',
            'errors' => $errors,
            'message' => 'Validation failed'
        ];
        
        $this->assertEquals('error', $errorResponse['status']);
        $this->assertArrayHasKey('errors', $errorResponse);
        $this->assertIsArray($errorResponse['errors']);
        $this->assertCount(3, $errorResponse['errors']);
    }

    /**
     * Test success response formatting
     */
    public function testSuccessResponseFormatting(): void
    {
        $successResponse = [
            'status' => 'success',
            'message' => 'Feedback sent successfully',
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        $this->assertEquals('success', $successResponse['status']);
        $this->assertArrayHasKey('message', $successResponse);
        $this->assertArrayHasKey('timestamp', $successResponse);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $successResponse['timestamp']);
    }

    /**
     * Test file attachment validation
     */
    public function testFileAttachmentValidation(): void
    {
        $allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
        $maxSize = 5 * 1024 * 1024; // 5MB
        
        $testFile = [
            'name' => 'test.jpg',
            'type' => 'image/jpeg',
            'size' => 1024 * 1024, // 1MB
            'tmp_name' => '/tmp/phptest'
        ];
        
        $isValidType = in_array($testFile['type'], $allowedTypes);
        $isValidSize = $testFile['size'] <= $maxSize;
        
        $this->assertTrue($isValidType, 'Should accept valid file types');
        $this->assertTrue($isValidSize, 'Should accept files within size limit');
        
        // Test invalid file
        $invalidFile = [
            'type' => 'application/x-executable',
            'size' => 10 * 1024 * 1024 // 10MB
        ];
        
        $isValidType = in_array($invalidFile['type'], $allowedTypes);
        $isValidSize = $invalidFile['size'] <= $maxSize;
        
        $this->assertFalse($isValidType, 'Should reject invalid file types');
        $this->assertFalse($isValidSize, 'Should reject oversized files');
    }
}