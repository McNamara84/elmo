import path from 'node:path';

export const APP_BASE_URL = process.env.CI ? 'http://localhost/elmo/' : 'http://localhost:8080/';

export const SELECTORS = {
  navigation: {
    navbar: '.navbar',
    helpToggle: '#bd-help',
    helpOnButton: '#buttonHelpOn',
    helpOffButton: '#buttonHelpOff',
    languageToggle: '#bd-lang',
    languageMenu: '#bd-lang + ul.dropdown-menu',
  },
  modals: {
    help: '#helpModal',
    feedback: '#modal-feedback',
    notification: '#modal-notification',
    saveAs: '#modal-saveas',
    submit: '#modal-submit',
  },
  formGroups: {
    authors: '#group-author',
    authorInstitution: '#group-authorinstitution',
    contributorPersons: '#group-contributorperson',
    contributorInstitutions: '#group-contributororganisation',
    descriptions: '#group-description',
    freeKeywords: '#group-freekeyword',
    fundingReference: '#group-fundingreference',
    relatedWork: '#group-relatedwork',
    spatialTemporalCoverages: '#group-stc',
  },
};

export const STATIC_ASSET_ROUTE_PATTERNS = [
  '**/node_modules/**',
  '**/js/**',
  '**/*.css',
  '**/*.map',
  '**/*.svg',
];

export const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');