<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

class ApiRoutesTest extends TestCase
{
    private string $settingsPath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->settingsPath = __DIR__ . '/../settings.php';
        $stub = <<<'PHP'
<?php
function connectDb() { return null; }
$connection = null;
$mslLabsUrl = '';
$mslVocabsUrl = '';
$apiKeyElmo = '';
$apiKeyTimezone = '';
PHP;
        file_put_contents($this->settingsPath, $stub);
    }

    protected function tearDown(): void
    {
        if (file_exists($this->settingsPath)) {
            unlink($this->settingsPath);
        }
        parent::tearDown();
    }

    private function loadRoutes(): array
    {
        return require __DIR__ . '/../api/v2/routes/api.php';
    }

    public function testRoutesArrayMatchesExpectedConfiguration(): void
    {
        $routes = $this->loadRoutes();
        $simplified = array_map(function ($r) {
            return [$r[0], $r[1], get_class($r[2][0]), $r[2][1]];
        }, $routes);

        $expected = [
            ['GET', '/general/alive', 'GeneralController', 'getAlive'],
            ['GET', '/update/vocabs/msl/labs', 'VocabController', 'updateMslLabs'],
            ['GET', '/update/vocabs/msl', 'VocabController', 'getMslVocab'],
            ['GET', '/update/timezones', 'VocabController', 'updateTimezones'],
            ['GET', '/update/vocabs/gcmd', 'VocabController', 'updateGcmdVocabs'],
            ['GET', '/update/vocabs/cgi', 'VocabController', 'updateCGIKeywords'],
            ['GET', '/update/ror', 'VocabController', 'getRorAffiliations'],
            ['GET', '/update/crossref', 'VocabController', 'getCrossref'],
            ['GET', '/vocabs/sciencekeywords', 'VocabController', 'getGcmdScienceKeywords'],
            ['GET', '/vocabs/cgi', 'VocabController', 'getCGIKeywords'],
            ['GET', '/vocabs/roles[/{type}]', 'VocabController', 'getRoles'],
            ['GET', '/vocabs/relations', 'VocabController', 'getRelations'],
            ['GET', '/vocabs/licenses/all', 'VocabController', 'getAllLicenses'],
            ['GET', '/vocabs/licenses/software', 'VocabController', 'getSoftwareLicenses'],
            ['GET', '/vocabs/freekeywords/all', 'VocabController', 'getAllFreeKeywords'],
            ['GET', '/vocabs/freekeywords/curated', 'VocabController', 'getCuratedFreeKeywords'],
            ['GET', '/vocabs/freekeywords/uncurated', 'VocabController', 'getUncuratedFreeKeywords'],
            ['GET', '/vocabs/resourcetypes', 'VocabController', 'getResourceTypes'],
            ['GET', '/vocabs/icgemformats', 'VocabController', 'getICGEMFileFormats'],
            ['GET', '/vocabs/modeltypes', 'VocabController', 'getICGEMModelTypes'],
            ['GET', '/vocabs/mathreps', 'VocabController', 'getMathRepresentations'],
            ['GET', '/validation/patterns[/{type}]', 'ValidationController', 'getPattern'],
            ['GET', '/validation/identifiertypes', 'ValidationController', 'getIdentifierTypes'],
            ['GET', '/dataset/export/{id}/all/download', 'DatasetController', 'exportAllDownload'],
            ['GET', '/dataset/export/{id}/all', 'DatasetController', 'exportAll'],
            ['GET', '/dataset/export/{id}/{scheme}/download', 'DatasetController', 'exportResourceDownload'],
            ['GET', '/dataset/export/{id}/{scheme}', 'DatasetController', 'exportResource'],
            ['GET', '/dataset/basexport/{id}', 'DatasetController', 'exportBaseXml'],
        ];

        $this->assertSame($expected, $simplified);
    }

    public function testAllRoutesHaveUniquePaths(): void
    {
        $routes = $this->loadRoutes();
        $paths = array_map(fn($r) => $r[1], $routes);
        $this->assertCount(count($paths), array_unique($paths));
    }

    public function testControllerMethodsExistForEachRoute(): void
    {
        $routes = $this->loadRoutes();
        foreach ($routes as $route) {
            [$method, $path, $handler] = $route;
            $this->assertEquals('GET', $method);
            $this->assertIsArray($handler);
            $this->assertIsObject($handler[0]);
            $this->assertTrue(method_exists($handler[0], $handler[1]), "Method {$handler[1]} for {$path} not found");
        }
    }
}