import Storage from 'expo-sqlite/kv-store';

export type TrailheadFavorites = {
  badges: string[];
  stamps: string[];
};

const PREFIX = 'ma-trailhead-favorites:v1:';
const EMPTY: TrailheadFavorites = { badges: [], stamps: [] };

function keyFor(userId: string | null | undefined) {
  return `${PREFIX}${userId || 'guest'}`;
}

function normalize(values: unknown) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))].slice(0, 3);
}

export async function getTrailheadFavorites(userId: string | null | undefined): Promise<TrailheadFavorites> {
  try {
    const raw = await Storage.getItem(keyFor(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<TrailheadFavorites>;
    return { badges: normalize(parsed.badges), stamps: normalize(parsed.stamps) };
  } catch {
    return EMPTY;
  }
}

export async function saveTrailheadFavorites(userId: string | null | undefined, next: TrailheadFavorites) {
  const normalized = { badges: normalize(next.badges), stamps: normalize(next.stamps) };
  await Storage.setItem(keyFor(userId), JSON.stringify(normalized));
  return normalized;
}

export async function setFavoriteBadges(userId: string | null | undefined, badges: string[]) {
  const current = await getTrailheadFavorites(userId);
  return saveTrailheadFavorites(userId, { ...current, badges });
}

export async function setFavoriteStamps(userId: string | null | undefined, stamps: string[]) {
  const current = await getTrailheadFavorites(userId);
  return saveTrailheadFavorites(userId, { ...current, stamps });
}
