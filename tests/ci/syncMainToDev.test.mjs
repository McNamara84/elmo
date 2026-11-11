import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { requiredWorkflows } from '../../scripts/ci/deploymentChecks.mjs';
import { enableSyncMerge, syncBranch, syncHeld } from '../../scripts/ci/syncMainToDev.mjs';
import { root } from './deploymentFixtures.mjs';
import { armed, conflict, marker, repo, repositoryPaused, syncFixture } from './syncFixtures.mjs';

test('one App-authored integration PR preserves main and dev, reusing its commit and reviews on retries', async t => {
    const fixture = syncFixture(t), { git, state } = fixture;
    const before = git.run('status', '--porcelain');
    await fixture.run();
    const head = git.head(syncBranch);
    assert.ok(git.contains(state.main, head)); assert.ok(git.contains(state.dev, head));
    assert.equal(git.run('show', `${head}:dev-feature.txt`), 'Only on dev');
    assert.equal(git.run('show', `${head}:main-fix.txt`), 'Only on main');
    assert.equal(git.head('main'), state.main); assert.equal(git.head('dev'), state.dev);
    assert.equal(git.run('status', '--porcelain'), before);
    const updates = state.updates.length;
    await fixture.run();
    assert.equal(git.head(syncBranch), head);
    assert.equal(state.created, 1); assert.equal(state.enables, 1); assert.equal(state.updates.length, updates);
});

test('a new main fix updates the same PR without merging dev features into main', async t => {
    const fixture = syncFixture(t); await fixture.run();
    const old = fixture.git.head(syncBranch);
    const main = fixture.commitFile('main', 'main-fix.txt', 'Updated fix');
    await fixture.run();
    assert.notEqual(fixture.git.head(syncBranch), old);
    assert.equal(fixture.state.created, 1);
    assert.equal(fixture.git.head('main'), main);
    assert.equal(fixture.git.head('dev'), fixture.state.dev);
    assert.throws(() => fixture.git.run('show', `${main}:dev-feature.txt`));
});

test('all explicit PR pauses stop branch writes and disable managed auto-merge', async t => {
    const fixture = syncFixture(t); await fixture.run();
    const head = fixture.git.head(syncBranch), pr = fixture.state.open[0];
    for (const kind of ['label', 'draft', 'disabled']) {
        pr.labels = kind === 'label' ? [{ name: 'sync:hold' }] : [];
        pr.draft = kind === 'draft';
        pr.auto_merge = kind === 'disabled' ? null : {};
        assert.equal(syncHeld(pr), true);
        await fixture.run();
        assert.equal(fixture.git.head(syncBranch), head);
        assert.equal(pr.auto_merge, null);
    }
    assert.equal(fixture.state.enables, 1);
});

test('repository pause is resumable while an existing manual disablement stays held', async t => {
    const fixture = syncFixture(t); await fixture.run();
    const pr = fixture.state.open[0];
    await fixture.run({ paused: true });
    assert.ok(pr.body.includes(repositoryPaused)); assert.equal(pr.auto_merge, null);
    await fixture.run(); assert.equal(fixture.state.enables, 2);
    pr.auto_merge = null;
    await fixture.run({ paused: true });
    assert.ok(!pr.body.includes(repositoryPaused));
    await fixture.run(); assert.equal(fixture.state.enables, 2);
});

test('sync:hold set during a repository pause remains a manual hold after resuming', async t => {
    const fixture = syncFixture(t); await fixture.run();
    const pr = fixture.state.open[0];
    await fixture.run({ paused: true }); pr.labels = [{ name: 'sync:hold' }];
    await fixture.run({ paused: true });
    assert.ok(!pr.body.includes(repositoryPaused));
    pr.labels = [];
    await fixture.run(); assert.equal(fixture.state.enables, 1);
});

test('a deliberately closed PR is not recreated and an unmanaged branch is never overwritten', async t => {
    const fixture = syncFixture(t); await fixture.run();
    const pr = fixture.state.open.pop(); pr.state = 'closed'; fixture.state.closed.push(pr);
    const head = fixture.git.head(syncBranch);
    await fixture.run(); assert.equal(fixture.state.created, 1); assert.equal(fixture.git.head(syncBranch), head);
    fixture.state.closed = [];
    await assert.rejects(fixture.run(), /not owned/u);
});

test('conflicts remain visible without choosing a changelog side; helper-branch resolutions are preserved', async t => {
    const fixture = syncFixture(t, { conflicts: true }), { git, state } = fixture;
    await assert.rejects(fixture.run(), /merge conflicts/u);
    assert.equal(state.created, 1); assert.equal(state.enables, 0);
    assert.ok(state.open[0].body.includes(conflict));
    const conflictHead = git.head(syncBranch);
    await assert.rejects(fixture.run(), /merge conflicts/u);
    assert.equal(git.head(syncBranch), conflictHead);
    // A deliberate resolution combines both histories and preserves upcoming
    // entries/currentVersion; the automation does not edit this JSON itself.
    const resolved = '{"currentVersion":"3.0.0","releases":[{"version":"3.0.0","editions":["msl"]},{"version":"2.2.3"}]}';
    const source = fixture.source;
    const run = (...args) => git.run('-C', source, ...args);
    run('checkout', '--quiet', 'dev');
    try { run('merge', '--no-commit', '--no-ff', 'main'); } catch { /* expected conflict */ }
    writeFileSync(join(source, 'json/changelog.json'), resolved);
    run('add', 'json/changelog.json'); run('commit', '-m', 'Resolve changelog deliberately');
    const helper = run('rev-parse', 'HEAD');
    run('push', `--force-with-lease=refs/heads/${syncBranch}:${conflictHead}`, 'origin', `HEAD:refs/heads/${syncBranch}`);
    await fixture.run();
    assert.equal(git.head(syncBranch), helper); assert.equal(state.enables, 1);
    assert.equal(git.run('show', `${helper}:json/changelog.json`), resolved);
    assert.ok(!state.open[0].body.includes(conflict));
});

