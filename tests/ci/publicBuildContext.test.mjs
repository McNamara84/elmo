import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { auditPublicBuildContext } from '../../scripts/ci/publicBuildContext.mjs';
import { temporaryDirectory } from './deploymentFixtures.mjs';

function context(t) {
    const directory = temporaryDirectory(t);
    for (const name of ['index.php', 'settings.elmo.php', 'docker-entrypoint.sh', 'composer.lock', 'package-lock.json']) {
        writeFileSync(join(directory, name), 'public application input');
    }
    return directory;
}

test('the audited public context contains the application template but no runtime credentials', t => {
    assert.equal(auditPublicBuildContext(context(t)), 5);
});

for (const file of ['settings.php', 'nested/test-settings.php', 'nested/.env.production', 'private/server.key',
    '.aws/credentials', '.git/config', '.docker/config.json', '.npmrc', 'nested/auth.json',
    'tests/fixture.php', 'storage/drafts/private.json', 'vendor/autoload.php']) {
    test(`public context audit rejects ${file}`, t => {
        const directory = context(t);
        mkdirSync(dirname(join(directory, file)), { recursive: true });
        writeFileSync(join(directory, file), 'must never be published');
        assert.throws(() => auditPublicBuildContext(directory), /Private/u);
    });
}

test('symlinks cannot escape the inspected context', t => {
    const directory = context(t), outside = temporaryDirectory(t);
    symlinkSync(outside, join(directory, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => auditPublicBuildContext(directory), /Unsupported/u);
});
