import test from 'node:test';
import assert from 'node:assert/strict';
import { exportRegistryImage, imageConfigId, requirePublicImage, verifyImageMetadata } from '../../scripts/ci/registryImages.mjs';
import { digest, metadata, record, temporaryDirectory } from './deploymentFixtures.mjs';

const candidate = { ...metadata, repository: 'McNamara84/elmo', sha: 'a'.repeat(40), image: 'ghcr.io/mcnamara84/elmo-web' };
const image = () => ({ Os: 'linux', Architecture: 'amd64', Config: { Labels: {
    'org.opencontainers.image.source': 'https://github.com/McNamara84/elmo',
    'org.opencontainers.image.revision': candidate.sha,
    'org.opencontainers.image.version': candidate.version,
} } });

test('image provenance and the confirmed endpoint architecture must match', () => {
    verifyImageMetadata(image(), candidate, 'web');
    assert.throws(() => verifyImageMetadata({ ...image(), Architecture: 'arm64' }, candidate, 'web'), /AMD64/u);
    for (const key of Object.keys(image().Config.Labels)) {
        const wrong = image(); wrong.Config.Labels[key] = 'unexpected';
        assert.throws(() => verifyImageMetadata(wrong, candidate, 'web'), /provenance/u);
    }
});

test('configuration identity comes from the saved image rather than a containerd index ID', () => {
    const hash = 'b'.repeat(64);
    assert.equal(imageConfigId([{ Config: `blobs/sha256/${hash}` }]), digest('b'));
    assert.equal(imageConfigId([{ Config: `${hash}.json` }]), digest('b'));
    assert.throws(() => imageConfigId([{ Config: `${hash}.json` }, { Config: `${hash}.json` }]), /one exported/u);
    assert.throws(() => imageConfigId([{ Config: '../unrelated' }]), /digest/u);
});

test('every registry command is bound to the exact selected digest', t => {
    const ref = record(candidate.sha).images.web, calls = [];
    const execute = (command, args) => {
        calls.push([command, ...args]);
        if (command === 'tar') return JSON.stringify([{ Config: `${'b'.repeat(64)}.json` }]);
        if (args[0] === 'image') return JSON.stringify([image()]);
        return '';
    };
    const result = exportRegistryImage(ref, candidate, 'web', temporaryDirectory(t), execute);
    assert.equal(result.imageId, digest('b'));
    assert.ok(calls.slice(0, 4).every(call => call.includes(ref)));
    assert.ok(!calls.some(call => call.includes('build') || call.includes('push')));
});

test('missing or inaccessible recorded images stop publication instead of rebuilding', t => {
    const ref = record(candidate.sha).images.web, calls = [];
    assert.throws(() => exportRegistryImage(ref, candidate, 'web', temporaryDirectory(t), (command, args) => {
        calls.push([command, ...args]); throw new Error('manifest unknown');
    }), /manifest unknown/u);
    assert.equal(calls.length, 1);
});

test('mutable refs and unrelated database images are rejected before contacting a registry', t => {
    const fail = () => { throw new Error('Registry must not be contacted'); };
    assert.throws(() => exportRegistryImage(`${candidate.image}:latest`, candidate, 'web', temporaryDirectory(t), fail), /immutable/u);
    assert.throws(() => exportRegistryImage(`mariadb:other@${digest('a')}`, candidate, 'mariadb', temporaryDirectory(t), fail), /immutable/u);
});

test('public visibility is verified with an anonymous token, never a GitHub credential', async () => {
    const ref = record(candidate.sha).images.web, calls = [];
    await requirePublicImage(ref, async (url, options) => {
        calls.push({ url, options });
        return calls.length === 1
            ? { ok: true, json: async () => ({ token: 'anonymous-pull-token' }) }
            : { ok: true, headers: new Headers({ 'docker-content-digest': digest('a') }) };
    });
    assert.equal(calls[0].options.headers, undefined);
    assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer anonymous-pull-token');
    assert.ok(calls[1].url.endsWith(`/manifests/${digest('a')}`));
});

test('private packages and missing or changed manifests cannot become deployment records', async () => {
    const ref = record(candidate.sha).images.web;
    await assert.rejects(requirePublicImage(ref, async () => ({ ok: false })), /visibility to public/u);
    let calls = 0;
    await assert.rejects(requirePublicImage(ref, async () => ++calls === 1
        ? { ok: true, json: async () => ({ token: 'anonymous' }) }
        : { ok: true, headers: new Headers({ 'docker-content-digest': digest('b') }) }), /not publicly/u);
});
