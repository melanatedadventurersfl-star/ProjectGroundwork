import Storage from 'expo-sqlite/kv-store';
import * as Updates from 'expo-updates';

const EXPECTED_UPDATE_KEY = 'go-melanated:expected-ota-update';
const LAST_ACTIVATION_RESULT_KEY = 'go-melanated:last-ota-activation-result';

export type ExpectedOtaUpdate = {
  updateId: string | null;
  commit: string | null;
  createdAt: string;
};

export type OtaActivationResult = {
  status: 'activated' | 'mismatch' | 'emergency-launch';
  expected: ExpectedOtaUpdate;
  activeUpdateId: string | null;
  activeCommit: string | null;
  checkedAt: string;
};

function manifestCommit() {
  const manifest = Updates.manifest as any;
  const candidates = [
    manifest?.extra?.expoClient?.extra,
    manifest?.extra?.expoGo?.extra,
    manifest?.extra,
  ];
  const extra = candidates.find((value) => value && typeof value === 'object');
  const value = extra?.buildCommit;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getActiveUpdateIdentity() {
  return {
    updateId: Updates.updateId ?? null,
    commit: manifestCommit(),
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
  };
}

export async function rememberExpectedOtaUpdate(expected: ExpectedOtaUpdate) {
  await Storage.setItem(EXPECTED_UPDATE_KEY, JSON.stringify(expected));
}

export async function verifyExpectedOtaActivation() {
  const raw = await Storage.getItem(EXPECTED_UPDATE_KEY);
  if (!raw) return null;

  let expected: ExpectedOtaUpdate;
  try {
    expected = JSON.parse(raw) as ExpectedOtaUpdate;
  } catch {
    await Storage.removeItem(EXPECTED_UPDATE_KEY);
    return null;
  }

  const active = getActiveUpdateIdentity();
  const matchesUpdateId = Boolean(expected.updateId && active.updateId && expected.updateId === active.updateId);
  const matchesCommit = Boolean(expected.commit && active.commit && expected.commit === active.commit);
  const activated = matchesUpdateId || matchesCommit;

  const result: OtaActivationResult = {
    status: active.isEmergencyLaunch ? 'emergency-launch' : activated ? 'activated' : 'mismatch',
    expected,
    activeUpdateId: active.updateId,
    activeCommit: active.commit,
    checkedAt: new Date().toISOString(),
  };

  await Storage.setItem(LAST_ACTIVATION_RESULT_KEY, JSON.stringify(result));
  if (activated) {
    await Storage.removeItem(EXPECTED_UPDATE_KEY);
  }

  return result;
}

export async function clearExpectedOtaUpdate() {
  await Storage.removeItem(EXPECTED_UPDATE_KEY);
}

export async function getLastOtaActivationResult() {
  const raw = await Storage.getItem(LAST_ACTIVATION_RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtaActivationResult;
  } catch {
    return null;
  }
}
