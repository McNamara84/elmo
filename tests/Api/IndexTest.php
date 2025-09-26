<?php

declare(strict_types=1);

namespace Tests\Api;

use PHPUnit\Framework\TestCase;

final class IndexTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        if (!defined('ELMO_API_INDEX_INCLUDE_ONLY')) {
            define('ELMO_API_INDEX_INCLUDE_ONLY', true);
        }

        require_once __DIR__ . '/../../api/index.php';
    }

    public function testDetermineApiVersionDefaultsToV2ForEmptyUri(): void
    {
        $version = \determineApiVersion([]);

        self::assertSame('v2', $version);
    }

    public function testDetermineApiVersionReadsVersionFromUri(): void
    {
        $version = \determineApiVersion(['REQUEST_URI' => '/api/v3/datasets']);

        self::assertSame('v3', $version);
    }

    public function testDetermineApiVersionRejectsInvalidVersionStrings(): void
    {
        $version = \determineApiVersion(['REQUEST_URI' => '/api/latest']);

        self::assertSame('v2', $version);
    }
}