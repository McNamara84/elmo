import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { compareStableTags, readReleaseSignal, resolveReleaseTag, stableTagPattern, validateRelease } from './productionRelease.mjs';

export const gitlabTarget = 'https://git.gfz-potsdam.de/data_services/elmo.git';
const shaPattern = /^[a-f0-9]{40}$/u;
const stable = release => release?.draft === false && release.prerelease === false && Number.isSafeInteger(release.id)
    && release.id > 0 && typeof release.tag_name === 'string' && stableTagPattern.test(release.tag_name);

/** The original signal is data only; tag code never gets mirror credentials. */
export async function selectMirrorRelease({ github, repo, event, runId, runAttempt, expected, decodeArchive }) {
    const settings = (await github.rest.repos.get(repo)).data;
    if (`${repo.owner}/${repo.repo}` !== 'McNamara84/elmo' || settings.full_name !== 'McNamara84/elmo' || settings.default_branch !== 'main') {
        throw new Error('Mirror is restricted to McNamara84/elmo with main as default branch.');
    }
    let signal, release;
    if (event === 'workflow_run') {
        signal = await readReleaseSignal({ github, repo, runId, runAttempt, decodeArchive });
        release = (await github.rest.repos.getRelease({ ...repo, release_id: signal.release.id })).data;
        if (release.id !== signal.release.id || release.tag_name !== signal.release.tag || release.published_at !== signal.release.published_at) {
            throw new Error('Mirror release differs from the original publication signal.');
        }
    } else if (event === 'workflow_dispatch') {
        release = (await github.rest.repos.getLatestRelease(repo)).data;
    } else throw new Error('Mirror requires a published release signal or a deliberate manual stable-release sync.');
    if (!stable(release)) throw new Error('Mirror requires a published stable vMAJOR.MINOR.PATCH release.');
    const latest = (await github.rest.repos.getLatestRelease(repo)).data;
    const releases = await github.paginate(github.rest.repos.listReleases, { ...repo, per_page: 100 });
    if (!releases.some(item => stable(item) && item.id === release.id && item.tag_name === release.tag_name && item.published_at === release.published_at)) {
        throw new Error('Mirror release is missing from the published stable-release list.');
    }
    // Never substitute a newer Latest for an older signal or rewind GitLab main.
    if (!stable(latest) || latest.id !== release.id || latest.tag_name !== release.tag_name || latest.published_at !== release.published_at
        || releases.some(item => stable(item) && compareStableTags(item.tag_name, release.tag_name) > 0)) {
        return { status: 'superseded', tag: release.tag_name };
    }
    const selected = validateRelease({ id: release.id, tag: release.tag_name, published_at: release.published_at,
        ...await resolveReleaseTag(github, repo, release.tag_name) });
    if (signal && signal.sha !== selected.sha) throw new Error('Mirror tag moved away from the signalled commit.');
    const main = (await github.rest.repos.getBranch({ ...repo, branch: 'main' })).data.commit.sha;
    if (main !== selected.sha) {
        const comparison = (await github.rest.repos.compareCommits({ ...repo, base: selected.sha, head: main })).data;
        if (!['ahead', 'identical'].includes(comparison.status)) throw new Error('Mirror release is outside main history.');
    }
    if (expected && !isDeepStrictEqual(expected.release, selected)) throw new Error('Mirror release or tag changed after selection.');
    return { status: 'ready', repository: settings.full_name, release: selected };
}