test('unprotected code branches, missing dev and disabled merge settings fail before writes', async t => {
    const fixture = syncFixture(t);
    for (const branch of ['main', 'dev']) {
        fixture.state.branches[branch].protected = false;
        await assert.rejects(fixture.run(), /Protect/u);
        fixture.state.branches[branch].protected = true;
    }
    fixture.state.settings.allow_auto_merge = false;
    await assert.rejects(fixture.run(), /Enable auto-merge/u);
    fixture.state.settings.allow_auto_merge = true;
    delete fixture.state.branches.dev;
    assert.match((await fixture.run()).message, /dev does not exist/u);
    assert.equal(fixture.git.head(syncBranch), undefined);
});

test('repository identity, unmanaged PRs and duplicate PRs fail closed', async t => {
    const fixture = syncFixture(t); fixture.state.settings.full_name = 'other/elmo';
    await assert.rejects(fixture.run(), /restricted/u);
    fixture.state.settings.full_name = 'McNamara84/elmo'; await fixture.run();
    const pr = fixture.state.open[0]; pr.head.repo.id = 99;
    await assert.rejects(fixture.run(), /Unmanaged/u);
    pr.head.repo.id = 42; fixture.state.open.push(structuredClone(pr));
    await assert.rejects(fixture.run(), /More than one/u);
});

test('advancing source refs and integration lease conflicts defer the update', async t => {
    const fixture = syncFixture(t), { git } = fixture;
    const head = git.head;
    let reads = 0;
    git.head = branch => branch === 'main' && ++reads > 1 ? 'e'.repeat(40) : head(branch);
    assert.match((await fixture.run()).message, /Branches advanced/u);
    assert.equal(head(syncBranch), undefined);
    git.head = head; git.push = () => false;
    assert.match((await fixture.run()).message, /changed concurrently/u);
    assert.equal(fixture.state.created, 0);
});

test('an integration head without both histories cannot enable auto-merge', async t => {
    const fixture = syncFixture(t); await fixture.run();
    const { git, state } = fixture;
    git.run('push', '--force', 'origin', `${state.main}:refs/heads/${syncBranch}`);
    await assert.rejects(fixture.run(), /both source histories/u);
    assert.equal(state.open[0].auto_merge, null);
});

test('fallback merges require an exact approved successful head and preserve branch rules', async () => {
    const head = 'a'.repeat(40), pr = { number: 7, node_id: 'PR_7', head: { sha: head } };
    const node = { state: 'OPEN', headRefOid: head, mergeStateStatus: 'CLEAN', reviewDecision: 'APPROVED',
        commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] } };
    let merges = 0;
    const github = { graphql: async query => { if (query.includes('enablePullRequestAutoMerge')) throw new Error('enable rejected'); return { node }; },
        rest: { pulls: { merge: async input => { merges++; assert.equal(input.sha, head); assert.equal(input.merge_method, 'merge'); return { data: { merged: true } }; } } } };
    for (const [key, value] of [['reviewDecision', 'REVIEW_REQUIRED'], ['headRefOid', 'b'.repeat(40)], ['mergeStateStatus', 'BLOCKED'], ['state', 'CLOSED']]) {
        const original = node[key]; node[key] = value;
        await assert.rejects(enableSyncMerge(github, repo, pr), /enable rejected/u); node[key] = original;
    }
    node.commits.nodes[0].commit.statusCheckRollup.state = 'FAILURE';
    await assert.rejects(enableSyncMerge(github, repo, pr), /enable rejected/u);
    assert.equal(merges, 0); node.commits.nodes[0].commit.statusCheckRollup.state = 'SUCCESS';
    assert.equal(await enableSyncMerge(github, repo, pr), true); assert.equal(merges, 1);
});

test('the workflow uses the shared checks, main-only Environment, scoped App and trusted automation', () => {
    const workflow = yaml.load(readFileSync(join(root, '.github/workflows/sync-main-to-dev.yml'), 'utf8'));
    assert.deepEqual([...workflow.on.workflow_run.workflows].sort(), requiredWorkflows.workflows.map(item => item.name).sort());
    assert.deepEqual(workflow.on.push.branches, ['main']); assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
    assert.equal(workflow.on.schedule[0].cron, '7,22,37,52 * * * *');
    assert.equal(workflow.jobs.synchronize.environment, 'branch-sync');
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    const steps = workflow.jobs.synchronize.steps;
    for (const step of steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/u);
    const token = steps.find(step => step.id === 'token');
    assert.equal(token.with.owner, 'McNamara84'); assert.equal(token.with.repositories, 'elmo');
    assert.equal(token.with['permission-workflows'], 'write');
    assert.equal(steps.find(step => step.uses.startsWith('actions/checkout@')).with.ref, '${{ github.sha }}');
});
