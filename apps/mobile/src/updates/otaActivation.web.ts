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

export function getActiveUpdateIdentity() {
  return {
    updateId: null,
    commit: null,
    isEmbeddedLaunch: true,
    isEmergencyLaunch: false,
  };
}

export async function rememberExpectedOtaUpdate(_expected: ExpectedOtaUpdate) {}
export async function verifyExpectedOtaActivation(): Promise<OtaActivationResult | null> { return null; }
export async function clearExpectedOtaUpdate() {}
export async function getLastOtaActivationResult(): Promise<OtaActivationResult | null> { return null; }
