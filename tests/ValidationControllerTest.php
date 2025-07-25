<?php
namespace Tests;

use PHPUnit\Framework\TestCase;

class ValidationControllerTest extends TestCase
{
    private string $script;

    protected function setUp(): void
    {
        $this->script = __DIR__ . '/scripts/validation.php';
    }

    private function executeScript(array $env): array
    {
        $descriptor = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        // run php with explicit environment to work across operating systems
        $cmd = [PHP_BINARY, $this->script];
        $process = proc_open(
            $cmd,
            $descriptor,
            $pipes,
            null,
            array_merge($_ENV, $env)
        );
        if (!is_resource($process)) {
            return [0, ['error' => 'Failed to start PHP process']];
        }

        $output = stream_get_contents($pipes[1]);
        $error  = stream_get_contents($pipes[2]);
        foreach ($pipes as $pipe) {
            fclose($pipe);
        }
        proc_close($process);

        // concat stderr so that potential warnings don't break the regex below
        $output .= $error;

        preg_match('/OUTPUT:(.*)\nSTATUS:(\d*)/s', $output, $m);
        $body = json_decode($m[1], true);
        $status = $m[2] === '' ? 0 : (int)$m[2];
        return [$status, $body];
    }

    public function testGetPatternNoType(): void
    {
        [$status, $body] = $this->executeScript([
            'SCENARIO' => 'success',
            'METHOD' => 'pattern',
            'TYPE' => ''
        ]);

        $this->assertSame(400, $status);
        $this->assertEquals('No identifier type specified', $body['error']);
    }

    public function testGetPatternPrepareFailure(): void
    {
        [$status, $body] = $this->executeScript([
            'SCENARIO' => 'prepareFail',
            'METHOD' => 'pattern',
            'TYPE' => 'doi'
        ]);

        $this->assertSame(500, $status);
        $this->assertEquals('Failed to prepare statement: prep', $body['error']);
    }

    public function testGetPatternExecuteFailure(): void
    {
        [$status, $body] = $this->executeScript([
            'SCENARIO' => 'executeFail',
            'METHOD' => 'pattern',
            'TYPE' => 'doi'
        ]);

        $this->assertSame(500, $status);
        $this->assertEquals('Failed to execute statement: exec', $body['error']);
    }

    public function testGetPatternSuccess(): void
    {
        [$status, $body] = $this->executeScript([
            'SCENARIO' => 'success',
            'METHOD' => 'pattern',
            'TYPE' => 'doi'
        ]);

        $this->assertSame(0, $status);
        $this->assertEquals('abc', $body['pattern']);
    }

    public function testGetPatternNotFound(): void
    {
        [$status, $body] = $this->executeScript([
            'SCENARIO' => 'notfound',
            'METHOD' => 'pattern',
            'TYPE' => 'foo'
        ]);

        $this->assertSame(404, $status);
        $this->assertEquals('No pattern found for the specified identifier type', $body['error']);
    }

    public function testGetIdentifierTypesSuccess(): void
    {
        [$status, $body] = $this->executeScript([
            'SCENARIO' => 'typesSuccess',
            'METHOD' => 'types'
        ]);

        $this->assertSame(0, $status);
        $this->assertCount(2, $body['identifierTypes']);
        $this->assertEquals('doi', $body['identifierTypes'][0]['name']);
    }

    public function testGetIdentifierTypesEmpty(): void
    {
        [$status, $body] = $this->executeScript([
            'SCENARIO' => 'typesEmpty',
            'METHOD' => 'types'
        ]);

        $this->assertSame(404, $status);
        $this->assertEquals('No identifier types found', $body['error']);
    }
}