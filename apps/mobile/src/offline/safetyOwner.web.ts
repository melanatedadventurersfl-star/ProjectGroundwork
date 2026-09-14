const OWNER_KEY = 'ma.offlineSafety.owner';
const SAFETY_KEYS = [
  'ma.offlineSafety.eventPacks',
  'ma.offlineSafety.sessions',
  'ma.offlineSafety.breadcrumbs',
  'ma.offlineSafety.queue',
  'ma.offlineSafety.rosterSweep',
  'ma.offlineSafety.hostFieldSnapshots',
] as const;

function storage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function clearKnownSafetyData() {
  const target = storage();
  if (!target) return;
  SAFETY_KEYS.forEach((key) => target.removeItem(key));
}

export async function ensureSafetyOwner(profileId: string) {
  const target = storage();
  if (!target) return;
  const owner = target.getItem(OWNER_KEY);
  if (owner && owner !== profileId) clearKnownSafetyData();
  target.setItem(OWNER_KEY, profileId);
}

export async function clearOfflineSafetyData() {
  const target = storage();
  if (!target) return;
  clearKnownSafetyData();
  target.removeItem(OWNER_KEY);
}
