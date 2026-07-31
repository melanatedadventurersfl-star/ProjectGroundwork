const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    rules: {
      // These screens intentionally fetch data when mounted.
      // The async loaders update state after their requests complete.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
