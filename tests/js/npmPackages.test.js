const fs = require('fs');
const path = require('path');
const packageJson = require('../../package.json');

const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

const nodeModulesDir = path.join(__dirname, '..', '..', 'node_modules');

describe('npm packages installation', () => {
  Object.keys(dependencies).forEach((pkg) => {
    test(`package '${pkg}' directory exists`, () => {
      const pkgDir = path.join(nodeModulesDir, pkg);
      expect(fs.existsSync(pkgDir)).toBe(true);
      const stat = fs.lstatSync(pkgDir);
      if (stat.isSymbolicLink()) {
        const realPath = fs.realpathSync(pkgDir);
        expect(fs.existsSync(realPath)).toBe(true);
      }
    });
  });
});