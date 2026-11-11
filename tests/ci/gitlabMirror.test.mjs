import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { createMirrorGit, gitlabTarget, mirrorRelease, selectMirrorRelease, withMirrorCredentials } from '../../scripts/ci/gitlabMirror.mjs';
import { gitFixture, root } from './deploymentFixtures.mjs';
import { releaseApiFixture, releaseFor, repo } from './productionFixtures.mjs';

function selection(sha, version = '2.2.1', id = 10) {
    return { status: 'ready', repository: 'McNamara84/elmo', release: releaseFor(sha, version, id) };
}

function mirrorFixture(t, { annotated = false } = {}) {
    const fixture = gitFixture(t);
    const target = join(fixture.directory, 'gitlab.git');
    fixture.git(fixture.directory, 'init', '--bare', '--initial-branch=main', target);
    const selected = selection(fixture.sha);
    if (annotated) {
        fixture.git(fixture.source, 'tag', '-a', '-m', 'Stable release', selected.release.tag);
        fixture.git(fixture.source, 'push', 'origin', `refs/tags/${selected.release.tag}`);
        selected.release.tag_object_sha = fixture.git(fixture.source, 'rev-parse', `refs/tags/${selected.release.tag}`);
    }
    const git = createMirrorGit(fixture.automation, target);
    return { ...fixture, target, git, selected, revalidate: async () => selected };
}

test('release-triggered mirror uses its original ID and tag, never a different Latest', async () => {
    const api = releaseApiFixture();
    const args = { ...api.options, event: 'workflow_run' };
    const result = await selectMirrorRelease(args);
    assert.equal(result.status, 'ready'); assert.equal(result.release.id, api.state.signal.release.id);
    api.state.latest = { ...api.state.release, id: 11, tag_name: 'v2.2.2' };
    api.state.releases.push(api.state.latest);
    assert.deepEqual(await selectMirrorRelease(args), { status: 'superseded', tag: 'v2.2.1' });
});

test('manual mirror selects current stable Latest without relying on an old signal artifact', async () => {
    const api = releaseApiFixture(); api.state.artifacts = [];
    const result = await selectMirrorRelease({ github: api.github, repo, event: 'workflow_dispatch' });
    assert.equal(result.status, 'ready'); assert.equal(result.release.tag, 'v2.2.1'); assert.equal(api.state.downloads, 0);
    api.state.latest.prerelease = true;
    await assert.rejects(selectMirrorRelease({ github: api.github, repo, event: 'workflow_dispatch' }), /stable/u);
});

test('drafts, prereleases and nonstable tags cannot mirror', async () => {
    for (const change of [value => { value.draft = true; }, value => { value.prerelease = true; }, value => { value.tag_name = 'v2.2.1-rc.1'; }]) {
        const api = releaseApiFixture(); change(api.state.latest);
        await assert.rejects(selectMirrorRelease({ github: api.github, repo, event: 'workflow_dispatch' }), /stable/u);
    }
    const api = releaseApiFixture(); api.state.release.prerelease = true;
    await assert.rejects(selectMirrorRelease({ ...api.options, event: 'workflow_run' }), /stable/u);
});

test('mirror requires a listed highest stable release, exact source history and unchanged tag', async () => {
    const api = releaseApiFixture(), args = { ...api.options, event: 'workflow_run' };
    const expected = await selectMirrorRelease(args);
    api.state.releases.push({ ...api.state.release, id: 11, tag_name: 'v2.10.0' });
    assert.equal((await selectMirrorRelease(args)).status, 'superseded');
    api.state.releases = [];
    await assert.rejects(selectMirrorRelease(args), /missing/u);
    api.state.releases = [api.state.release];
    api.state.head = 'd'.repeat(40); api.state.comparison = 'diverged';
    await assert.rejects(selectMirrorRelease(args), /outside main/u);
    api.state.comparison = 'ahead';
    api.state.tag.object.sha = 'd'.repeat(40);
    await assert.rejects(selectMirrorRelease(args), /tag moved/u);
    const manual = { github: api.github, repo, event: 'workflow_dispatch', expected };
    await assert.rejects(selectMirrorRelease(manual), /changed after selection/u);
});

test('repository identities, unsupported events and republished releases fail closed', async () => {
    const api = releaseApiFixture();
    await assert.rejects(selectMirrorRelease({ ...api.options, event: 'push' }), /requires a published/u);
    api.state.release.published_at = '2026-11-10T12:00:00Z';
    await assert.rejects(selectMirrorRelease({ ...api.options, event: 'workflow_run' }), /original publication/u);
    api.state.repository.full_name = 'other/elmo';
    await assert.rejects(selectMirrorRelease({ ...api.options, event: 'workflow_dispatch' }), /restricted/u);
});

test('lightweight and annotated releases atomically mirror only the exact tag and GitLab main', async t => {
    for (const annotated of [false, true]) {
        const fixture = mirrorFixture(t, { annotated }), { git, selected } = fixture;
        assert.deepEqual(await mirrorRelease(git, selected, fixture.revalidate), { status: 'updated' });
        const snapshot = git.snapshot();
        assert.equal(snapshot.head, fixture.sha);
        assert.deepEqual(Object.keys(snapshot.tags), [selected.release.tag]);
        assert.equal(snapshot.tags[selected.release.tag].object, selected.release.tag_object_sha);
        assert.equal(snapshot.tags[selected.release.tag].commit, fixture.sha);
        assert.deepEqual(await mirrorRelease(git, selected, fixture.revalidate), { status: 'unchanged' });
        const refs = git.run('ls-remote', fixture.target);
        assert.ok(!refs.includes('artifacts/')); assert.ok(!refs.includes('deploy/')); assert.ok(!refs.includes('refs/heads/dev'));
    }
});

