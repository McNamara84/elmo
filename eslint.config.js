const js = require("@eslint/js");
const prettierPlugin = require("eslint-plugin-prettier");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "vendor/**",
      "coverage/**",
      "playwright-report/**",
      "tests/Playwright/**",
      "tests/playwright/**",
      "save/**",
      "*.min.js",
      "**/*.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["js/**/*.js", "doc/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.jquery,
        bootstrap: "readonly",
        Tagify: "readonly",
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-unsafe-optional-chaining": "off",
      "no-prototype-builtins": "off",
      "no-async-promise-executor": "off",
    },
  },
  {
    files: ["tests/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.browser,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["tests/js/functions-esm.test.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.jest,
        ...globals.browser,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  {
    files: ["*.cjs", "*.config.js", "*.config.cjs", "jest.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
];