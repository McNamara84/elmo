<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

class DatasetControllerTestDouble extends DatasetController
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $invocations = [];

    public function __construct(\mysqli $connection, $logger = null)
    {
        parent::__construct($connection, $logger);
    }

    protected function handleExport($vars, $download)
    {
        $this->invocations[] = [
            'method' => 'handleExport',
            'vars' => $vars,
            'download' => $download,
        ];
    }

    protected function handleExportAll($vars, $download, $returnAsString = false)
    {
        $this->invocations[] = [
            'method' => 'handleExportAll',
            'vars' => $vars,
            'download' => $download,
            'returnAsString' => $returnAsString,
        ];

        if ($returnAsString) {
            return '<xml />';
        }

        return null;
    }

    public function handleExportBaseXml(array $vars)
    {
        $this->invocations[] = [
            'method' => 'handleExportBaseXml',
            'vars' => $vars,
        ];
    }
}

final class DatasetControllerTest extends TestCase
{
    private function createFakeConnection(): \mysqli
    {
        return new class extends \mysqli {
            public function __construct()
            {
                // Prevent real connection attempts during tests.
            }
        };
    }

    public function testConstructorUsesInjectedConnection(): void
    {
        $fakeConnection = $this->createFakeConnection();
        $logger = new class {
        };
        $controller = new DatasetController($fakeConnection, $logger);

        $reflection = new ReflectionProperty(DatasetController::class, 'connection');
        $reflection->setAccessible(true);

        $this->assertSame($fakeConnection, $reflection->getValue($controller));
    }

    public function testExportResourceMethodsDelegateToHandleExport(): void
    {
        $double = new DatasetControllerTestDouble($this->createFakeConnection());
        $vars = ['id' => 42, 'scheme' => 'datacite'];

        $double->exportResourceDownload($vars);
        $double->exportResource($vars);

        $this->assertSame([
            [
                'method' => 'handleExport',
                'vars' => $vars,
                'download' => true,
            ],
            [
                'method' => 'handleExport',
                'vars' => $vars,
                'download' => false,
            ],
        ], $double->invocations);
    }

    public function testExportAllMethodsDelegateToHandleExportAll(): void
    {
        $double = new DatasetControllerTestDouble($this->createFakeConnection());
        $vars = ['id' => 7];

        $double->exportAllDownload($vars);
        $double->exportAll($vars);

        $this->assertSame([
            [
                'method' => 'handleExportAll',
                'vars' => $vars,
                'download' => true,
                'returnAsString' => false,
            ],
            [
                'method' => 'handleExportAll',
                'vars' => $vars,
                'download' => false,
                'returnAsString' => false,
            ],
        ], $double->invocations);
    }

    public function testExportBaseXmlDelegatesToHandleExportBaseXml(): void
    {
        $double = new DatasetControllerTestDouble($this->createFakeConnection());
        $vars = ['id' => 13];

        $double->exportBaseXml($vars);

        $this->assertSame([
            [
                'method' => 'handleExportBaseXml',
                'vars' => $vars,
            ],
        ], $double->invocations);
    }

    public function testEnvelopeXmlAsStringReturnsCombinedXml(): void
    {
        $double = new DatasetControllerTestDouble($this->createFakeConnection());
        $result = $double->envelopeXmlAsString($this->createFakeConnection(), 99);

        $this->assertSame('<xml />', $result);

        $this->assertSame([
            [
                'method' => 'handleExportAll',
                'vars' => ['id' => 99],
                'download' => false,
                'returnAsString' => true,
            ],
        ], $double->invocations);
    }
}