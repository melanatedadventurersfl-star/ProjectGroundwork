// Kept separate to make OTA activation state easy to inspect in diagnostics and tests.
export type OtaActivationStatus = 'activated' | 'mismatch' | 'emergency-launch';
