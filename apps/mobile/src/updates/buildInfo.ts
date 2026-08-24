import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

function extraValue(key: string) {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getBuildInfo() {
  const commit = extraValue('buildCommit');
  const timestamp = extraValue('buildTimestamp');
  const profile = extraValue('buildProfile');
  const source = extraValue('buildSource');
  const ciBuildNumber = extraValue('buildNumber');
  const shortCommit = commit && commit !== 'local' ? commit.slice(0, 7) : commit;

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
  };
}

export function getBuildFingerprint() {
  const info = getBuildInfo();
  const versionPart = `v${info.appVersion}`;
  const nativeBuildPart = info.nativeBuildNumber !== 'Not set' ? `native ${info.nativeBuildNumber}` : '';
  const ciBuildPart = info.ciBuildNumber !== 'Not set' ? `CI ${info.ciBuildNumber}` : '';
  const commitPart = info.shortCommit && info.shortCommit !== 'local' ? info.shortCommit : 'local';
  return [versionPart, nativeBuildPart, ciBuildPart, commitPart].filter(Boolean).join(' · ');
}