export function createMirrorGit(cwd, target = gitlabTarget, environment = process.env) {
    const env = { ...environment, GIT_TERMINAL_PROMPT: '0' };
    const run = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', ...args], {
        cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const snapshot = () => {
        const output = run('ls-remote', target, 'refs/heads/main', 'refs/tags/*');
        const tags = {};
        let head;
        for (const row of output.split('\n').filter(Boolean)) {
            const [sha, ref] = row.split(/\s+/u);
            if (typeof sha !== 'string' || sha.length !== 40 || !shaPattern.test(sha)) throw new Error('Invalid GitLab ref result.');
            if (ref === 'refs/heads/main') { head = sha; continue; }
            const match = ref.match(/^refs\/tags\/(v\d+\.\d+\.\d+)(\^\{\})?$/u);
            if (!match || !stableTagPattern.test(match[1])) continue;
            const tag = tags[match[1]] ??= {};
            tag[match[2] ? 'commit' : 'object'] = sha;
        }
        for (const tag of Object.values(tags)) tag.commit ??= tag.object;
        return { head, tags };
    };
    return {
        run, snapshot,
        fetch: release => {
            validateRelease(release);
            run('fetch', '--quiet', '--no-tags', 'origin', release.tag_object_sha);
            if (run('rev-parse', `${release.tag_object_sha}^{commit}`) !== release.sha) throw new Error('Fetched mirror tag does not match its recorded commit.');
        },
        push: (release, previous) => {
            validateRelease(release);
            if (!isDeepStrictEqual(snapshot(), previous)) return false;
            // Atomic explicit refs, no broad mirror or credential in the URL.
            const args = ['push', '--quiet', '--atomic', `--force-with-lease=refs/heads/main:${previous.head ?? ''}`,
                `--force-with-lease=refs/tags/${release.tag}:${previous.tags[release.tag]?.object ?? ''}`,
                target, `${release.tag_object_sha}:refs/tags/${release.tag}`, `${release.sha}:refs/heads/main`];
            const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'credential.helper=', ...args], { cwd, env, encoding: 'utf8' });
            if (result.error) throw result.error;
            if (result.status === 0) return true;
            if (!isDeepStrictEqual(snapshot(), previous)) return false;
            throw new Error('GitLab atomic update failed; check access and atomic-push support.');
        },
    };
}

export async function mirrorRelease(git, selection, revalidate) {
    if (selection.status !== 'ready' || selection.repository !== 'McNamara84/elmo' || typeof revalidate !== 'function') {
        throw new Error('An exact validated stable release and a fresh validation callback are required.');
    }
    const release = validateRelease(selection.release);
    git.fetch(release);
    for (let attempt = 0; attempt < 3; attempt++) {
        const fresh = await revalidate();
        if (fresh.status === 'superseded') return { status: 'superseded' };
        if (fresh.status !== 'ready' || !isDeepStrictEqual(fresh.release, release)) throw new Error('Mirror release changed before writing.');
        const previous = git.snapshot();
        if (previous.tags[release.tag] && previous.tags[release.tag].object !== release.tag_object_sha) {
            throw new Error('Existing GitLab release tag differs; tags must never be moved.');
        }
        for (const tag of Object.keys(previous.tags)) {
            if (compareStableTags(tag, release.tag) > 0) throw new Error('Refusing to replace a higher stable GitLab release with an older version.');
        }
        if (previous.head && !Object.values(previous.tags).some(tag => tag.commit === previous.head)) {
            throw new Error('GitLab main contains an unrecognized or manually changed state; inspect it before mirroring.');
        }
        if (previous.head === release.sha && previous.tags[release.tag]?.object === release.tag_object_sha) return { status: 'unchanged' };
        const beforePush = await revalidate();
        if (beforePush.status === 'superseded') return { status: 'superseded' };
        if (beforePush.status !== 'ready' || !isDeepStrictEqual(beforePush.release, release)) throw new Error('Mirror tag changed immediately before push.');
        if (git.push(release, previous)) return { status: 'updated' };
    }
    throw new Error('GitLab refs kept changing; rerun the mirror.');
}

/** The temporary askpass script contains no credential value. */
export async function withMirrorCredentials(token, action) {
    if (typeof token !== 'string' || !token) throw new Error('GITLAB_TOKEN is required for the release mirror.');
    const directory = mkdtempSync(join(tmpdir(), 'elmo-mirror-auth-'));
    const script = join(directory, 'askpass.sh');
    try {
        writeFileSync(script, '#!/bin/sh\ncase "$1" in\n*Username*) printf "%s\\n" oauth2 ;;\n*Password*) printf "%s\\n" "$GITLAB_TOKEN" ;;\n*) exit 1 ;;\nesac\n', { mode: 0o700 });
        return await action({ ...process.env, GIT_ASKPASS: script, GITLAB_TOKEN: token, GIT_TERMINAL_PROMPT: '0' });
    } finally { rmSync(script, { force: true }); rmdirSync(directory); }
}
