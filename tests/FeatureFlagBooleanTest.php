<?php

declare(strict_types=1);

namespace Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Feature flags loaded without a Playwright lock must be real booleans.
 * The string "false" is truthy when PHP casts it to bool.
 */
final class FeatureFlagBooleanTest extends TestCase
{
    #[DataProvider('envReaderFlagProvider')]
    public function testEnvReaderFlagsAreBooleans(?string $mslMode, ?string $ggms, bool $expectedMsl, bool $expectedGgms): void
    {
        $flags = $this->loadFlags('includes/env_variables_reader.php', [
            'SHOW_MSL_MODE' => $mslMode,
            'SHOW_GGMS_PROPERTIES' => $ggms,
        ], [
            'showMslMode',
            'showGGMsProperties',
        ]);

        self::assertSame($expectedMsl, $flags['showMslMode']['value']);
        self::assertSame('bool', $flags['showMslMode']['type']);
        self::assertSame($expectedGgms, $flags['showGGMsProperties']['value']);
        self::assertSame('bool', $flags['showGGMsProperties']['type']);
    }

    public function testContactAddressRepositoryReadsEnvironment(): void
    {
        $value = $this->loadVariable('includes/env_variables_reader.php', [
            'CONTACT_ADDRESS_REPOSITORY' => 'repo@example.org',
        ], 'contactAddressRepository');

        self::assertSame('repo@example.org', $value);
    }

    public function testContactAddressRepositoryDefaultsWhenUnset(): void
    {
        $value = $this->loadVariable('includes/env_variables_reader.php', [
            'CONTACT_ADDRESS_REPOSITORY' => null,
        ], 'contactAddressRepository');

        self::assertSame('datapub@gfz.de', $value);
    }

    #[DataProvider('simulateEmailProvider')]
    public function testFeatureFlagsSimulateEmailIsBoolean(?string $simulateEmail, bool $expected): void
    {
        $flags = $this->loadFlags('feature_flags.php', [
            'SIMULATE_EMAIL' => $simulateEmail,
        ], ['SIMULATE_EMAIL']);

        self::assertSame($expected, $flags['SIMULATE_EMAIL']['value']);
        self::assertSame('bool', $flags['SIMULATE_EMAIL']['type']);
    }

    /**
     * @return array<string, array{0: ?string, 1: ?string, 2: bool, 3: bool}>
     */
    public static function envReaderFlagProvider(): array
    {
        return [
            'string false' => ['false', 'false', false, false],
            'string true' => ['true', 'true', true, true],
            'unset' => [null, null, false, false],
        ];
    }

    /**
     * @return array<string, array{0: ?string, 1: bool}>
     */
    public static function simulateEmailProvider(): array
    {
        return [
            'string false' => ['false', false],
            'string true' => ['true', true],
            'unset' => [null, false],
        ];
    }

    /**
     * @param array<string, ?string> $environment null unsets the variable
     * @param list<string> $names
     * @return array<string, array{type: string, value: bool}>
     */
    private function loadFlags(string $relativePath, array $environment, array $names): array
    {
        $root = dirname(__DIR__);
        $assignments = '';
        foreach ($environment as $name => $value) {
            $assignments .= $value === null
                ? 'putenv(' . var_export($name, true) . ');'
                : 'putenv(' . var_export($name . '=' . $value, true) . ');';
        }
        $encodedNames = var_export($names, true);
        $script = $assignments . 'require ' . var_export($root . '/' . $relativePath, true) . ';'
            . '$out = [];'
            . 'foreach (' . $encodedNames . ' as $name) {'
            . '  $out[$name] = ["type" => get_debug_type($$name), "value" => $$name];'
            . '}'
            . 'echo json_encode($out);';

        $command = [PHP_BINARY, '-d', 'display_errors=stderr', '-r', $script];
        $descriptor = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = proc_open($command, $descriptor, $pipes);
        self::assertIsResource($process);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);

        self::assertSame(0, $exitCode, $stderr);
        $decoded = json_decode($stdout, true);
        self::assertIsArray($decoded, $stdout);

        return $decoded;
    }

    /**
     * @param array<string, ?string> $environment null unsets the variable
     */
    private function loadVariable(string $relativePath, array $environment, string $name): mixed
    {
        $root = dirname(__DIR__);
        $assignments = '';
        foreach ($environment as $envName => $value) {
            $assignments .= $value === null
                ? 'putenv(' . var_export($envName, true) . ');'
                : 'putenv(' . var_export($envName . '=' . $value, true) . ');';
        }
        $script = $assignments . 'require ' . var_export($root . '/' . $relativePath, true) . ';'
            . 'echo json_encode($' . $name . ');';

        $command = [PHP_BINARY, '-d', 'display_errors=stderr', '-r', $script];
        $descriptor = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = proc_open($command, $descriptor, $pipes);
        self::assertIsResource($process);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);

        self::assertSame(0, $exitCode, $stderr);
        $decoded = json_decode($stdout, true);
        self::assertIsString($decoded, $stdout);

        return $decoded;
    }
}
