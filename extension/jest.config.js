/**
 * Jest configuration for SEO & GEO Optimizer extension tests.
 *
 * Uses jsdom to simulate a browser environment.
 * Tests are located in extension/tests/ directory.
 */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
};
