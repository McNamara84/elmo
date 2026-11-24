import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { databasePattern, digestPattern, platform } from './deploymentChecks.mjs';

export async function requirePublicImage(ref, request = fetch) {
    const match = ref.match(/^ghcr\.io\/([a-z0-9_.-]+\/elmo-web)@(sha256:[a-f0-9]{64})$/u);
    if (!match) throw new Error('Expected an immutable GHCR web image.');
    const scope = new URLSearchParams({ service: 'ghcr.io', scope: `repository:${match[1]}:pull` });
    const options = { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(30000) };
    const authorization = await request(`https://ghcr.io/token?${scope}`, options);
    if (!authorization.ok) throw new Error('Set the elmo-web GHCR package visibility to public, then retry this workflow.');
    const token = (await authorization.json()).token;
    if (typeof token !== 'string' || !token) throw new Error('Missing anonymous GHCR pull token.');
    const manifest = await request(`https://ghcr.io/v2/${match[1]}/manifests/${match[2]}`, {
        ...options, method: 'HEAD', signal: AbortSignal.timeout(30000),
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: ['application/vnd.oci.image.index.v1+json', 'application/vnd.oci.image.manifest.v1+json',
                'application/vnd.docker.distribution.manifest.list.v2+json', 'application/vnd.docker.distribution.manifest.v2+json'].join(', '),
        },
    });
    if (!manifest.ok || manifest.headers.get('docker-content-digest') !== match[2]) {
        throw new Error('The exact recorded GHCR digest is not publicly available.');
    }
}

export function imageConfigId(manifest) {
    if (!Array.isArray(manifest) || manifest.length !== 1) throw new Error('Expected exactly one exported image.');
    const path = manifest[0].Config;
    const match = typeof path === 'string' && path.match(/^(?:blobs\/sha256\/)?([a-f0-9]{64})(?:\.json)?$/u);
    if (!match) throw new Error('Invalid exported image configuration digest.');
    return `sha256:${match[1]}`;
}

export function verifyImageMetadata(image, candidate, kind) {
    if (image?.Os !== 'linux' || image?.Architecture !== 'amd64' || candidate.platform !== platform) {
        throw new Error('The image does not match the confirmed Linux/AMD64 endpoint.');
    }
    if (kind === 'web') {
        const labels = image.Config?.Labels ?? {};
        const expected = {
            'org.opencontainers.image.source': `https://github.com/${candidate.repository}`,
            'org.opencontainers.image.revision': candidate.sha,
            'org.opencontainers.image.version': candidate.version,
        };
        for (const [key, value] of Object.entries(expected)) {
            if (labels[key] !== value) throw new Error(`Published image provenance mismatch: ${key}`);
        }
    }
}

/** Pull immutable refs only; a missing recorded manifest never triggers a rebuild. */
export function exportRegistryImage(ref, candidate, kind, directory, execute = execFileSync) {
    const expectedPrefix = `${candidate.image}@`;
    if (kind === 'web' ? !ref.startsWith(expectedPrefix) || !digestPattern.test(ref.slice(expectedPrefix.length))
        : kind !== 'mariadb' || ref !== candidate.database || !databasePattern.test(ref)) {
        throw new Error('Expected the candidate\'s immutable image reference.');
    }
    const run = (command, args) => execute(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    run('docker', ['buildx', 'imagetools', 'inspect', ref]);
    run('docker', ['pull', '--platform', platform, ref]);
    const inspected = JSON.parse(run('docker', ['image', 'inspect', ref]));
    if (inspected.length !== 1) throw new Error('Ambiguous image inspection result.');
    verifyImageMetadata(inspected[0], candidate, kind);
    mkdirSync(directory, { recursive: true });
    const archive = join(directory, 'image.tar');
    run('docker', ['save', '--output', archive, ref]);
    const imageId = imageConfigId(JSON.parse(run('tar', ['-xOf', archive, 'manifest.json'])));
    return { archive, imageId };
}
