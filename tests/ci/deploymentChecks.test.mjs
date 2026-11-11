import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { assessCandidate, candidateMetadata, requiredWorkflows, requireReadyCandidate } from '../../scripts/ci/deploymentChecks.mjs';
import { changelog, metadata, prod, root, stage } from './deploymentFixtures.mjs';

function apiFixture(branch = 'dev') {
    const repository = { id: 42, full_name: 'McNamara84/elmo', default_branch: 'main' };
    const sha = 'a'.repeat(40);
    const workflows = requiredWorkflows.workflows.map((item, index) => ({ ...item, id: index + 1, path: `.github/workflows/${item.file}` }));
    const runs = workflows.map((workflow, index) => ({
        id: 100 + index, workflow_id: workflow.id, path: workflow.path, name: workflow.name,
        repository: { ...repository }, head_repository: { ...repository }, head_branch: branch, head_sha: sha,
        event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1, html_url: `https://example.invalid/${index}`,
    }));
    const jobs = new Map(runs.map((run, index) => [run.id, workflows[index].checks.map(name => ({ name, status: 'completed', conclusion: 'success', run_attempt: 1 }))]));
    const state = { repository, sha, workflows, runs, jobs, head: sha, comparison: 'ahead', getRun: id => runs.find(run => run.id === id) };
    const actions = {
        getWorkflowRun: async ({ run_id }) => ({ data: structuredClone(state.getRun(run_id)) }),
        getWorkflow: async ({ workflow_id }) => ({ data: workflows.find(item => item.file === workflow_id) }),
        listWorkflowRuns() {}, listJobsForWorkflowRun() {},
    };
    const github = {
        rest: { actions, repos: {
            get: async () => ({ data: repository }),
            getBranch: async () => ({ data: { commit: { sha: state.head } } }),
            compareCommits: async () => ({ data: { status: state.comparison } }),
            getContent: async ({ path, ref }) => {
                assert.equal(ref, sha);
                const files = { 'json/changelog.json': changelog, 'docker-compose.stage.yml': stage, 'docker-compose.prod.yml': prod };
                return { data: { type: 'file', encoding: 'base64', content: Buffer.from(files[path]).toString('base64') } };
            },
        } },
        paginate: async (method, options) => method === actions.listWorkflowRuns
            ? runs.filter(run => run.workflow_id === options.workflow_id && run.head_branch === options.branch && run.head_sha === options.head_sha)
            : structuredClone(jobs.get(options.run_id) ?? []),
    };
    const assess = () => assessCandidate({ github, repo: { owner: 'McNamara84', repo: 'elmo' }, runId: 100 });
    return { ...state, state, github, assess };
}

test('all six latest push workflows and their matrix jobs authorize the exact candidate', async () => {
    const api = apiFixture();
    const result = await api.assess();
    assert.equal(result.ready, true);
    assert.equal(result.current, true);
    assert.equal(result.version, '2.2.1'); // The first listed release is deliberately newer.
    assert.equal(result.checks.length, 6);
    requireReadyCandidate(result, { ...metadata, branch: 'dev', sha: api.sha });
});

for (const event of ['pull_request', 'workflow_dispatch']) {
    test(`${event} signals never authorize publication`, async () => {
        const api = apiFixture(); api.runs[0].event = event;
        await assert.rejects(api.assess(), /signal/u);
    });
}

test('a fork with a spoofed repository name still fails the repository-ID check', async () => {
    const api = apiFixture(); api.runs[0].head_repository.id = 99;
    await assert.rejects(api.assess(), /signal/u);
});

test('an unrelated workflow with the same display name cannot supply the signal', async () => {
    const api = apiFixture(); api.runs[0].workflow_id = 99;
    await assert.rejects(api.assess(), /required workflow/u);
});

test('a candidate outside its branch history cannot publish', async () => {
    const api = apiFixture(); api.state.head = 'b'.repeat(40); api.state.comparison = 'diverged';
    await assert.rejects(api.assess(), /contained/u);
});

test('successful older main commits remain eligible release candidates', async () => {
    const api = apiFixture('main'); api.state.head = 'b'.repeat(40);
    const result = await api.assess();
    assert.equal(result.current, false);
    assert.equal(result.ready, true);
    assert.equal(result.branch, 'main');
});

