const base = require('./app.json').expo;

const buildCommit =
  process.env.EAS_BUILD_GIT_COMMIT_HASH ||
  process.env.GITHUB_SHA ||
  process.env.EXPO_PUBLIC_GIT_SHA ||
  'local';

const buildNumber =
  process.env.EXPO_PUBLIC_BUILD_NUMBER ||
  process.env.GITHUB_RUN_NUMBER ||
  'local';

function shareHost() {
  try {
    const value = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim();
    if (!value) return null;
    const url = new URL(value);
    return url.protocol === 'https:' ? url.host : null;
  } catch {
    return null;
  }
}

const publicShareHost = shareHost();

// The selected Go Melanated launcher artwork is a complete, finished icon.
// Do not feed that same finished square into Android's adaptive foreground
// layer, because launchers will scale/mask it a second time and can make the
// artwork appear cropped, tiny, or visually replaced by the adaptive mask.
// Android will instead use the canonical icon declared at android.icon.
const android = {
  ...(base.android || {}),
  ...(publicShareHost
    ? {
        intentFilters: [
          ...(base.android?.intentFilters || []),
          {
            action: 'VIEW',
            autoVerify: true,
            data: [{ scheme: 'https', host: publicShareHost, pathPrefix: '/p' }],
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ],
      }
    : {}),
};
delete android.adaptiveIcon;

const ios = {
  ...(base.ios || {}),
  ...(publicShareHost
    ? {
        associatedDomains: [
          ...(base.ios?.associatedDomains || []),
          `applinks:${publicShareHost}`,
        ],
      }
    : {}),
};

module.exports = {
  ...base,
  android,
  ios,
  extra: {
    ...base.extra,
    nativeBuildAssetRevision: 'go-melanated-launcher-v15',
    buildCommit,
    buildNumber,
    buildTimestamp: process.env.EXPO_PUBLIC_BUILD_TIMESTAMP || new Date().toISOString(),
    buildProfile: process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_BUILD_PROFILE || 'local',
    buildSource: process.env.EXPO_PUBLIC_BUILD_SOURCE || 'local',
  },
};
