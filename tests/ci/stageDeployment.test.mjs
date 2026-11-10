import test from 'node:test';
import assert from 'node:assert/strict';
import * as yaml from 'js-yaml';
import { gitRepository, publishArtifact, readArtifact } from '../../scripts/ci/deploymentArtifacts.mjs';
import { renderStage, updateStage } from '../../scripts/ci/stageDeployment.mjs';
import { gitFixture, record, repository, stage } from './deploymentFixtures.mjs';

test('all Stage variants use one digest and preserve environment, routing and volumes', () => {
    const selected = record('a'.repeat(40));
    const rendered = renderStage(stage, selected);
    assert.ok(!rendered.includes('deployment-template'));
    const actual = yaml.load(rendered), original = yaml.load(stage);
    for (const name of ['web', 'web-msl', 'web-igsn']) {
        const expression = '${ELMO_STAGE_WEB_IMAGE:-' + selected.images.web + '}';
        assert.equal(actual.services[name].image, expression);
        original.services[name].image = expression;
    }
    assert.deepEqual(actual, original);
});

test('missing markers, extra services, builds and unexpected refs cannot deploy', () => {
    const selected = record('a'.repeat(40));
    assert.throws(() => renderStage(stage.replace('deployment-template', 'latest'), selected), /template/u);
    assert.throws(() => renderStage(stage.replace('  web-igsn:', '  unexpected:'), selected), /services/u);
    assert.throws(() => renderStage(stage.replace('  web:', '  web:\n    build: .'), selected), /contract/u);
    assert.throws(() => renderStage(stage.replace('mariadb:12.3.3-noble@sha256:', 'other:12@sha256:'), selected), /database/u);
});

test('Stage deployment changes only the selected Compose file and metadata', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const artifact = publishArtifact(git, record(fixture.sha));
    const result = updateStage(git, artifact);
    assert.equal(result.status, 'updated');
    assert.deepEqual(fixture.git(fixture.automation, 'diff', '--name-only', fixture.sha, result.commit).split('\n').sort(),
        ['.elmo-deployment.json', 'docker-compose.stage.yml']);
    assert.ok(git.ancestor(fixture.sha, result.commit));
    assert.equal(git.head('refs/heads/main'), fixture.sha);
    assert.equal(git.head('refs/heads/dev'), fixture.sha);
    assert.equal(git.head('refs/heads/deploy/prod'), undefined);
});

test('retries do not redeploy when the artifact branch advanced for another SHA', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const artifact = publishArtifact(git, record(fixture.sha));
    const first = updateStage(git, artifact);
    // Append a different main record without changing dev or its image set.
    const next = fixture.advance('main');
    publishArtifact(git, record(next, 'dev'));
    const newerSnapshot = readArtifact(git, repository, 'dev', fixture.sha);
    assert.notEqual(newerSnapshot.commit, artifact.commit);
    assert.deepEqual(updateStage(git, newerSnapshot), { status: 'unchanged', commit: first.commit });
});

test('main candidates can only create records, never a Stage deployment', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const artifact = publishArtifact(git, record(fixture.sha, 'main'));
    assert.throws(() => updateStage(git, artifact), /dev artifact/u);
    assert.equal(git.head('refs/heads/deploy/stage'), undefined);
});

test('a stale dev candidate cannot overwrite a newer deployment', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const old = publishArtifact(git, record(fixture.sha));
    const next = fixture.advance();
    const current = publishArtifact(git, record(next));
    const deployed = updateStage(git, current);
    assert.deepEqual(updateStage(git, old), { status: 'stale' });
    assert.equal(git.head('refs/heads/deploy/stage'), deployed.commit);
});

test('dev advancing during rendering is checked again immediately before push', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const artifact = publishArtifact(git, record(fixture.sha));
    const head = git.head;
    let reads = 0;
    git.head = ref => {
        if (ref === 'refs/heads/dev' && ++reads === 2) fixture.advance();
        return head(ref);
    };
    assert.deepEqual(updateStage(git, artifact), { status: 'stale' });
    assert.equal(head('refs/heads/deploy/stage'), undefined);
});

test('concurrent Stage writers reconcile without creating a second deployment', t => {
    const fixture = gitFixture(t), git = gitRepository(fixture.automation);
    const artifact = publishArtifact(git, record(fixture.sha));
    const other = gitRepository(fixture.source), push = git.push;
    let winner;
    git.push = (...args) => {
        if (!winner) winner = updateStage(other, artifact);
        return push(...args);
    };
    const result = updateStage(git, artifact);
    assert.equal(result.status, 'unchanged');
    assert.equal(result.commit, winner.commit);
});
