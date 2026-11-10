import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';

export const shaPattern = /^[a-f0-9]{40}$/u;
export const digestPattern = /^sha256:[a-f0-9]{64}$/u;
export const databasePattern = /^mariadb:[\w.-]+@sha256:[a-f0-9]{64}$/u;
export const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:[A-Za-z][\w.-]*|-[\w.-]+)?(?:\+[\w.-]+)?$/u;
export const platform = 'linux/amd64';
export const requiredWorkflows = JSON.parse(readFileSync(new URL('../../.github/required-workflows.json', import.meta.url), 'utf8'));

export async function readRepositoryFile(github, repo, path, ref) {
    const { data } = await github.rest.repos.getContent({ ...repo, path, ref });
    if (data.type !== 'file' || data.encoding !== 'base64') throw new Error(`Expected a UTF-8 repository file: ${path}`);
    return Buffer.from(data.content, 'base64').toString('utf8');
}

export function candidateMetadata(changelogText, stageText, prodText) {
    const changelog = JSON.parse(changelogText);
    const version = changelog.currentVersion;
    if (typeof version !== 'string' || version !== version.trim() || version.length > 128 || !versionPattern.test(version)
        || !Array.isArray(changelog.releases) || !changelog.releases.some(release => release.version === version)) {
        throw new Error('currentVersion must identify an existing changelog release.');
    }
    const stage = yaml.load(stageText);
    const prod = yaml.load(prodText);
    const database = stage?.services?.db?.image;
    if (typeof database !== 'string' || database !== database.trim() || !databasePattern.test(database)
        || database !== prod?.services?.db?.image) {
        throw new Error('Stage and Prod must use the same digest-pinned MariaDB image.');
    }
    return { version, database, platform };
}

function sameRepository(actual, expected) {
    return actual?.id === expected.id && actual?.full_name?.toLowerCase() === expected.full_name.toLowerCase();
}

function validSourceRun(run, repository, branch, sha, workflow) {
    return sameRepository(run.repository, repository) && sameRepository(run.head_repository, repository)
        && run.event === 'push' && run.head_branch === branch && run.head_sha === sha
        && run.workflow_id === workflow.id && run.path === workflow.path && run.name === workflow.name;
}

/** Read only: no branch, package, PR artifact, or caller-supplied conclusion is trusted. */
export async function assessCandidate({ github, repo, runId, policy = requiredWorkflows }) {
    if (!Number.isSafeInteger(Number(runId)) || Number(runId) < 1) throw new Error('Invalid triggering run ID.');
    const repository = (await github.rest.repos.get(repo)).data;
    if (repository.full_name.toLowerCase() !== `${repo.owner}/${repo.repo}`.toLowerCase()
        || repository.default_branch !== 'main') throw new Error('Expected the main default branch in this repository.');
    const signal = (await github.rest.actions.getWorkflowRun({ ...repo, run_id: Number(runId) })).data;
    const branch = signal.head_branch;
    const sha = signal.head_sha;
    if (!policy.sourceBranches.includes(branch) || typeof sha !== 'string' || sha.length !== 40 || !shaPattern.test(sha)
        || !sameRepository(signal.repository, repository) || !sameRepository(signal.head_repository, repository)
        || signal.event !== policy.validationEvent || signal.event !== 'push'
        || signal.status !== 'completed' || signal.conclusion !== 'success') {
        throw new Error('The signal must be a successful push check from this repository on main or dev.');
    }

    const workflows = [];
    for (const required of policy.workflows) {
        const workflow = (await github.rest.actions.getWorkflow({ ...repo, workflow_id: required.file })).data;
        if (workflow.path !== `.github/workflows/${required.file}` || workflow.name !== required.name) {
            throw new Error(`Required workflow identity changed: ${required.file}`);
        }
        workflows.push({ ...workflow, checks: required.checks });
    }
    const signalWorkflow = workflows.find(workflow => workflow.id === signal.workflow_id);
    if (!signalWorkflow || !validSourceRun(signal, repository, branch, sha, signalWorkflow)) {
        throw new Error('The signal does not belong to a required workflow.');
    }
    const head = (await github.rest.repos.getBranch({ ...repo, branch })).data.commit.sha;
    if (head !== sha) {
        const comparison = (await github.rest.repos.compareCommits({ ...repo, base: sha, head })).data;
        if (!['ahead', 'identical'].includes(comparison.status)) throw new Error('Candidate is not contained in its source branch.');
    }

    const checks = [];
    for (const workflow of workflows) {
        const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
            ...repo, workflow_id: workflow.id, branch, event: 'push', head_sha: sha, per_page: 100,
        });
        // A rerun of an older run cannot override a newer failed/missing attempt.
        const newest = runs.filter(run => run.head_sha === sha && run.head_branch === branch && run.event === 'push')
            .sort((left, right) => right.id - left.id)[0];
        let ready = false;
        let conclusion = newest?.conclusion ?? 'missing';
        if (newest) {
            const run = (await github.rest.actions.getWorkflowRun({ ...repo, run_id: newest.id })).data;
            if (!validSourceRun(run, repository, branch, sha, workflow)) throw new Error(`Invalid check provenance: ${workflow.name}`);
            conclusion = run.conclusion ?? run.status;
            if (run.status === 'completed' && run.conclusion === 'success') {
                const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
                    ...repo, run_id: run.id, filter: 'latest', per_page: 100,
                });
                const after = (await github.rest.actions.getWorkflowRun({ ...repo, run_id: run.id })).data;
                ready = jobs.length > 0 && jobs.every(job => job.status === 'completed' && job.conclusion === 'success'
                    && job.run_attempt === run.run_attempt)
                    && workflow.checks.every(name => jobs.filter(job => job.name === name).length === 1)
                    && after.run_attempt === run.run_attempt && after.status === 'completed' && after.conclusion === 'success';
                if (!ready) conclusion = 'incomplete, skipped, failed or superseded jobs';
            }
        }
        checks.push({ name: workflow.name, ready, conclusion, url: newest?.html_url ?? '' });
    }
    const [changelog, stage, prod] = await Promise.all([
        readRepositoryFile(github, repo, 'json/changelog.json', sha),
        readRepositoryFile(github, repo, 'docker-compose.stage.yml', sha),
        readRepositoryFile(github, repo, 'docker-compose.prod.yml', sha),
    ]);
    return {
        repository: repository.full_name, branch, sha, current: head === sha,
        ready: checks.every(check => check.ready), checks,
        image: `ghcr.io/${repo.owner.toLowerCase()}/elmo-web`,
        ...candidateMetadata(changelog, stage, prod),
    };
}

export function requireReadyCandidate(candidate, expected) {
    if (!candidate.ready) throw new Error('All latest required push workflows and matrix jobs must succeed.');
    for (const key of ['branch', 'sha', 'version', 'database', 'platform']) {
        if (expected[key] !== candidate[key]) throw new Error(`Validated candidate changed: ${key}`);
    }
}

export async function candidateSummary(core, candidate) {
    await core.summary.addHeading(`Image candidate: ${candidate.branch} ${candidate.sha}`)
        .addTable([
            [{ data: 'Workflow', header: true }, { data: 'Result', header: true }],
            ...candidate.checks.map(check => [check.name, check.ready ? 'success' : check.conclusion]),
        ]).write();
}
