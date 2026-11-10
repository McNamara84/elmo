import * as yaml from 'js-yaml';
import { candidateMetadata, shaPattern } from './deploymentChecks.mjs';
import { sameArtifact, validateArtifact } from './deploymentArtifacts.mjs';

const serviceNames = ['db', 'web', 'web-msl', 'web-igsn'];
const webNames = serviceNames.slice(1);
const metadataPath = '.elmo-deployment.json';

export function renderStage(source, record) {
    validateArtifact(record);
    if (record.branch !== 'dev') throw new Error('Only a dev artifact may deploy Stage.');
    const owner = record.repository.split('/')[0].toLowerCase();
    const marker = `ghcr.io/${owner}/elmo-web:deployment-template`;
    const template = '${ELMO_STAGE_WEB_IMAGE:-' + marker + '}';
    const resultImage = '${ELMO_STAGE_WEB_IMAGE:-' + record.images.web + '}';
    const document = yaml.load(source);
    if (Object.keys(document?.services ?? {}).sort().join(',') !== [...serviceNames].sort().join(',')) {
        throw new Error('Unexpected or missing Stage services.');
    }
    if (document.services.db.image !== record.images.mariadb || document.services.db.build) throw new Error('Unexpected Stage database image.');
    for (const name of webNames) {
        const service = document.services[name];
        if (service.image !== template || service.build || service.ports || service.pull_policy !== 'always') {
            throw new Error(`Unexpected Stage image template or runtime contract: ${name}`);
        }
    }
    if (source.split(marker).length - 1 !== webNames.length) throw new Error('Unexpected image marker count.');
    const rendered = source.replaceAll(marker, record.images.web);
    if (rendered.includes('deployment-template')) throw new Error('Unresolved deployment template.');
    const parsed = yaml.load(rendered);
    if (!webNames.every(name => parsed.services[name].image === resultImage)) throw new Error('Stage image digest mismatch.');
    return rendered;
}

export function updateStage(git, artifact) {
    const record = validateArtifact(artifact.record);
    if (record.branch !== 'dev' || !shaPattern.test(artifact.commit ?? '')) throw new Error('Expected an immutable dev artifact record.');
    git.fetch(artifact.commit);
    const stored = git.file(artifact.commit, `${record.sha}.json`);
    if (stored === null || !sameArtifact(JSON.parse(stored), record)) throw new Error('Artifact commit does not contain the selected record.');
    git.fetch(record.sha);
    const stage = git.file(record.sha, 'docker-compose.stage.yml');
    const prod = git.file(record.sha, 'docker-compose.prod.yml');
    const changelog = git.file(record.sha, 'json/changelog.json');
    if ([stage, prod, changelog].includes(null)) throw new Error('Incomplete candidate source.');
    const metadata = candidateMetadata(changelog, stage, prod);
    validateArtifact(record, { version: metadata.version, database: metadata.database, platform: metadata.platform });
    const rendered = renderStage(stage, record);
    const ref = 'refs/heads/deploy/stage';
    for (let attempt = 0; attempt < 3; attempt++) {
        if (git.head('refs/heads/dev') !== record.sha) return { status: 'stale' };
        const previous = git.head(ref);
        if (previous) {
            git.fetch(previous);
            const text = git.file(previous, metadataPath);
            if (text === null) throw new Error('Existing Stage branch is not owned by this automation.');
            const deployed = JSON.parse(text);
            if (deployed.schema !== 1 || deployed.environment !== 'stage' || !shaPattern.test(deployed.artifact_commit ?? '')) {
                throw new Error('Invalid Stage deployment metadata.');
            }
            validateArtifact(deployed.record, { repository: record.repository, branch: 'dev' });
            if (sameArtifact(deployed.record, record) && git.file(previous, 'docker-compose.stage.yml') === rendered) {
                return { status: 'unchanged', commit: previous };
            }
            if (deployed.record.sha === record.sha) throw new Error('Refusing to replace a deployment for the same source with different artifacts.');
        }
        const commit = git.commit({
            base: record.sha, parents: [previous, record.sha],
            files: {
                'docker-compose.stage.yml': rendered,
                [metadataPath]: `${JSON.stringify({ schema: 1, environment: 'stage', artifact_commit: artifact.commit, record }, null, 2)}\n`,
            },
            message: `Deploy Stage ${record.version} from ${record.sha}`,
        });
        if (git.head('refs/heads/dev') !== record.sha) return { status: 'stale' };
        if (git.push(ref, commit, previous)) return { status: 'updated', commit };
    }
    throw new Error('Stage branch kept changing; retry deployment reconciliation.');
}
