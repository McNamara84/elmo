import { execFileSync, spawnSync } from 'node:child_process';

export const syncBranch = 'automation/sync-main-to-dev';
const marker = '<!-- elmo-main-dev-sync -->';
const armed = '<!-- auto-merge-armed -->';
const repositoryPaused = '<!-- auto-merge-paused-by-repository -->';
const conflict = '<!-- elmo-sync-conflict -->';
const completed = '<!-- sync-completed -->';
const shaPattern = /^[a-f0-9]{40}$/u;

export function syncHeld(pr) {
    return Boolean(pr.draft || pr.labels?.some(label => label.name === 'sync:hold')
        || (pr.body?.includes(armed) && !pr.auto_merge && !pr.body.includes(repositoryPaused) && !pr.body.includes(conflict)));
}

async function disableSyncMerge(github, repo, pr, resumable = false) {
    let body = pr.body;
    if (pr.auto_merge) {
        await github.graphql('mutation($id: ID!) { disablePullRequestAutoMerge(input: {pullRequestId: $id}) { clientMutationId } }', { id: pr.node_id });
        if (!body.includes(armed)) body += `\n${armed}`;
        if (resumable && !body.includes(repositoryPaused)) body += `\n${repositoryPaused}`;
    }
    if (!resumable) body = body.replaceAll(`\n${repositoryPaused}`, '').replaceAll(`\n${conflict}`, '');
    if (body !== pr.body) await github.rest.pulls.update({ ...repo, pull_number: pr.number, body });
}

export async function enableSyncMerge(github, repo, pr) {
    try {
        await github.graphql('mutation($id: ID!) { enablePullRequestAutoMerge(input: {pullRequestId: $id, mergeMethod: MERGE}) { clientMutationId } }', { id: pr.node_id });
        return false;
    } catch (error) {
        // GitHub rejects enabling auto-merge for some already mergeable PRs.
        // Merge only this exact approved head with successful CI; GitHub still
        // enforces branch rules. There is no review or administrator bypass.
        const { node } = await github.graphql(`query($id: ID!) {
            node(id: $id) { ... on PullRequest {
                state headRefOid mergeStateStatus reviewDecision
                commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
            } }
        }`, { id: pr.node_id });
        if (node?.state !== 'OPEN' || node.headRefOid !== pr.head.sha || node.mergeStateStatus !== 'CLEAN'
            || node.reviewDecision !== 'APPROVED' || node.commits?.nodes[0]?.commit.statusCheckRollup?.state !== 'SUCCESS') throw error;
        const { data } = await github.rest.pulls.merge({ ...repo, pull_number: pr.number, sha: node.headRefOid, merge_method: 'merge' });
        if (!data.merged) throw new Error(`Synchronization PR #${pr.number} could not merge: ${data.message}`, { cause: error });
        return true;
    }
}

/** Merge trees, not checked-out candidate code: hooks and custom merge drivers
 * from the integration tree are never installed in the trusted worktree. */
