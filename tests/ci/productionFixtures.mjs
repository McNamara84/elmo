import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requiredWorkflows } from '../../scripts/ci/deploymentChecks.mjs';
import { gitRepository, publishArtifact } from '../../scripts/ci/deploymentArtifacts.mjs';
import { changelog, gitFixture, prod, record, repository, root, stage } from './deploymentFixtures.mjs';

export const repo = { owner: 'McNamara84', repo: 'elmo' };
export const trustedSignal = readFileSync(join(root, '.github/workflows/production-release-signal.yml'), 'utf8');
export const releaseFor = (sha, version = '2.2.1', id = 10) => ({ id, tag: `v${version}`, sha, tag_object_sha: sha, published_at: '2026-11-10T10:00:00Z' });

export function productionFixture(t) {
    const fixture = gitFixture(t);
    const git = gitRepository(fixture.automation, { productionOnly: true });
    const publicationGit = gitRepository(fixture.source);
    const artifact = publishArtifact(publicationGit, record(fixture.sha, 'main'));
    const selection = { release: releaseFor(fixture.sha), artifact };
    const promote = async () => {};
    const nextRelease = (version = '2.2.2', id = 11) => {
        const log = JSON.parse(changelog);
        log.currentVersion = version;
        log.releases = [{ version, date: '2026-11-10' }];
        writeFileSync(join(fixture.source, 'json/changelog.json'), JSON.stringify(log));
        fixture.git(fixture.source, 'add', 'json/changelog.json');
        fixture.git(fixture.source, 'commit', '-m', `Prepare ${version}`);
        const sha = fixture.git(fixture.source, 'rev-parse', 'HEAD');
        fixture.git(fixture.source, 'push', 'origin', 'HEAD:refs/heads/main');
        const artifact = publishArtifact(publicationGit, { ...record(sha, 'main'), version });
        return { release: releaseFor(sha, version, id), artifact };
    };
    return { ...fixture, git, publicationGit, selection, promote, nextRelease };
}

export function releaseApiFixture(sha = 'a'.repeat(40)) {
    const repositoryData = { id: 42, full_name: repository, default_branch: 'main' };
    const workflow = { id: 7, name: 'Production Release Signal', path: '.github/workflows/production-release-signal.yml' };
    const run = { ...workflow, id: 200, workflow_id: 7, run_attempt: 1, event: 'release', head_sha: sha,
        repository: { ...repositoryData }, head_repository: { ...repositoryData }, status: 'completed', conclusion: 'success' };
    const release = { id: 10, tag_name: 'v2.2.1', published_at: '2026-11-10T10:00:00Z', draft: false, prerelease: false };
    const signal = { schema: 1, action: 'published', repository, repository_id: 42, run_id: 200, run_attempt: 1,
        sha, ref: 'refs/tags/v2.2.1', release: { id: release.id, tag: release.tag_name, published_at: release.published_at, draft: false, prerelease: false } };
    const artifacts = [{ id: 500, name: 'production-release-signal-1', expired: false, size_in_bytes: 400,
        workflow_run: { id: run.id, head_sha: sha } }];
    const workflows = requiredWorkflows.workflows.map((item, index) => ({ ...item, id: index + 1, path: `.github/workflows/${item.file}` }));
    const runs = workflows.map(item => ({ ...item, id: item.id + 100, workflow_id: item.id, run_attempt: 1, event: 'push',
        head_sha: sha, head_branch: 'main', repository: { ...repositoryData }, head_repository: { ...repositoryData }, status: 'completed', conclusion: 'success' }));
    const jobs = new Map(runs.map((item, index) => [item.id, workflows[index].checks.map(name => ({ name, status: 'completed', conclusion: 'success', run_attempt: 1 }))]));
    const state = { repository: repositoryData, workflow, run, release, signal, artifacts, workflows, runs, jobs,
        latest: { ...release }, releases: [{ ...release }], tag: { ref: 'refs/tags/v2.2.1', object: { type: 'commit', sha } },
        annotated: {}, head: sha, comparison: 'ahead', downloads: 0,
        files: { [workflow.path]: trustedSignal, 'json/changelog.json': changelog,
            'docker-compose.stage.yml': stage, 'docker-compose.prod.yml': prod } };
    const actions = {
        getWorkflow: async ({ workflow_id }) => ({ data: workflow_id === 'production-release-signal.yml' ? state.workflow : workflows.find(item => item.file === workflow_id) }),
        getWorkflowRun: async ({ run_id }) => ({ data: structuredClone(run_id === run.id ? state.run : runs.find(item => item.id === run_id)) }),
        downloadArtifact: async () => { state.downloads++; return { data: Buffer.from('test archive') }; },
        listWorkflowRunArtifacts() {}, listWorkflowRuns() {}, listJobsForWorkflowRun() {},
    };
    const repos = {
        get: async () => ({ data: state.repository }),
        getRelease: async ({ release_id }) => { if (release_id !== state.release.id) throw new Error('Release not found'); return { data: state.release }; },
        getLatestRelease: async () => ({ data: state.latest }),
        listReleases() {},
        getBranch: async () => ({ data: { commit: { sha: state.head } } }),
        compareCommits: async () => ({ data: { status: state.comparison } }),
        getContent: async ({ path, ref }) => {
            if (ref !== sha || !Object.hasOwn(state.files, path)) throw new Error('Missing exact source file');
            return { data: { type: 'file', encoding: 'base64', content: Buffer.from(state.files[path]).toString('base64') } };
        },
    };
    const github = { rest: { actions, repos, git: {
        getRef: async () => ({ data: state.tag }),
        getTag: async ({ tag_sha }) => ({ data: state.annotated[tag_sha] }),
    } }, paginate: async (method, options) => {
        if (method === actions.listWorkflowRunArtifacts) return state.artifacts;
        if (method === actions.listWorkflowRuns) return runs.filter(item => item.workflow_id === options.workflow_id
            && item.head_sha === options.head_sha && item.head_branch === options.branch && item.event === options.event);
        if (method === actions.listJobsForWorkflowRun) return state.jobs.get(options.run_id) ?? [];
        if (method === repos.listReleases) return state.releases;
        throw new Error('Unexpected pagination');
    } };
    // Read-only Git double: production deployment itself is exercised against
    // real local remotes in productionDeployment.test.mjs.
    const stored = record(sha, 'main');
    const git = { head: ref => ref === 'refs/heads/artifacts/main' ? 'b'.repeat(40) : undefined,
        fetch() {}, run: () => `100644 blob ${'c'.repeat(40)}\t${sha}.json\0`,
        file: () => JSON.stringify(stored) };
    return { state, github, git, stored, options: { github, repo, git, runId: 200, runAttempt: 1, decodeArchive: () => state.signal } };
}
