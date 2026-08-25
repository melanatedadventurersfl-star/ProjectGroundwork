import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

function embeddedExtraValue(key: string) {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function activeManifestExtra() {
  const manifest = Updates.manifest as any;
  const candidates = [
    manifest?.extra?.expoClient?.extra,
    manifest?.extra?.expoGo?.extra,
    manifest?.extra,
  ];
  return candidates.find((value) => value && typeof value === 'object') ?? null;
}

function activeExtraValue(key: string) {
  const activeExtra = activeManifestExtra();
  const value = activeExtra?.[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return embeddedExtraValue(key);
}

export function getBuildInfo() {
  const commit = activeExtraValue('buildCommit');
  const timestamp = activeExtraValue('buildTimestamp');
  const profile = activeExtraValue('buildProfile');
  const source = activeExtraValue('buildSource');
  const ciBuildNumber = activeExtraValue('buildNumber');
  const shortCommit = commit && commit !== 'local' ? commit.slice(0, 7) : commit;

  const embeddedCommit = embeddedExtraValue('buildCommit');
  const embeddedBuildNumber = embeddedExtraValue('buildNumber');

  return {
    appVersion: Constants.nativeAppVersion || Constants.expoConfig?.version || 'Unknown',
    nativeBuildNumber: Constants.nativeBuildVersion || 'Not set',
    ciBuildNumber: ciBuildNumber || 'Not set',
    commit,
    shortCommit,
    timestamp,
    profile,
    source,
    channel: Updates.channel || 'embedded',
    runtimeVersion: Updates.runtimeVersion || 'Unknown',
    updateId: Updates.updateId || null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
    updatesEnabled: Updates.isEnabled,
    embeddedCommit,
    embeddedShortCommit: embeddedCommit && embeddedCommit !== 'local' ? embeddedCommit.slice(0, 7) : embeddedCommit,
    embeddedBuildNumber: embeddedBuildNumber || 'Not set',
    activeSource: Updates.isEmbeddedLaunch ? 'embedded' : 'ota',
  };
}

export function getBuildFingerprint() {
  const info = getBuildInfo();
  const versionPart = `v${info.appVersion}`;
  const nativeBuildPart = info.nativeBuildNumber !== 'Not set' ? `native ${info.nativeBuildNumber}` : '';
  const ciBuildPart = info.ciBuildNumber !== 'Not set' ? `CI ${info.ciBuildNumber}` : '';
  const commitPart = info.shortCommit && info.shortCommit !== 'local' ? info.shortCommit : 'local';
  const sourcePart = info.activeSource === 'ota' ? 'OTA' : 'embedded';
  return [versionPart, nativeBuildPart, ciBuildPart, commitPart, sourcePart].filter(Boolean).join(' · ');
}
