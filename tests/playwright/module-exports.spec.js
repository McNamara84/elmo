import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, '../../js');

function createStub() {
  return new Proxy(function () {}, {
    get: (_target, prop) => {
      if (prop === 'length') return 0;
      if (prop === 'classList') return { add() {}, remove() {} };
      return createStub();
    },
    apply: () => createStub(),
  });
}

async function checkModule(file, className) {
  const dummy = createStub();
  global.document = {
    getElementById: () => dummy,
    querySelector: () => dummy,
  };
  global.$ = () => dummy;
  global.bootstrap = { Modal: class {} };
  global.translations = {
    dates: { embargoDateError: '' },
    coverage: { endDateError: '' },
  };
  global.applyTranslations = () => {};

  const code = await fs.readFile(file, 'utf8');
  const url = `data:text/javascript,${encodeURIComponent(code)}`;
  const mod = await import(url);
  return !!(
    mod.default &&
    mod[className] &&
    mod.validateEmbargoDate &&
    mod.validateTemporalCoverage &&
    mod.validateContactPerson
  );
}

test.describe('module export compatibility', () => {
  test('saveHandler provides default and named exports', async () => {
    const ok = await checkModule(path.join(baseDir, 'saveHandler.js'), 'SaveHandler');
    expect(ok).toBe(true);
  });

  test('submitHandler provides default and named exports', async () => {
    const ok = await checkModule(path.join(baseDir, 'submitHandler.js'), 'SubmitHandler');
    expect(ok).toBe(true);
  });
});