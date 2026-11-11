import * as yaml from 'js-yaml';
import { candidateMetadata, shaPattern } from './deploymentChecks.mjs';
import { sameArtifact, validateArtifact } from './deploymentArtifacts.mjs';
import { compareStableTags, validateRelease, validateReleaseChangelog } from './productionRelease.mjs';

const ref = 'refs/heads/deploy/prod';
const metadataPath = '.elmo-deployment.json';

export function renderProduction(source, record) {
    validateArtifact(record, { branch: 'main' });
    const owner = record.repository.split('/')[0].toLowerCase();
    const marker = `ghcr.io/${owner}/elmo-web:deployment-template`;
    const template = '${ELMO_PROD_WEB_IMAGE:-' + marker + '}';
    const resultImage = '${ELMO_PROD_WEB_IMAGE:-' + record.images.web + '}';
    const document = yaml.load(source);
    if (Object.keys(document?.services ?? {}).sort().join(',') !== 'db,web,web-msl') throw new Error('Unexpected or missing Production services.');
    if (document.services.db.image !== record.images.mariadb || document.services.db.build) throw new Error('Unexpected Production database image.');
    for (const name of ['web', 'web-msl']) {
        const service = document.services[name];
        if (service.image !== template || service.build || service.ports || service.pull_policy !== 'always') {
            throw new Error(`Unexpected Production image template or runtime contract: ${name}`);
        }
    }
    if (source.split(marker).length - 1 !== 2) throw new Error('Unexpected Production image marker count.');
    const rendered = source.replaceAll(marker, record.images.web);
    if (rendered.includes('deployment-template')) throw new Error('Unresolved Production deployment template.');
    const parsed = yaml.load(rendered);
    if (!['web', 'web-msl'].every(name => parsed.services[name].image === resultImage)) throw new Error('Production image digest mismatch.');
    return rendered;
}

function validateSelection(selection) {
    const release = validateRelease(selection.release), artifact = selection.artifact;
    validateArtifact(artifact.record, { branch: 'main', sha: release.sha, version: release.tag.slice(1) });
    if (!shaPattern.test(artifact.commit ?? '')) throw new Error('Expected immutable main artifact evidence.');
    return selection;
}

export function inspectProduction(git, selection) {
    const { release, artifact } = validateSelection(selection);
    const previous = git.head(ref);
    if (!previous) return { previous, unchanged: false };
    git.fetch(previous);
    const text = git.file(previous, metadataPath);
    if (text === null) throw new Error('Existing Production branch is not owned by this automation.');
    const deployed = JSON.parse(text);
    if (deployed.schema !== 1 || deployed.environment !== 'prod' || !shaPattern.test(deployed.artifact_commit ?? '')) {
        throw new Error('Invalid Production deployment metadata.');
    }
    validateRelease(deployed.release);
    validateArtifact(deployed.record, { repository: artifact.record.repository, branch: 'main',
        sha: deployed.release.sha, version: deployed.release.tag.slice(1) });
    const order = compareStableTags(release.tag, deployed.release.tag);
    if (order < 0) throw new Error('Release is older than the deployed stable version.');
    if (order === 0 && (!sameArtifact(deployed.release, release) || !sameArtifact(deployed.record, artifact.record))) {
        throw new Error('Refusing to replace a deployed stable version with a different release, source or image.');
    }
    return { previous, unchanged: order === 0 };
}

export async function updateProduction(git, selection, revalidate) {
    const { release, artifact } = validateSelection(selection), record = artifact.record;
    if (typeof revalidate !== 'function') throw new Error('A fresh release validation is required before Production writes.');
    git.fetch(artifact.commit);
    const stored = git.file(artifact.commit, `${record.sha}.json`);
    if (stored === null || !sameArtifact(JSON.parse(stored), record)) throw new Error('Artifact evidence does not contain the selected record.');
    git.fetch(record.sha);
    const source = Object.fromEntries(['docker-compose.stage.yml', 'docker-compose.prod.yml', 'json/changelog.json']
        .map(path => [path, git.file(record.sha, path)]));
    if (Object.values(source).includes(null)) throw new Error('Incomplete Production source.');
    const metadata = candidateMetadata(source['json/changelog.json'], source['docker-compose.stage.yml'], source['docker-compose.prod.yml']);
    validateArtifact(record, { version: metadata.version, database: metadata.database, platform: metadata.platform });
    validateReleaseChangelog(source['json/changelog.json'], release);
    const rendered = renderProduction(source['docker-compose.prod.yml'], record);
    for (let attempt = 0; attempt < 3; attempt++) {
        await revalidate();
        const { previous, unchanged } = inspectProduction(git, selection);
        if (unchanged) {
            if (git.file(previous, 'docker-compose.prod.yml') !== rendered) throw new Error('Production Compose differs from the recorded release.');
            return { status: 'unchanged', commit: previous };
        }
        const commit = git.commit({
            base: record.sha, parents: [previous, record.sha],
            files: {
                'docker-compose.prod.yml': rendered,
                [metadataPath]: `${JSON.stringify({ schema: 1, environment: 'prod', artifact_commit: artifact.commit, release, record }, null, 2)}\n`,
            },
            message: `Deploy Production ${release.tag} from ${record.sha}`,
        });
        // Recheck Latest, highest Semver, exact tag object, main ancestry and all
        // current CI attempts immediately before the compare-and-swap push.
        await revalidate();
        if (git.push(ref, commit, previous)) return { status: 'updated', commit };
    }
    throw new Error('Production branch kept changing; rerun this promotion.');
}
