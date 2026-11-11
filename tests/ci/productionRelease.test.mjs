import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { assessProductionRelease, compareStableTags, decodeSignalArchive, resolveReleaseTag,
    stableTagPattern, validateReleaseChangelog } from '../../scripts/ci/productionRelease.mjs';
import { changelog, root } from './deploymentFixtures.mjs';
import { releaseApiFixture, releaseFor } from './productionFixtures.mjs';

test('a published stable signal selects the exact main record, even after main advanced', async () => {
    const api = releaseApiFixture(); api.state.head = 'd'.repeat(40);
    const result = await assessProductionRelease(api.options);
    assert.equal(result.release.sha, api.state.signal.sha);
    assert.equal(result.artifact.record.branch, 'main');
    assert.equal(result.candidate.current, false);
    assert.equal(result.candidate.ready, true);
    assert.equal(result.candidate.version, '2.2.1');
    assert.equal(api.state.files['json/changelog.json'], changelog);
});

test('stable tags are strict and compared numerically without precision loss', () => {
    for (const tag of ['2.2.1', 'v02.2.1', 'v2.02.1', 'v2.2.01', 'v2.2', 'v2.2.1-rc.1', 'v2.2.1+build', 'v2.2.1\n', ' v2.2.1', 'v2.2.1 ']) {
        assert.equal(stableTagPattern.test(tag), false, tag);
        assert.throws(() => compareStableTags(tag, 'v2.2.1'), /stable/u);
    }
    assert.equal(compareStableTags('v2.10.0', 'v2.9.99'), 1);
    assert.equal(compareStableTags('v9007199254740993.0.0', 'v9007199254740992.0.0'), 1);
    assert.equal(compareStableTags('v0.0.0', 'v0.0.0'), 0);
});

test('forged event, fork, workflow, result and attempt identities fail before downloading data', async () => {
    const changes = [
        state => { state.run.event = 'push'; },
        state => { state.run.conclusion = 'failure'; },
        state => { state.run.status = 'in_progress'; },
        state => { state.run.head_repository.id = 99; },
        state => { state.run.repository.id = 99; },
        state => { state.run.workflow_id = 99; },
        state => { state.run.run_attempt = 2; },
        state => { state.workflow.path = '.github/workflows/other.yml'; },
        state => { state.repository.default_branch = 'dev'; },
    ];
    for (const change of changes) {
        const api = releaseApiFixture(); change(api.state);
        await assert.rejects(assessProductionRelease(api.options), /provenance/u);
        assert.equal(api.state.downloads, 0);
    }
});

test('release-tag workflow code must match the minimal trusted definition exactly', async () => {
    const api = releaseApiFixture(); api.state.files['.github/workflows/production-release-signal.yml'] += '\n# different tag workflow';
    await assert.rejects(assessProductionRelease(api.options), /trusted minimal definition/u);
    assert.equal(api.state.downloads, 0);
});

test('missing, expired, oversized, foreign or ambiguous signal artifacts fail closed', async () => {
    const changes = [
        state => { state.artifacts = []; },
        state => { state.artifacts[0].expired = true; },
        state => { state.artifacts[0].size_in_bytes = 1048577; },
        state => { state.artifacts[0].workflow_run.id = 201; },
        state => { state.artifacts[0].workflow_run.head_sha = 'd'.repeat(40); },
        state => { state.artifacts.push({ ...state.artifacts[0], id: 501 }); },
    ];
    for (const change of changes) {
        const api = releaseApiFixture(); change(api.state);
        await assert.rejects(assessProductionRelease(api.options), /signal artifact/u);
    }
});

test('signal data must attest to the original publication, repository, attempt and commit', async () => {
    const changes = [
        signal => { signal.action = 'created'; },
        signal => { signal.repository_id = 99; },
        signal => { signal.repository = 'attacker/elmo'; },
        signal => { signal.run_id = 201; },
        signal => { signal.run_attempt = 2; },
        signal => { signal.sha = 'd'.repeat(40); },
        signal => { signal.ref = 'refs/heads/main'; },
        signal => { signal.release.draft = true; },
        signal => { signal.release.prerelease = true; },
        signal => { signal.release.tag = 'v2.2.1-rc.1'; signal.ref = 'refs/tags/v2.2.1-rc.1'; },
    ];
    for (const change of changes) {
        const api = releaseApiFixture(); change(api.state.signal);
        await assert.rejects(assessProductionRelease(api.options), /original published stable/u);
    }
});

test('a signal rerun starting during artifact inspection invalidates the prior attempt', async () => {
    const api = releaseApiFixture(), getRun = api.github.rest.actions.getWorkflowRun;
    let reads = 0;
    api.github.rest.actions.getWorkflowRun = async args => {
        if (++reads === 2) api.state.run.run_attempt = 2;
        return getRun(args);
    };
    await assert.rejects(assessProductionRelease(api.options), /superseded/u);
});

