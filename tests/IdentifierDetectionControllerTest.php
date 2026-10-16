<?php

declare(strict_types=1);

namespace Tests;

use IdentifierDetectionController;
use IdentifierDetectionService;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

require_once __DIR__ . '/../api/v2/controllers/IdentifierDetectionController.php';

#[CoversClass(IdentifierDetectionController::class)]
final class IdentifierDetectionControllerTest extends TestCase
{
    protected function tearDown(): void
    {
        $_GET = [];
        http_response_code(200);
    }

    public static function results(): array
    {
        return [[['identifierType' => 'IGSN', 'status' => 'detected', 'source' => 'datacite']], [['identifierType' => null, 'status' => 'unknown', 'source' => null]]];
    }

    #[DataProvider('results')]
    public function testSuccessfulAndUnknownResponses(array $result): void
    {
        $service = $this->createMock(IdentifierDetectionService::class);
        $service->expects(self::once())->method('detect')->with('10.1234/item')->willReturn($result);
        $_GET = ['doi' => '10.1234/item'];
        ob_start();
        (new IdentifierDetectionController($service))->detect();
        self::assertSame($result, json_decode(ob_get_clean(), true));
        self::assertSame(200, http_response_code());
    }

    public static function failures(): array
    {
        return [[new InvalidArgumentException('bad doi'), 400, 'invalid'], [new RuntimeException('rate limited', 502), 502, 'unavailable'], [new RuntimeException('timeout', 504), 504, 'unavailable']];
    }

    #[DataProvider('failures')]
    public function testErrorsNeverReturnPositiveType(\Throwable $error, int $status, string $expected): void
    {
        $service = $this->createMock(IdentifierDetectionService::class);
        $service->expects(self::once())->method('detect')->willThrowException($error);
        $_GET = ['doi' => '10.1234/item'];
        ob_start();
        (new IdentifierDetectionController($service))->detect();
        self::assertSame(['identifierType' => null, 'status' => $expected, 'source' => null], json_decode(ob_get_clean(), true));
        self::assertSame($status, http_response_code());
    }

    public function testArrayParameterIsRejectedBeforeLookup(): void
    {
        $service = $this->createMock(IdentifierDetectionService::class);
        $service->expects(self::never())->method('detect');
        $_GET = ['doi' => ['10.1234/item']];
        ob_start();
        (new IdentifierDetectionController($service))->detect();
        self::assertNull(json_decode(ob_get_clean(), true)['identifierType']);
        self::assertSame(400, http_response_code());
    }

    public function testDefaultServiceRejectsMissingDoi(): void
    {
        $_GET = [];
        ob_start();
        (new IdentifierDetectionController())->detect();
        self::assertSame('invalid', json_decode(ob_get_clean(), true)['status']);
        self::assertSame(400, http_response_code());
    }
}
