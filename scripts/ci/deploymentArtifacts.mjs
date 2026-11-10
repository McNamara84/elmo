import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { databasePattern, digestPattern, platform, shaPattern, versionPattern } from './deploymentChecks.mjs';

export function validateArtifact(record, expected = {}) {
    if (!record || record.schema !== 1 || typeof record.repository !== 'string'
        || record.repository !== record.repository.trim() || !/^[\w.-]+\/elmo$/u.test(record.repository)
        || !['main', 'dev'].includes(record.branch) || typeof record.sha !== 'string' || record.sha.length !== 40 || !shaPattern.test(record.sha)
        || typeof record.version !== 'string' || record.version !== record.version.trim() || record.version.length > 128
        || !versionPattern.test(record.version) || record.platform !== platform
        || typeof record.images?.mariadb !== 'string' || record.images.mariadb !== record.images.mariadb.trim()
        || !databasePattern.test(record.images.mariadb)) throw new Error('Invalid deployment artifact record.');
    const image = `ghcr.io/${record.repository.split('/')[0].toLowerCase()}/elmo-web@`;
    if (typeof record.images?.web !== 'string' || record.images.web !== record.images.web.trim() || !record.images.web.startsWith(image)
        || !digestPattern.test(record.images.web.slice(image.length))) throw new Error('Invalid immutable web image reference.');
    for (const [key, value] of Object.entries(expected)) {
        const actual = key === 'database' ? record.images.mariadb : record[key];
        if (value !== actual) throw new Error(`Artifact does not match candidate: ${key}`);
    }
    return record;
}

/** Only plumbing commands run here; no candidate checkout, hooks, or shell code. */
export function gitRepository(cwd = process.cwd()) {
    const environment = {
        ...process.env, GIT_TERMINAL_PROMPT: '0',
        GIT_AUTHOR_NAME: 'github-actions[bot]', GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
        GIT_COMMITTER_NAME: 'github-actions[bot]', GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    };
    const run = (args, options = {}) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
        cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: environment, ...options,
    });
    const attempt = args => {
        const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8', env: environment });
        if (result.error) throw result.error;
        return result;
    };
    const head = ref => {
        const result = attempt(['ls-remote', '--exit-code', 'origin', ref]);
        if (result.status === 2) return undefined;
        if (result.status !== 0) throw new Error(`Cannot read ${ref}: ${result.stderr}`);
        const rows = result.stdout.trim().split('\n');
        const [sha, name] = rows[0].split(/\s+/u);
        if (rows.length !== 1 || name !== ref || !shaPattern.test(sha)) throw new Error(`Invalid remote ref: ${ref}`);
        return sha;
    };
    const fetch = sha => {
        if (!shaPattern.test(sha)) throw new Error('Invalid Git source SHA.');
        run(['fetch', '--quiet', '--no-tags', 'origin', sha]);
        if (run(['cat-file', '-t', sha]).trim() !== 'commit') throw new Error('Expected a source commit.');
    };
    const file = (sha, path) => {
        const entry = run(['ls-tree', '-z', sha, '--', path]);
        if (!entry) return null;
        const match = entry.match(/^100644 blob ([a-f0-9]{40})\t[^\0]+\0$/u);
        if (!match) throw new Error(`Expected a regular deployment file: ${path}`);
        return run(['cat-file', 'blob', match[1]]);
    };
    const ancestor = (base, commit) => {
        const result = attempt(['merge-base', '--is-ancestor', base, commit]);
        if (![0, 1].includes(result.status)) throw new Error('Cannot validate deployment history.');
        return result.status === 0;
    };
    const commit = ({ base, files, parents, message }) => {
        const directory = mkdtempSync(join(tmpdir(), 'elmo-git-index-'));
        const index = join(directory, 'index');
        const env = { ...environment, GIT_INDEX_FILE: index };
        const indexed = (args, input) => run(args, { env, input });
        try {
            indexed(base ? ['read-tree', base] : ['read-tree', '--empty']);
            for (const [path, content] of Object.entries(files)) {
                if (path.startsWith('/') || path.split('/').includes('..') || /[\0\r\n]/u.test(path)) throw new Error('Invalid deployment path.');
                const blob = indexed(['hash-object', '-w', '--stdin'], content).trim();
                indexed(['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`]);
            }
            const tree = indexed(['write-tree']).trim();
            return indexed(['-c', 'commit.gpgSign=false', 'commit-tree', tree,
                ...[...new Set(parents.filter(Boolean))].flatMap(parent => ['-p', parent]), '-m', message]).trim();
        } finally {
            rmSync(index, { force: true });
            rmSync(`${index}.lock`, { force: true });
            rmdirSync(directory);
        }
    };
    const push = (ref, sha, previous) => {
        if (!/^refs\/heads\/(?:artifacts\/(?:main|dev)|deploy\/stage)$/u.test(ref)) throw new Error('Not an AP 3 machine branch.');
        if (previous && !ancestor(previous, sha)) throw new Error('Refusing to rewrite deployment history.');
        if (head(ref) !== previous) return false;
        const result = attempt(['push', '--quiet', `--force-with-lease=${ref}:${previous ?? ''}`, 'origin', `${sha}:${ref}`]);
        if (result.status === 0) return true;
        if (head(ref) !== previous) return false; // A competing writer won; reconcile its state.
        throw new Error(`Cannot update ${ref}: ${result.stderr}`);
    };
    return { run, head, fetch, file, ancestor, commit, push };
}

function selection(repository, branch, sha) {
    if (!['main', 'dev'].includes(branch) || !shaPattern.test(sha ?? '')) throw new Error('Invalid artifact selection.');
    return { repository, branch, sha };
}

function artifactSnapshot(git, repository, branch, sha) {
    const expected = selection(repository, branch, sha);
    const commit = git.head(`refs/heads/artifacts/${branch}`);
    if (!commit) return { record: null, commit: undefined };
    git.fetch(commit);
    const entries = git.run(['ls-tree', '-z', commit]).split('\0').filter(Boolean);
    if (!entries.length || !entries.every(entry => /^100644 blob [a-f0-9]{40}\t[a-f0-9]{40}\.json$/u.test(entry))) {
        throw new Error('Existing artifact branch contains files not owned by this automation.');
    }
    const text = git.file(commit, `${sha}.json`);
    return { record: text === null ? null : validateArtifact(JSON.parse(text), expected), commit };
}

export function readArtifact(git, repository, branch, sha) {
    const snapshot = artifactSnapshot(git, repository, branch, sha);
    return snapshot.record ? snapshot : null;
}

export function publishArtifact(git, record) {
    validateArtifact(record);
    git.fetch(record.sha);
    const ref = `refs/heads/artifacts/${record.branch}`;
    for (let attempt = 0; attempt < 3; attempt++) {
        const previous = artifactSnapshot(git, record.repository, record.branch, record.sha);
        if (previous.record) {
            // Concurrent builds may differ; the first scanned image always wins.
            validateArtifact(previous.record, {
                ...selection(record.repository, record.branch, record.sha),
                version: record.version, database: record.images.mariadb, platform: record.platform,
            });
            return { ...previous, created: false };
        }
        const commit = git.commit({
            base: previous.commit, parents: [previous.commit, record.sha],
            files: { [`${record.sha}.json`]: `${JSON.stringify(record, null, 2)}\n` },
            message: `Record ${record.branch} image from ${record.sha}`,
        });
        if (git.push(ref, commit, previous.commit)) return { record, commit, created: true };
    }
    throw new Error('Artifact branch kept changing; retry publication.');
}

export function sameArtifact(left, right) {
    return isDeepStrictEqual(left, right);
}
