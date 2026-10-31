// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const jestGlobals = Object.fromEntries(['jest', 'test', 'it', 'describe', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'].map((g) => [g, 'readonly']));

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'android/*', 'ios/*'] },
  // A web (HTML) rule: apostrophes in React Native <Text> are plain text, nothing to escape.
  { rules: { 'react/no-unescaped-entities': 'off' } },
  // Tests, and the helpers only tests use (*.testkit.js), run in Jest on Node.
  { files: ['**/*.test.js', '**/*.testkit.js'], languageOptions: { globals: { ...jestGlobals, __dirname: 'readonly' } } },
]);
