const path = require('path');

function requireFresh(relPath) {
  let mod;
  jest.isolateModules(() => {
    mod = require(path.resolve(__dirname, relPath));
  });
  return mod;
}

module.exports = { requireFresh };