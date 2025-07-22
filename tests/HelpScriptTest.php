<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

class HelpScriptTest extends TestCase
{
    /** @var string Path to temporary settings.php */
    private $settingsPath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->settingsPath = dirname(__DIR__) . '/settings.php';
        $settingsCode = <<<'PHP'
<?php
function getSettings($setting) {
    header('Content-Type: application/json; charset=utf-8');
    switch ($setting) {
        case 'apiKey':
            echo json_encode(['apiKey' => 'test_api_key']);
            break;
        case 'all':
            echo json_encode(['apiKey' => 'test_api_key', 'showMslLabs' => true]);
            break;
        default:
            echo json_encode(['error' => 'Unknown setting']);
            break;
    }
    exit;
}
if (isset($_GET['setting'])) {
    getSettings($_GET['setting']);
    exit;
}
PHP;
        file_put_contents($this->settingsPath, $settingsCode);
    }

    protected function tearDown(): void
    {
        if (file_exists($this->settingsPath)) {
            unlink($this->settingsPath);
        }
        parent::tearDown();
    }

    private function includeHelp(): string
    {
        $phpCode = '$_GET = ' . var_export($_GET, true) . '; chdir("doc"); include "help.php";';
        $cmd = 'php -r ' . escapeshellarg($phpCode);
        return shell_exec($cmd);
    }

    public function testHelpPageReturnsHtml(): void
    {
        $_GET = [];
        $output = $this->includeHelp();
        $this->assertStringContainsString('<!DOCTYPE html>', $output);
        $this->assertStringContainsString('ELMO User Guide', $output);
    }
}