export function createSyncGit(cwd = process.cwd()) {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0',
        GIT_AUTHOR_NAME: 'ELMO branch sync', GIT_AUTHOR_EMAIL: 'elmo-branch-sync@users.noreply.github.com',
        GIT_COMMITTER_NAME: 'ELMO branch sync', GIT_COMMITTER_EMAIL: 'elmo-branch-sync@users.noreply.github.com' };
    const attempt = args => {
        const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8', env, maxBuffer: 16 * 1024 * 1024 });
        if (result.error) throw result.error;
        return result;
    };
    const run = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
        cwd, encoding: 'utf8', env, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const validSha = sha => { if (typeof sha !== 'string' || sha.length !== 40 || !shaPattern.test(sha)) throw new Error('Invalid synchronization SHA.'); return sha; };
    const head = branch => {
        if (!['main', 'dev', syncBranch].includes(branch)) throw new Error('Unexpected synchronization branch.');
        const result = attempt(['ls-remote', '--exit-code', 'origin', `refs/heads/${branch}`]);
        if (result.status === 2) return undefined;
        if (result.status !== 0) throw new Error(`Cannot read synchronization ref: ${branch}`);
        const [sha, ref] = result.stdout.trim().split(/\s+/u);
        if (ref !== `refs/heads/${branch}`) throw new Error('Unexpected synchronization ref result.');
        return validSha(sha);
    };
    return {
        run, head,
        fetch: sha => run('fetch', '--quiet', '--no-tags', 'origin', validSha(sha)),
        contains: (base, commit) => {
            const result = attempt(['merge-base', '--is-ancestor', validSha(base), validSha(commit)]);
            if (![0, 1].includes(result.status)) throw new Error('Cannot compare synchronization history.');
            return result.status === 0;
        },
        merge: (base, commit) => {
            const result = attempt(['merge-tree', '--write-tree', validSha(base), validSha(commit)]);
            if (![0, 1].includes(result.status)) throw new Error('Cannot prepare synchronization merge.');
            return result.status === 0 ? validSha(result.stdout.split('\n')[0].trim()) : null;
        },
        commit: (tree, dev, main) => run('-c', 'commit.gpgSign=false', 'commit-tree', validSha(tree), '-p', validSha(dev), '-p', validSha(main),
            '-m', `Synchronize main ${main} into dev ${dev}`),
        push: (next, previous) => {
            validSha(next); if (previous) validSha(previous);
            if (head(syncBranch) !== previous) return false;
            const result = attempt(['push', '--quiet', `--force-with-lease=refs/heads/${syncBranch}:${previous ?? ''}`, 'origin', `${next}:refs/heads/${syncBranch}`]);
            if (result.status === 0) return true;
            if (head(syncBranch) !== previous) return false;
            throw new Error('Cannot update synchronization integration branch.');
        },
    };
}

