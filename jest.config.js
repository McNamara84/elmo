module.exports = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/playwright/' // Ignore Playwright tests
  ],
  collectCoverageFrom: [
    'js/**/*.js',
    // Exclude ES-Module files (use 'import' statements - not testable with CommonJS/Jest)
    '!js/validation.js',
    '!js/eventhandlers/buttons.js',
    '!js/eventhandlers/formgroups/author.js',
    '!js/eventhandlers/formgroups/authorInstitution.js',
    '!js/eventhandlers/formgroups/contributor-organisation.js',
    '!js/eventhandlers/formgroups/contributor-person.js',
    '!js/eventhandlers/formgroups/fundingreference.js',
    '!js/eventhandlers/formgroups/ggms-datasources.js',
    '!js/eventhandlers/formgroups/relatedwork.js',
    '!js/eventhandlers/formgroups/resourceinformation-title.js',
    '!js/eventhandlers/formgroups/stc.js',
    // Exclude jQuery-only files wrapped in $(document).ready() without exports
    '!js/map.js',
    '!js/thesauri.js',
    '!js/originatingLaboratories.js',
    // Exclude GGMS files (feature-specific, wrapped in document.ready)
    '!js/eventhandlers/formgroups/ggms-definition.js',
    '!js/eventhandlers/formgroups/ggms-modeltypes.js',
    '!js/eventhandlers/formgroups/ggms-properties.js',
    '!js/eventhandlers/formgroups/feedback.js'
  ],
  coverageProvider: 'v8',
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
};