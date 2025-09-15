module.exports = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/playwright/' // Ignore Playwright tests
  ],
  collectCoverageFrom: ['js/**/*.js'],
  coverageProvider: 'v8',
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
};