module.exports = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/playwright/' // Ignore Playwright tests
  ],
};