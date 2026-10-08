const fs = require('fs');
const path = require('path');

let listeners = [];

afterEach(() => {
  listeners.forEach(args => document.removeEventListener(...args));
  listeners = [];
  delete window.authorStack;
  delete window.contributorStack;
});

function loadStack(name) {
  const add = document.addEventListener;
  document.addEventListener = function (...args) {
    listeners.push(args);
    return add.apply(this, args);
  };
  try {
    const source = fs.readFileSync(path.resolve(__dirname, `../../../js/eventhandlers/formgroups/${name}.js`), 'utf8')
      .replace(/^import .*;\s*$/gm, '')
      .replace('$(document).ready(function () {', '(function () {')
      .replace(/\n\}\);\s*$/, '\n})();');
    window.eval(source);
  } finally {
    document.addEventListener = add;
  }
}

function mountAuthorStack(authors) {
  const $ = require('jquery');
  global.$ = global.jQuery = window.$ = window.jQuery = $;
  Object.assign(window, require('../../../js/eventhandlers/functions.js'));
  window.updateHelpStatus = jest.fn();
  if (!window.autocompleteAffiliations) window.autocompleteAffiliations = jest.fn();
  if (!authors) {
    authors = Array.from(document.querySelectorAll('[data-creator-row], #group-author > .row')).map(row => {
      const value = name => row.querySelector(`[name="${name}"]`)?.value || '';
      return { type: 'person', familyname: value('familynames[]'), givenname: value('givennames[]'),
        orcid: value('orcids[]'), isContact: row.querySelector('[name="contacts[]"]')?.checked || false,
        email: value('cpEmail[]'), website: value('cpOnlineResource[]'), affiliations: [] };
    });
  }
  const markup = fs.readFileSync(path.resolve(__dirname, '../../../formgroups/authors.html'), 'utf8')
    .replace(/<\?php[\s\S]*?\?>/g, '');
  document.querySelectorAll('#formgroup-authors, #group-author, #group-authorinstitution, [data-creator-row], [data-authorinstitution-row]').forEach(element => element.remove());
  (document.querySelector('form') || document.body).insertAdjacentHTML('beforeend', markup);
  loadStack('authorStack');
  window.authorStack.setAuthors(authors);
  return window.authorStack;
}

function mountContributorStack(contributors = []) {
  const $ = require('jquery');
  global.$ = global.jQuery = window.$ = window.jQuery = $;
  Object.assign(window, require('../../../js/eventhandlers/functions.js'));
  window.updateHelpStatus = jest.fn();
  const markup = fs.readFileSync(path.resolve(__dirname, '../../../formgroups/contributors.html'), 'utf8')
    .replace(/<\?php[\s\S]*?\?>/g, '');
  document.querySelectorAll('#formgroup-contributors, #group-contributorperson, #group-contributororganisation').forEach(element => element.remove());
  (document.querySelector('form') || document.body).insertAdjacentHTML('beforeend', markup);
  loadStack('contributorStack');
  window.contributorStack.setContributors(contributors);
  return window.contributorStack;
}

module.exports = { mountAuthorStack, mountContributorStack };