export async function reconcileSync({ github, repo, git = createSyncGit(), core, paused = false }) {
    const notice = message => { core.notice(message); return { message }; };
    const settings = (await github.rest.repos.get(repo)).data;
    if (`${repo.owner}/${repo.repo}` !== 'McNamara84/elmo' || settings.full_name !== 'McNamara84/elmo' || settings.default_branch !== 'main') {
        throw new Error('Synchronization is restricted to McNamara84/elmo with main as default branch.');
    }
    const assertManaged = pr => {
        if (!pr.body?.includes(marker) || pr.head?.ref !== syncBranch || pr.base?.ref !== 'dev'
            || pr.head.repo?.id !== settings.id || pr.base.repo?.id !== settings.id) throw new Error('Unmanaged synchronization PR or repository.');
    };
    const list = state => github.paginate(github.rest.pulls.list, {
        ...repo, state, base: 'dev', head: `${repo.owner}:${syncBranch}`, per_page: 100,
    });
    const prs = await list('open');
    if (prs.length > 1) throw new Error('More than one synchronization PR exists.');
    let pr = prs[0];
    if (pr) assertManaged(pr);
    if (paused) {
        if (pr) await disableSyncMerge(github, repo, pr, !syncHeld(pr));
        return notice('Synchronization paused by SYNC_MAIN_TO_DEV_PAUSED; managed auto-merge is disabled.');
    }
    if (pr && syncHeld(pr)) {
        await disableSyncMerge(github, repo, pr);
        return notice(`Synchronization PR #${pr.number} is on hold. Remove sync:hold, mark ready and re-enable auto-merge to resume.`);
    }
    const branches = {};
    for (const branch of ['main', 'dev']) {
        try { branches[branch] = (await github.rest.repos.getBranch({ ...repo, branch })).data; }
        catch (error) { if (error.status === 404 && branch === 'dev') return notice('dev does not exist; create it deliberately before enabling synchronization.'); throw error; }
        if (!branches[branch].protected) throw new Error(`Protect ${branch} with required reviews and checks before enabling synchronization.`);
    }
    if (!settings.allow_auto_merge || !settings.allow_merge_commit) throw new Error('Enable auto-merge and merge commits in repository settings.');
    const main = git.head('main'), dev = git.head('dev'), oldHead = git.head(syncBranch);
    if (!main || !dev) throw new Error('Source branches disappeared during synchronization.');
    git.fetch(main); git.fetch(dev); if (oldHead) git.fetch(oldHead);
    if (git.contains(main, dev)) {
        if (pr) await github.rest.pulls.update({ ...repo, pull_number: pr.number, state: 'closed', body: `${pr.body}\n${completed}` });
        return notice('dev already includes main.');
    }
    if (!pr) {
        const closed = await list('closed');
        if (closed.some(item => item.body?.includes(marker) && !item.body.includes(completed) && !item.merged_at)) {
            return notice('A maintainer closed a synchronization PR. Reopen it to resume.');
        }
        if (oldHead && !closed.some(item => item.body?.includes(marker))) throw new Error('Existing integration branch is not owned by this synchronization.');
    }
    const sourcePair = `Source: ${main}\nTarget: ${dev}\n`;
    const unchanged = Boolean(pr?.body?.includes(sourcePair) && oldHead);
    let tree = git.merge(dev, main);
    // A maintainer may resolve a conflicting sync on a helper branch based on
    // dev and push it to the integration branch. Preserve that reviewed result.
    if (unchanged && git.contains(dev, oldHead) && git.contains(main, oldHead)) tree = git.run('rev-parse', `${oldHead}^{tree}`);
    const description = `${marker}\n\nSynchronize reviewed main changes into dev.\n\n${sourcePair}\n${tree
        ? 'Both histories are preserved. Required reviews and CI apply.'
        : 'Merge conflicts need resolution on a helper branch based on dev. Never merge dev into main to resolve this PR.'}\n\nChangelog conflicts require a deliberate resolution: preserve currentVersion, upcoming entries and editions.\n\nAdd \`sync:hold\`, mark draft or disable auto-merge to pause. Operational procedures belong in the internal wiki.\n`;
    if (pr) {
        pr = (await github.rest.pulls.get({ ...repo, pull_number: pr.number })).data;
        assertManaged(pr);
        if (pr.state !== 'open') return notice('Synchronization PR was closed during preparation; leaving it closed.');
        if (syncHeld(pr)) { await disableSyncMerge(github, repo, pr); return notice('Synchronization held during preparation.'); }
        if (pr.head.sha !== oldHead) return notice('Integration head changed during preparation; retry on the next reconciliation.');
    }
    let integrationHead = oldHead;
    if (!unchanged) {
        if (git.head('main') !== main || git.head('dev') !== dev) return notice('Branches advanced during preparation; retry on the next reconciliation.');
        const next = tree ? git.commit(tree, dev, main) : main;
        if (!git.push(next, oldHead)) return notice('Integration branch changed concurrently; retry on the next reconciliation.');
        integrationHead = next;
        if (pr) await github.rest.pulls.update({ ...repo, pull_number: pr.number, body: description });
    }
    if (!pr) pr = (await github.rest.pulls.create({ ...repo, head: syncBranch, base: 'dev', title: 'Sync main into dev', body: description })).data;
    pr = (await github.rest.pulls.get({ ...repo, pull_number: pr.number })).data;
    assertManaged(pr);
    if (pr.state !== 'open') return notice('Synchronization PR was closed; leaving it closed.');
    if (syncHeld(pr)) { await disableSyncMerge(github, repo, pr); return notice('Synchronization held before enabling auto-merge.'); }
    if (pr.head.sha !== integrationHead || git.head(syncBranch) !== integrationHead) return notice('Integration head changed before auto-merge; retry on the next reconciliation.');
    if (!tree) {
        if (pr.auto_merge) await github.graphql('mutation($id: ID!) { disablePullRequestAutoMerge(input: {pullRequestId: $id}) { clientMutationId } }', { id: pr.node_id });
        await github.rest.pulls.update({ ...repo, pull_number: pr.number, body: `${description}\n${conflict}` });
        throw new Error(`Synchronization PR #${pr.number} has merge conflicts; resolve on a dev-based helper branch.`);
    }
    if (!git.contains(dev, integrationHead) || !git.contains(main, integrationHead)) {
        await disableSyncMerge(github, repo, pr);
        throw new Error('Integration head does not preserve both source histories; resolve it deliberately.');
    }
    if (git.head('main') !== main || git.head('dev') !== dev) return notice('Branches advanced before auto-merge; retry on the next reconciliation.');
    if (!pr.auto_merge && await enableSyncMerge(github, repo, pr)) return notice(`Synchronization PR #${pr.number} merged after required reviews and CI.`);
    const enabledBody = `${description}\n${armed}`;
    if (pr.body !== enabledBody) await github.rest.pulls.update({ ...repo, pull_number: pr.number, body: enabledBody });
    return notice(`Synchronization PR #${pr.number}: auto-merge waits for required reviews and CI.`);
}