test('a newer failed run cannot be hidden by an older successful run', async () => {
    const api = apiFixture(); api.runs.push({ ...api.runs[5], id: 999, conclusion: 'failure' });
    assert.equal((await api.assess()).ready, false);
});

test('a running latest attempt blocks publication', async () => {
    const api = apiFixture(); api.runs[5].status = 'in_progress'; api.runs[5].conclusion = null;
    assert.equal((await api.assess()).ready, false);
});

test('a missing workflow blocks publication', async () => {
    const api = apiFixture(); api.runs.pop();
    assert.equal((await api.assess()).ready, false);
});

test('a skipped matrix job blocks even a successful overall workflow', async () => {
    const api = apiFixture(); api.jobs.get(103)[1].conclusion = 'skipped';
    assert.equal((await api.assess()).ready, false);
});

test('missing or renamed required matrix jobs cannot silently reduce coverage', async () => {
    const api = apiFixture(); api.jobs.get(103).pop();
    assert.equal((await api.assess()).ready, false);
});

test('jobs from an older attempt cannot approve a successful rerun', async () => {
    const api = apiFixture(); api.runs[5].run_attempt = 2;
    assert.equal((await api.assess()).ready, false);
});

test('a rerun starting during job inspection invalidates the earlier result', async () => {
    const api = apiFixture(); const original = api.state.getRun; let reads = 0;
    api.state.getRun = id => {
        const run = original(id);
        return id === 105 && ++reads > 1 ? { ...run, run_attempt: 2, status: 'in_progress', conclusion: null } : run;
    };
    assert.equal((await api.assess()).ready, false);
});

test('a workflow identity change or an API error fails closed', async () => {
    const api = apiFixture(); api.workflows[5].name = 'Unrelated checks';
    await assert.rejects(api.assess(), /identity/u);
    const broken = apiFixture(); broken.github.rest.repos.getBranch = async () => { throw new Error('network unavailable'); };
    await assert.rejects(broken.assess(), /network unavailable/u);
});

test('source metadata cannot disagree across environments or with the displayed version', () => {
    assert.throws(() => candidateMetadata('{"currentVersion":"9.0.0","releases":[]}', stage, prod), /currentVersion/u);
    assert.throws(() => candidateMetadata(changelog, stage, prod.replace('mariadb:', 'other:')), /MariaDB/u);
    assert.throws(() => candidateMetadata(JSON.stringify({ currentVersion: '2.2.1\n', releases: [{ version: '2.2.1\n' }] }), stage, prod), /currentVersion/u);
});

test('the workflow uses the shared check contract and separates read/package/ref permissions', () => {
    const workflow = yaml.load(readFileSync(join(root, '.github/workflows/publish-images.yml'), 'utf8'));
    assert.deepEqual(Object.keys(workflow.on), ['workflow_run']);
    assert.deepEqual([...workflow.on.workflow_run.workflows].sort(), requiredWorkflows.workflows.map(item => item.name).sort());
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.deepEqual(workflow.jobs.validate.permissions, { actions: 'read', contents: 'read' });
    assert.deepEqual(workflow.jobs.publish.permissions, { actions: 'read', contents: 'read', packages: 'write' });
    assert.deepEqual(workflow.jobs.record.permissions, { actions: 'read', contents: 'write', packages: 'read' });
    for (const job of Object.values(workflow.jobs)) {
        for (const step of job.steps) {
            if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/u);
            if (step.uses?.startsWith('actions/checkout@') && step.with.path !== 'candidate') assert.equal(step.with.ref, '${{ github.sha }}');
            if (step.with?.path === 'candidate') assert.equal(step.with['persist-credentials'], false);
            if (step.with?.script) assert.ok(!step.with.script.includes('/candidate/scripts/'));
        }
    }
    const build = workflow.jobs.publish.steps.find(step => step.uses?.startsWith('docker/build-push-action@'));
    assert.equal(build.with.context, '${{ steps.context.outputs.directory }}');
    assert.equal(build.with.target, 'prod');
});
