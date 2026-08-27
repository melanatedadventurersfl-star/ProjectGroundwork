const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    rules: {
      // These screens intentionally fetch data when mounted.
      // The async loaders update state after their requests complete.
      'react-hooks/set-state-in-effect': 'off',
      // Expo's current React Compiler lint flags existing callback dependency
      // narrowing in Trailhead/Explore as an optimization warning. Keep it
      // visible without blocking validation while those callbacks are cleaned up.
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    files: ['src/onboarding/GuidedOnboardingExperience.tsx', 'app/trail-guide/ask.tsx'],
    rules: {
      // These user-facing screens intentionally contain contractions/apostrophes
      // in JSX copy. Keep punctuation from blocking mobile validation.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
