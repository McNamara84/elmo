import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const privateDirectories = new Set([
    '.git', '.hg', '.svn', '.ssh', '.aws', '.docker', '.codex', '.agents', '.github',
    '.tmp', 'tmp', 'temp', 'tests', 'debug', 'vendor', 'node_modules', 'storage',
    'coverage', 'playwright-report', 'test-results', 'xml',
]);

/** Inspect the context Docker actually exported, then use that exact tree to build. */
export function auditPublicBuildContext(root) {
    let files = 0;
    function visit(directory, relative = '') {
        for (const name of readdirSync(directory)) {
            const path = join(directory, name);
            const logical = relative ? `${relative}/${name}` : name;
            const info = lstatSync(path);
            const lower = name.toLowerCase();
            if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) throw new Error(`Unsupported public context entry: ${logical}`);
            if (privateDirectories.has(lower) || lower.startsWith('.env')
                || /^(?:settings|test-settings)\.php$/u.test(lower)
                || ['.npmrc', '.netrc', '.pypirc', '.git-credentials', '.dockercfg', 'auth.json'].includes(lower)
                || lower === 'playwright-variant-lock.php'
                || /\.(?:pem|key|crt|p12|pfx|sql|log|tmp)$/u.test(lower)) {
                throw new Error(`Private, generated, or host-only file in public build context: ${logical}`);
            }
            if (info.isDirectory()) visit(path, logical);
            else files++;
        }
    }
    visit(root);
    for (const path of ['index.php', 'settings.elmo.php', 'docker-entrypoint.sh', 'composer.lock', 'package-lock.json']) {
        if (!lstatSync(join(root, path)).isFile()) throw new Error(`Missing application build input: ${path}`);
    }
    return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    console.log(`Validated ${auditPublicBuildContext(process.argv[2])} public build context files.`);
}
