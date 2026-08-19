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
  const shortCommit = commit && commit !== 'local' ? commit.slice(0, 7) : commit;

  return {
    appVersion: Constants.nativeAppVersion || Constants.expoConfig?.version || 'Unknown',
    buildNumber: Constants.nativeBuildVersion || 'Not set',
    commit,
    shortCommit,
    timestamp,
    profile,
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
  const buildPart = info.buildNumber !== 'Not set' ? `(${info.buildNumber})` : '';
  const commitPart = info.shortCommit && info.shortCommit !== 'local' ? info.shortCommit : 'local';
  return [versionPart, buildPart, commitPart].filter(Boolean).join(' · ');
}
