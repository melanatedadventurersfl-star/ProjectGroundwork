const base = require('./app.json').expo;

const buildCommit =
  process.env.EAS_BUILD_GIT_COMMIT_HASH ||
  process.env.GITHUB_SHA ||
  process.env.EXPO_PUBLIC_GIT_SHA ||
  'local';

// The selected Go Melanated launcher artwork is a complete, finished icon.
// Do not feed that same finished square into Android's adaptive foreground
// layer, because launchers will scale/mask it a second time and can make the
// artwork appear cropped, tiny, or visually replaced by the adaptive mask.
// Android will instead use the canonical icon declared at android.icon.
const android = {
  ...(base.android || {}),
};
delete android.adaptiveIcon;

module.exports = {
  ...base,
  android,
  extra: {
    ...base.extra,
    nativeBuildAssetRevision: 'go-melanated-launcher-v12',
    buildCommit,
    buildTimestamp: process.env.EXPO_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString(),
    buildProfile: process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_BUILD_PROFILE || 'local',
  },
};
