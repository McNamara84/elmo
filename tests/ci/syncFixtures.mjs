import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSyncGit, reconcileSync, syncBranch } from '../../scripts/ci/syncMainToDev.mjs';
import { gitFixture } from './deploymentFixtures.mjs';

export const marker = '<!-- elmo-main-dev-sync -->';
export const armed = '<!-- auto-merge-armed -->';
export const repositoryPaused = '<!-- auto-merge-paused-by-repository -->';
export const conflict = '<!-- elmo-sync-conflict -->';
export const repo = { owner: 'McNamara84', repo: 'elmo' };

export function syncFixture(t, { conflicts = false } = {}) {
    const fixture = gitFixture(t);
    const commitFile = (branch, path, text) => {
        fixture.git(fixture.source, 'checkout', '--quiet', branch);
        writeFileSync(join(fixture.source, path), text);
        fixture.git(fixture.source, 'add', path);
        fixture.git(fixture.source, 'commit', '-m', `Change ${branch} ${path}`);
        fixture.git(fixture.source, 'push', 'origin', `HEAD:refs/heads/${branch}`);
        return fixture.git(fixture.source, 'rev-parse', 'HEAD');
    };
    fixture.git(fixture.source, 'branch', 'dev');
    const dev = commitFile('dev', conflicts ? 'json/changelog.json' : 'dev-feature.txt', conflicts ? '{"currentVersion":"3.0.0","releases":[]}' : 'Only on dev');
    const main = commitFile('main', conflicts ? 'json/changelog.json' : 'main-fix.txt', conflicts ? '{"currentVersion":"2.2.3","releases":[]}' : 'Only on main');
    const git = createSyncGit(fixture.automation);
    const settings = { id: 42, full_name: 'McNamara84/elmo', default_branch: 'main', allow_auto_merge: true, allow_merge_commit: true };
    const state = { settings, main, dev, open: [], closed: [], updates: [], created: 0, enables: 0, disables: 0, merges: [],
        branches: { main: { protected: true }, dev: { protected: true } }, enableError: null, fallback: null };
    const refresh = pr => {
        const value = structuredClone(pr);
        value.head.sha = git.head(syncBranch);
        return value;
    };
    const pulls = {
        list() {},
        create: async input => {
            state.created++;
            const pr = { number: 1, node_id: 'PR_1', state: 'open', draft: false, labels: [], auto_merge: null,
                title: input.title, body: input.body, head: { ref: syncBranch, repo: { id: 42 }, sha: git.head(syncBranch) }, base: { ref: 'dev', repo: { id: 42 } } };
            state.open.push(pr);
            return { data: refresh(pr) };
        },
        get: async ({ pull_number }) => ({ data: refresh([...state.open, ...state.closed].find(pr => pr.number === pull_number)) }),
        update: async input => {
            state.updates.push(input);
            const pr = [...state.open, ...state.closed].find(pr => pr.number === input.pull_number);
            for (const key of ['body', 'state']) if (Object.hasOwn(input, key)) pr[key] = input[key];
            return { data: refresh(pr) };
        },
        merge: async input => { state.merges.push(input); return { data: { merged: true } }; },
    };
    const github = {
        rest: { pulls, repos: {
            get: async () => ({ data: state.settings }),
            getBranch: async ({ branch }) => {
                if (!state.branches[branch]) throw Object.assign(new Error('Not found'), { status: 404 });
                return { data: state.branches[branch] };
            },
        } },
        paginate: async (_method, { state: status }) => (status === 'open' ? state.open : state.closed).filter(pr => pr.state === status).map(refresh),
        graphql: async (query, { id }) => {
            const pr = state.open.find(item => item.node_id === id);
            if (query.includes('disablePullRequestAutoMerge')) { state.disables++; pr.auto_merge = null; return {}; }
            if (query.includes('enablePullRequestAutoMerge')) {
                state.enables++; if (state.enableError) throw state.enableError;
                pr.auto_merge = { enabled_by: { login: 'elmo-sync[bot]' } }; return {};
            }
            return { node: state.fallback };
        },
    };
    const notices = [];
    const options = { github, repo, git, core: { notice: message => notices.push(message) } };
    return { ...fixture, commitFile, git, state, github, notices, options, run: extra => reconcileSync({ ...options, ...extra }) };
}
