import test from 'node:test';
import assert from 'node:assert/strict';
import { gitRepository, publishArtifact, readArtifact, validateArtifact } from '../../scripts/ci/deploymentArtifacts.mjs';
import { digest, gitFixture, record, repository } from './deploymentFixtures.mjs';

test('records an immutable snapshot without changing code branches or the worktree', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const before = fixture.git(fixture.automation, 'status', '--porcelain');
    const artifact = publishArtifact(git, record(fixture.sha));
    assert.equal(artifact.created, true);
    assert.deepEqual(readArtifact(git, repository, 'dev', fixture.sha).record, artifact.record);
    assert.equal(git.head('refs/heads/dev'), fixture.sha);
    assert.equal(git.head('refs/heads/main'), fixture.sha);
    assert.equal(fixture.git(fixture.automation, 'status', '--porcelain'), before);
    assert.equal(fixture.git(fixture.automation, 'ls-tree', '--name-only', artifact.commit), `${fixture.sha}.json`);
    assert.ok(git.ancestor(fixture.sha, artifact.commit));
});

test('a retry reuses the first digest even when another build produced a different one', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const first = publishArtifact(git, record(fixture.sha));
    const retry = publishArtifact(git, record(fixture.sha, 'dev', digest('b')));
    assert.equal(retry.created, false);
    assert.equal(retry.commit, first.commit);
    assert.deepEqual(retry.record, first.record);
});

test('a parallel append for another commit is preserved after a lease conflict', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const next = fixture.advance();
    const other = gitRepository(fixture.source);
    const push = git.push;
    let raced = false;
    git.push = (...args) => {
        if (!raced) { raced = true; publishArtifact(other, record(next)); }
        return push(...args);
    };
    const result = publishArtifact(git, record(fixture.sha));
    assert.ok(raced);
    assert.equal(result.created, true);
    assert.equal(readArtifact(git, repository, 'dev', next).record.sha, next);
    assert.equal(readArtifact(git, repository, 'dev', fixture.sha).record.sha, fixture.sha);
});

test('a parallel writer for the same SHA wins permanently', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const other = gitRepository(fixture.source), push = git.push;
    let winner;
    git.push = (...args) => {
        if (!winner) winner = publishArtifact(other, record(fixture.sha, 'dev', digest('b')));
        return push(...args);
    };
    const result = publishArtifact(git, record(fixture.sha));
    assert.equal(result.commit, winner.commit);
    assert.deepEqual(result.record, winner.record);
    assert.equal(result.created, false);
});

test('an immutable record cannot be reused with different version/database metadata', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    publishArtifact(git, record(fixture.sha));
    assert.throws(() => publishArtifact(git, { ...record(fixture.sha), version: '9.0.0' }), /version/u);
    const changed = record(fixture.sha);
    changed.images.mariadb = `mariadb:12.3.3-noble@${digest('b')}`;
    assert.throws(() => publishArtifact(git, changed), /database/u);
});

test('invalid immutable records fail instead of falling back to another image', () => {
    const source = record('a'.repeat(40));
    assert.throws(() => validateArtifact({ ...source, platform: 'linux/arm64' }), /Invalid/u);
    assert.throws(() => validateArtifact({ ...source, images: { ...source.images, web: 'ghcr.io/mcnamara84/elmo-web:latest' } }), /immutable/u);
    assert.throws(() => validateArtifact({ ...source, images: { ...source.images, web: `ghcr.io/attacker/elmo-web@${digest('a')}` } }), /immutable/u);
    assert.throws(() => validateArtifact({ ...source, version: '2.2.1\n' }), /Invalid/u);
    assert.throws(() => validateArtifact({ ...source, sha: [source.sha] }), /Invalid/u);
});

test('an unrelated preexisting artifact branch is not overwritten or adopted', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    fixture.git(fixture.source, 'push', 'origin', 'HEAD:refs/heads/artifacts/dev');
    assert.throws(() => publishArtifact(git, record(fixture.sha)), /not owned/u);
    assert.equal(git.head('refs/heads/artifacts/dev'), fixture.sha);
});

test('machine writes cannot target main, dev, or Production and cannot rewrite history', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    for (const ref of ['refs/heads/main', 'refs/heads/dev', 'refs/heads/deploy/prod']) {
        assert.throws(() => git.push(ref, fixture.sha, fixture.sha), /AP 3 machine branch/u);
    }
    const artifact = publishArtifact(git, record(fixture.sha));
    assert.throws(() => git.push('refs/heads/artifacts/dev', fixture.sha, artifact.commit), /rewrite/u);
});
