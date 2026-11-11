import test from 'node:test';
import assert from 'node:assert/strict';
import * as yaml from 'js-yaml';
import { gitRepository, publishArtifact, readArtifact } from '../../scripts/ci/deploymentArtifacts.mjs';
import { inspectProduction, renderProduction, updateProduction } from '../../scripts/ci/productionDeployment.mjs';
import { digest, prod, record, repository } from './deploymentFixtures.mjs';
import { assessProductionRelease } from '../../scripts/ci/productionRelease.mjs';
import { productionFixture, releaseApiFixture } from './productionFixtures.mjs';

test('Production renders both variants with the recorded digest, preserving routing and reset settings', () => {
    const selected = record('a'.repeat(40), 'main');
    const rendered = renderProduction(prod, selected), actual = yaml.load(rendered), original = yaml.load(prod);
    for (const name of ['web', 'web-msl']) original.services[name].image = '${ELMO_PROD_WEB_IMAGE:-' + selected.images.web + '}';
    assert.deepEqual(actual, original);
    assert.equal(actual.services.web.environment.INSTALL_ACTION, 'basic');
    assert.ok(!rendered.includes('deployment-template'));
    assert.throws(() => renderProduction(prod, record('a'.repeat(40), 'dev')), /branch/u);
});

test('Production rejects missing or extra markers, unexpected variants, builds, ports and database refs', () => {
    const selected = record('a'.repeat(40), 'main');
    for (const source of [prod.replace('deployment-template', 'latest'), prod + '\n# deployment-template',
        prod.replace('  web-msl:', '  web-igsn:'), prod.replace('  web:', '  web:\n    build: .'),
        prod.replace('  web:', '  web:\n    ports: [80:80]'), prod.replace('mariadb:12.3.3-noble@', 'mariadb:other@')]) {
        assert.throws(() => renderProduction(source, selected), /Production|marker|template/u);
    }
});

test('first promotion changes exactly Prod Compose and metadata without touching Stage or source branches', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    const before = fixture.git.run(['status', '--porcelain']);
    const result = await updateProduction(git, selection, fixture.promote);
    assert.equal(result.status, 'updated');
    assert.deepEqual(fixture.git.run(['diff', '--name-only', fixture.sha, result.commit]).trim().split('\n').sort(),
        ['.elmo-deployment.json', 'docker-compose.prod.yml']);
    assert.equal(git.head('refs/heads/main'), fixture.sha);
    assert.equal(git.head('refs/heads/dev'), fixture.sha);
    assert.equal(git.head('refs/heads/deploy/stage'), undefined);
    assert.ok(git.ancestor(fixture.sha, result.commit));
    assert.equal(git.run(['status', '--porcelain']), before);
    const deployed = JSON.parse(git.file(result.commit, '.elmo-deployment.json'));
    assert.deepEqual(deployed.release, selection.release);
    assert.deepEqual(deployed.record, selection.artifact.record);
});

test('a retry creates no new deployment commit, including after unrelated artifact appends', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    const first = await updateProduction(git, selection, fixture.promote);
    const next = fixture.advance('main');
    publishArtifact(fixture.publicationGit, record(next, 'main'));
    const artifact = readArtifact(fixture.publicationGit, repository, 'main', fixture.sha);
    assert.notEqual(artifact.commit, selection.artifact.commit);
    const retry = await updateProduction(git, { ...selection, artifact }, fixture.promote);
    assert.deepEqual(retry, { status: 'unchanged', commit: first.commit });
    assert.equal(git.head('refs/heads/deploy/prod'), first.commit);
});

test('higher stable versions preserve Production history and older versions cannot roll back', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    const first = await updateProduction(git, selection, fixture.promote);
    const next = fixture.nextRelease();
    const second = await updateProduction(git, next, fixture.promote);
    assert.ok(git.ancestor(first.commit, second.commit));
    assert.ok(git.ancestor(next.release.sha, second.commit));
    await assert.rejects(updateProduction(git, selection, fixture.promote), /older/u);
    assert.equal(git.head('refs/heads/deploy/prod'), second.commit);
});

