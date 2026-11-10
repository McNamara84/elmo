import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidateMetadata } from '../../scripts/ci/deploymentChecks.mjs';

export const root = fileURLToPath(new URL('../..', import.meta.url));
export const stage = readFileSync(join(root, 'docker-compose.stage.yml'), 'utf8');
export const prod = readFileSync(join(root, 'docker-compose.prod.yml'), 'utf8');
export const changelog = JSON.stringify({ currentVersion: '2.2.1', releases: [{ version: '2.2.2', date: '2026-XX-XX' }, { version: '2.2.1', date: '2026-11-10' }] });
export const metadata = candidateMetadata(changelog, stage, prod);
export const repository = 'McNamara84/elmo';
export const digest = letter => `sha256:${letter.repeat(64)}`;

export function temporaryDirectory(t) {
    const base = resolve(root, '.tmp', 'ap3', 'tests');
    mkdirSync(base, { recursive: true });
    const directory = mkdtempSync(join(base, 'case-'));
    t.after(() => {
        const target = resolve(directory);
        if (dirname(target) !== base || !target.startsWith(`${base}${sep}case-`)) throw new Error('Unsafe test cleanup path.');
        rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });
    return directory;
}

export function record(sha, branch = 'dev', web = digest('a')) {
    return { schema: 1, repository, branch, sha, version: metadata.version, platform: metadata.platform,
        images: { web: `ghcr.io/mcnamara84/elmo-web@${web}`, mariadb: metadata.database } };
}

export function gitFixture(t) {
    const directory = temporaryDirectory(t);
    const remote = join(directory, 'remote.git');
    const source = join(directory, 'source');
    const automation = join(directory, 'automation');
    const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    git(directory, 'init', '--bare', '--initial-branch=main', remote);
    git(directory, 'init', '--initial-branch=main', source);
    git(source, 'config', 'user.name', 'Deployment tests');
    git(source, 'config', 'user.email', 'deployment-tests@example.invalid');
    git(source, 'config', 'commit.gpgSign', 'false');
    git(source, 'config', 'core.hooksPath', join(directory, 'no-hooks'));
    mkdirSync(join(source, 'json'));
    writeFileSync(join(source, 'docker-compose.stage.yml'), stage);
    writeFileSync(join(source, 'docker-compose.prod.yml'), prod);
    writeFileSync(join(source, 'json', 'changelog.json'), changelog);
    git(source, 'add', '.');
    git(source, 'commit', '-m', 'Initial candidate');
    const sha = git(source, 'rev-parse', 'HEAD');
    git(source, 'remote', 'add', 'origin', remote);
    git(source, 'push', 'origin', 'HEAD:refs/heads/main', 'HEAD:refs/heads/dev');
    git(directory, 'clone', '--quiet', remote, automation);
    const advance = (branch = 'dev') => {
        writeFileSync(join(source, 'change.txt'), `${Date.now()}-${Math.random()}`);
        git(source, 'add', 'change.txt');
        git(source, 'commit', '-m', 'Next candidate');
        git(source, 'push', 'origin', `HEAD:refs/heads/${branch}`);
        return git(source, 'rev-parse', 'HEAD');
    };
    return { directory, remote, source, automation, sha, git, advance };
}
