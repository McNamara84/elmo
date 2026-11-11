import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assessSourceCandidate, readRepositoryFile, shaPattern } from './deploymentChecks.mjs';
import { readArtifact, sameArtifact, validateArtifact } from './deploymentArtifacts.mjs';

export const stableTagPattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?![\s\S])/u;
const signalPath = '.github/workflows/production-release-signal.yml';
const signalName = 'Production Release Signal';
const trustedSignal = readFileSync(new URL(`../../${signalPath}`, import.meta.url), 'utf8');
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const timestamp = value => typeof value === 'string' && value.length === 20
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value.replace('Z', '.000Z');

export function compareStableTags(left, right) {
    if (![left, right].every(value => typeof value === 'string' && stableTagPattern.test(value))) throw new Error('Expected stable vMAJOR.MINOR.PATCH tags.');
    const a = left.slice(1).split('.').map(BigInt), b = right.slice(1).split('.').map(BigInt);
    for (let index = 0; index < 3; index++) {
        if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
    }
    return 0;
}

export function validateRelease(release) {
    if (!release || !positiveInteger(release.id) || typeof release.tag !== 'string' || !stableTagPattern.test(release.tag)
        || typeof release.sha !== 'string' || release.sha.length !== 40 || !shaPattern.test(release.sha)
        || typeof release.tag_object_sha !== 'string' || release.tag_object_sha.length !== 40 || !shaPattern.test(release.tag_object_sha)
        || !timestamp(release.published_at)) throw new Error('Invalid immutable stable release selection.');
    return release;
}

function stableRelease(release) {
    return release?.draft === false && release.prerelease === false && positiveInteger(release.id)
        && typeof release.tag_name === 'string' && stableTagPattern.test(release.tag_name) && timestamp(release.published_at);
}

/** Read just one small JSON member; never extract a signal artifact into a checkout. */
export function decodeSignalArchive(data, execute = execFileSync) {
    const buffer = Buffer.from(data);
    if (!buffer.length || buffer.length > 1024 * 1024) throw new Error('Invalid release signal archive size.');
    const directory = mkdtempSync(join(tmpdir(), 'elmo-release-signal-'));
    const archive = join(directory, 'signal.zip');
    try {
        writeFileSync(archive, buffer);
        const run = args => execute('unzip', args, { encoding: 'utf8', maxBuffer: 65536, timeout: 10000 });
        if (run(['-Z1', archive]).trim() !== 'release-signal.json') throw new Error('Unexpected release signal archive members.');
        return JSON.parse(run(['-p', archive, 'release-signal.json']));
    } finally {
        rmSync(archive, { force: true });
        rmdirSync(directory);
    }
}

export async function readReleaseSignal({ github, repo, runId, runAttempt, decodeArchive = decodeSignalArchive }) {
    if (!positiveInteger(runId) || !positiveInteger(runAttempt)) throw new Error('Invalid release signal run selection.');
    const repository = (await github.rest.repos.get(repo)).data;
    const workflow = (await github.rest.actions.getWorkflow({ ...repo, workflow_id: 'production-release-signal.yml' })).data;
    const run = (await github.rest.actions.getWorkflowRun({ ...repo, run_id: runId })).data;
    const sameRepository = actual => actual?.id === repository.id && actual?.full_name?.toLowerCase() === repository.full_name.toLowerCase();
    if (repository.default_branch !== 'main' || repository.full_name.toLowerCase() !== `${repo.owner}/${repo.repo}`.toLowerCase()
        || workflow.path !== signalPath || workflow.name !== signalName || run.workflow_id !== workflow.id
        || run.id !== runId || run.path !== signalPath || run.name !== signalName || run.event !== 'release'
        || run.status !== 'completed' || run.conclusion !== 'success' || run.run_attempt !== runAttempt
        || !sameRepository(run.repository) || !sameRepository(run.head_repository)
        || typeof run.head_sha !== 'string' || run.head_sha.length !== 40 || !shaPattern.test(run.head_sha)) throw new Error('Invalid release signal provenance or attempt.');
    // A tag may contain its own workflow. Only this minimal, trusted definition
    // can attest to the original release ID/action, rather than arbitrary data.
    if (await readRepositoryFile(github, repo, signalPath, run.head_sha) !== trustedSignal) {
        throw new Error('Release signal workflow differs from the trusted minimal definition.');
    }
    const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, { ...repo, run_id: runId, per_page: 100 });
    const selected = artifacts.filter(item => item.name === `production-release-signal-${runAttempt}`);
    if (selected.length !== 1 || selected[0].expired || !positiveInteger(selected[0].id)
        || !positiveInteger(selected[0].size_in_bytes) || selected[0].size_in_bytes > 1024 * 1024
        || selected[0].workflow_run?.id !== runId || selected[0].workflow_run?.head_sha !== run.head_sha) {
        throw new Error('Missing, expired or ambiguous release signal artifact; rerun the original signal to renew it.');
    }
    const response = await github.rest.actions.downloadArtifact({ ...repo, artifact_id: selected[0].id, archive_format: 'zip' });
    const signal = decodeArchive(response.data);
    const release = signal?.release;
    if (signal?.schema !== 1 || signal.action !== 'published' || signal.repository_id !== repository.id
        || signal.repository !== repository.full_name || signal.run_id !== runId || signal.run_attempt !== runAttempt
        || signal.sha !== run.head_sha || signal.ref !== `refs/tags/${release?.tag}`
        || !positiveInteger(release?.id) || typeof release.tag !== 'string' || !stableTagPattern.test(release.tag)
        || release.draft !== false || release.prerelease !== false || !timestamp(release.published_at)) {
        throw new Error('Signal must identify the original published stable release and exact commit.');
    }
    const after = (await github.rest.actions.getWorkflowRun({ ...repo, run_id: runId })).data;
    if (after.run_attempt !== runAttempt || after.status !== 'completed' || after.conclusion !== 'success') {
        throw new Error('Release signal was superseded by another attempt.');
    }
    return signal;
}

