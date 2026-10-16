// Version the imported module too, so an updated renderer cannot reuse a cached copy.
const version = new URL(import.meta.url).searchParams.get('v');
const moduleUrl = version ? `./changelog.js?v=${encodeURIComponent(version)}` : './changelog.js';

import(moduleUrl).then(({ initChangelog }) => initChangelog());