test('another Latest release cannot reuse a signal even when it has the same tag or SHA', async () => {
    const api = releaseApiFixture(); api.state.latest.id = 11;
    await assert.rejects(assessProductionRelease(api.options), /Latest/u);
});

test('GitHub Latest must also be the highest listed published stable Semver', async () => {
    const api = releaseApiFixture(); api.state.releases.push({ ...api.state.release, id: 11, tag_name: 'v2.10.0' });
    await assert.rejects(assessProductionRelease(api.options), /highest/u);
    api.state.releases[1].prerelease = true;
    assert.equal((await assessProductionRelease(api.options)).release.tag, 'v2.2.1');
    api.state.releases = [];
    await assert.rejects(assessProductionRelease(api.options), /highest/u);
});

test('deleted, drafted, prereleased, renamed and republished releases cannot promote', async () => {
    const changes = [
        state => { state.release.draft = true; },
        state => { state.release.prerelease = true; },
        state => { state.release.tag_name = 'v2.2.2'; },
        state => { state.release.published_at = '2026-11-10T11:00:00Z'; },
    ];
    for (const change of changes) {
        const api = releaseApiFixture(); change(api.state);
        await assert.rejects(assessProductionRelease(api.options), /Latest/u);
    }
    const api = releaseApiFixture(); api.github.rest.repos.getRelease = async () => { throw new Error('404 release deleted'); };
    await assert.rejects(assessProductionRelease(api.options), /404/u);
});

test('lightweight and annotated tags resolve exactly; moved or non-commit tags fail', async () => {
    const api = releaseApiFixture(), tag = 'e'.repeat(40), sha = api.state.signal.sha;
    api.state.tag.object = { type: 'tag', sha: tag };
    api.state.annotated[tag] = { sha: tag, object: { type: 'commit', sha } };
    const selected = await assessProductionRelease(api.options);
    assert.equal(selected.release.tag_object_sha, tag);
    api.state.tag.object = { type: 'commit', sha: 'f'.repeat(40) };
    await assert.rejects(assessProductionRelease(api.options), /tag moved/u);
    api.state.tag.object.type = 'tree';
    await assert.rejects(resolveReleaseTag(api.github, api.options.repo, 'v2.2.1'), /commit/u);
});

test('a tag outside main cannot promote', async () => {
    const api = releaseApiFixture(); api.state.head = 'd'.repeat(40); api.state.comparison = 'diverged';
    await assert.rejects(assessProductionRelease(api.options), /contained/u);
});

test('missing main checks cannot be replaced by successful dev or PR checks', async () => {
    for (const change of [run => { run.head_branch = 'dev'; }, run => { run.event = 'pull_request'; }, run => { run.head_sha = 'd'.repeat(40); }]) {
        const api = releaseApiFixture(); change(api.state.runs[5]);
        await assert.rejects(assessProductionRelease(api.options), /main push checks/u);
    }
});

test('new failed runs, running reruns and skipped matrix jobs block release promotion', async () => {
    const changes = [
        state => { state.runs.push({ ...state.runs[5], id: 999, conclusion: 'failure' }); },
        state => { state.runs[5].status = 'in_progress'; state.runs[5].conclusion = null; },
        state => { state.jobs.get(104)[1].conclusion = 'skipped'; },
        state => { state.runs[5].run_attempt = 2; },
    ];
    for (const change of changes) {
        const api = releaseApiFixture(); change(api.state);
        await assert.rejects(assessProductionRelease(api.options), /main push checks/u);
    }
});

test('only an exact main artifact is accepted, never a dev fallback or changed image version', async () => {
    const api = releaseApiFixture(); api.git.head = () => undefined;
    await assert.rejects(assessProductionRelease(api.options), /No artifacts\/main/u);
    const wrongBranch = releaseApiFixture(); wrongBranch.stored.branch = 'dev';
    await assert.rejects(assessProductionRelease(wrongBranch.options), /branch/u);
    const wrongVersion = releaseApiFixture(); wrongVersion.stored.version = '2.2.2';
    await assert.rejects(assessProductionRelease(wrongVersion.options), /version/u);
});