export async function resolveReleaseTag(github, repo, tag) {
    if (typeof tag !== 'string' || !stableTagPattern.test(tag)) throw new Error('Invalid stable release tag.');
    const ref = (await github.rest.git.getRef({ ...repo, ref: `tags/${tag}` })).data;
    if (ref.ref !== `refs/tags/${tag}`) throw new Error('Unexpected release tag ref.');
    const tagObject = ref.object?.sha;
    let object = ref.object;
    for (let depth = 0; depth < 6; depth++) {
        if (typeof object?.sha !== 'string' || object.sha.length !== 40 || !shaPattern.test(object.sha)) throw new Error('Invalid release tag object.');
        if (object.type === 'commit') return { sha: object.sha, tag_object_sha: tagObject };
        if (object.type !== 'tag') throw new Error('Release tag does not resolve to a commit.');
        const annotated = (await github.rest.git.getTag({ ...repo, tag_sha: object.sha })).data;
        if (annotated.sha !== object.sha) throw new Error('Annotated tag identity mismatch.');
        object = annotated.object;
    }
    throw new Error('Release tag nesting exceeds the validation limit.');
}

export function validateReleaseChangelog(text, release) {
    const changelog = JSON.parse(text), version = release.tag.slice(1);
    const entries = changelog.releases?.filter(entry => entry.version === version) ?? [];
    const date = entries[0]?.date;
    if (changelog.currentVersion !== version || entries.length !== 1 || typeof date !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/u.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
        || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || date > release.published_at.slice(0, 10)) {
        throw new Error('Release currentVersion needs one matching changelog entry with a final, valid date by publication.');
    }
    return version;
}

/** Fully read-only; every call re-reads the release, tag, main checks and record. */
export async function assessProductionRelease({ github, repo, git, runId, runAttempt, expected, decodeArchive = decodeSignalArchive }) {
    const signal = await readReleaseSignal({ github, repo, runId, runAttempt, decodeArchive });
    const release = (await github.rest.repos.getRelease({ ...repo, release_id: signal.release.id })).data;
    const latest = (await github.rest.repos.getLatestRelease(repo)).data;
    const releases = await github.paginate(github.rest.repos.listReleases, { ...repo, per_page: 100 });
    if (!stableRelease(release) || !stableRelease(latest) || release.id !== signal.release.id
        || release.tag_name !== signal.release.tag || release.published_at !== signal.release.published_at
        || latest.id !== release.id || latest.tag_name !== release.tag_name || latest.published_at !== release.published_at
        || !releases.some(item => stableRelease(item) && item.id === release.id && item.tag_name === release.tag_name
            && item.published_at === release.published_at)
        || releases.some(item => stableRelease(item) && compareStableTags(item.tag_name, release.tag_name) > 0)) {
        throw new Error('Signalled release must still be GitHub Latest and the highest published stable version.');
    }
    const selected = validateRelease({ id: release.id, tag: release.tag_name, published_at: release.published_at,
        ...await resolveReleaseTag(github, repo, release.tag_name) });
    if (selected.sha !== signal.sha) throw new Error('Release tag moved away from the signalled commit.');
    const candidate = await assessSourceCandidate({ github, repo, branch: 'main', sha: selected.sha });
    if (!candidate.ready) throw new Error('All latest required main push checks and matrix jobs must succeed for this release SHA.');
    const changelog = await readRepositoryFile(github, repo, 'json/changelog.json', selected.sha);
    const version = validateReleaseChangelog(changelog, selected);
    const artifact = readArtifact(git, candidate.repository, 'main', selected.sha);
    if (!artifact) throw new Error(`No artifacts/main record exists for ${selected.sha}; publish the candidate first.`);
    validateArtifact(artifact.record, { repository: candidate.repository, branch: 'main', sha: selected.sha,
        version, database: candidate.database, platform: candidate.platform });
    if (candidate.version !== version) throw new Error('Release and image candidate versions differ.');
    if (expected && (!sameArtifact(expected.release, selected) || !sameArtifact(expected.artifact.record, artifact.record))) {
        throw new Error('Release, tag or recorded image changed after validation.');
    }
    // Keep the original immutable evidence commit if an unrelated record was appended.
    if (expected) {
        if (!shaPattern.test(expected.artifact.commit ?? '')) throw new Error('Invalid original artifact evidence commit.');
        git.fetch(expected.artifact.commit);
        const stored = git.file(expected.artifact.commit, `${selected.sha}.json`);
        if (stored === null || !sameArtifact(JSON.parse(stored), artifact.record)) throw new Error('Original artifact evidence changed.');
        artifact.commit = expected.artifact.commit;
    }
    return { release: selected, artifact, candidate };
}
