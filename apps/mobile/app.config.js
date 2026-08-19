const base = require('./app.json').expo;

const buildCommit =
  process.env.EAS_BUILD_GIT_COMMIT_HASH ||
  process.env.GITHUB_SHA ||
  process.env.EXPO_PUBLIC_GIT_SHA ||
  'local';

module.exports = {
  expo: {
    ...base,
    extra: {
      ...base.extra,
      buildCommit,
      buildTimestamp: process.env.EXPO_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString(),
      buildProfile: process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_BUILD_PROFILE || 'local',
    },
  },
};