test('a deployed stable version cannot be replaced through a new ID, moved tag or changed digest', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    await updateProduction(git, selection, fixture.promote);
    for (const change of [value => { value.release.id++; }, value => { value.release.tag_object_sha = 'e'.repeat(40); },
        value => { value.artifact.record.images.web = `ghcr.io/mcnamara84/elmo-web@${digest('b')}`; }]) {
        const changed = structuredClone(selection); change(changed);
        assert.throws(() => inspectProduction(git, changed), /different release, source or image/u);
    }
});

test('a release superseded immediately before push leaves Production untouched', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    let checks = 0;
    await assert.rejects(updateProduction(git, selection, async () => {
        if (++checks === 2) throw new Error('Latest release changed');
    }), /Latest release changed/u);
    assert.equal(checks, 2);
    assert.equal(git.head('refs/heads/deploy/prod'), undefined);
});

test('concurrent retries reconcile the winning commit without a second deployment', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    const other = gitRepository(fixture.source, { productionOnly: true });
    // Git's real lease must reject this competing write; run the competitor at
    // the pre-push validation boundary, rather than mocking the lease itself.
    let winner, checks = 0;
    const result = await updateProduction(git, selection, async () => {
        if (++checks === 2) winner = await updateProduction(other, selection, fixture.promote);
    });
    assert.equal(result.status, 'unchanged');
    assert.equal(result.commit, winner.commit);
});

test('release validation and promotion integrate against the actual immutable main Git record', async t => {
    const fixture = productionFixture(t), api = releaseApiFixture(fixture.sha);
    const options = { ...api.options, git: fixture.git };
    const selection = await assessProductionRelease(options);
    const revalidate = () => assessProductionRelease({ ...options, expected: selection });
    const deployed = await updateProduction(fixture.git, selection, revalidate);
    assert.equal(deployed.status, 'updated');
    assert.deepEqual(await updateProduction(fixture.git, selection, revalidate), { status: 'unchanged', commit: deployed.commit });
});

test('a newer concurrent deployment wins and an older writer cannot overwrite it', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    const next = fixture.nextRelease(), other = gitRepository(fixture.source, { productionOnly: true });
    let winner, checks = 0;
    await assert.rejects(updateProduction(git, selection, async () => {
        if (++checks === 2) winner = await updateProduction(other, next, fixture.promote);
    }), /older/u);
    assert.equal(git.head('refs/heads/deploy/prod'), winner.commit);
});

test('unowned Production branches and mismatched evidence fail without overwrite', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    fixture.git.run(['push', 'origin', `${fixture.sha}:refs/heads/deploy/prod`]);
    await assert.rejects(updateProduction(git, selection, fixture.promote), /not owned/u);
    assert.equal(git.head('refs/heads/deploy/prod'), fixture.sha);
    const changed = structuredClone(selection); changed.artifact.record.images.web = `ghcr.io/mcnamara84/elmo-web@${digest('b')}`;
    await assert.rejects(updateProduction(git, changed, fixture.promote), /evidence/u);
});

test('Production writes require a validation callback and cannot target other branches or rewrite history', async t => {
    const fixture = productionFixture(t), { git, selection } = fixture;
    await assert.rejects(updateProduction(git, selection), /fresh release validation/u);
    for (const ref of ['refs/heads/main', 'refs/heads/dev', 'refs/heads/deploy/stage', 'refs/heads/artifacts/main']) {
        assert.throws(() => git.push(ref, fixture.sha, fixture.sha), /Only the Production/u);
    }
    const deployed = await updateProduction(git, selection, fixture.promote);
    assert.throws(() => git.push('refs/heads/deploy/prod', fixture.sha, deployed.commit), /rewrite/u);
});
