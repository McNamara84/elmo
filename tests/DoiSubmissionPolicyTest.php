<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

require_once __DIR__ . '/../includes/doi_submission_policy.php';

final class DoiSubmissionPolicyTest extends TestCase
{
    private const CONTACT = 'curation@example.org';

    private static function post(string $doi, string $version = ''): array
    {
        return ['doi' => $doi, 'version' => $version, 'language' => '1'];
    }

    public function testEmptyDoiAllowsNewRegistrationWithoutLookup(): void
    {
        $called = false;
        $result = validateSubmissionResourceInformation(self::post(''), false,
            static function () use (&$called) { $called = true; }, self::CONTACT);
        self::assertSame('', $result['doi']);
        self::assertFalse($called);
    }

    public function testIcgemKeepsItsExistingDoiFlow(): void
    {
        $result = validateSubmissionResourceInformation(self::post('10.9999/other'), true,
            static function () { throw new RuntimeException('must not run'); }, self::CONTACT);
        self::assertSame('10.9999/other', $result['doi']);
    }

    public function testExistingGfzDoiAdvancesMajorVersionAndPayload(): void
    {
        $post = self::post('10.5880/abc', '3.0');
        $post['resourceInformationPayload'] = json_encode([
            'doi' => '10.5880/abc', 'version' => '3.0', 'languageId' => '1', 'titles' => []
        ], JSON_THROW_ON_ERROR);
        $result = validateSubmissionResourceInformation($post, false,
            static fn () => ['found' => true, 'attributes' => ['doi' => '10.5880/abc', 'version' => '2.4']], self::CONTACT);
        self::assertSame('3.0', $result['version']);
        self::assertSame('3.0', json_decode($result['resourceInformationPayload'], true)['version']);
    }

    public function testMissingSourceVersionStartsAtOnePointZero(): void
    {
        $result = validateSubmissionResourceInformation(self::post('10.5880/abc'), false,
            static fn () => ['found' => true, 'attributes' => ['doi' => '10.5880/abc']], self::CONTACT);
        self::assertSame('1.0', $result['version']);
    }

    #[DataProvider('blockedCases')]
    public function testRejectsUnverifiedOrConflictingDoi(array $post, callable $lookup, string $message): void
    {
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage($message);
        validateSubmissionResourceInformation($post, false, $lookup, self::CONTACT);
    }

    public static function blockedCases(): iterable
    {
        $found = static fn () => ['found' => true, 'attributes' => ['doi' => '10.5880/abc', 'version' => '2.4']];
        yield 'external prefix' => [self::post('10.1234/other'), $found, '10.5880'];
        yield 'invalid DOI' => [self::post('invalid'), $found, 'valid DOI'];
        yield 'not found' => [self::post('10.5880/abc'), static fn () => ['found' => false], 'not found'];
        yield 'network failure' => [self::post('10.5880/abc'), static function () { throw new RuntimeException('timeout'); }, 'could not be verified'];
        yield 'malformed source version' => [self::post('10.5880/abc'),
            static fn () => ['found' => true, 'attributes' => ['version' => 'release two']], 'unclear version'];
        yield 'version overflow' => [self::post('10.5880/abc'),
            static fn () => ['found' => true, 'attributes' => ['version' => '999999999999999999999.0']], 'unclear version'];
        yield 'stale submitted version' => [self::post('10.5880/abc', '2.0'), $found, 'must be 3.0'];
        yield 'different DOI' => [self::post('10.5880/abc'),
            static fn () => ['found' => true, 'attributes' => ['doi' => '10.5880/other']], 'different DOI'];
        yield 'language absent' => [['doi' => ''], $found, 'dataset language'];
    }
}
