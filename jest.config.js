module.exports = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/playwright/' // Ignore Playwright tests
  ],
  collectCoverageFrom: ['tests/js/**/*.js'],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
};