test('currentVersion, final calendar date and exact changelog entry are required without reordering', () => {
    const release = releaseFor('a'.repeat(40));
    assert.equal(validateReleaseChangelog(changelog, release), '2.2.1');
    for (const date of ['2026-XX-XX', '', null, '2026-02-30', '2026-13-01', '2026-11-11', '2026-1-1', '2026-11-10\n']) {
        assert.throws(() => validateReleaseChangelog(JSON.stringify({ currentVersion: '2.2.1', releases: [{ version: '2.2.1', date }] }), release), /final/u);
    }
    const log = JSON.parse(changelog); log.currentVersion = '2.2.2';
    assert.throws(() => validateReleaseChangelog(JSON.stringify(log), release), /currentVersion/u);
    log.currentVersion = '2.2.1'; log.releases.push(log.releases[1]);
    assert.throws(() => validateReleaseChangelog(JSON.stringify(log), release), /one matching/u);
});

test('revalidation rejects a changed tag object or image but preserves the first evidence commit', async () => {
    const api = releaseApiFixture(), expected = await assessProductionRelease(api.options);
    api.state.tag.object = { type: 'tag', sha: 'e'.repeat(40) };
    api.state.annotated['e'.repeat(40)] = { sha: 'e'.repeat(40), object: { type: 'commit', sha: api.state.signal.sha } };
    await assert.rejects(assessProductionRelease({ ...api.options, expected }), /changed after validation/u);
    api.state.tag.object = { type: 'commit', sha: api.state.signal.sha };
    api.stored.images.web = `ghcr.io/mcnamara84/elmo-web@sha256:${'d'.repeat(64)}`;
    await assert.rejects(assessProductionRelease({ ...api.options, expected }), /changed after validation/u);
    api.stored.images.web = expected.artifact.record.images.web;
    api.git.head = () => 'f'.repeat(40);
    const retry = await assessProductionRelease({ ...api.options, expected });
    assert.equal(retry.artifact.commit, expected.artifact.commit);
});

test('signal ZIP reading is bounded and rejects extra paths, malformed JSON and unzip errors', () => {
    assert.throws(() => decodeSignalArchive(Buffer.alloc(0)), /size/u);
    assert.throws(() => decodeSignalArchive(Buffer.alloc(1048577)), /size/u);
    assert.throws(() => decodeSignalArchive(Buffer.from('zip'), () => '../release-signal.json\n'), /members/u);
    assert.throws(() => decodeSignalArchive(Buffer.from('zip'), () => 'release-signal.json\nextra\n'), /members/u);
    assert.throws(() => decodeSignalArchive(Buffer.from('zip'), (_command, args) => args[0] === '-Z1' ? 'release-signal.json\n' : '{'), SyntaxError);
    assert.throws(() => decodeSignalArchive(Buffer.from('zip'), () => { throw new Error('unzip failed'); }), /unzip failed/u);
    const decoded = decodeSignalArchive(Buffer.from('zip'), (_command, args, options) => {
        assert.equal(options.maxBuffer, 65536); assert.equal(options.timeout, 10000);
        return args[0] === '-Z1' ? 'release-signal.json\n' : '{"schema":1}';
    });
    assert.deepEqual(decoded, { schema: 1 });
});

test('workflow triggers, trusted checkouts and least permissions enforce release-only promotion', () => {
    const signal = yaml.load(readFileSync(join(root, '.github/workflows/production-release-signal.yml'), 'utf8'));
    const workflow = yaml.load(readFileSync(join(root, '.github/workflows/promote-production-release.yml'), 'utf8'));
    assert.deepEqual(signal.on, { release: { types: ['published'] } });
    assert.deepEqual(signal.permissions, { contents: 'read' });
    assert.ok(!signal.jobs.signal.steps.some(step => step.uses?.startsWith('actions/checkout@')));
    assert.deepEqual(workflow.on, { workflow_run: { workflows: ['Production Release Signal'], types: ['completed'] } });
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
    assert.deepEqual(workflow.jobs.validate.permissions, { actions: 'read', contents: 'read' });
    assert.deepEqual(workflow.jobs.inspect.permissions, { actions: 'read', contents: 'read', packages: 'read' });
    assert.deepEqual(workflow.jobs.promote.permissions, { actions: 'read', contents: 'write' });
    assert.deepEqual(workflow.jobs.promote.needs, ['validate', 'inspect']);
    assert.ok(workflow.jobs.inspect.steps.some(step => step.run?.includes('scan-container-image.sh')));
    for (const job of [...Object.values(workflow.jobs), signal.jobs.signal]) {
        assert.equal(job.environment, undefined);
        for (const step of job.steps) {
            if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/u);
            assert.ok(!step.uses?.startsWith('docker/build-push-action@'));
            if (step.uses?.startsWith('actions/checkout@')) {
                assert.equal(step.with.ref, '${{ github.sha }}');
                assert.equal(step.with.path, 'automation');
                if (job !== workflow.jobs.promote) assert.equal(step.with['persist-credentials'], false);
            }
        }
    }
});