test('new stable releases advance the mirror and an older run cannot rewind it', async t => {
    const fixture = mirrorFixture(t), { git, selected } = fixture;
    await mirrorRelease(git, selected, fixture.revalidate);
    const next = selection(fixture.advance('main'), '2.2.2', 11);
    assert.deepEqual(await mirrorRelease(git, next, async () => next), { status: 'updated' });
    await assert.rejects(mirrorRelease(git, selected, fixture.revalidate), /higher stable/u);
    assert.equal(git.snapshot().head, next.release.sha);
});

test('a moved GitLab tag and unrecognized main cannot be overwritten', async t => {
    const fixture = mirrorFixture(t), { git, selected } = fixture;
    const next = fixture.advance('main');
    git.run('fetch', '--no-tags', 'origin', next);
    git.run('push', fixture.target, `${next}:refs/tags/${selected.release.tag}`);
    await assert.rejects(mirrorRelease(git, selected, fixture.revalidate), /tags must never be moved/u);
    // A separate existing main without a known stable release is never adopted.
    git.run('push', fixture.target, `${next}:refs/heads/main`);
    const different = selection(fixture.sha, '2.2.2', 11);
    // This head is recognized by the prior tag, so add a manual commit instead.
    const manual = fixture.advance('main'); git.run('fetch', '--no-tags', 'origin', manual);
    git.run('push', fixture.target, `${manual}:refs/heads/main`);
    await assert.rejects(mirrorRelease(git, different, async () => different), /unrecognized/u);
});

test('concurrent identical mirror writes converge; newer writers win without partial tag writes', async t => {
    const fixture = mirrorFixture(t), { git, selected } = fixture;
    const other = createMirrorGit(fixture.source, fixture.target);
    let validations = 0;
    const result = await mirrorRelease(git, selected, async () => {
        if (++validations === 2) await mirrorRelease(other, selected, fixture.revalidate);
        return selected;
    });
    assert.equal(result.status, 'unchanged');
    const next = selection(fixture.advance('main'), '2.2.2', 11);
    const oldSnapshot = git.snapshot();
    await mirrorRelease(other, next, async () => next);
    assert.equal(git.push(selected.release, oldSnapshot), false);
    assert.equal(git.snapshot().head, next.release.sha);
});

test('superseded or changed candidates cannot write even when invalidated immediately before push', async t => {
    const fixture = mirrorFixture(t);
    let validations = 0;
    const result = await mirrorRelease(fixture.git, fixture.selected, async () => ++validations === 2 ? { status: 'superseded' } : fixture.selected);
    assert.deepEqual(result, { status: 'superseded' }); assert.equal(fixture.git.snapshot().head, undefined);
    const changed = structuredClone(fixture.selected); changed.release.tag_object_sha = 'd'.repeat(40);
    await assert.rejects(mirrorRelease(fixture.git, fixture.selected, async () => changed), /changed before writing/u);
    await assert.rejects(mirrorRelease(fixture.git, fixture.selected), /fresh validation/u);
});

test('askpass never persists the token and cleans its script after success and failure', async () => {
    const token = 'synthetic-test-token', paths = [];
    for (const fail of [false, true]) {
        const action = withMirrorCredentials(token, async env => {
            paths.push(env.GIT_ASKPASS);
            assert.equal(env.GITLAB_TOKEN, token);
            const script = readFileSync(env.GIT_ASKPASS, 'utf8');
            assert.ok(!script.includes(token)); assert.ok(script.includes('$GITLAB_TOKEN'));
            if (fail) throw new Error('mirror failed');
            return 'ok';
        });
        if (fail) await assert.rejects(action, /mirror failed/u); else assert.equal(await action, 'ok');
        assert.equal(existsSync(paths.at(-1)), false);
    }
    await assert.rejects(withMirrorCredentials('', () => {}), /GITLAB_TOKEN/u);
});

test('mirror credentials are confined to trusted default-branch code and explicit release refs', () => {
    assert.equal(gitlabTarget, 'https://git.gfz-potsdam.de/data_services/elmo.git');
    const workflow = yaml.load(readFileSync(join(root, '.github/workflows/mirror-to-gitlab.yml'), 'utf8'));
    assert.deepEqual(Object.keys(workflow.on).sort(), ['workflow_dispatch', 'workflow_run']);
    assert.deepEqual(workflow.on.workflow_run.workflows, ['Production Release Signal']);
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
    assert.deepEqual(workflow.jobs.mirror.permissions, { actions: 'read', contents: 'read' });
    const steps = workflow.jobs.mirror.steps;
    for (const step of steps) assert.ok(!step.run?.includes('--force'));
    for (const step of steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/u);
    const checkout = steps.find(step => step.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout.with.ref, '${{ github.sha }}'); assert.equal(checkout.with['persist-credentials'], false);
    const writes = steps.filter(step => step.env?.GITLAB_TOKEN);
    assert.equal(writes.length, 1); assert.equal(writes[0].if, "steps.release.outputs.ready == 'true'");
});
